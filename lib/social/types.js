// lib/social/types.js

export const PLATFORMS = Object.freeze({
  INSTAGRAM: "instagram",
  FACEBOOK: "facebook",
  PINTEREST: "pinterest",
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
 * Creates an empty, initialized platform state object.
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
 * Creates a fresh daily post state record.
 * @param {string} publishDate - Target date in YYYY-MM-DD
 * @param {string} [manifestId=null] - Manifest ID
 * @returns {object}
 */
export function createDefaultPostState(publishDate, manifestId = null) {
  const now = new Date().toISOString();
  return {
    publishDate,
    manifestId,
    overallStatus: PUBLISH_STATUS.PENDING,
    createdAt: now,
    updatedAt: now,
    platforms: {
      [PLATFORMS.INSTAGRAM]: createDefaultPlatformState(),
      [PLATFORMS.FACEBOOK]: createDefaultPlatformState(),
      [PLATFORMS.PINTEREST]: createDefaultPlatformState(),
    },
  };
}
