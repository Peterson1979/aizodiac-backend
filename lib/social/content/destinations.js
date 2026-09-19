// lib/social/content/destinations.js
import { DEFAULT_APP_PLAY_STORE_URL, FACEBOOK_TRACKING_PLAY_STORE_URL } from "./dailyContentGenerator.js";
import {
  FEATURE_SPOTLIGHT_CATALOG,
  TOOL_OF_DAY_CATALOG,
  GUIDE_DISCOVERY_CATALOG,
  DID_YOU_KNOW_CATALOG,
  QUESTION_OF_DAY_CATALOG,
  THREE_ZODIAC_SIGNS_CATALOG,
  COMPATIBILITY_CATALOG,
  AI_ASTROLOGY_CATALOG,
  WEEKLY_DISCOVERY_CATALOG,
} from "./topicRotation.js";

export const WEBSITE_PRODUCTION_BASE_URL = "https://aizodiac.life";

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
 * Deterministic mapping of social categories and content formats to relevant website routes.
 */
export const CATEGORY_DESTINATIONS_MAP = Object.freeze({
  // 9 Content Formats (Rotation V2)
  three_zodiac_signs: Object.freeze(THREE_ZODIAC_SIGNS_CATALOG.map(c => c.path)),
  feature_spotlight: Object.freeze(FEATURE_SPOTLIGHT_CATALOG.map(c => c.path)),
  tool_of_day: Object.freeze(TOOL_OF_DAY_CATALOG.map(c => c.path)),
  guide_discovery: Object.freeze(GUIDE_DISCOVERY_CATALOG.map(c => c.path)),
  did_you_know: Object.freeze(DID_YOU_KNOW_CATALOG.map(c => c.path)),
  question_of_day: Object.freeze(QUESTION_OF_DAY_CATALOG.map(c => c.path)),
  compatibility_insight: Object.freeze(COMPATIBILITY_CATALOG.map(c => c.path)),
  ai_astrology: Object.freeze(AI_ASTROLOGY_CATALOG.map(c => c.path)),
  weekly_discovery: Object.freeze(WEEKLY_DISCOVERY_CATALOG.map(c => c.path)),

  // Legacy Category Aliases (Backward Compatibility)
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
 * Deterministically resolves the website route path for a given category/format and date.
 * @param {object} params
 * @param {string} [params.category="personality"]
 * @param {string} [params.format]
 * @param {string} [params.publishDate]
 * @returns {string} - Route path (e.g. "/tools/compatibility")
 */
export function resolveWebsitePath({ category, format, publishDate } = {}) {
  const targetKey = (format || category || "").trim().toLowerCase();
  const candidateRoutes = CATEGORY_DESTINATIONS_MAP[targetKey] || DEFAULT_FALLBACK_ROUTES;

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
 * @param {string} params.path - Path component (e.g. "/tools/compatibility" or "/articles/what-is-a-birth-chart")
 * @param {string} params.platform - Target platform: "facebook" | "instagram" | "pinterest"
 * @param {string} [params.campaign] - UTM campaign tag (e.g. topic category / format)
 * @param {string} [params.contentId] - UTM content identifier (e.g. "social-2026-09-01")
 * @param {string} [params.baseUrl=WEBSITE_PRODUCTION_BASE_URL] - Base website origin
 * @returns {string} - Fully qualified URL with UTM query params
 */
export function buildWebsiteDestinationUrl({
  path,
  platform,
  campaign,
  contentId,
  baseUrl = WEBSITE_PRODUCTION_BASE_URL,
}) {
  const normPath = normalizeWebsitePath(path);
  if (!KNOWN_WEBSITE_ROUTES.has(normPath)) {
    throw new Error(`Invalid destination path '${path}': route not in known website catalog`);
  }

  const cleanBase = (baseUrl || WEBSITE_PRODUCTION_BASE_URL).replace(/\/+$/, "");
  const url = new URL(normPath, cleanBase);

  // Standard deterministic UTM attribution parameters
  url.searchParams.set("utm_source", String(platform).toLowerCase().trim());
  url.searchParams.set("utm_medium", "social");
  if (campaign) {
    url.searchParams.set("utm_campaign", String(campaign).toLowerCase().trim().replace(/[^a-z0-9_]/g, "_"));
  }
  if (contentId) {
    url.searchParams.set("utm_content", String(contentId).trim());
  }

  return url.toString();
}

/**
 * Validates a website destination URL against safety, domain, and UTM schema constraints.
 * Fails closed if host or path is unknown or UTM params are missing/malformed.
 * @param {string} urlString
 * @param {object} [options={}]
 * @param {string} [options.expectedPlatform]
 * @param {string} [options.baseUrl=WEBSITE_PRODUCTION_BASE_URL]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateWebsiteDestinationUrl(urlString, options = {}) {
  const errors = [];
  if (!urlString || typeof urlString !== "string") {
    return { valid: false, errors: ["Missing or non-string website URL"] };
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    return { valid: false, errors: [`Malformed URL '${urlString}': ${err.message}`] };
  }

  const allowedBase = options.baseUrl || WEBSITE_PRODUCTION_BASE_URL;
  const expectedHost = new URL(allowedBase).hostname;

  if (parsed.hostname !== expectedHost) {
    errors.push(`Invalid host '${parsed.hostname}': expected '${expectedHost}'`);
  }

  if (parsed.protocol !== "https:") {
    errors.push(`Invalid protocol '${parsed.protocol}': destination must be HTTPS`);
  }

  const normPath = normalizeWebsitePath(parsed.pathname);
  if (!KNOWN_WEBSITE_ROUTES.has(normPath)) {
    errors.push(`Path '${normPath}' is not a known website route`);
  }

  // Enforce required UTM parameters
  const utmSource = parsed.searchParams.get("utm_source");
  const utmMedium = parsed.searchParams.get("utm_medium");
  const utmCampaign = parsed.searchParams.get("utm_campaign");
  const utmContent = parsed.searchParams.get("utm_content");

  if (!utmSource) errors.push("Missing 'utm_source' in destination URL");
  if (options.expectedPlatform && utmSource && utmSource.toLowerCase() !== options.expectedPlatform.toLowerCase()) {
    errors.push(`Mismatched utm_source '${utmSource}': expected '${options.expectedPlatform}'`);
  }

  if (!utmMedium || utmMedium !== "social") {
    errors.push(`Invalid 'utm_medium' ('${utmMedium}'): expected 'social'`);
  }

  if (!utmCampaign) errors.push("Missing 'utm_campaign' in destination URL");
  if (!utmContent) errors.push("Missing 'utm_content' in destination URL");

  return {
    valid: errors.length === 0,
    errors,
  };
}

export const DEFAULT_FACEBOOK_CTA = "Explore more insights on AI Zodiac:";
export const DEFAULT_FACEBOOK_WEBSITE_URL = "https://aizodiac.life/";

/**
 * Formats a Facebook caption by ensuring both the canonical website destination link (https://aizodiac.life/) and mandatory Google Play URL are present.
 * @param {object} params
 * @param {string} [params.baseCaption=""]
 * @param {string} [params.websiteUrl=DEFAULT_FACEBOOK_WEBSITE_URL]
 * @param {string} [params.playStoreUrl=FACEBOOK_TRACKING_PLAY_STORE_URL]
 * @returns {string}
 */
export function formatFacebookCaption({
  baseCaption = "",
  websiteUrl = DEFAULT_FACEBOOK_WEBSITE_URL,
  playStoreUrl = FACEBOOK_TRACKING_PLAY_STORE_URL,
} = {}) {
  let text = String(baseCaption || "").trim();

  // Normalize legacy/deprecated domain references to canonical AI Zodiac production website
  text = text.replace(/https?:\/\/(?:www\.)?(?:aizodiac\.(?:app|com)|lifemode\.com)(?:\/)?/gi, "https://aizodiac.life/");
  // Normalize origin without trailing slash to canonical URL
  text = text.replace(/https:\/\/aizodiac\.life(?!\/)/g, "https://aizodiac.life/");

  let targetWebsiteUrl = String(websiteUrl || DEFAULT_FACEBOOK_WEBSITE_URL).trim();
  if (targetWebsiteUrl === WEBSITE_PRODUCTION_BASE_URL || targetWebsiteUrl === "https://aizodiac.life") {
    targetWebsiteUrl = "https://aizodiac.life/";
  }

  // 1. Attach website discovery URL if not already present in caption text
  if (targetWebsiteUrl && !text.includes(targetWebsiteUrl) && !text.includes("https://aizodiac.life/")) {
    if (text) {
      text = `${text}\n\n${DEFAULT_FACEBOOK_CTA} ${targetWebsiteUrl}`;
    } else {
      text = `${DEFAULT_FACEBOOK_CTA} ${targetWebsiteUrl}`;
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

export const DEFAULT_INSTAGRAM_CTA = "Explore more with AI Zodiac — link in bio.";

/**
 * Formats an Instagram caption by attaching a clean bio-link call-to-action.
 * Does NOT append raw website URLs to preserve clean Instagram UX.
 * @param {object} params
 * @param {string} [params.baseCaption=""]
 * @param {string} [params.cta=DEFAULT_INSTAGRAM_CTA]
 * @returns {string}
 */
export function formatInstagramCaption({
  baseCaption = "",
  cta = DEFAULT_INSTAGRAM_CTA,
} = {}) {
  const text = String(baseCaption || "").trim();
  const ctaText = String(cta || DEFAULT_INSTAGRAM_CTA).trim();

  if (!ctaText || text.includes(ctaText)) {
    return text;
  }

  // If caption ends with hashtags, insert the CTA before hashtags if possible
  const hashtagMatch = text.match(/(\s+(?:#\w+\s*)+)$/);
  if (hashtagMatch && hashtagMatch.index !== undefined) {
    const mainBody = text.slice(0, hashtagMatch.index).trim();
    const hashtags = hashtagMatch[0].trim();
    return mainBody ? `${mainBody}\n\n${ctaText}\n\n${hashtags}` : `${ctaText}\n\n${hashtags}`;
  }

  return text ? `${text}\n\n${ctaText}` : ctaText;
}
