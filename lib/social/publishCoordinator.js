// lib/social/publishCoordinator.js
import {
  PLATFORMS,
  ALL_PLATFORMS,
  DESTINATIONS,
  ALL_DESTINATIONS,
  ALL_CONFIGURED_DESTINATIONS,
  canonicalizeDestination,
  canonicalizeDestinations,
  PUBLISH_STATUS,
  BLOCKED_STATUSES,
} from "./types.js";
import { getSocialConfig, redactSecrets } from "./config.js";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getPostState,
  savePostState,
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

import { getPrepareState, PREPARE_STAGES } from "./prepareStateHelper.js";
import { QUALITY_GATE_STATUS } from "./quality/socialQualityGate.js";

/**
 * Creates default platform/destination adapter instances.
 * @returns {Record<string, object>}
 */
export function createDefaultAdapters() {
  return {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: new InstagramAdapter({
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      getAccountId: (c) => c.instagramAccountId,
      getAccessToken: (c) => c.metaPageAccessToken,
      getApiVersion: (c) => c.metaGraphApiVersion,
    }),
    [DESTINATIONS.FACEBOOK_PRIMARY]: new FacebookAdapter({
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      getPageId: (c) => c.metaPageId,
      getAccessToken: (c) => c.metaPageAccessToken,
      getApiVersion: (c) => c.metaGraphApiVersion,
    }),
    [DESTINATIONS.INSTAGRAM_SECONDARY]: new InstagramAdapter({
      name: DESTINATIONS.INSTAGRAM_SECONDARY,
      getAccountId: (c) => c.lifemodeInstagramAccountId,
      getAccessToken: (c) => c.lifemodeMetaPageAccessToken,
      getApiVersion: (c) => c.lifemodeMetaGraphApiVersion || c.metaGraphApiVersion,
    }),
    [DESTINATIONS.FACEBOOK_SECONDARY]: new FacebookAdapter({
      name: DESTINATIONS.FACEBOOK_SECONDARY,
      getPageId: (c) => c.lifemodeMetaPageId,
      getAccessToken: (c) => c.lifemodeMetaPageAccessToken,
      getApiVersion: (c) => c.lifemodeMetaGraphApiVersion || c.metaGraphApiVersion,
    }),
    [DESTINATIONS.PINTEREST]: new PinterestAdapter(),

    // Backward-compatibility aliases for legacy platform identifiers
    [PLATFORMS.INSTAGRAM]: new InstagramAdapter({
      name: DESTINATIONS.INSTAGRAM_PRIMARY,
      getAccountId: (c) => c.instagramAccountId,
      getAccessToken: (c) => c.metaPageAccessToken,
      getApiVersion: (c) => c.metaGraphApiVersion,
    }),
    [PLATFORMS.FACEBOOK]: new FacebookAdapter({
      name: DESTINATIONS.FACEBOOK_PRIMARY,
      getPageId: (c) => c.metaPageId,
      getAccessToken: (c) => c.metaPageAccessToken,
      getApiVersion: (c) => c.metaGraphApiVersion,
    }),
  };
}

/**
 * Resolves an adapter from the adapter map using canonical or legacy keys.
 * @param {Record<string, object>} adapters
 * @param {string} platform
 * @returns {object|null}
 */
export function resolveAdapter(adapters, platform) {
  if (!adapters || typeof adapters !== "object") return null;
  if (adapters[platform]) return adapters[platform];
  const canonical = canonicalizeDestination(platform);
  if (adapters[canonical]) return adapters[canonical];
  if (platform === DESTINATIONS.INSTAGRAM_PRIMARY && adapters[PLATFORMS.INSTAGRAM]) {
    return adapters[PLATFORMS.INSTAGRAM];
  }
  if (platform === DESTINATIONS.FACEBOOK_PRIMARY && adapters[PLATFORMS.FACEBOOK]) {
    return adapters[PLATFORMS.FACEBOOK];
  }
  return null;
}

/**
 * Main coordinator for automated social publication.
 * @param {object} params
 * @param {object} [params.redis] - Upstash Redis client instance
 * @param {object} [params.config] - Social config overrides
 * @param {string} [params.targetDate] - Target publish date (YYYY-MM-DD)
 * @param {object} [params.manifest] - Pre-loaded manifest override
 * @param {Array<object>} [params.manifestRegistry] - Static manifest registry
 * @param {string[]} [params.platforms] - Target platforms/destinations (default: all 4 Meta destinations)
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
  platforms: requestedPlatforms = null,
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

  // 3.5 Fail-Closed Production Quality Gate Hard Block
  // NO provider write may occur unless BOTH authoritative preparation state
  // and manifest quality metadata confirm QUALITY_GATE_PASS.
  const prepState = redis ? await getPrepareState(redis, publishDate) : null;
  const statePassed = prepState?.stage === PREPARE_STAGES.QUALITY_GATE_PASS;
  const manifestPassed = manifest?.metadata?.qualityGate === QUALITY_GATE_STATUS.PASS;
  const isQualityGatePassed = statePassed && manifestPassed;

  if (!isQualityGatePassed) {
    return {
      success: false,
      status: "QUALITY_GATE_BLOCKED",
      message: `Publication blocked: Quality gate state is '${prepState?.stage || "ABSENT"}' (manifest: '${manifest?.metadata?.qualityGate || "ABSENT"}'), expected '${PREPARE_STAGES.QUALITY_GATE_PASS}'. Zero provider writes committed.`,
      date: publishDate,
      qualityGateStage: prepState?.stage || null,
      manifestQualityGate: manifest?.metadata?.qualityGate || null,
      dryRun,
    };
  }

  // Canonicalize and filter valid requested destinations
  const rawPlatforms = requestedPlatforms !== null && requestedPlatforms !== undefined
    ? (Array.isArray(requestedPlatforms) ? requestedPlatforms : [requestedPlatforms])
    : (customAdapters ? Object.keys(customAdapters) : ALL_DESTINATIONS);

  const canonicalRequested = canonicalizeDestinations(rawPlatforms);
  const targetPlatforms = canonicalRequested.filter(p =>
    ALL_CONFIGURED_DESTINATIONS.includes(p) || Boolean(resolveAdapter(adapters, p))
  );

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
      const canonicalKey = canonicalizeDestination(platform);
      const pState = platformStates[canonicalKey] || platformStates[platform];
      const status = pState?.status;

      if (status === PUBLISH_STATUS.PUBLISHED) {
        const skipEntry = {
          status: PUBLISH_STATUS.PUBLISHED,
          postId: pState.postId,
          publishedAt: pState.publishedAt,
          reason: "ALREADY_PUBLISHED",
        };
        skippedPlatforms[canonicalKey] = skipEntry;
        skippedPlatforms[platform] = skipEntry;
        if (canonicalKey === DESTINATIONS.INSTAGRAM_PRIMARY) {
          skippedPlatforms[PLATFORMS.INSTAGRAM] = skipEntry;
        }
        if (canonicalKey === DESTINATIONS.FACEBOOK_PRIMARY) {
          skippedPlatforms[PLATFORMS.FACEBOOK] = skipEntry;
        }
      } else if (status === PUBLISH_STATUS.RECONCILIATION_REQUIRED) {
        const skipEntry = {
          status: PUBLISH_STATUS.RECONCILIATION_REQUIRED,
          reason: "AMBIGUOUS_STATE_RECONCILIATION_REQUIRED",
          reconciliationData: pState.reconciliationData,
        };
        skippedPlatforms[canonicalKey] = skipEntry;
        skippedPlatforms[platform] = skipEntry;
        if (canonicalKey === DESTINATIONS.INSTAGRAM_PRIMARY) {
          skippedPlatforms[PLATFORMS.INSTAGRAM] = skipEntry;
        }
        if (canonicalKey === DESTINATIONS.FACEBOOK_PRIMARY) {
          skippedPlatforms[PLATFORMS.FACEBOOK] = skipEntry;
        }
      } else {
        eligiblePlatforms.push(canonicalKey);
      }
    }

    // If all target destinations are already published or blocked, return cleanly
    if (eligiblePlatforms.length === 0) {
      return {
        success: true,
        status: "ALL_PLATFORMS_SKIPPED",
        publishDate,
        manifestId: manifest.id,
        skipped: skippedPlatforms,
        results: {},
        overallStatus: currentState ? calculateOverallStatus(currentState.platforms, targetPlatforms) : PUBLISH_STATUS.PUBLISHED,
      };
    }

    // 7. Mark Eligible Destinations as IN_PROGRESS in Redis
    for (const platform of eligiblePlatforms) {
      await updatePlatformState(
        redis,
        publishDate,
        platform,
        { status: PUBLISH_STATUS.IN_PROGRESS },
        manifest.id
      );
    }

    // 8. Execute Destination Adapters Concurrently via Promise.allSettled
    const executionPromises = eligiblePlatforms.map(async (platform) => {
      const adapter = resolveAdapter(adapters, platform);
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
            error: adapter.sanitizeError ? adapter.sanitizeError(adapterErr, null) : { message: adapterErr.message },
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
        const canonicalKey = canonicalizeDestination(platform);
        platformResults[canonicalKey] = result;
        platformResults[platform] = result;
        if (canonicalKey === DESTINATIONS.INSTAGRAM_PRIMARY) {
          platformResults[PLATFORMS.INSTAGRAM] = result;
        }
        if (canonicalKey === DESTINATIONS.FACEBOOK_PRIMARY) {
          platformResults[PLATFORMS.FACEBOOK] = result;
        }

        await updatePlatformState(
          redis,
          publishDate,
          canonicalKey,
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
    const overallStatus = finalState
      ? calculateOverallStatus(finalState.platforms, targetPlatforms)
      : calculateOverallStatus(platformResults, targetPlatforms);

    if (finalState && finalState.overallStatus !== overallStatus) {
      finalState.overallStatus = overallStatus;
      await savePostState(redis, publishDate, finalState);
    }

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
    const adapter = resolveAdapter(adapters, platform);
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

