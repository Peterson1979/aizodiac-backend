// lib/social/config.js
import { DESTINATIONS, canonicalizeDestinations } from "./types.js";

export const DEFAULT_META_GRAPH_API_VERSION = "v26.0";
export const DEFAULT_SOCIAL_TIME_ZONE = "UTC";
export const DEFAULT_PINTEREST_ACCESS_TIER = "trial";
export const DEFAULT_HTTP_TIMEOUT_MS = 8000;

/**
 * Loads and normalizes social subsystem configuration from environment or overrides.
 * @param {object} [overrides={}] - Optional config overrides (e.g. for testing)
 * @returns {object}
 */
export function getSocialConfig(overrides = {}) {
  const env = process.env || {};

  return {
    cronSecret: overrides.cronSecret ?? env.CRON_SECRET ?? "",
    autoPublishEnabled: overrides.autoPublishEnabled ?? (env.SOCIAL_AUTO_PUBLISH_ENABLED === "true"),
    mediaBaseUrl: overrides.mediaBaseUrl ?? env.SOCIAL_MEDIA_BASE_URL ?? "",
    timeZone: overrides.timeZone ?? env.SOCIAL_TIME_ZONE ?? DEFAULT_SOCIAL_TIME_ZONE,

    // Primary Meta Configuration (AI Zodiac)
    metaGraphApiVersion: overrides.metaGraphApiVersion ?? env.META_GRAPH_API_VERSION ?? DEFAULT_META_GRAPH_API_VERSION,
    metaPageId: overrides.metaPageId ?? env.META_PAGE_ID ?? "",
    metaPageAccessToken: overrides.metaPageAccessToken ?? env.META_PAGE_ACCESS_TOKEN ?? "",
    instagramAccountId: overrides.instagramAccountId ?? env.INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "",

    // Secondary Meta Configuration (LifeMode)
    lifemodeMetaPageId: overrides.lifemodeMetaPageId ?? env.LIFEMODE_META_PAGE_ID ?? "",
    lifemodeMetaPageAccessToken: overrides.lifemodeMetaPageAccessToken ?? env.LIFEMODE_META_PAGE_ACCESS_TOKEN ?? "",
    lifemodeInstagramAccountId: overrides.lifemodeInstagramAccountId ?? env.LIFEMODE_INSTAGRAM_BUSINESS_ACCOUNT_ID ?? "",
    lifemodeMetaGraphApiVersion: overrides.lifemodeMetaGraphApiVersion ?? env.LIFEMODE_META_GRAPH_API_VERSION ?? overrides.metaGraphApiVersion ?? env.META_GRAPH_API_VERSION ?? DEFAULT_META_GRAPH_API_VERSION,

    // Pinterest Configuration
    pinterestAppId: overrides.pinterestAppId ?? env.PINTEREST_APP_ID ?? "",
    pinterestAppSecret: overrides.pinterestAppSecret ?? env.PINTEREST_APP_SECRET ?? "",
    pinterestAccessToken: overrides.pinterestAccessToken ?? env.PINTEREST_ACCESS_TOKEN ?? "",
    pinterestRefreshToken: overrides.pinterestRefreshToken ?? env.PINTEREST_REFRESH_TOKEN ?? "",
    pinterestBoardId: overrides.pinterestBoardId ?? env.PINTEREST_BOARD_ID ?? "",
    pinterestAccessTier: (overrides.pinterestAccessTier ?? env.PINTEREST_ACCESS_TIER ?? DEFAULT_PINTEREST_ACCESS_TIER).toLowerCase(),
    pinterestAllowTrialPosting: overrides.pinterestAllowTrialPosting ?? (env.PINTEREST_ALLOW_TRIAL_POSTING === "true"),

    // Network timeouts
    httpTimeoutMs: Number(overrides.httpTimeoutMs ?? env.SOCIAL_HTTP_TIMEOUT_MS) || DEFAULT_HTTP_TIMEOUT_MS,
  };
}

/**
 * Validates social subsystem configuration for specific target platforms/destinations.
 * Fails closed if required destination credentials are missing.
 * @param {object} config - Loaded config object
 * @param {string[]} [destinations=["instagram", "facebook", "pinterest"]] - Destinations to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSocialConfig(config, destinations = ["instagram", "facebook", "pinterest"]) {
  const errors = [];
  const targetKeys = canonicalizeDestinations(destinations);

  if (targetKeys.includes(DESTINATIONS.INSTAGRAM_PRIMARY)) {
    if (!config.metaPageAccessToken) errors.push("Missing META_PAGE_ACCESS_TOKEN for Instagram");
    if (!config.instagramAccountId) errors.push("Missing INSTAGRAM_BUSINESS_ACCOUNT_ID for Instagram");
  }

  if (targetKeys.includes(DESTINATIONS.FACEBOOK_PRIMARY)) {
    if (!config.metaPageAccessToken) errors.push("Missing META_PAGE_ACCESS_TOKEN for Facebook");
    if (!config.metaPageId) errors.push("Missing META_PAGE_ID for Facebook");
  }

  if (targetKeys.includes(DESTINATIONS.INSTAGRAM_SECONDARY)) {
    if (!config.lifemodeMetaPageAccessToken) errors.push("Missing LIFEMODE_META_PAGE_ACCESS_TOKEN for Instagram Secondary (LifeMode)");
    if (!config.lifemodeInstagramAccountId) errors.push("Missing LIFEMODE_INSTAGRAM_BUSINESS_ACCOUNT_ID for Instagram Secondary (LifeMode)");
  }

  if (targetKeys.includes(DESTINATIONS.FACEBOOK_SECONDARY)) {
    if (!config.lifemodeMetaPageAccessToken) errors.push("Missing LIFEMODE_META_PAGE_ACCESS_TOKEN for Facebook Secondary (LifeMode)");
    if (!config.lifemodeMetaPageId) errors.push("Missing LIFEMODE_META_PAGE_ID for Facebook Secondary (LifeMode)");
  }

  if (targetKeys.includes(DESTINATIONS.PINTEREST)) {
    if (!config.pinterestAccessToken && !config.pinterestRefreshToken) {
      errors.push("Missing PINTEREST_ACCESS_TOKEN / PINTEREST_REFRESH_TOKEN for Pinterest");
    }
    if (!config.pinterestBoardId) errors.push("Missing PINTEREST_BOARD_ID for Pinterest");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Redacts known sensitive patterns and secrets from any value, object, or string.
 * Never logs or returns access tokens, refresh tokens, secrets, or CRON_SECRET.
 * @param {*} value
 * @returns {*}
 */
export function redactSecrets(value) {
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return value
      .replace(/EAAB[a-zA-Z0-9_-]+/g, "[REDACTED_META_TOKEN]")
      .replace(/pina_[a-zA-Z0-9_-]+/g, "[REDACTED_PINTEREST_TOKEN]")
      .replace(/pinr_[a-zA-Z0-9_-]+/g, "[REDACTED_PINTEREST_REFRESH]")
      .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, "Bearer [REDACTED_AUTH_TOKEN]")
      .replace(/access_token=[a-zA-Z0-9._-]+/gi, "access_token=[REDACTED_TOKEN]")
      .replace(/client_secret=[a-zA-Z0-9._-]+/gi, "client_secret=[REDACTED_SECRET]");
  }

  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (typeof value === "object") {
    const sensitiveKeys = new Set([
      "cronsecret",
      "metapageaccesstoken",
      "lifemodemetapageaccesstoken",
      "lifemodeaccesstoken",
      "lifemodetoken",
      "pinterestaccesstoken",
      "pinterestrefreshtoken",
      "pinterestappsecret",
      "accesstoken",
      "refreshtoken",
      "secret",
      "password",
      "authorization",
      "token",
    ]);

    const sanitized = {};
    for (const [k, v] of Object.entries(value)) {
      const lowerK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (sensitiveKeys.has(lowerK)) {
        sanitized[k] = "[REDACTED]";
      } else {
        sanitized[k] = redactSecrets(v);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Returns a safe, sanitized diagnostic view of the current configuration.
 * @param {object} config
 * @returns {object}
 */
export function getSanitizedConfigView(config) {
  return {
    autoPublishEnabled: Boolean(config.autoPublishEnabled),
    timeZone: config.timeZone,
    mediaBaseUrl: config.mediaBaseUrl || "(none)",
    metaGraphApiVersion: config.metaGraphApiVersion,
    metaPageId: config.metaPageId ? `***${String(config.metaPageId).slice(-4)}` : "(not configured)",
    instagramAccountId: config.instagramAccountId ? `***${String(config.instagramAccountId).slice(-4)}` : "(not configured)",
    metaTokenConfigured: Boolean(config.metaPageAccessToken),
    lifemodeMetaPageId: config.lifemodeMetaPageId ? `***${String(config.lifemodeMetaPageId).slice(-4)}` : "(not configured)",
    lifemodeInstagramAccountId: config.lifemodeInstagramAccountId ? `***${String(config.lifemodeInstagramAccountId).slice(-4)}` : "(not configured)",
    lifemodeMetaTokenConfigured: Boolean(config.lifemodeMetaPageAccessToken),
    pinterestBoardId: config.pinterestBoardId ? `***${String(config.pinterestBoardId).slice(-4)}` : "(not configured)",
    pinterestAccessTier: config.pinterestAccessTier,
    pinterestAllowTrialPosting: Boolean(config.pinterestAllowTrialPosting),
    pinterestTokenConfigured: Boolean(config.pinterestAccessToken || config.pinterestRefreshToken),
  };
}

