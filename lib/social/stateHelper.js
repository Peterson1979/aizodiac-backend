// lib/social/stateHelper.js
import { randomUUID } from "node:crypto";
import {
  PLATFORMS,
  ALL_PLATFORMS,
  DESTINATIONS,
  ALL_DESTINATIONS,
  ALL_CONFIGURED_DESTINATIONS,
  canonicalizeDestination,
  canonicalizeDestinations,
  attachPlatformAliases,
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
export function getLockKey(publishDate, stream = null) {
  const normDate = String(publishDate || "").trim();
  const prefix = stream ? `aiz:social:lock:${stream}:` : `aiz:social:lock:`;
  return `${prefix}${normDate}`;
}

export function getPostStateKey(publishDate, stream = null) {
  const normDate = String(publishDate || "").trim();
  const prefix = stream ? `aiz:social:post:${stream}:` : `aiz:social:post:`;
  return `${prefix}${normDate}`;
}

export function getManifestKey(publishDate, stream = null) {
  const normDate = String(publishDate || "").trim();
  const prefix = stream ? `aiz:social:manifest:${stream}:` : `aiz:social:manifest:`;
  return `${prefix}${normDate}`;
}

export function getPinterestAuthKey(destinationKey = null) {
  const normKey = canonicalizeDestination(destinationKey);
  if (normKey === DESTINATIONS.PINTEREST_SECONDARY) {
    return "aiz:social:auth:pinterest:secondary";
  }
  return "aiz:social:auth:pinterest";
}

export function getYoutubeAuthKey(destinationKey = null) {
  const normKey = canonicalizeDestination(destinationKey);
  if (normKey === DESTINATIONS.YOUTUBE_LIFEMODE) {
    return "aiz:social:auth:youtube:lifemode";
  }
  return "aiz:social:auth:youtube";
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
 * @param {string} [options.stream=null] - Optional stream prefix (e.g. "video")
 * @returns {Promise<{ acquired: boolean, lockOwnerId: string|null, lockKey: string, reason?: string }>}
 */
export async function acquireDistributedLock(
  redis,
  publishDate,
  optionsOrTtl = {},
  streamArg = null
) {
  let ttlSeconds = DEFAULT_LOCK_TTL_SECONDS;
  let lockOwnerId = null;
  let stream = null;

  if (typeof optionsOrTtl === "number") {
    ttlSeconds = optionsOrTtl;
    stream = typeof streamArg === "string" ? streamArg : (streamArg?.stream || null);
  } else if (typeof optionsOrTtl === "object" && optionsOrTtl !== null) {
    ttlSeconds = optionsOrTtl.ttlSeconds || DEFAULT_LOCK_TTL_SECONDS;
    lockOwnerId = optionsOrTtl.lockOwnerId || null;
    stream = optionsOrTtl.stream || (typeof streamArg === "string" ? streamArg : null);
  } else if (typeof optionsOrTtl === "string") {
    stream = optionsOrTtl;
  }

  const lockKey = getLockKey(publishDate, stream);
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
 * @param {object|string} [options={}] - Options or stream string
 * @returns {Promise<{ released: boolean, reason?: string }>}
 */
export async function releaseDistributedLock(redis, publishDate, lockOwnerId, options = {}) {
  if (!redis || !lockOwnerId) {
    return { released: false, reason: "INVALID_ARGUMENTS" };
  }

  const stream = typeof options === "string" ? options : (options?.stream || null);
  const lockKey = getLockKey(publishDate, stream);

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
 * @param {object|string} [options={}] - Options or stream string
 * @returns {Promise<object|null>}
 */
export async function getPostState(redis, publishDate, options = {}) {
  if (!redis || !publishDate) return null;

  const stream = typeof options === "string" ? options : (options?.stream || null);
  const key = getPostStateKey(publishDate, stream);
  try {
    const data = await redis.get(key);
    if (!data) return null;

    let parsed = null;
    if (typeof data === "string") {
      parsed = JSON.parse(data);
    } else if (typeof data === "object") {
      parsed = data;
    }
    if (parsed && parsed.platforms) {
      attachPlatformAliases(parsed.platforms);
    }
    return parsed;
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
 * @param {object|string} [options={}] - Options or stream string
 * @returns {Promise<boolean>}
 */
export async function savePostState(
  redis,
  publishDate,
  stateObj,
  ttlSeconds = SOCIAL_STATE_TTL_SECONDS,
  options = {}
) {
  if (!redis || !publishDate || !stateObj) return false;

  const stream = typeof options === "string" ? options : (options?.stream || null);
  const key = getPostStateKey(publishDate, stream);
  try {
    const stateCopy = {
      ...stateObj,
      platforms: { ...(stateObj.platforms || {}) },
    };
    // Ensure legacy aliases are not serialized as duplicate keys
    delete stateCopy.platforms[PLATFORMS.INSTAGRAM];
    delete stateCopy.platforms[PLATFORMS.FACEBOOK];

    const sanitized = redactSecrets(stateCopy);
    const serialized = JSON.stringify(sanitized);
    await redis.set(key, serialized, { ex: ttlSeconds });
    return true;
  } catch (err) {
    console.error(`❌ Error saving post state for ${publishDate}:`, err.message);
    return false;
  }
}

/**
 * Calculates overall status from per-destination statuses.
 * @param {object} platforms - Destination map { instagram_primary: { status }, ... }
 * @param {string[]} [targetPlatforms=null] - Optional subset of destinations to evaluate
 * @returns {string}
 */
export function calculateOverallStatus(platforms = {}, targetPlatforms = null) {
  const canonicalTargets = Array.isArray(targetPlatforms) && targetPlatforms.length > 0
    ? canonicalizeDestinations(targetPlatforms)
    : null;

  const allCanonicalKeys = Object.keys(platforms).filter(k => k !== PLATFORMS.INSTAGRAM && k !== PLATFORMS.FACEBOOK);

  let platformKeys;
  if (canonicalTargets) {
    platformKeys = canonicalTargets.filter(k => k in platforms || ALL_CONFIGURED_DESTINATIONS.includes(k) || ALL_PLATFORMS.includes(k));
  } else {
    const activeKeys = allCanonicalKeys.filter(k => {
      const p = platforms[k];
      return p && (p.attempts > 0 || (p.status && p.status !== PUBLISH_STATUS.PENDING) || p.postId);
    });
    platformKeys = activeKeys.length > 0 ? activeKeys : allCanonicalKeys;
  }

  const statuses = platformKeys.map(k => {
    const canonicalKey = canonicalizeDestination(k);
    return platforms[canonicalKey]?.status || platforms[k]?.status || PUBLISH_STATUS.PENDING;
  });
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
 * Updates state for a single destination atomically in Redis.
 * @param {object} redis
 * @param {string} publishDate
 * @param {string} platform - "instagram_primary", "facebook_primary", "facebook_secondary", etc.
 * @param {object} platformUpdate - Partial destination state updates
 * @param {string} [manifestId=null]
 * @param {object|string} [options={}] - Options or stream string
 * @returns {Promise<object>} - Updated full state object
 */
export async function updatePlatformState(
  redis,
  publishDate,
  platform,
  platformUpdate = {},
  manifestId = null,
  options = {}
) {
  const stream = typeof options === "string" ? options : (options?.stream || null);
  let currentState = await getPostState(redis, publishDate, { stream });
  if (!currentState) {
    currentState = createDefaultPostState(publishDate, manifestId);
  }

  if (manifestId && !currentState.manifestId) {
    currentState.manifestId = manifestId;
  }

  if (!currentState.platforms) {
    currentState.platforms = {};
  }

  const canonicalKey = canonicalizeDestination(platform);

  if (!currentState.platforms[canonicalKey]) {
    // Check if legacy un-suffixed key had state
    currentState.platforms[canonicalKey] = currentState.platforms[platform] || createDefaultPlatformState();
  }

  const existingPlatform = currentState.platforms[canonicalKey];
  const now = new Date().toISOString();

  // Merge destination state with sanitization
  const mergedPlatform = {
    ...existingPlatform,
    ...platformUpdate,
    attempts: (existingPlatform.attempts || 0) + (platformUpdate.incrementAttempt ? 1 : 0),
    updatedAt: now,
    error: platformUpdate.error ? redactSecrets(platformUpdate.error) : existingPlatform.error,
  };

  delete mergedPlatform.incrementAttempt;

  currentState.platforms[canonicalKey] = mergedPlatform;
  currentState.updatedAt = now;
  currentState.overallStatus = calculateOverallStatus(currentState.platforms);

  await savePostState(redis, publishDate, currentState, SOCIAL_STATE_TTL_SECONDS, { stream });
  return currentState;
}

/**
 * Gets Pinterest OAuth token record from Redis with fallback to config.
 * @param {object} redis
 * @param {object} config
 * @param {string} [destinationKey=null]
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number|null, refreshTokenExpiresAt: number|null, source: string }>}
 */
export async function getPinterestTokenState(redis, config = {}, destinationKey = null) {
  const isSecondary = canonicalizeDestination(destinationKey) === DESTINATIONS.PINTEREST_SECONDARY;
  const configAccessToken = isSecondary ? (config.lifemodePinterestAccessToken || "") : (config.pinterestAccessToken || "");
  const configRefreshToken = isSecondary ? (config.lifemodePinterestRefreshToken || "") : (config.pinterestRefreshToken || "");

  const defaultState = {
    accessToken: configAccessToken,
    refreshToken: configRefreshToken,
    expiresAt: null,
    refreshTokenExpiresAt: null,
    source: "config",
  };

  if (!redis) return defaultState;

  const key = getPinterestAuthKey(destinationKey);
  try {
    const raw = await redis.get(key);
    if (!raw) return defaultState;

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      accessToken: data.accessToken || configAccessToken || "",
      refreshToken: data.refreshToken || configRefreshToken || "",
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
 * @param {string} [destinationKey=null]
 * @returns {Promise<boolean>}
 */
export async function savePinterestTokenState(redis, tokenData = {}, destinationKey = null) {
  if (!redis || !tokenData.accessToken) return false;

  const key = getPinterestAuthKey(destinationKey);
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

/**
 * Gets YouTube OAuth token record from Redis with fallback to config.
 * @param {object} redis
 * @param {object} config
 * @param {string} [destinationKey=null]
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: number|null, source: string }>}
 */
export async function getYoutubeTokenState(redis, config = {}, destinationKey = null) {
  const isLifeMode = canonicalizeDestination(destinationKey) === DESTINATIONS.YOUTUBE_LIFEMODE;
  const configRefreshToken = isLifeMode
    ? (config.lifemodeYoutubeRefreshToken || "")
    : (config.youtubeRefreshToken || "");

  const defaultState = {
    accessToken: "",
    refreshToken: configRefreshToken,
    expiresAt: null,
    source: "config",
  };

  if (!redis) return defaultState;

  const key = getYoutubeAuthKey(destinationKey);
  try {
    const raw = await redis.get(key);
    if (!raw) return defaultState;

    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      accessToken: data.accessToken || "",
      refreshToken: data.refreshToken || configRefreshToken || "",
      expiresAt: data.expiresAt || null,
      source: "redis",
    };
  } catch (err) {
    console.warn(`⚠️ Error reading YouTube token state from Redis (${key}):`, err.message);
    return defaultState;
  }
}

/**
 * Persists refreshed YouTube OAuth tokens into Redis.
 * @param {object} redis
 * @param {object} tokenData
 * @param {string} tokenData.accessToken
 * @param {string} [tokenData.refreshToken]
 * @param {number} [tokenData.expiresAt]
 * @param {string} [destinationKey=null]
 * @returns {Promise<boolean>}
 */
export async function saveYoutubeTokenState(redis, tokenData = {}, destinationKey = null) {
  if (!redis || !tokenData.accessToken) return false;

  const key = getYoutubeAuthKey(destinationKey);
  try {
    const record = {
      accessToken: tokenData.accessToken,
      refreshToken: tokenData.refreshToken || "",
      expiresAt: tokenData.expiresAt || null,
      updatedAt: new Date().toISOString(),
    };

    await redis.set(key, JSON.stringify(record), { ex: SOCIAL_AUTH_TTL_SECONDS });
    return true;
  } catch (err) {
    console.error(`❌ Error persisting YouTube token state in Redis (${key}):`, err.message);
    return false;
  }
}

