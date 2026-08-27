// lib/social/publishCoordinator.js
import {
  PLATFORMS,
  ALL_PLATFORMS,
  PUBLISH_STATUS,
  BLOCKED_STATUSES,
} from "./types.js";
import { getSocialConfig, redactSecrets } from "./config.js";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getPostState,
  updatePlatformState,
  calculateOverallStatus,
} from "./stateHelper.js";
import {
  getDateInTimeZone,
  validateManifest,
  resolveManifestForDate,
} from "./contentManifest.js";
import { InstagramAdapter } from "./adapters/instagramAdapter.js";
import { FacebookAdapter } from "./adapters/facebookAdapter.js";
import { PinterestAdapter } from "./adapters/pinterestAdapter.js";

/**
 * Creates default platform adapter instances.
 * @returns {Record<string, object>}
 */
export function createDefaultAdapters() {
  return {
    [PLATFORMS.INSTAGRAM]: new InstagramAdapter(),
    [PLATFORMS.FACEBOOK]: new FacebookAdapter(),
    [PLATFORMS.PINTEREST]: new PinterestAdapter(),
  };
}

/**
 * Main coordinator for automated social publication.
 * @param {object} params
 * @param {object} [params.redis] - Upstash Redis client instance
 * @param {object} [params.config] - Social config overrides
 * @param {string} [params.targetDate] - Target publish date (YYYY-MM-DD)
 * @param {object} [params.manifest] - Pre-loaded manifest override
 * @param {Array<object>} [params.manifestRegistry] - Static manifest registry
 * @param {string[]} [params.platforms] - Target platforms (default: all)
 * @param {boolean} [params.isCanary=false] - If true, allows publishing even if autoPublishEnabled is false
 * @param {boolean} [params.dryRun=false] - If true, validates and tests read-only; zero write calls
 * @param {Function} [params.fetchFn=fetch] - HTTP fetch abstraction
 * @param {Record<string, object>} [params.adapters] - Adapter map injection
 * @returns {Promise<object>}
 */
export async function executeSocialPublishing({
  redis = null,
  config: configOverrides = {},
  targetDate = null,
  manifest: manifestOverride = null,
  manifestRegistry = null,
  platforms: requestedPlatforms = ALL_PLATFORMS,
  isCanary = false,
  dryRun = false,
  fetchFn = fetch,
  adapters: customAdapters = null,
} = {}) {
  const config = getSocialConfig(configOverrides);
  const adapters = customAdapters || createDefaultAdapters();

  // 1. Safety Kill-Switch Guard
  if (!config.autoPublishEnabled && !isCanary) {
    return {
      success: false,
      status: "SKIPPED_AUTO_PUBLISH_DISABLED",
      message: "SOCIAL_AUTO_PUBLISH_ENABLED is false; automated publishing is disabled.",
      date: targetDate || getDateInTimeZone(new Date(), config.timeZone),
      dryRun,
    };
  }

  // 2. Resolve Target Date in Configured TimeZone
  const publishDate = targetDate || getDateInTimeZone(new Date(), config.timeZone);

  // 3. Resolve & Validate Content Manifest
  let manifest = manifestOverride;
  if (!manifest) {
    manifest = await resolveManifestForDate(publishDate, {
      redis,
      manifestRegistry,
      mediaBaseUrl: config.mediaBaseUrl,
    });
  }

  if (!manifest) {
    return {
      success: false,
      status: "MISSING_MANIFEST",
      message: `No content manifest found for date ${publishDate}`,
      date: publishDate,
      dryRun,
    };
  }

  const manifestValidation = validateManifest(manifest, { mediaBaseUrl: config.mediaBaseUrl });
  if (!manifestValidation.valid) {
    return {
      success: false,
      status: "INVALID_MANIFEST",
      message: `Manifest validation failed for date ${publishDate}`,
      errors: manifestValidation.errors,
      date: publishDate,
      dryRun,
    };
  }

  // Filter valid requested platforms
  const targetPlatforms = requestedPlatforms.filter(p => ALL_PLATFORMS.includes(p));
  if (targetPlatforms.length === 0) {
    return {
      success: false,
      status: "NO_VALID_PLATFORMS",
      message: "No valid platforms requested for publication",
      date: publishDate,
    };
  }

  // 4. Handle Dry-Run Mode (Read-Only Validation & Zero Write Operations)
  if (dryRun) {
    return await executeDryRun({
      manifest,
      config,
      targetPlatforms,
      adapters,
      redis,
      fetchFn,
      publishDate,
    });
  }

  // 5. Acquire Atomic Distributed Lock
  const lockResult = await acquireDistributedLock(redis, publishDate);
  if (!lockResult.acquired) {
    return {
      success: false,
      status: "LOCK_CONTENTION",
      message: `Could not acquire lock for date ${publishDate}: ${lockResult.reason}`,
      lockKey: lockResult.lockKey,
      date: publishDate,
    };
  }

  const lockOwnerId = lockResult.lockOwnerId;

  try {
    // 6. Read Existing Post State for Idempotency Guard
    const currentState = await getPostState(redis, publishDate);
    const platformStates = currentState?.platforms || {};

    const eligiblePlatforms = [];
    const skippedPlatforms = {};

    for (const platform of targetPlatforms) {
      const pState = platformStates[platform];
      const status = pState?.status;

      if (status === PUBLISH_STATUS.PUBLISHED) {
        skippedPlatforms[platform] = {
          status: PUBLISH_STATUS.PUBLISHED,
          postId: pState.postId,
          publishedAt: pState.publishedAt,
          reason: "ALREADY_PUBLISHED",
        };
      } else if (status === PUBLISH_STATUS.RECONCILIATION_REQUIRED) {
        skippedPlatforms[platform] = {
          status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
          reason: "AMBIGUOUS_STATE_RECONCILIATION_REQUIRED",
          reconciliationData: pState.reconciliationData,
        };
      } else {
        eligiblePlatforms.push(platform);
      }
    }

    // If all target platforms are already published or blocked, return cleanly
    if (eligiblePlatforms.length === 0) {
      return {
        success: true,
        status: "ALL_PLATFORMS_SKIPPED",
        publishDate,
        manifestId: manifest.id,
        skipped: skippedPlatforms,
        results: {},
        overallStatus: currentState ? calculateOverallStatus(currentState.platforms) : PUBLISH_STATUS.PUBLISHED,
      };
    }

    // 7. Mark Eligible Platforms as IN_PROGRESS in Redis
    for (const platform of eligiblePlatforms) {
      await updatePlatformState(
        redis,
        publishDate,
        platform,
        { status: PUBLISH_STATUS.IN_PROGRESS },
        manifest.id
      );
    }

    // 8. Execute Platform Adapters Concurrently via Promise.allSettled
    const executionPromises = eligiblePlatforms.map(async (platform) => {
      const adapter = adapters[platform];
      if (!adapter) {
        return {
          platform,
          result: {
            success: false,
            status: PUBLISH_STATUS.FAILED,
            error: { message: `No adapter registered for platform: ${platform}` },
          },
        };
      }

      try {
        const result = await adapter.publish({
          manifest,
          config,
          redis,
          fetchFn,
        });
        return { platform, result };
      } catch (adapterErr) {
        return {
          platform,
          result: {
            success: false,
            status: PUBLISH_STATUS.FAILED,
            error: adapter.sanitizeError(adapterErr, null),
          },
        };
      }
    });

    const settledResults = await Promise.allSettled(executionPromises);
    const platformResults = {};

    // 9. Process & Persist Results Immediately in Redis
    for (const settled of settledResults) {
      if (settled.status === "fulfilled") {
        const { platform, result } = settled.value;
        platformResults[platform] = result;

        await updatePlatformState(
          redis,
          publishDate,
          platform,
          {
            status: result.status,
            postId: result.postId || null,
            containerId: result.containerId || null,
            publishedAt: result.publishedAt || null,
            error: result.error || null,
            reconciliationData: result.reconciliationData || null,
            incrementAttempt: true,
          },
          manifest.id
        );
      } else {
        // Unhandled promise rejection safety net
        console.error("❌ Unexpected rejection in publishCoordinator:", settled.reason);
      }
    }

    const finalState = await getPostState(redis, publishDate);
    const overallStatus = finalState ? calculateOverallStatus(finalState.platforms) : "UNKNOWN";

    return {
      success: overallStatus === PUBLISH_STATUS.PUBLISHED || overallStatus === "PARTIAL_SUCCESS",
      status: overallStatus,
      publishDate,
      manifestId: manifest.id,
      results: platformResults,
      skipped: skippedPlatforms,
    };

  } finally {
    // 10. Atomically Release Distributed Lock Owned by Current Invocation
    await releaseDistributedLock(redis, publishDate, lockOwnerId);
  }
}

/**
 * Executes read-only dry-run checks. Performs zero write operations.
 */
async function executeDryRun({
  manifest,
  config,
  targetPlatforms,
  adapters,
  redis,
  fetchFn,
  publishDate,
}) {
  const mediaChecks = [];
  for (const item of manifest.media) {
    try {
      const headRes = await fetchFn(item.url, { method: "HEAD" }).catch(() => null);
      mediaChecks.push({
        url: item.url,
        reachable: Boolean(headRes && (headRes.ok || headRes.status === 200)),
        status: headRes?.status || "UNREACHABLE",
      });
    } catch (headErr) {
      mediaChecks.push({
        url: item.url,
        reachable: false,
        error: headErr.message,
      });
    }
  }

  const credentialChecks = {};
  for (const platform of targetPlatforms) {
    const adapter = adapters[platform];
    if (adapter && typeof adapter.checkHealth === "function") {
      try {
        const health = await adapter.checkHealth({ config, redis, fetchFn });
        credentialChecks[platform] = {
          valid: health.healthy,
          details: health.details || null,
          error: health.error ? redactSecrets(health.error) : null,
        };
      } catch (healthErr) {
        credentialChecks[platform] = {
          valid: false,
          error: redactSecrets(healthErr.message || String(healthErr)),
        };
      }
    }
  }

  return {
    success: true,
    dryRun: true,
    publishDate,
    manifestId: manifest.id,
    manifestType: manifest.type,
    targetPlatforms,
    mediaChecks,
    credentialChecks,
    summary: "Dry-run validation complete. Zero write operations performed.",
  };
}
