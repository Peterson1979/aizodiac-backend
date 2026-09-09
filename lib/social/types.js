// lib/social/types.js

export const DESTINATIONS = Object.freeze({
  INSTAGRAM_PRIMARY: "instagram_primary",
  FACEBOOK_PRIMARY: "facebook_primary",
  INSTAGRAM_SECONDARY: "instagram_secondary",
  FACEBOOK_SECONDARY: "facebook_secondary",
  PINTEREST: "pinterest",
});

export const ALL_DESTINATIONS = Object.freeze([
  DESTINATIONS.INSTAGRAM_PRIMARY,
  DESTINATIONS.FACEBOOK_PRIMARY,
  DESTINATIONS.INSTAGRAM_SECONDARY,
  DESTINATIONS.FACEBOOK_SECONDARY,
]);

export const ALL_CONFIGURED_DESTINATIONS = Object.freeze([
  DESTINATIONS.INSTAGRAM_PRIMARY,
  DESTINATIONS.FACEBOOK_PRIMARY,
  DESTINATIONS.INSTAGRAM_SECONDARY,
  DESTINATIONS.FACEBOOK_SECONDARY,
  DESTINATIONS.PINTEREST,
]);

// Backward-compatibility aliases for legacy platform names
export const PLATFORMS = Object.freeze({
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  PINTEREST: "pinterest",
  ...DESTINATIONS,
});

export const ALL_PLATFORMS = Object.freeze([
  PLATFORMS.INSTAGRAM,
  PLATFORMS.FACEBOOK,
  PLATFORMS.PINTEREST,
]);

export const MEDIA_TYPES = Object.freeze({
  SINGLE_IMAGE: "single_image",
  CAROUSEL: "carousel",
  VIDEO_STUB: "video",
});

export const PUBLISH_STATUS = Object.freeze({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  PUBLISHED: "PUBLISHED",
  FAILED: "FAILED",
  AUTH_FAILED: "AUTH_FAILED",
  SKIPPED: "SKIPPED",
  SKIPPED_TRIAL_MODE: "SKIPPED_TRIAL_MODE",
  UNKNOWN: "UNKNOWN",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
});

export const TERMINAL_SUCCESS_STATUSES = new Set([
  PUBLISH_STATUS.PUBLISHED,
]);

export const BLOCKED_STATUSES = new Set([
  PUBLISH_STATUS.PUBLISHED,
  PUBLISH_STATUS.RECONCILIATION_REQUIRED,
]);

/**
 * Maps legacy platform names to canonical destination keys.
 * @param {string} name
 * @returns {string}
 */
export function canonicalizeDestination(name) {
  if (!name || typeof name !== "string") return name;
  const lower = name.trim().toLowerCase();
  if (lower === "facebook") return DESTINATIONS.FACEBOOK_PRIMARY;
  if (lower === "instagram") return DESTINATIONS.INSTAGRAM_PRIMARY;
  return lower;
}

/**
 * Maps an array of platform/destination names to canonical destination keys without duplicates.
 * @param {string[]} list
 * @returns {string[]}
 */
export function canonicalizeDestinations(list) {
  if (!Array.isArray(list)) return [];
  const canonicalSet = new Set();
  for (const item of list) {
    const canonical = canonicalizeDestination(item);
    if (canonical) {
      canonicalSet.add(canonical);
    }
  }
  return Array.from(canonicalSet);
}

/**
 * Attaches legacy getter/setter aliases (instagram -> instagram_primary, facebook -> facebook_primary)
 * to a platforms state object so legacy callers can read/write without duplicating persisted state.
 * @param {object} platforms
 * @returns {object}
 */
export function attachPlatformAliases(platforms) {
  if (!platforms || typeof platforms !== "object") return platforms;
  if (!Object.prototype.hasOwnProperty.call(platforms, PLATFORMS.INSTAGRAM)) {
    Object.defineProperty(platforms, PLATFORMS.INSTAGRAM, {
      get() { return this[DESTINATIONS.INSTAGRAM_PRIMARY]; },
      set(v) { this[DESTINATIONS.INSTAGRAM_PRIMARY] = v; },
      enumerable: true,
      configurable: true,
    });
  }
  if (!Object.prototype.hasOwnProperty.call(platforms, PLATFORMS.FACEBOOK)) {
    Object.defineProperty(platforms, PLATFORMS.FACEBOOK, {
      get() { return this[DESTINATIONS.FACEBOOK_PRIMARY]; },
      set(v) { this[DESTINATIONS.FACEBOOK_PRIMARY] = v; },
      enumerable: true,
      configurable: true,
    });
  }
  return platforms;
}

/**
 * Creates an empty, initialized platform/destination state object.
 * @returns {object}
 */
export function createDefaultPlatformState() {
  return {
    status: PUBLISH_STATUS.PENDING,
    postId: null,
    containerId: null,
    publishedAt: null,
    updatedAt: null,
    error: null,
    attempts: 0,
    reconciliationData: null,
  };
}

/**
 * Creates a fresh daily post state record initialized for all canonical destinations.
 * @param {string} publishDate - Target date in YYYY-MM-DD
 * @param {string} [manifestId=null] - Manifest ID
 * @returns {object}
 */
export function createDefaultPostState(publishDate, manifestId = null) {
  const now = new Date().toISOString();
  const platforms = {
    [DESTINATIONS.INSTAGRAM_PRIMARY]: createDefaultPlatformState(),
    [DESTINATIONS.FACEBOOK_PRIMARY]: createDefaultPlatformState(),
    [DESTINATIONS.INSTAGRAM_SECONDARY]: createDefaultPlatformState(),
    [DESTINATIONS.FACEBOOK_SECONDARY]: createDefaultPlatformState(),
    [DESTINATIONS.PINTEREST]: createDefaultPlatformState(),
  };

  attachPlatformAliases(platforms);

  return {
    publishDate,
    manifestId,
    overallStatus: PUBLISH_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
    platforms,
  };
}

