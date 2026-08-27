// api/cron/canarySocialPublish.js
import { Redis } from "@upstash/redis";
import { executeSocialPublishing, createDefaultAdapters } from "../../lib/social/publishCoordinator.js";
import { getSocialConfig, getSanitizedConfigView, redactSecrets } from "../../lib/social/config.js";
import { getPinterestTokenState } from "../../lib/social/stateHelper.js";
import { PLATFORMS, ALL_PLATFORMS } from "../../lib/social/types.js";

export const maxDuration = 60;

function getRedisClient() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

/**
 * Manual canary & diagnostic testing endpoint for social publishing.
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const config = getSocialConfig();

  // 1. Authenticate Request
  const authHeader = req.headers.authorization || "";
  const expectedAuth = config.cronSecret ? `Bearer ${config.cronSecret}` : null;

  if (!expectedAuth || authHeader !== expectedAuth) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Invalid or missing authorization header",
    });
  }

  const query = req.query || {};
  const redis = getRedisClient();

  // 2. Handle Action: Token Health Inspection
  if (query.action === "tokenHealth") {
    try {
      const adapters = createDefaultAdapters();
      const healthResults = {};

      for (const platform of ALL_PLATFORMS) {
        const adapter = adapters[platform];
        if (adapter && typeof adapter.checkHealth === "function") {
          const health = await adapter.checkHealth({ config, redis });
          healthResults[platform] = {
            healthy: health.healthy,
            details: health.details || null,
            error: health.error ? redactSecrets(health.error) : null,
          };
        }
      }

      // Read Pinterest token state metadata from Redis
      const pinState = await getPinterestTokenState(redis, config);
      const pinTokenInfo = {
        source: pinState.source,
        hasAccessToken: Boolean(pinState.accessToken),
        hasRefreshToken: Boolean(pinState.refreshToken),
        expiresAt: pinState.expiresAt ? new Date(pinState.expiresAt).toISOString() : null,
        refreshTokenExpiresAt: pinState.refreshTokenExpiresAt ? new Date(pinState.refreshTokenExpiresAt).toISOString() : null,
        accessTier: config.pinterestAccessTier,
      };

      return res.status(200).json({
        success: true,
        action: "tokenHealth",
        configView: getSanitizedConfigView(config),
        platforms: healthResults,
        pinterestTokenInfo: pinTokenInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (healthErr) {
      return res.status(500).json({
        error: "health_check_failed",
        message: redactSecrets(healthErr.message || String(healthErr)),
      });
    }
  }

  // 3. Handle Publishing / Dry-Run Invocations
  const isDryRun = query.dryRun === "true" || query.dryRun === true;
  const targetDate = query.date ? String(query.date).trim() : null;
  const requestedPlatform = query.platform ? String(query.platform).trim().toLowerCase() : null;

  const platforms = requestedPlatform && ALL_PLATFORMS.includes(requestedPlatform)
    ? [requestedPlatform]
    : ALL_PLATFORMS;

  try {
    const result = await executeSocialPublishing({
      redis,
      targetDate,
      platforms,
      isCanary: true, // Canary allows execution even if autoPublishEnabled is false
      dryRun: isDryRun,
    });

    const sanitizedResult = redactSecrets(result);
    return res.status(200).json(sanitizedResult);
  } catch (error) {
    console.error("❌ Error in canarySocialPublish endpoint:", error.message || error);
    return res.status(500).json({
      error: "canary_execution_failed",
      message: redactSecrets(error.message || String(error)),
    });
  }
}
