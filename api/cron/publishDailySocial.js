// api/cron/publishDailySocial.js
import { Redis } from "@upstash/redis";
import { executeSocialPublishing } from "../../lib/social/publishCoordinator.js";
import { getSocialConfig, redactSecrets } from "../../lib/social/config.js";
import { PLATFORMS } from "../../lib/social/types.js";

export const maxDuration = 60;

/**
 * Helper to get the active Redis client for social publishing.
 */
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
 * Daily scheduled serverless cron handler for social publishing.
 */
export default async function handler(req, res) {
  // Allow GET and POST for cron invocations
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const config = getSocialConfig();

  // 1. Authenticate Request via CRON_SECRET
  const authHeader = req.headers.authorization || "";
  const expectedAuth = config.cronSecret ? `Bearer ${config.cronSecret}` : null;

  if (!expectedAuth || authHeader !== expectedAuth) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Invalid or missing authorization header",
    });
  }

  // 2. Verify Auto Publish Kill-Switch
  if (!config.autoPublishEnabled) {
    return res.status(200).json({
      success: false,
      status: "SKIPPED_AUTO_PUBLISH_DISABLED",
      message: "SOCIAL_AUTO_PUBLISH_ENABLED is false; automated publishing is disabled.",
      timestamp: new Date().toISOString(),
    });
  }

  // 3. Execute Social Publishing Pipeline (Production cron targets Instagram & Facebook only)
  try {
    const redis = getRedisClient();
    const result = await executeSocialPublishing({
      redis,
      platforms: [PLATFORMS.INSTAGRAM, PLATFORMS.FACEBOOK],
      isCanary: false,
      dryRun: false,
    });

    const sanitizedResult = redactSecrets(result);
    return res.status(200).json(sanitizedResult);
  } catch (error) {
    console.error("❌ Unhandled error in publishDailySocial cron handler:", error.message || error);
    return res.status(500).json({
      error: "internal_error",
      message: redactSecrets(error.message || String(error)),
    });
  }
}
