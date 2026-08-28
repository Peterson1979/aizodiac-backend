// lib/social/stateHelper.js
import { randomUUID } from "node:crypto";
import {
  PLATFORMS,
  ALL_PLATFORMS,
  PUBLISH_STATUS,
  createDefaultPostState,
  createDefaultPlatformState,
} from "./types.js";
import { redactSecrets } from "./config.js";

export const SOCIAL_STATE_TTL_SECONDS = 90 * 86400; // 90 days retention for post state
export const SOCIAL_AUTH_TTL_SECONDS = 180 * 86400; // 180 days retention for auth state
export const DEFAULT_LOCK_TTL_SECONDS = 300; // 5 minutes distributed lock

/**
 * Canonical Redis key helpers.
 */
export function getLockKey(publishDate) {
  const normDate = String(publishDate || "").trim();
  return `aiz:social:lock:${normDate}`;
}

export function getPostStateKey(publishDate) {
  const normDate = String(publishDate || "").trim();
  return `aiz:social:post:${normDate}`;
}

export function getManifestKey(publishDate) {
  const normDate = String(publishDate || "").trim();
  return `aiz:social:manifest:${normDate}`;
}

export function getPinterestAuthKey() {
  return "aiz:social:auth:pinterest";
}

// --- Safe Atomic Lock Release Lua Script ---
// Compares stored lockOwnerId against argument; deletes ONLY if match.
export const RELEASE_LOCK_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
`;

/**
 * Attempts to acquire an atomic distributed lock for a given publication date.
 * Uses SET NX EX with a unique lockOwnerId.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} publishDate - Target date (YYYY-MM-DD)
 * @param {object} [options={}]
 * @param {number} [options.ttlSeconds=DEFAULT_LOCK_TTL_SECONDS]
 * @param {string} [options.lockOwnerId] - Optional override (generated if omitted)
 * @returns {Promise<{ acquired: boolean, lockOwnerId: string|null, lockKey: string, reason?: string }>}
 */
export async function acquireDistributedLock(
  redis,
  publishDate,
  { ttlSeconds = DEFAULT_LOCK_TTL_SECONDS, lockOwnerId = null } = {}
) {
  const lockKey = getLockKey(publishDate);
  const ownerId = lockOwnerId || randomUUID();

  if (!redis) {
    // If Redis is not configured, fail closed
    return {
      acquired: false,
      lockOwnerId: null,
      lockKey,
      reason: "REDIS_UNAVAILABLE",
    };
  }

  try {
    const res = await redis.set(lockKey, ownerId, {
      nx: true,
      ex: ttlSeconds,
    });

    const acquired = res === "OK" || res === true;
    return {
      acquired,
      lockOwnerId: acquired ? ownerId : null,
      lockKey,
      reason: acquired ? "LOCK_ACQUIRED" : "LOCK_CONTENTION",
    };
  } catch (err) {
    console.error(`❌ Error acquiring social lock for ${publishDate}:`, err.message || err);
    return {
      acquired: false,
      lockOwnerId: null,
      lockKey,
      reason: "REDIS_ERROR",
      error: err.message,
    };
  }
}

/**
 * Safely releases an acquired distributed lock ONLY if the current invocation still owns it.
 * Uses atomic Lua script comparison to prevent releasing an expired lock owned by another invocation.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} publishDate - Target date (YYYY-MM-DD)
 * @param {string} lockOwnerId - The lockOwnerId obtained upon acquisition
 * @returns {Promise<{ released: boolean, reason?: string }>}
 */
export async function releaseDistributedLock(redis, publishDate, lockOwnerId) {
  if (!redis || !lockOwnerId) {
    return { released: false, reason: "INVALID_ARGUMENTS" };
  }

  const lockKey = getLockKey(publishDate);

  try {
    const result = await redis.eval(
      RELEASE_LOCK_LUA,
      [lockKey],
      [lockOwnerId]
    );

    const released = Number(result) === 1;
    return {
      released,
      reason: released ? "RELEASED" : "LOCK_NOT_OWNED_OR_EXPIRED",
    };
  } catch (err) {
    console.error(`❌ Error releasing social lock for ${publishDate}:`, err.message || err);
    return {
      released: false,
      reason: "REDIS_ERROR",
      error: err.message,
    };
  }
}

/**
 * Reads the current publication state for a given date from Redis.
 * @param {object} redis - Upstash Redis client instance
 * @param {string} publishDate - Target date (YYYY-MM-DD)
 * @returns {Promise<object|null>}
 */
export async function getPostState(redis, publishDate) {
  if (!redis || !publishDate) return null;

  const key = getPostStateKey(publishDate);
  try {
    const data = await redis.get(key);
    if (!data) return null;

    if (typeof data === "string") {
      return JSON.parse(data);
    }
    if (typeof data === "object") {
      return data;
    }
    return null;
  } catch (err) {
    console.warn(`⚠️ Error reading post state for ${publishDate}:`, err.message);
    return null;
  }
}

/**
 * Persists full publication state for a date in Redis with 90-day retention.
 * @param {object} redis
 * @param {string} publishDate
 * @param {object} stateObj
 * @param {number} [ttlSeconds=SOCIAL_STATE_TTL_SECONDS]
 * @returns {Promise<boolean>}
 */
export async function savePostState(
  redis,
  publishDate,
  stateObj,
  ttlSeconds = SOCIAL_STATE_TTL_SECONDS
) {
  if (!redis || !publishDate || !stateObj) return false;

  const key = getPostStateKey(publishDate);
  try {
    const sanitized = redactSecrets(stateObj);
    const serialized = JSON.stringify(sanitized);
    await redis.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.error(`❌ Error saving post state for ${publishDate}:`, err.message);
    return false;
  }
}

/**
 * Calculates overall status from per-platform statuses.
 * @param {object} platforms - Platform map { instagram: { status }, ... }
 * @param {string[]} [targetPlatforms=null] - Optional subset of platforms to evaluate
 * @returns {string}
 */
export function calculateOverallStatus(platforms = {}, targetPlatforms = null) {
  const platformKeys = Array.isArray(targetPlatforms) && targetPlatforms.length > 0
    ? targetPlatforms.filter(k => k in platforms || ALL_PLATFORMS.includes(k))
    : Object.keys(platforms);

  const statuses = platformKeys.map(k => platforms[k]?.status || PUBLISH_STATUS.PENDING);
  if (statuses.length === 0) return PUBLISH_STATUS.PENDING;

  if (statuses.some(s => s === PUBLISH_STATUS.RECONCILIATION_REQUIRED)) {
    return PUBLISH_STATUS.RECONCILIATION_REQUIRED;
  }

  const publishedCount = statuses.filter(s => s === PUBLISH_STATUS.PUBLISHED).length;
  const skippedCount = statuses.filter(s => s === PUBLISH_STATUS.SKIPPED || s === PUBLISH_STATUS.SKIPPED_TRIAL_MODE).length;
  const failedCount = statuses.filter(s => s === PUBLISH_STATUS.FAILED || s === PUBLISH_STATUS.AUTH_FAILED).length;
  const inProgressCount = statuses.filter(s => s === PUBLISH_STATUS.IN_PROGRESS).length;

  if (inProgressCount > 0) return PUBLISH_STATUS.IN_PROGRESS;
  if (publishedCount === statuses.length) return PUBLISH_STATUS.PUBLISHED;
  if (publishedCount + skippedCount === statuses.length && publishedCount > 0) return PUBLISH_STATUS.PUBLISHED;
  if (publishedCount > 0 && failedCount > 0) return "PARTIAL_SUCCESS";
  if (statuses.length === 1 && statuses[0] === PUBLISH_STATUS.AUTH_FAILED) return PUBLISH_STATUS.AUTH_FAILED;
  if (failedCount === statuses.length) return PUBLISH_STATUS.FAILED;
  if (skippedCount === statuses.length) return PUBLISH_STATUS.SKIPPED;

  return PUBLISH_STATUS.PENDING;
}

/**
 * Updates state for a single platform atomically in Redis.
 * @param {object} redis
 * @param {string} publishDate
 * @param {string} platform - "instagram", "facebook", "pinterest"
 * @param {object} platformUpdate - Partial platform state updates
 * @param {string} [manifestId=null]
 * @returns {Promise<object>} - Updated full state object
 */
export async function updatePlatformState(
  redis,
  publishDate,
  platform,
  platformUpdate = {},
  manifestId = null
) {
  let currentState = await getPostState(redis, publishDate);
  if (!currentState) {
    currentState = createDefaultPostState(publishDate, manifestId);
  }

  if (manifestId && !currentState.manifestId) {
    currentState.manifestId = manifestId;
  }

  if (!currentState.platforms) {
    currentState.platforms = {};
  }
  if (!currentState.platforms[platform]) {
    currentState.platforms[platform] = createDefaultPlatformState();
  }

  const existingPlatform = currentState.platforms[platform];
  const now = new Date().toISOString();

  // Merge platform state with sanitization
  const mergedPlatform = {
    ...existingPlatform,
    ...platformUpdate,
    attempts: (existingPlatform.attempts || 0) + (platformUpdate.incrementAttempt ? 1 : 0),
    updatedAt: now,
    error: platformUpdate.error ? redactSecrets(platformUpdate.error) : existingPlatform.error,
  };

  delete mergedPlatform.incrementAttempt;

  currentState.platforms[platform] = mergedPlatform;
  currentState.updatedAt = now;
  currentState.overallStatus = calculateOverallStatus(currentState.platforms);

  await savePostState(redis, publishDate, currentState);
  return currentState;
}

/**
 * Gets Pinterest OAuth token record from Redis with fallback to config.
 * @param {object} redis
 * @param {object} config
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number|null, refreshTokenExpiresAt: number|null, source: string }>}
 */
export async function getPinterestTokenState(redis, config = {}) {
  const defaultState = {
    accessToken: config.pinterestAccessToken || "",
    refreshToken: config.pinterestRefreshToken || "",
    expiresAt: null,
    refreshTokenExpiresAt: null,
    source: "config",
  };

  if (!redis) return defaultState;

  const key = getPinterestAuthKey();
  try {
    const raw = await redis.get(key);
    if (!raw) return defaultState;

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      accessToken: data.accessToken || config.pinterestAccessToken || "",
      refreshToken: data.refreshToken || config.pinterestRefreshToken || "",
      expiresAt: data.expiresAt || null,
      refreshTokenExpiresAt: data.refreshTokenExpiresAt || null,
      source: "redis",
    };
  } catch (err) {
    console.warn("⚠️ Error reading Pinterest token state from Redis:", err.message);
    return defaultState;
  }
}

/**
 * Persists refreshed Pinterest OAuth tokens into Redis.
 * @param {object} redis
 * @param {object} tokenData
 * @param {string} tokenData.accessToken
 * @param {string} [tokenData.refreshToken]
 * @param {number} [tokenData.expiresAt]
 * @param {number} [tokenData.refreshTokenExpiresAt]
 * @returns {Promise<boolean>}
 */
export async function savePinterestTokenState(redis, tokenData = {}) {
  if (!redis || !tokenData.accessToken) return false;

  const key = getPinterestAuthKey();
  try {
    const record = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || "",
      expiresAt: tokenData.expiresAt || null,
      refreshTokenExpiresAt: tokenData.refreshTokenExpiresAt || null,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(key, JSON.stringify(record), { ex: SOCIAL_AUTH_TTL_SECONDS });
    return true;
  } catch (err) {
    console.error("❌ Error persisting Pinterest token state in Redis:", err.message);
    return false;
  }
}
