// api/cron/prepareDailySocial.js
import { Redis } from "@upstash/redis";
import { executeDailyPreparation } from "../../lib/social/prepareCoordinator.js";
import { getSocialConfig, redactSecrets } from "../../lib/social/config.js";

export const maxDuration = 60;

/**
 * Helper to get the active Redis client for social preparation.
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
 * Daily scheduled serverless cron handler for preparing social content packages.
 * Generates AI content, renders carousel slides, uploads to R2, and saves manifest to Redis.
 */
export default async function handler(req, res) {
  // Allow GET and POST for cron / webhook invocations
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

  // 2. Parse Query Parameters (?dryRun=true, ?date=YYYY-MM-DD, ?force=true)
  const query = req.query || {};
  const dryRun = query.dryRun === "true" || query.dryRun === true;
  const targetDate = typeof query.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.date)
    ? query.date
    : null;
  const forceRegenerate = query.force === "true" || query.force === true;

  // 3. Execute Daily Preparation Pipeline
  try {
    const redis = getRedisClient();
    const result = await executeDailyPreparation({
      redis,
      targetDate,
      dryRun,
      forceRegenerate,
    });

    const sanitizedResult = redactSecrets(result);
    return res.status(200).json(sanitizedResult);
  } catch (error) {
    console.error("❌ Unhandled error in prepareDailySocial cron handler:", error.message || error);
    return res.status(500).json({
      error: "internal_error",
      message: redactSecrets(error.message || String(error)),
    });
  }
}
