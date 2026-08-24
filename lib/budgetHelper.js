// lib/budgetHelper.js
import { createHash } from "node:crypto";
import { getMaxOutputTokens, getInternalAiSchema } from "./responseSchemas.js";

// --- Default Hard Budget Limits ---
export const DEFAULT_GROQ_DAILY_TOKEN_LIMIT = parseInt(process.env.GROQ_DAILY_TOKEN_LIMIT || "160000", 10);
export const DEFAULT_GEMINI_DAILY_TOKEN_LIMIT = parseInt(process.env.GEMINI_DAILY_TOKEN_LIMIT || "20000", 10);
export const DEFAULT_GLOBAL_DAILY_TOKEN_LIMIT = parseInt(process.env.GLOBAL_DAILY_TOKEN_LIMIT || "180000", 10);

// --- Safe Production Routing Defaults (Gemini-only unless explicitly configured) ---
export const DEFAULT_PRIMARY_PROVIDER = process.env.AI_PRIMARY_PROVIDER || "gemini";
export const DEFAULT_FALLBACK_PROVIDER = process.env.AI_FALLBACK_PROVIDER || "gemini";
export const DEFAULT_FALLBACK_ENABLED = process.env.AI_FALLBACK_ENABLED === "true";

// --- Abuse Rate Limit Defaults ---
export const DEFAULT_AI_GENERATION_IP_HOURLY_LIMIT = parseInt(process.env.AI_GENERATION_IP_HOURLY_LIMIT || "60", 10);
export const DEFAULT_ASK_THE_STARS_IP_HOURLY_LIMIT = parseInt(process.env.ASK_THE_STARS_IP_HOURLY_LIMIT || "20", 10);

// Retention for daily budget keys (7 days)
export const BUDGET_RETENTION_SECONDS = 7 * 86400;

/**
 * Builds the canonical Redis key for a provider's daily budget.
 * @param {string} provider - 'groq', 'gemini', or 'global'
 * @param {Date|string} [date] - Target date
 * @returns {string}
 */
export function getDailyBudgetKey(provider, date = new Date()) {
  const day = typeof date === "string" ? date : date.toISOString().slice(0, 10);
  const normProvider = String(provider || "global").trim().toLowerCase();
  if (normProvider === "global") {
    return `aiz:budget:${day}:global`;
  }
  return `aiz:budget:${day}:provider:${normProvider}`;
}

/**
 * Builds the canonical Redis key for global daily budget.
 * @param {Date|string} [date]
 * @returns {string}
 */
export function getGlobalBudgetKey(date = new Date()) {
  return getDailyBudgetKey("global", date);
}

/**
 * Calculates a conservative, safe upper-bound pre-request token reservation.
 * Formula: prompt tokens + serialized schema overhead + provider maxOutputTokens ceiling + reasoning safety buffer.
 * @param {string} type - Request type
 * @param {string} promptText - The filled prompt
 * @param {object} [schema] - Response JSON schema object
 * @param {string} [provider] - Target provider ('groq' or 'gemini')
 * @returns {number}
 */
export function calculateReservationAmount(type, promptText = "", schema = null, provider = "groq") {
  const promptTokens = Math.ceil(String(promptText || "").length / 4);
  const targetSchema = schema || getInternalAiSchema(type);
  const schemaTokens = targetSchema ? Math.ceil(JSON.stringify(targetSchema).length / 4) : 100;
  const schemaOverhead = Math.max(120, schemaTokens + 50); // Structure & framing buffer
  const maxOutputTokens = getMaxOutputTokens(type) || 600;
  const reasoningAllowance = String(provider).toLowerCase() === "groq" ? 150 : 50; // Safety allowance for reasoning

  return promptTokens + schemaOverhead + maxOutputTokens + reasoningAllowance;
}

// --- Atomic Lua Scripts for Redis Budget Enforcement ---

export const RESERVE_LUA = `
local globalKey = KEYS[1]
local providerKey = KEYS[2]

local reserveAmount = tonumber(ARGV[1])
local globalLimit = tonumber(ARGV[2])
local providerLimit = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local globalUsed = tonumber(redis.call('GET', globalKey) or '0')
local providerUsed = tonumber(redis.call('GET', providerKey) or '0')

if (globalUsed + reserveAmount) > globalLimit then
  return {0, 'GLOBAL_BUDGET_EXHAUSTED', tostring(globalUsed), tostring(globalLimit)}
end

if (providerUsed + reserveAmount) > providerLimit then
  return {0, 'PROVIDER_BUDGET_EXHAUSTED', tostring(providerUsed), tostring(providerLimit)}
end

local newGlobal = redis.call('INCRBY', globalKey, reserveAmount)
redis.call('EXPIRE', globalKey, ttl)

local newProvider = redis.call('INCRBY', providerKey, reserveAmount)
redis.call('EXPIRE', providerKey, ttl)

return {1, 'RESERVED', tostring(newGlobal), tostring(newProvider)}
`;

export const SETTLE_LUA = `
local globalKey = KEYS[1]
local providerKey = KEYS[2]

local reservedAmount = tonumber(ARGV[1])
local actualAmount = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local diff = reservedAmount - actualAmount

local globalUsed = tonumber(redis.call('GET', globalKey) or '0')
local providerUsed = tonumber(redis.call('GET', providerKey) or '0')

local newGlobal = globalUsed - diff
if newGlobal < 0 then newGlobal = 0 end
redis.call('SET', globalKey, newGlobal)
redis.call('EXPIRE', globalKey, ttl)

local newProvider = providerUsed - diff
if newProvider < 0 then newProvider = 0 end
redis.call('SET', providerKey, newProvider)
redis.call('EXPIRE', providerKey, ttl)

return {1, 'SETTLED', tostring(newGlobal), tostring(newProvider)}
`;

/**
 * Atomically reserves budget against both provider daily limit and global daily limit.
 * Fails closed if Redis is unavailable, throws, or returns malformed data.
 * @param {object} params
 * @param {object} params.redis - Upstash Redis client instance
 * @param {string} params.provider - 'groq' or 'gemini'
 * @param {number} params.reserveAmount - Estimated tokens to reserve
 * @param {Date|string} [params.date] - Target date
 * @param {number} [params.globalLimit] - Global budget limit override
 * @param {number} [params.providerLimit] - Provider budget limit override
 * @returns {Promise<{success: boolean, reservedAmount: number, reason: string, currentUsed?: number, limit?: number, error?: string}>}
 */
export async function reserveBudget({
  redis,
  provider = "groq",
  reserveAmount,
  date = new Date(),
  globalLimit,
  providerLimit,
}) {
  if (!redis) {
    // FAIL CLOSED: Hard cost brake requires active Redis verification
    return {
      success: false,
      reservedAmount: 0,
      reason: "BUDGET_SERVICE_UNAVAILABLE",
      error: "Redis client not configured or unavailable",
    };
  }

  const normProvider = String(provider || "groq").trim().toLowerCase();
  const effGlobalLimit = globalLimit !== undefined ? globalLimit : DEFAULT_GLOBAL_DAILY_TOKEN_LIMIT;
  const effProviderLimit = providerLimit !== undefined
    ? providerLimit
    : (normProvider === "groq" ? DEFAULT_GROQ_DAILY_TOKEN_LIMIT : DEFAULT_GEMINI_DAILY_TOKEN_LIMIT);

  const globalKey = getGlobalBudgetKey(date);
  const providerKey = getDailyBudgetKey(normProvider, date);

  try {
    const res = await redis.eval(
      RESERVE_LUA,
      [globalKey, providerKey],
      [reserveAmount, effGlobalLimit, effProviderLimit, BUDGET_RETENTION_SECONDS]
    );

    if (!Array.isArray(res) || res.length < 2) {
      return {
        success: false,
        reservedAmount: 0,
        reason: "BUDGET_SERVICE_MALFORMED",
        error: "Unexpected response format from budget evaluation",
      };
    }

    const isSuccess = Number(res[0]) === 1;
    let reason = String(res[1]);

    if (!isSuccess) {
      if (reason === "PROVIDER_BUDGET_EXHAUSTED") {
        reason = `${normProvider.toUpperCase()}_BUDGET_EXHAUSTED`;
      }
      const currentUsed = Number(res[2]) || 0;
      const limit = Number(res[3]) || 0;
      return {
        success: false,
        reservedAmount: 0,
        reason,
        currentUsed,
        limit,
      };
    }

    return {
      success: true,
      reservedAmount: reserveAmount,
      reason: "RESERVED",
      provider: normProvider,
      globalKey,
      providerKey,
    };
  } catch (err) {
    console.error("❌ Redis budget reservation error (failing closed):", err.message);
    return {
      success: false,
      reservedAmount: 0,
      reason: "BUDGET_SERVICE_ERROR",
      error: err.message,
    };
  }
}

/**
 * Atomically settles a budget reservation.
 * Handles:
 * - actual < reserved: refunds unused reservation
 * - actual == reserved: no change
 * - actual > reserved: accounts for additional actual tokens consumed
 * @param {object} params
 * @param {object} params.redis - Upstash Redis client instance
 * @param {string} params.provider - 'groq' or 'gemini'
 * @param {number} params.reservedAmount - Previously reserved tokens
 * @param {number} params.actualAmount - Actual provider-reported tokens
 * @param {Date|string} [params.date] - Target date
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function settleBudget({
  redis,
  provider,
  reservedAmount,
  actualAmount,
  date = new Date(),
}) {
  if (!redis || reservedAmount === undefined || reservedAmount === null) return { success: true };

  const normProvider = String(provider || "groq").trim().toLowerCase();
  const globalKey = getGlobalBudgetKey(date);
  const providerKey = getDailyBudgetKey(normProvider, date);

  try {
    await redis.eval(
      SETTLE_LUA,
      [globalKey, providerKey],
      [reservedAmount, actualAmount, BUDGET_RETENTION_SECONDS]
    );
    return { success: true };
  } catch (err) {
    console.warn("⚠️ Redis budget settlement error (failing open):", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Releases the full reservation when a call fails prior to billable usage.
 * @param {object} params
 * @param {object} params.redis - Upstash Redis client instance
 * @param {string} params.provider - 'groq' or 'gemini'
 * @param {number} params.reservedAmount - Reserved amount to release
 * @param {Date|string} [params.date] - Target date
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function releaseBudget({
  redis,
  provider,
  reservedAmount,
  date = new Date(),
}) {
  return settleBudget({
    redis,
    provider,
    reservedAmount,
    actualAmount: 0,
    date,
  });
}

/**
 * Secondary abuse rate limiter for AI generation.
 * Counts only requests that trigger model generation (not cache HITs).
 * Hashes raw IP with SHA-256 to ensure no PII is stored in Redis.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} rawIp - The client IP address
 * @param {string} [type] - Request type (stricter limit for 'ask_the_stars')
 * @returns {Promise<{allowed: boolean, reason?: string, current?: number, limit?: number}>}
 */
export async function checkAbuseRateLimit(redis, rawIp, type) {
  if (!redis) return { allowed: true };

  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp || "unknown").split(",")[0].trim();
  if (!ip || ip === "unknown") {
    return { allowed: true };
  }

  // Hash IP with SHA-256 (take first 16 hex chars to avoid PII exposure in Redis keys)
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);

  const isAskTheStars = type === "ask_the_stars";
  const limit = isAskTheStars
    ? DEFAULT_ASK_THE_STARS_IP_HOURLY_LIMIT
    : DEFAULT_AI_GENERATION_IP_HOURLY_LIMIT;

  const keyPrefix = isAskTheStars ? "ask_the_stars" : "ai_gen";
  const key = `aiz:ratelimit:ip:${ipHash}:${keyPrefix}:window:3600`;

  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 3600); // 1 hour window
    }
    if (current > limit) {
      return {
        allowed: false,
        reason: "AI_RATE_LIMITED",
        current,
        limit,
      };
    }
    return { allowed: true, current, limit };
  } catch (err) {
    console.warn("⚠️ Redis abuse rate limit error (failing open):", err.message);
    return { allowed: true };
  }
}
