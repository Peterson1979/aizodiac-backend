// api/cron/publishDailyVideo.js
import { Redis } from "@upstash/redis";
import { executeSocialPublishing } from "../../lib/social/publishCoordinator.js";
import { getSocialConfig, redactSecrets } from "../../lib/social/config.js";
import { DESTINATIONS } from "../../lib/social/types.js";
import { getDateInTimeZone } from "../../lib/social/contentManifest.js";
import { isPromoVideoCampaignDate } from "../../lib/social/content/promoVideoRegistry.js";

export const maxDuration = 60;

/**
 * Dedicated video publishing destinations (Instagram Primary + Facebook Primary + YouTube).
 * Strictly excludes Pinterest.
 */
export const PROMO_VIDEO_DESTINATIONS = Object.freeze([
  DESTINATIONS.INSTAGRAM_PRIMARY,
  DESTINATIONS.FACEBOOK_PRIMARY,
  DESTINATIONS.YOUTUBE,
]);

/**
 * Helper to get active Redis client.
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
 * Daily scheduled serverless cron & catch-up handler for AI Zodiac promo video publication.
 * Permanent schedule: 18:00 UTC daily (0 18 * * *).
 */
export default async function handler(req, res) {
  // Allow GET and POST for cron and operational invocations
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

  const query = req.query || {};
  const isDryRun = query.dryRun === "true" || query.dryRun === true;
  const isCanary = query.canary === "true" || query.canary === true || query.isCanary === "true";

  // 2. Verify Auto Publish Kill-Switch Guard (unless explicitly bypassed via canary)
  if (!config.autoPublishEnabled && !isCanary) {
    return res.status(200).json({
      success: false,
      status: "SKIPPED_AUTO_PUBLISH_DISABLED",
      message: "SOCIAL_AUTO_PUBLISH_ENABLED is false; automated video publishing is disabled.",
      timestamp: new Date().toISOString(),
      dryRun: isDryRun,
    });
  }

  // 3. Resolve Target Campaign Date (supports manual override for catch-up, e.g. ?date=2026-09-27)
  const targetDate = query.date ? String(query.date).trim() : getDateInTimeZone(new Date(), config.timeZone);

  // 4. Validate Target Date Against Authoritative 30-Day Campaign Window
  if (!isPromoVideoCampaignDate(targetDate)) {
    return res.status(200).json({
      success: true,
      status: "SKIPPED_OUTSIDE_CAMPAIGN_WINDOW",
      message: `Date ${targetDate} is outside the authoritative 30-day promo video campaign window (2026-09-27 through 2026-10-26).`,
      date: targetDate,
      timestamp: new Date().toISOString(),
    });
  }

  // 5. Execute Video Publishing Pipeline (stream: "video", destinations: IG + FB + YT)
  try {
    const redis = getRedisClient();
    const result = await executeSocialPublishing({
      redis,
      targetDate,
      stream: "video",
      platforms: PROMO_VIDEO_DESTINATIONS,
      isCanary,
      dryRun: isDryRun,
    });

    const sanitizedResult = redactSecrets(result);
    return res.status(200).json(sanitizedResult);
  } catch (error) {
    console.error("❌ Unhandled error in publishDailyVideo cron handler:", error.message || error);
    return res.status(500).json({
      error: "internal_error",
      message: redactSecrets(error.message || String(error)),
    });
  }
}
