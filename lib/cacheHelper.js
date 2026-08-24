// lib/cacheHelper.js

export const CACHE_VERSION = "v2";

export const TTL_SECONDS = {
  home_daily_horoscope: 36 * 3600,   // ~36 hours
  home_daily_quote: 36 * 3600,       // ~36 hours
  ai_horoscope_daily: 36 * 3600,     // ~36 hours
  ai_horoscope_general: 36 * 3600,   // ~36 hours
  ai_horoscope_weekly: 10 * 86400,   // 10 days
  ai_horoscope_monthly: 45 * 86400,  // 45 days
  ai_horoscope_yearly: 380 * 86400,  // 380 days
  ascendant_calc: 180 * 86400,       // 180 days
  love_compatibility: 180 * 86400,   // 180 days
  chinese_horoscope: 380 * 86400,    // 380 days
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
]);

export function isSharedCacheEligible(type) {
  return SHARED_CACHE_TYPES.has(type);
}

export function getSharedCacheKey(type, templateData = {}, model = "default") {
  if (!isSharedCacheEligible(type)) {
    return null;
  }

  const normModel = String(model || "default").trim().toLowerCase();
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
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const weekRange = String(templateData.weekRange || "").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_weekly:${weekRange}:${sign}:${normLang}`;
    }

    case "ai_horoscope_monthly": {
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const month = String(templateData.month || "").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_monthly:${year}_${month}:${sign}:${normLang}`;
    }

    case "ai_horoscope_yearly": {
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ai_horoscope_yearly:${year}:${sign}:${normLang}`;
    }

    case "ascendant_calc": {
      const risingSign = String(templateData.risingSign || "generalized").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:ascendant_calc:${risingSign}:${normLang}`;
    }

    case "love_compatibility": {
      const sign = String(templateData.zodiacSign || "unknown").trim().toLowerCase();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:love_compatibility:${sign}:${normLang}`;
    }

    case "chinese_horoscope": {
      const animal = String(templateData.animal || "").trim().toLowerCase();
      const element = String(templateData.element || "").trim().toLowerCase();
      const yinYang = String(templateData.yinYang || "").trim().toLowerCase();
      const year = String(templateData.currentYear || "").trim();
      return `aiz:cache:${CACHE_VERSION}:${normModel}:chinese_horoscope:${year}:${animal}_${element}_${yinYang}:${normLang}`;
    }

    default:
      return null;
  }
}
