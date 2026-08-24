// lib/cacheHelper.js
import { createHash } from "node:crypto";

export const CACHE_VERSION = "v2";

/**
 * Type-specific revisions to partition modified output semantics without
 * invalidating unrelated v2 public shared caches.
 */
export const CACHE_TYPE_REVISION = {
  personal_horoscope: "b4",
  numerology: "b4",
  personal_astro_calendar: "b4",
  chinese_horoscope: "b4",
  ai_horoscope_weekly: "b5",
  ai_horoscope_monthly: "b5",
  ai_horoscope_yearly: "b5",
  ascendant_calc: "b5",
  love_compatibility: "b5",
  personal_horoscope_period_daily: "b5",
  personal_horoscope_period_weekly: "b5",
  personal_horoscope_period_monthly: "b5",
};

export const TTL_SECONDS = {
  home_daily_horoscope: 36 * 3600,            // ~36 hours
  home_daily_quote: 36 * 3600,                // ~36 hours
  ai_horoscope_daily: 36 * 3600,              // ~36 hours
  ai_horoscope_general: 36 * 3600,            // ~36 hours
  ai_horoscope_weekly: 10 * 86400,            // 10 days
  ai_horoscope_monthly: 45 * 86400,           // 45 days
  ai_horoscope_yearly: 380 * 86400,           // 380 days
  ascendant_calc: 180 * 86400,                // 180 days
  love_compatibility: 180 * 86400,            // 180 days
  chinese_horoscope: 380 * 86400,             // 380 days
  personal_horoscope: 36 * 3600,              // 36 hours (daily planetary transit natal cache)
  numerology: 90 * 86400,                     // 90 days (numerical tuple interpretation cache)
  personal_astro_calendar: 36 * 3600,         // 36 hours (shared transit timeline cache)
  personal_horoscope_period_daily: 36 * 3600, // 36 hours (shared period cache)
  personal_horoscope_period_weekly: 10 * 86400, // 10 days (shared period cache)
  personal_horoscope_period_monthly: 45 * 86400,// 45 days (shared period cache)
};

export const SHARED_CACHE_TYPES = new Set([
  "home_daily_horoscope",
  "home_daily_quote",
  "ai_horoscope_daily",
  "ai_horoscope_general",
  "ai_horoscope_weekly",
  "ai_horoscope_monthly",
  "ai_horoscope_yearly",
  "ascendant_calc",
  "love_compatibility",
  "chinese_horoscope",
  "personal_horoscope",
  "numerology",
  "personal_astro_calendar",
  "personal_horoscope_period_daily",
  "personal_horoscope_period_weekly",
  "personal_horoscope_period_monthly",
]);

export function isSharedCacheEligible(type) {
  return SHARED_CACHE_TYPES.has(type);
}

/**
 * Builds the canonical Redis cache key for shared AI responses.
 * @param {string} type - Request type
 * @param {object} templateData - Normalized template data object
 * @param {string} [model] - Model name (e.g. 'gemini-2.5-flash-lite', 'openai/gpt-oss-20b')
 * @param {string} [provider] - Provider name ('gemini', 'groq')
 * @returns {string|null}
 */
export function getSharedCacheKey(type, templateData = {}, model = "default", provider = "gemini") {
  if (!isSharedCacheEligible(type)) {
    return null;
  }

  const rawModel = String(model || "default").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "_");
  const normProvider = String(provider || "gemini").trim().toLowerCase();

  // Gemini retains byte-for-byte baseline model segment; Groq / non-Gemini receive provider namespace prefix
  const normModel = normProvider === "gemini" ? rawModel : `${normProvider}:${rawModel}`;
  const normLang = String(templateData.language || "en").trim().toLowerCase();

  switch (type) {
    case "home_daily_horoscope": {
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const date = String(templateData.currentDate || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:home_daily_horoscope:${date}:${sign}:${normLang}`;
    }

    case "home_daily_quote": {
      const date = String(templateData.currentDate || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:home_daily_quote:${date}:${normLang}`;
    }

    case "ai_horoscope_daily":
    case "ai_horoscope_general": {
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const date = String(templateData.currentDate || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_daily:${date}:${sign}:${normLang}`;
    }

    case "ai_horoscope_weekly": {
      const rev = CACHE_TYPE_REVISION.ai_horoscope_weekly;
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const weekRange = String(templateData.weekRange || "").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_weekly:${rev}:${weekRange}:${sign}:${normLang}`;
    }

    case "ai_horoscope_monthly": {
      const rev = CACHE_TYPE_REVISION.ai_horoscope_monthly;
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const month = String(templateData.month || "").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_monthly:${rev}:${year}_${month}:${sign}:${normLang}`;
    }

    case "ai_horoscope_yearly": {
      const rev = CACHE_TYPE_REVISION.ai_horoscope_yearly;
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_yearly:${rev}:${year}:${sign}:${normLang}`;
    }

    case "ascendant_calc": {
      const rev = CACHE_TYPE_REVISION.ascendant_calc;
      const risingSign = String(templateData.risingSign || "generalized").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ascendant_calc:${rev}:${risingSign}:${normLang}`;
    }

    case "love_compatibility": {
      const rev = CACHE_TYPE_REVISION.love_compatibility;
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:love_compatibility:${rev}:${sign}:${normLang}`;
    }

    case "chinese_horoscope": {
      const rev = CACHE_TYPE_REVISION.chinese_horoscope;
      const animal = String(templateData.animal || "").trim().toLowerCase();
      const element = String(templateData.element || "").trim().toLowerCase();
      const yinYang = String(templateData.yinYang || "").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:chinese_horoscope:${rev}:${year}:${animal}_${element}_${yinYang}:${normLang}`;
    }

    case "personal_horoscope": {
      const rev = CACHE_TYPE_REVISION.personal_horoscope;
      const semanticPayload = {
        sunSign: String(templateData.sunSign || "unknown").trim().toLowerCase(),
        moonSign: String(templateData.moonSign || "estimated").trim().toLowerCase(),
        risingSign: String(templateData.risingSign || "generalized").trim().toLowerCase(),
        firePercent: Number(templateData.firePercent) || 0,
        earthPercent: Number(templateData.earthPercent) || 0,
        airPercent: Number(templateData.airPercent) || 0,
        waterPercent: Number(templateData.waterPercent) || 0,
        currentDate: String(templateData.currentDate || "").trim(),
        currentYear: String(templateData.currentYear || "").trim(),
        month: String(templateData.month || "").trim().toLowerCase(),
        weekRange: String(templateData.weekRange || "").trim().toLowerCase(),
        periodType: String(templateData.periodType || "Daily").trim().toLowerCase(),
      };
      const semanticHash = createHash("sha256")
        .update(JSON.stringify(semanticPayload))
        .digest("hex")
        .slice(0, 32);
      return `aiz:cache:${CACHE_VERSION}:${normModel}:personal_horoscope:${rev}:${semanticHash}:${normLang}`;
    }

    case "numerology": {
      const rev = CACHE_TYPE_REVISION.numerology;
      const lp = String(templateData.lifePathNumber || "x").trim().toLowerCase();
      const exp = String(templateData.expressionNumber || "x").trim().toLowerCase();
      const su = String(templateData.soulUrgeNumber || "x").trim().toLowerCase();
      const pers = String(templateData.personalityNumber || "x").trim().toLowerCase();
      const bday = String(templateData.birthdayNumber || "x").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:numerology:${rev}:${lp}_${exp}_${su}_${pers}_${bday}:${normLang}`;
    }

    case "personal_astro_calendar": {
      const rev = CACHE_TYPE_REVISION.personal_astro_calendar;
      const range = String(templateData.timeRange || "daily").trim().toLowerCase();
      const d1 = String(templateData.timelineDate1 || "").trim();
      const d2 = String(templateData.timelineDate2 || "").trim();
      const d3 = String(templateData.timelineDate3 || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:personal_astro_calendar:${rev}:${range}:${d1}_${d2}_${d3}:${normLang}`;
    }

    case "personal_horoscope_period_daily": {
      const rev = CACHE_TYPE_REVISION.personal_horoscope_period_daily;
      const date = String(templateData.currentDate || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:personal_horoscope_period_daily:${rev}:${date}:${normLang}`;
    }

    case "personal_horoscope_period_weekly": {
      const rev = CACHE_TYPE_REVISION.personal_horoscope_period_weekly;
      const weekRange = String(templateData.weekRange || "").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:personal_horoscope_period_weekly:${rev}:${weekRange}:${normLang}`;
    }

    case "personal_horoscope_period_monthly": {
      const rev = CACHE_TYPE_REVISION.personal_horoscope_period_monthly;
      const month = String(templateData.month || "").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:personal_horoscope_period_monthly:${rev}:${year}_${month}:${normLang}`;
    }

    default:
      return null;
  }
}
