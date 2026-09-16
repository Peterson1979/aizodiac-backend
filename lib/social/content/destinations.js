// lib/social/content/destinations.js
import { DEFAULT_APP_PLAY_STORE_URL, FACEBOOK_TRACKING_PLAY_STORE_URL } from "./dailyContentGenerator.js";

export const WEBSITE_PRODUCTION_BASE_URL = "https://aizodiac-web.appaizodiac.workers.dev";

/**
 * Authoritative set of discovered website routes from the aizodiac-web repository.
 */
export const KNOWN_WEBSITE_ROUTES = Object.freeze(new Set([
  "/",
  "/tools",
  "/tools/compatibility",
  "/tools/birth-chart",
  "/tools/zodiac-sign",
  "/articles",
  "/articles/astrology-and-communication-mercury-placements",
  "/articles/astrology-basics-how-to-read-birth-chart",
  "/articles/elemental-harmony-fire-earth-air-water",
  "/articles/guide-to-the-12-astrological-houses",
  "/articles/how-ai-creates-personalized-astrology-insights",
  "/articles/questions-to-ask-an-ai-astrologer",
  "/articles/the-big-three-sun-moon-rising-signs",
  "/articles/understanding-relationship-patterns-through-astrology",
  "/articles/understanding-zodiac-personality-patterns",
  "/articles/what-is-a-birth-chart",
  "/articles/zodiac-compatibility-beyond-sun-signs",
  "/articles/zodiac-signs-conflict-resolution-styles",
  "/features",
  "/features/personal-horoscope",
  "/features/ascendant",
  "/features/zodiac-traits",
  "/features/love-compatibility",
  "/features/ask-ai",
  "/features/numerology",
  "/features/chinese-zodiac",
  "/features/personal-calendar",
  "/ask-ai",
]));

/**
 * Deterministic mapping of social categories to relevant website routes.
 */
export const CATEGORY_DESTINATIONS_MAP = Object.freeze({
  self_discovery: Object.freeze([
    "/tools/birth-chart",
    "/articles/what-is-a-birth-chart",
    "/articles/the-big-three-sun-moon-rising-signs",
    "/articles/astrology-basics-how-to-read-birth-chart",
    "/features/personal-horoscope",
  ]),
  daily_insight: Object.freeze([
    "/features/personal-calendar",
    "/features/personal-horoscope",
    "/articles/how-ai-creates-personalized-astrology-insights",
    "/tools/zodiac-sign",
  ]),
  personality: Object.freeze([
    "/tools/zodiac-sign",
    "/articles/understanding-zodiac-personality-patterns",
    "/articles/elemental-harmony-fire-earth-air-water",
    "/features/zodiac-traits",
  ]),
  love_compatibility: Object.freeze([
    "/tools/compatibility",
    "/articles/zodiac-compatibility-beyond-sun-signs",
    "/articles/understanding-relationship-patterns-through-astrology",
    "/features/love-compatibility",
  ]),
  zodiac_psychology: Object.freeze([
    "/articles/zodiac-signs-conflict-resolution-styles",
    "/articles/understanding-zodiac-personality-patterns",
    "/articles/astrology-and-communication-mercury-placements",
    "/tools/zodiac-sign",
  ]),
  dating_relationships: Object.freeze([
    "/tools/compatibility",
    "/articles/understanding-relationship-patterns-through-astrology",
    "/articles/zodiac-compatibility-beyond-sun-signs",
    "/articles/zodiac-signs-conflict-resolution-styles",
  ]),
  fun_ranking: Object.freeze([
    "/tools/zodiac-sign",
    "/articles/elemental-harmony-fire-earth-air-water",
    "/features/zodiac-traits",
    "/tools/compatibility",
  ]),
});

export const DEFAULT_FALLBACK_ROUTES = Object.freeze([
  "/tools/zodiac-sign",
  "/tools/compatibility",
  "/tools/birth-chart",
  "/articles",
]);

/**
 * Resolves a date string into an integer seed for deterministic rotation.
 * @param {string} [dateStr] - Date string YYYY-MM-DD
 * @returns {number}
 */
export function getDeterministicDateSeed(dateStr) {
  if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 86400000);
  }
  return Math.floor(Date.now() / 86400000);
}

/**
 * Deterministically resolves the website route path for a given category and date.
 * @param {object} params
 * @param {string} [params.category="personality"]
 * @param {string} [params.publishDate]
 * @returns {string} - Route path (e.g. "/tools/compatibility")
 */
export function resolveWebsitePath({ category, publishDate } = {}) {
  const normCategory = (category || "").trim().toLowerCase();
  const candidateRoutes = CATEGORY_DESTINATIONS_MAP[normCategory] || DEFAULT_FALLBACK_ROUTES;

  const seed = getDeterministicDateSeed(publishDate);
  const index = Math.abs(seed) % candidateRoutes.length;

  return candidateRoutes[index];
}

/**
 * Normalizes a website pathname (removes trailing slashes unless root).
 * @param {string} pathStr
 * @returns {string}
 */
export function normalizeWebsitePath(pathStr) {
  if (!pathStr || typeof pathStr !== "string") return "/";
  const trimmed = pathStr.trim();
  if (trimmed === "/" || trimmed === "") return "/";
  return trimmed.replace(/\/+$/, "");
}

/**
 * Builds a deterministic, validated website destination URL with standard UTM parameters.
 * @param {object} params
 * @param {string} params.path - Website path (e.g. "/tools/compatibility")
 * @param {string} params.platform - Target platform ("facebook", "instagram", "pinterest")
 * @param {string} [params.campaign] - Topic category / campaign identifier
 * @param {string} [params.contentId] - Placement / content identifier (e.g. "social-2026-09-16")
 * @param {string} [params.baseUrl=WEBSITE_PRODUCTION_BASE_URL]
 * @returns {string} - Full HTTPS URL with query parameters
 */
export function buildWebsiteDestinationUrl({
  path: routePath,
  platform,
  campaign,
  contentId,
  baseUrl = WEBSITE_PRODUCTION_BASE_URL,
} = {}) {
  const normPath = normalizeWebsitePath(routePath);
  if (!KNOWN_WEBSITE_ROUTES.has(normPath)) {
    throw new Error(`Unknown or unverified website route: '${routePath}'`);
  }

  const cleanBase = (baseUrl || WEBSITE_PRODUCTION_BASE_URL).replace(/\/+$/, "");
  const normPlatform = (platform || "social").toLowerCase().replace(/_primary|_secondary/g, "");
  const normCampaign = (campaign || "daily_post").toLowerCase().replace(/[^a-z0-9_]/g, "_");
  const normContent = (contentId || "social_post").replace(/[^a-zA-Z0-9_-]/g, "_");

  const url = new URL(`${cleanBase}${normPath}`);
  url.searchParams.set("utm_source", normPlatform);
  url.searchParams.set("utm_medium", "social");
  url.searchParams.set("utm_campaign", normCampaign);
  url.searchParams.set("utm_content", normContent);

  return url.toString();
}

/**
 * Validates a website destination URL against strict security and UTM requirements.
 * Fails closed on foreign domains, unknown routes, or missing UTM parameters.
 * @param {string} urlStr
 * @param {object} [options={}]
 * @param {string} [options.expectedPlatform]
 * @param {string} [options.baseUrl=WEBSITE_PRODUCTION_BASE_URL]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWebsiteDestinationUrl(urlStr, options = {}) {
  const errors = [];
  if (!urlStr || typeof urlStr !== "string") {
    return { valid: false, errors: ["Destination URL must be a non-empty string"] };
  }

  let parsed;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { valid: false, errors: [`Invalid URL format: '${urlStr}'`] };
  }

  // 1. Host validation (must match website production host or custom base)
  const allowedBase = options.baseUrl || WEBSITE_PRODUCTION_BASE_URL;
  const allowedHost = new URL(allowedBase).hostname;
  if (parsed.hostname !== allowedHost) {
    errors.push(`Destination URL host '${parsed.hostname}' must match '${allowedHost}'`);
  }

  if (parsed.protocol !== "https:") {
    errors.push(`Destination URL must use HTTPS protocol, received: '${parsed.protocol}'`);
  }

  // 2. Path validation against known routes
  const normPath = normalizeWebsitePath(parsed.pathname);
  if (!KNOWN_WEBSITE_ROUTES.has(normPath)) {
    errors.push(`Destination URL pathname '${parsed.pathname}' is not a known website route`);
  }

  // 3. Deterministic UTM parameters validation
  const source = parsed.searchParams.get("utm_source");
  const medium = parsed.searchParams.get("utm_medium");
  const campaign = parsed.searchParams.get("utm_campaign");
  const content = parsed.searchParams.get("utm_content");

  if (!source) {
    errors.push("Missing 'utm_source' in destination URL");
  } else if (options.expectedPlatform) {
    const normExpected = options.expectedPlatform.toLowerCase().replace(/_primary|_secondary/g, "");
    if (source.toLowerCase() !== normExpected) {
      errors.push(`Destination 'utm_source' '${source}' does not match expected '${normExpected}'`);
    }
  }

  if (!medium || medium !== "social") {
    errors.push(`Destination 'utm_medium' must be 'social', received: '${medium}'`);
  }

  if (!campaign || campaign.trim().length === 0) {
    errors.push("Missing or empty 'utm_campaign' in destination URL");
  }

  if (!content || content.trim().length === 0) {
    errors.push("Missing or empty 'utm_content' in destination URL");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formats a Facebook caption by ensuring the primary website discovery destination
 * and the mandatory Google Play download URL are both present deterministically.
 * @param {object} params
 * @param {string} params.baseCaption
 * @param {string} params.websiteUrl
 * @param {string} [params.playStoreUrl=FACEBOOK_TRACKING_PLAY_STORE_URL]
 * @returns {string}
 */
export function formatFacebookCaption({
  baseCaption = "",
  websiteUrl = "",
  playStoreUrl = FACEBOOK_TRACKING_PLAY_STORE_URL,
} = {}) {
  let text = String(baseCaption || "").trim();

  // 1. Attach website discovery URL if provided and not already present
  if (websiteUrl && !text.includes(websiteUrl)) {
    if (text) {
      text = `${text}\n\nExplore more insights on AI Zodiac: ${websiteUrl}`;
    } else {
      text = `Explore insights on AI Zodiac: ${websiteUrl}`;
    }
  }

  // 2. Deterministically enforce mandatory Google Play URL
  if (!text.includes(DEFAULT_APP_PLAY_STORE_URL) && !text.includes(playStoreUrl)) {
    text = `${text}\n\nDownload AI Zodiac on Google Play:\n${playStoreUrl}`;
  } else if (text.includes(DEFAULT_APP_PLAY_STORE_URL) && !text.includes("referrer=")) {
    text = text.replace(DEFAULT_APP_PLAY_STORE_URL, playStoreUrl);
  }

  return text;
}

/**
 * Formats an Instagram caption by attaching the website discovery destination.
 * @param {object} params
 * @param {string} params.baseCaption
 * @param {string} params.websiteUrl
 * @returns {string}
 */
export function formatInstagramCaption({
  baseCaption = "",
  websiteUrl = "",
} = {}) {
  const text = String(baseCaption || "").trim();
  if (!websiteUrl || text.includes(websiteUrl)) {
    return text;
  }

  // If caption ends with hashtags, insert the website URL before hashtags if possible
  const hashtagMatch = text.match(/(\s+(?:#\w+\s*)+)$/);
  if (hashtagMatch && hashtagMatch.index !== undefined) {
    const mainBody = text.slice(0, hashtagMatch.index).trim();
    const hashtags = hashtagMatch[0].trim();
    return `${mainBody}\n\nExplore more on AI Zodiac: ${websiteUrl}\n\n${hashtags}`;
  }

  return text ? `${text}\n\nExplore more: ${websiteUrl}` : `Explore more: ${websiteUrl}`;
}
