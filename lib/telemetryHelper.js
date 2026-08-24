// lib/telemetryHelper.js

export const TELEMETRY_RETENTION_SECONDS = 60 * 86400; // 60 days retention

/**
 * Safely extracts usage metadata from a Gemini API response.
 * @param {object} response - The response object from ai.models.generateContent
 * @returns {{promptTokens: number, candidateTokens: number, totalTokens: number, thoughtsTokens: number, cachedTokens: number}}
 */
export function extractUsageMetadata(response) {
  const meta = response?.usageMetadata || {};
  const promptTokens = Number(meta.promptTokenCount) || 0;
  const candidateTokens = Number(meta.candidatesTokenCount) || 0;
  const totalTokens = Number(meta.totalTokenCount) || (promptTokens + candidateTokens);
  const thoughtsTokens = Number(meta.thoughtsTokenCount) || 0;
  const cachedTokens = Number(meta.cachedContentTokenCount) || 0;

  return {
    promptTokens,
    candidateTokens,
    totalTokens,
    thoughtsTokens,
    cachedTokens,
  };
}

/**
 * Records aggregate, non-PII token telemetry in Redis partitioned by date, type, provider, and model.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} requestType - The request type (e.g. 'home_daily_horoscope')
 * @param {object} usage - The extracted usage metadata object
 * @param {Date|string} [date] - Optional date override (defaults to current date)
 * @param {string} [provider] - Provider name ('gemini', 'groq')
 * @param {string} [model] - Model identifier
 */
export async function recordUsageTelemetry(
  redis,
  requestType,
  usage,
  date = new Date(),
  provider = "gemini",
  model = "default"
) {
  if (!redis || !usage) return;

  const today = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const normType = String(requestType || "unknown").trim().toLowerCase();
  const normProvider = String(provider || "gemini").trim().toLowerCase();
  const normModel = String(model || "default").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");

  const totalKey = `aiz:usage:${today}:total`;
  const typeKey = `aiz:usage:${today}:type:${normType}`;
  const providerKey = `aiz:usage:${today}:provider:${normProvider}`;
  const providerModelKey = `aiz:usage:${today}:provider:${normProvider}:model:${normModel}`;

  try {
    await Promise.all([
      // Daily total aggregate
      redis.hincrby(totalKey, "requests", 1),
      redis.hincrby(totalKey, "promptTokens", usage.promptTokens),
      redis.hincrby(totalKey, "candidateTokens", usage.candidateTokens),
      redis.hincrby(totalKey, "totalTokens", usage.totalTokens),
      redis.expire(totalKey, TELEMETRY_RETENTION_SECONDS),

      // Per request-type aggregate
      redis.hincrby(typeKey, "requests", 1),
      redis.hincrby(typeKey, "promptTokens", usage.promptTokens),
      redis.hincrby(typeKey, "candidateTokens", usage.candidateTokens),
      redis.hincrby(typeKey, "totalTokens", usage.totalTokens),
      redis.expire(typeKey, TELEMETRY_RETENTION_SECONDS),

      // Per provider aggregate
      redis.hincrby(providerKey, "requests", 1),
      redis.hincrby(providerKey, "promptTokens", usage.promptTokens),
      redis.hincrby(providerKey, "candidateTokens", usage.candidateTokens),
      redis.hincrby(providerKey, "totalTokens", usage.totalTokens),
      redis.expire(providerKey, TELEMETRY_RETENTION_SECONDS),

      // Per provider & model aggregate
      redis.hincrby(providerModelKey, "requests", 1),
      redis.hincrby(providerModelKey, "promptTokens", usage.promptTokens),
      redis.hincrby(providerModelKey, "candidateTokens", usage.candidateTokens),
      redis.hincrby(providerModelKey, "totalTokens", usage.totalTokens),
      redis.expire(providerModelKey, TELEMETRY_RETENTION_SECONDS),
    ]);
  } catch (err) {
    console.warn("⚠️ Redis token telemetry error (failing open):", err.message);
  }
}

/**
 * Records aggregate, non-PII routing event counters in Redis.
 * Event types: 'groqSuccess', 'geminiFallbackSuccess', 'fallbackAttempt', 'budgetRejected', 'rateLimited', 'reserveUsed'
 * @param {object} redis - Upstash Redis client instance
 * @param {string} eventType - Event identifier
 * @param {Date|string} [date] - Optional date override
 */
export async function recordRoutingTelemetry(redis, eventType, date = new Date()) {
  if (!redis || !eventType) return;

  const today = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const routingKey = `aiz:usage:${today}:routing`;

  try {
    await redis.hincrby(routingKey, eventType, 1);
    await redis.expire(routingKey, TELEMETRY_RETENTION_SECONDS);
  } catch (err) {
    console.warn("⚠️ Redis routing telemetry error (failing open):", err.message);
  }
}

/**
 * Records aggregate, non-PII emergency reserve telemetry in Redis.
 * Increments reserve counters in routing key and per-type reserve key without consuming token usage.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} requestType - Request type (e.g. 'home_daily_horoscope')
 * @param {string} [reasonCategory] - 'budget' | 'provider_failure' | 'budget_service_failure'
 * @param {Date|string} [date] - Optional date override
 */
export async function recordReserveTelemetry(
  redis,
  requestType,
  reasonCategory = "budget",
  date = new Date()
) {
  if (!redis) return;

  const today = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const normType = String(requestType || "unknown").trim().toLowerCase();
  const routingKey = `aiz:usage:${today}:routing`;
  const typeKey = `aiz:usage:${today}:reserve:type:${normType}`;

  let specificCounter = "reserveByBudget";
  if (reasonCategory === "provider_failure") {
    specificCounter = "reserveByProviderFailure";
  } else if (reasonCategory === "budget_service_failure") {
    specificCounter = "reserveByBudgetServiceFailure";
  }

  try {
    await Promise.all([
      redis.hincrby(routingKey, "reserveUsed", 1),
      redis.hincrby(routingKey, specificCounter, 1),
      redis.expire(routingKey, TELEMETRY_RETENTION_SECONDS),
      redis.hincrby(typeKey, "requests", 1),
      redis.expire(typeKey, TELEMETRY_RETENTION_SECONDS),
    ]);
  } catch (err) {
    console.warn("⚠️ Redis reserve telemetry error (failing open):", err.message);
  }
}
