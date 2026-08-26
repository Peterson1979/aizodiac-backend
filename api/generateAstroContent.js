// api/generateAstroContent.js
import { GoogleGenAI } from "@google/genai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { calculateLifePathNumber, calculateNumerology } from "../lib/factualCalculations.js";
import { getChineseZodiac_FULL } from "../lib/chineseZodiac.js";
import { calculateAscendant, getCoordinatesFromLocation } from "../lib/ascendant.js";
import { getSharedCacheKey, TTL_SECONDS } from "../lib/cacheHelper.js";
import { extractUsageMetadata, recordUsageTelemetry, recordReserveTelemetry } from "../lib/telemetryHelper.js";
import {
  getInternalAiSchema,
  mergeDeterministicFields,
  validateResponseObject,
  getResponseSchema,
  getMaxOutputTokens
} from "../lib/responseSchemas.js";
import {
  executeProviderRouting,
  DEFAULT_PROVIDER,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  AI_PROVIDERS
} from "../lib/aiProvider.js";
import {
  checkAbuseRateLimit,
  DEFAULT_PRIMARY_PROVIDER,
  DEFAULT_FALLBACK_PROVIDER
} from "../lib/budgetHelper.js";
import { generateReserveResponse } from "../lib/reserveGenerator.js";

export const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const MAX_RETRIES = 5;

export async function retryWithBackoff(fn, retries = MAX_RETRIES, sleepFn = (ms) => new Promise(r => setTimeout(r, ms))) {
  let attempt = 0;
  while (attempt < retries) {
    try { return await fn(); }
    catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      if (err?.status === 503) await sleepFn(Math.pow(2, attempt) * 1000);
      else throw err;
    }
  }
}

function fillTemplate(template, data = {}) {
  let out = template;
  Object.keys(data).forEach(k => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  return out.replace(/{{\w+}}/g, "");
}

// ISO date (YYYY-MM-DD) → DD/MM/YYYY
function isoToDdMmYyyy(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function getWesternZodiac(dateStr) {
  const [day, month] = dateStr.split("/").map(Number);
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "Aries";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "Taurus";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return "Gemini";
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return "Cancer";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "Leo";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "Virgo";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "Libra";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return "Scorpio";
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return "Sagittarius";
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return "Capricorn";
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "Aquarius";
  return "Pisces";
}

function getMoonSignApprox(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) return "Estimated";
  const month = parseInt(parts[1], 10);
  if (isNaN(month) || month < 1 || month > 12) return "Estimated";
  const signs = ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"];
  return signs[month - 1];
}

function calculateElementBalance(sunSign, moonSign = "Estimated", ascendant = "Generalized") {
  const fire = ["Aries", "Leo", "Sagittarius"];
  const earth = ["Taurus", "Virgo", "Capricorn"];
  const air = ["Gemini", "Libra", "Aquarius"];
  const water = ["Cancer", "Scorpio", "Pisces"];
  const signs = [sunSign, moonSign, ascendant].filter(s => s !== "Estimated" && s !== "Generalized");
  const counts = { fire: 0, earth: 0, air: 0, water: 0 };
  signs.forEach(sign => {
    if (fire.includes(sign)) counts.fire++;
    else if (earth.includes(sign)) counts.earth++;
    else if (air.includes(sign)) counts.air++;
    else if (water.includes(sign)) counts.water++;
  });
  const total = signs.length || 1;
  return {
    fire: Math.round((counts.fire / total) * 100 / 5) * 5,
    earth: Math.round((counts.earth / total) * 100 / 5) * 5,
    air: Math.round((counts.air / total) * 100 / 5) * 5,
    water: Math.round((counts.water / total) * 100 / 5) * 5,
  };
}

function getMonthName(dateStr, locale = 'en') {
  const date = new Date(dateStr);
  return date.toLocaleString(locale, { month: 'long' });
}

function getWeekRange(dateStr) {
  const date = new Date(dateStr);
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toISOString().slice(0, 10)} to ${sunday.toISOString().slice(0, 10)}`;
}

function getTimelineDates(timeRange = 'daily') {
  const now = new Date();
  const dates = [];

  if (timeRange === 'monthly') {
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextMonth.getFullYear();
    const month = nextMonth.getMonth() + 1;
    dates.push(`${year}-${String(month).padStart(2, '0')}-08`);
    dates.push(`${year}-${String(month).padStart(2, '0')}-16`);
    dates.push(`${year}-${String(month).padStart(2, '0')}-24`);
  } else if (timeRange === 'weekly') {
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
    for (let i of [0, 2, 4]) {
      const date = new Date(nextMonday);
      date.setDate(nextMonday.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const date = new Date(now);
      date.setDate(now.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }
  }
  return dates;
}

function extractBirthdayFromDdMmYyyy(dateStr) {
  const parts = String(dateStr || "").split('/');
  if (parts.length >= 1) {
    const day = parseInt(parts[0], 10);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      return day;
    }
  }
  return 1;
}

/**
 * Unified, canonical request processor for all AI Zodiac generation requests.
 * Shared by api/generateAstroContent.js and api/astro.js.
 */
export async function processAstroRequest({
  body = {},
  ip = "unknown",
  redisClient = redis,
  sleepFn,
}) {
  const { type, data = {}, languageCode = "en" } = body;
  if (!type) {
    return { status: 400, headers: {}, body: { error: "missing_type" } };
  }

  // Safe input length sanitization
  const safeLang = String(languageCode || "en").trim().slice(0, 10).toLowerCase();
  const safeData = { ...data };
  if (safeData.question) {
    safeData.question = String(safeData.question).slice(0, 500); // 500 chars max question length
  }
  if (safeData.fullName) {
    safeData.fullName = String(safeData.fullName).slice(0, 100);
  }
  if (safeData.placeOfBirth) {
    safeData.placeOfBirth = String(safeData.placeOfBirth).slice(0, 100);
  }

  const currentDate = safeData.specificDate || new Date().toISOString().slice(0, 10);
  const currentYear = new Date(currentDate).getFullYear().toString();
  const currentMonth = getMonthName(currentDate, safeLang);
  const weekRange = getWeekRange(currentDate);

  let finalData = { ...safeData, currentDate, currentYear, currentMonth, month: currentMonth, weekRange };

  let sunSign = "Unknown";
  let moonSign = "Estimated";
  let risingSign = "Generalized";

  if (finalData.dateOfBirth) {
    let ddMmYyyy;
    if (/^\d{4}-\d{2}-\d{2}$/.test(finalData.dateOfBirth)) {
      ddMmYyyy = isoToDdMmYyyy(finalData.dateOfBirth);
    } else {
      ddMmYyyy = String(finalData.dateOfBirth).slice(0, 10);
    }

    sunSign = getWesternZodiac(ddMmYyyy);
    moonSign = getMoonSignApprox(ddMmYyyy);

    if (type === "ascendant_calc" || type === "personal_horoscope") {
      const place = finalData.placeOfBirth?.trim() || "";
      if (place) {
        try {
          const coords = await getCoordinatesFromLocation(place);
          risingSign = calculateAscendant(
            finalData.dateOfBirth,
            finalData.timeOfBirth || "12:00 PM",
            coords.latitude,
            coords.longitude
          );
        } catch (err) {
          risingSign = "Generalized";
        }
      }
    }

    if (type === "personal_horoscope") {
      const balance = calculateElementBalance(sunSign, moonSign, risingSign);
      finalData.firePercent = balance.fire;
      finalData.earthPercent = balance.earth;
      finalData.airPercent = balance.air;
      finalData.waterPercent = balance.water;
    }
  }

  if (type === "numerology") {
    if (!finalData.fullName || !finalData.dateOfBirth) {
      return { status: 400, headers: {}, body: { error: "missing_fullName_or_dateOfBirth_for_numerology" } };
    }

    const birthdayNumber = extractBirthdayFromDdMmYyyy(finalData.dateOfBirth);
    const num = calculateNumerology(finalData.fullName, finalData.dateOfBirth);

    finalData.lifePathNumber = num.lifePath;
    finalData.expressionNumber = num.expression;
    finalData.soulUrgeNumber = num.soulUrge;
    finalData.personalityNumber = num.personality;
    finalData.birthdayNumber = birthdayNumber;
  }

  if (finalData.dateOfBirth && type === "chinese_horoscope") {
    try {
      const zodiac = getChineseZodiac_FULL(finalData.dateOfBirth);
      finalData.SYMBOL = zodiac.symbol;
      finalData.ANIMAL = zodiac.animal;
      finalData.ELEMENT = zodiac.element;
      finalData.YIN_YANG = zodiac.yinYang;
    } catch {
      return { status: 400, headers: {}, body: { error: "invalid_date_format" } };
    }
  }

  if (type === "personal_astro_calendar") {
    const timeRange = finalData.timeRange || finalData.period || "daily";
    const timelineDates = getTimelineDates(timeRange);
    finalData.timelineDate1 = timelineDates[0];
    finalData.timelineDate2 = timelineDates[1];
    finalData.timelineDate3 = timelineDates[2];
  }

  finalData.sunSign = sunSign;
  finalData.moonSign = moonSign;
  finalData.risingSign = risingSign;

  const promptTemplate = PROMPTS[type];
  if (!promptTemplate) {
    return { status: 400, headers: {}, body: { error: "unknown_type" } };
  }

  const periodMap = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };
  const periodType = periodMap[finalData.period] || "Daily";

  const templateData = {
    language: safeLang,
    currentDate: currentDate,
    currentYear: currentYear,
    month: currentMonth,
    weekRange: weekRange,
  };

  if (type === "ascendant_calc") {
    templateData.risingSign = risingSign;
    templateData.birthTime = finalData.timeOfBirth || "12:00 PM";
    templateData.birthPlace = finalData.placeOfBirth || "Nincs megadva";
  }

  if (type === "home_daily_horoscope" || type.startsWith("ai_horoscope_") || type === "love_compatibility") {
    const rawSign = String(finalData.zodiacSign || "Aries").trim();
    templateData.zodiacSign = rawSign.length > 0 ? (rawSign.charAt(0).toUpperCase() + rawSign.slice(1).toLowerCase()) : "Aries";
    if (type !== "love_compatibility") {
      templateData.periodType = periodType;
    }
  }

  if (type === "chinese_horoscope") {
    templateData.animal = finalData.ANIMAL || "";
    templateData.element = finalData.ELEMENT || "";
    templateData.yinYang = finalData.YIN_YANG || "";
  }

  if (type === "personal_horoscope") {
    templateData.sunSign = sunSign;
    templateData.moonSign = moonSign;
    templateData.risingSign = risingSign;
    templateData.firePercent = finalData.firePercent || 0;
    templateData.earthPercent = finalData.earthPercent || 0;
    templateData.airPercent = finalData.airPercent || 0;
    templateData.waterPercent = finalData.waterPercent || 0;
    templateData.periodType = periodType;
  }

  if (type === "numerology") {
    templateData.lifePathNumber = finalData.lifePathNumber || "X";
    templateData.expressionNumber = finalData.expressionNumber || "X";
    templateData.soulUrgeNumber = finalData.soulUrgeNumber || "X";
    templateData.personalityNumber = finalData.personalityNumber || "X";
    templateData.birthdayNumber = finalData.birthdayNumber || "X";
  }

  if (type === "personal_astro_calendar") {
    templateData.timelineDate1 = finalData.timelineDate1 || "";
    templateData.timelineDate2 = finalData.timelineDate2 || "";
    templateData.timelineDate3 = finalData.timelineDate3 || "";
    templateData.timeRange = finalData.timeRange || "daily";
  }

  if (type === "ask_the_stars") {
    templateData.question = finalData.question || "Nincs kérdés megadva";
  }

  const filledPrompt = fillTemplate(promptTemplate, templateData);

  const primaryProvider = process.env.AI_PRIMARY_PROVIDER || DEFAULT_PRIMARY_PROVIDER;
  const fallbackProvider = process.env.AI_FALLBACK_PROVIDER || DEFAULT_FALLBACK_PROVIDER;

  const primaryModel = primaryProvider === AI_PROVIDERS.GROQ
    ? (process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL)
    : (process.env.GENERATIVE_MODEL || DEFAULT_GEMINI_MODEL);

  const fallbackModel = fallbackProvider === AI_PROVIDERS.GEMINI
    ? (process.env.GENERATIVE_MODEL || DEFAULT_GEMINI_MODEL)
    : (process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL);

  // =========================================================================
  // 1. CACHE FIRST — ALWAYS (Check primary provider cache, then fallback cache)
  // =========================================================================
  const primaryCacheKey = getSharedCacheKey(type, templateData, primaryModel, primaryProvider);
  const fallbackCacheKey = getSharedCacheKey(type, templateData, fallbackModel, fallbackProvider);

  if (redisClient) {
    try {
      if (primaryCacheKey) {
        const cached = await redisClient.get(primaryCacheKey);
        if (cached !== null && cached !== undefined) {
          const cachedText = typeof cached === "string" ? cached.trim() : JSON.stringify(cached);
          if (cachedText.length > 0) {
            return {
              status: 200,
              headers: { "X-AIZ-Source": "cache", "X-AIZ-Cache": "HIT" },
              body: { success: true, type, content: cachedText }
            };
          }
        }
      }

      if (fallbackCacheKey && fallbackCacheKey !== primaryCacheKey) {
        const cachedFallback = await redisClient.get(fallbackCacheKey);
        if (cachedFallback !== null && cachedFallback !== undefined) {
          const cachedText = typeof cachedFallback === "string" ? cachedFallback.trim() : JSON.stringify(cachedFallback);
          if (cachedText.length > 0) {
            return {
              status: 200,
              headers: { "X-AIZ-Source": "cache", "X-AIZ-Cache": "HIT" },
              body: { success: true, type, content: cachedText }
            };
          }
        }
      }
    } catch (cacheGetErr) {
      console.warn("⚠️ Redis cache GET error (failing open):", cacheGetErr.message);
    }
  }

  // =========================================================================
  // 2. ABUSE RATE LIMIT (Applied ONLY on cache MISS / generation requests)
  // =========================================================================
  const abuseCheck = await checkAbuseRateLimit(redisClient, ip, type);
  if (!abuseCheck.allowed) {
    return {
      status: 429,
      headers: { "X-AIZ-Cache": "NONE" },
      body: { error: "token_limit_exceeded", reason: "AI_RATE_LIMITED" }
    };
  }

  // =========================================================================
  // 3. ATOMIC BUDGET ADMISSION & ROUTED GENERATION (With Emergency Reserve Fallback)
  // =========================================================================
  const aiSchema = getInternalAiSchema(type);
  const maxTokens = getMaxOutputTokens(type);

  let aiResult;
  let fallbackToReserve = false;
  let reserveReasonCategory = "budget";

  try {
    aiResult = await executeProviderRouting({
      type,
      prompt: filledPrompt,
      responseSchema: aiSchema,
      maxOutputTokens: maxTokens,
      redis: redisClient,
      geminiRetryFn: retryWithBackoff,
      groqSleepFn: sleepFn,
    });
  } catch (routeErr) {
    const status = routeErr?.status || 0;
    const reason = routeErr?.reason || routeErr?.message || "";

    if (
      status === 429 ||
      reason.includes("BUDGET_EXHAUSTED") ||
      reason.includes("BUDGET_SERVICE_") ||
      reason.includes("TRANSIENT_FAILURE") ||
      status === 503 ||
      status === 502 ||
      status === 504
    ) {
      fallbackToReserve = true;
      if (reason.includes("BUDGET_SERVICE_")) {
        reserveReasonCategory = "budget_service_failure";
      } else if (reason.includes("TRANSIENT_FAILURE") || status >= 500) {
        reserveReasonCategory = "provider_failure";
      } else {
        reserveReasonCategory = "budget";
      }
    } else {
      throw routeErr;
    }
  }

  if (fallbackToReserve) {
    const reserveResult = generateReserveResponse(type, finalData, safeLang);
    await recordReserveTelemetry(redisClient, type, reserveReasonCategory, new Date());

    return {
      status: 200,
      headers: { "X-AIZ-Source": "reserve", "X-AIZ-Cache": "RESERVE" },
      body: { success: true, type, content: reserveResult.content }
    };
  }

  const text = aiResult?.text || "";
  const trimmedText = text.trim();

  let rawAiObj;
  try {
    rawAiObj = JSON.parse(trimmedText);
  } catch (jsonErr) {
    console.error(`❌ Structured output JSON parse failed for ${type} [${aiResult?.provider}]`);
    return {
      status: 500,
      headers: {},
      body: { error: "invalid_ai_response", message: "Failed to parse structured JSON from AI" }
    };
  }

  const finalObj = mergeDeterministicFields(type, rawAiObj, finalData, safeLang);

  if (!validateResponseObject(type, finalObj)) {
    console.error(`❌ Final response object validation failed for ${type}`);
    return {
      status: 500,
      headers: {},
      body: { error: "invalid_ai_response", message: "Missing required response fields after merge" }
    };
  }

  const finalJsonString = JSON.stringify(finalObj);

  // Record exact provider token usage telemetry
  const usage = aiResult.usage;
  await recordUsageTelemetry(redisClient, type, usage, new Date(), aiResult.provider, aiResult.model);

  // =========================================================================
  // 4. CACHE SET (Saved under the ACTUALLY winning provider's identity)
  // =========================================================================
  const winningCacheKey = getSharedCacheKey(type, templateData, aiResult.model, aiResult.provider);
  if (winningCacheKey && redisClient && finalJsonString.length > 0) {
    const ttl = TTL_SECONDS[type] || 36 * 3600;
    try {
      await redisClient.set(winningCacheKey, finalJsonString, { ex: ttl });
    } catch (cacheSetErr) {
      console.warn("⚠️ Redis cache SET error (failing open):", cacheSetErr.message);
    }
  }

  return {
    status: 200,
    headers: { "X-AIZ-Source": aiResult.provider, "X-AIZ-Cache": "MISS" },
    body: { success: true, type, content: finalJsonString }
  };
}

/**
 * Standard Vercel Serverless Function entrypoint (Node.js style req, res).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rawIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(",")[0].trim();

  try {
    const body = req.body || {};
    const result = await processAstroRequest({
      body,
      ip,
      redisClient: redis,
    });

    if (result.headers) {
      Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    }

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Error in generateAstroContent:", error.message || error);
    return res.status(500).json({ error: "internal_error" });
  }
}