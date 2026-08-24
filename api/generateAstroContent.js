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

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
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

// ISO dátum (YYYY-MM-DD) → DD/MM/YYYY
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const rawIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp).split(",")[0].trim();

  try {
    const body = req.body || {};
    console.log("➡️ REQUEST BODY:", JSON.stringify(body, null, 2));

    const { type, data = {}, languageCode = "en" } = body;
    if (!type) return res.status(400).json({ error: "missing_type" });

    const currentDate = data.specificDate || new Date().toISOString().slice(0, 10);
    const currentYear = new Date(currentDate).getFullYear().toString();
    const currentMonth = getMonthName(currentDate, languageCode);
    const weekRange = getWeekRange(currentDate);

    let finalData = { ...data, currentDate, currentYear, currentMonth, month: currentMonth, weekRange };

    let sunSign = "Unknown";
    let moonSign = "Estimated";
    let risingSign = "Generalized";

    if (finalData.dateOfBirth) {
      let ddMmYyyy;
      if (/^\d{4}-\d{2}-\d{2}$/.test(finalData.dateOfBirth)) {
        ddMmYyyy = isoToDdMmYyyy(finalData.dateOfBirth);
      } else {
        ddMmYyyy = finalData.dateOfBirth;
      }

      sunSign = getWesternZodiac(ddMmYyyy);
      moonSign = getMoonSignApprox(ddMmYyyy);

      if (type === "ascendant_calc" || type === "personal_horoscope") {
        const place = finalData.placeOfBirth?.trim() || "";

        if (place) {
          try {
            const coords = await getCoordinatesFromLocation(place);
            console.log("🌍 Lekért koordináták:", coords);

            risingSign = calculateAscendant(
              finalData.dateOfBirth,
              finalData.timeOfBirth || "12:00 PM",
              coords.latitude,
              coords.longitude
            );
            console.log("✅ Számított aszcendens:", risingSign);
          } catch (err) {
            console.warn("⚠️ Aszcendens számítás sikertelen, fallback:", err.message);
            risingSign = "Generalized";
          }
        } else {
          console.warn("⚠️ Nincs születési hely megadva – nem lehet aszcendenst számolni.");
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
        return res.status(400).json({ error: "missing_fullName_or_dateOfBirth_for_numerology" });
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
      console.log("🔍 Chinese Zodiac input date:", finalData.dateOfBirth);
      const zodiac = getChineseZodiac_FULL(finalData.dateOfBirth);
      console.log("✅ Chinese Zodiac result:", zodiac);
      finalData.SYMBOL = zodiac.symbol;
      finalData.ANIMAL = zodiac.animal;
      finalData.ELEMENT = zodiac.element;
      finalData.YIN_YANG = zodiac.yinYang;
    }

    if (type === "personal_astro_calendar") {
      const timeRange = finalData.timeRange || "daily";
      const timelineDates = getTimelineDates(timeRange);
      finalData.timelineDate1 = timelineDates[0];
      finalData.timelineDate2 = timelineDates[1];
      finalData.timelineDate3 = timelineDates[2];
    }

    finalData.sunSign = sunSign;
    finalData.moonSign = moonSign;
    finalData.risingSign = risingSign;

    let promptTemplate = PROMPTS[type];
    if (!promptTemplate) return res.status(400).json({ error: "unknown_type" });

    const periodMap = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly', 'yearly': 'Yearly' };
    const periodType = periodMap[finalData.period] || 'Daily';

    const templateData = {
      language: languageCode,
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

    if (type === "home_daily_horoscope" || 
        type.startsWith("ai_horoscope_") || 
        type === "love_compatibility") {
      templateData.zodiacSign = finalData.zodiacSign || "Ismeretlen";
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
    console.log(`📝 Filled prompt for ${type}:\n`, filledPrompt);

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

    if (redis) {
      try {
        if (primaryCacheKey) {
          const cached = await redis.get(primaryCacheKey);
          if (cached !== null && cached !== undefined) {
            const cachedText = typeof cached === "string" ? cached.trim() : JSON.stringify(cached);
            if (cachedText.length > 0) {
              res.setHeader("X-AIZ-Source", "cache");
              res.setHeader("X-AIZ-Cache", "HIT");
              console.log(`⚡ CACHE HIT for ${type} [Primary]: ${primaryCacheKey}`);
              return res.status(200).json({ success: true, content: cachedText });
            }
          }
        }

        if (fallbackCacheKey && fallbackCacheKey !== primaryCacheKey) {
          const cachedFallback = await redis.get(fallbackCacheKey);
          if (cachedFallback !== null && cachedFallback !== undefined) {
            const cachedText = typeof cachedFallback === "string" ? cachedFallback.trim() : JSON.stringify(cachedFallback);
            if (cachedText.length > 0) {
              res.setHeader("X-AIZ-Source", "cache");
              res.setHeader("X-AIZ-Cache", "HIT");
              console.log(`⚡ CACHE HIT for ${type} [Fallback]: ${fallbackCacheKey}`);
              return res.status(200).json({ success: true, content: cachedText });
            }
          }
        }
      } catch (cacheGetErr) {
        console.warn("⚠️ Redis cache GET error (failing open):", cacheGetErr.message);
      }
    }

    res.setHeader("X-AIZ-Cache", primaryCacheKey ? "BYPASS" : "NONE");

    // =========================================================================
    // 2. ABUSE RATE LIMIT (Applied ONLY on cache MISS / generation requests)
    // =========================================================================
    const abuseCheck = await checkAbuseRateLimit(redis, ip, type);
    if (!abuseCheck.allowed) {
      console.warn(`🛑 Abuse rate limit exceeded for ${type} [IP hash]:`, abuseCheck);
      return res.status(429).json({
        error: "token_limit_exceeded",
        reason: "AI_RATE_LIMITED"
      });
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
        redis,
        geminiRetryFn: retryWithBackoff,
      });
    } catch (routeErr) {
      const status = routeErr?.status || 0;
      const reason = routeErr?.reason || routeErr?.message || "";

      // Controlled conditions for Emergency Reserve activation
      if (
        status === 429 ||
        reason.includes("BUDGET_EXHAUSTED") ||
        reason.includes("BUDGET_SERVICE_") ||
        reason.includes("TRANSIENT_FAILURE") ||
        status === 503 ||
        status === 502 ||
        status === 504
      ) {
        console.warn(`🛡️ Activating Emergency Content Reserve for ${type}: ${reason}`);
        fallbackToReserve = true;
        if (reason.includes("BUDGET_SERVICE_")) {
          reserveReasonCategory = "budget_service_failure";
        } else if (reason.includes("TRANSIENT_FAILURE") || status >= 500) {
          reserveReasonCategory = "provider_failure";
        } else {
          reserveReasonCategory = "budget";
        }
      } else {
        // Uncontrolled failures (e.g. 400, 401, 403, 404, or programming errors) fail closed
        throw routeErr;
      }
    }

    if (fallbackToReserve) {
      // Generate 100% deterministic local response (0 tokens, 0 AI calls)
      const reserveResult = generateReserveResponse(type, finalData, languageCode);
      await recordReserveTelemetry(redis, type, reserveReasonCategory, new Date());

      res.setHeader("X-AIZ-Source", "reserve");
      res.setHeader("X-AIZ-Cache", "RESERVE");
      console.log(`🛡️ Emergency Reserve generated successfully for ${type}`);
      return res.status(200).json({ success: true, content: reserveResult.content });
    }

    const text = aiResult?.text || "";
    const trimmedText = text.trim();

    let rawAiObj;
    try {
      rawAiObj = JSON.parse(trimmedText);
    } catch (jsonErr) {
      console.error(`❌ Structured output JSON parse failed for ${type} [${aiResult?.provider}]:`, jsonErr.message, "\nRaw text:", trimmedText);
      return res.status(500).json({ error: "invalid_ai_response", message: "Failed to parse structured JSON from AI" });
    }

    // Merge server-side deterministic fields into the final response object
    const finalObj = mergeDeterministicFields(type, rawAiObj, finalData, languageCode);

    // Validate final merged object against canonical full response schema
    if (!validateResponseObject(type, finalObj)) {
      console.error(`❌ Final response object validation failed for ${type}. Missing required fields.`, finalObj);
      return res.status(500).json({ error: "invalid_ai_response", message: "Missing required response fields after merge" });
    }

    const finalJsonString = JSON.stringify(finalObj);

    // Record exact provider token usage telemetry
    const usage = aiResult.usage;
    await recordUsageTelemetry(redis, type, usage, new Date(), aiResult.provider, aiResult.model);
    console.log(`📊 Token Telemetry for ${type} [${aiResult.provider}/${aiResult.model}]: Prompt=${usage.promptTokens}, Candidates=${usage.candidateTokens}, Total=${usage.totalTokens}`);

    // =========================================================================
    // 4. CACHE SET (Saved under the ACTUALLY winning provider's identity)
    // =========================================================================
    const winningCacheKey = getSharedCacheKey(type, templateData, aiResult.model, aiResult.provider);
    if (winningCacheKey && redis && finalJsonString.length > 0) {
      const ttl = TTL_SECONDS[type] || 36 * 3600;
      try {
        await redis.set(winningCacheKey, finalJsonString, { ex: ttl });
      } catch (cacheSetErr) {
        console.warn("⚠️ Redis cache SET error (failing open):", cacheSetErr.message);
      }
      res.setHeader("X-AIZ-Cache", "MISS");
    }

    res.setHeader("X-AIZ-Source", aiResult.provider);
    console.log("⬅️ AI RESPONSE CONTENT:", finalJsonString);
    return res.status(200).json({ success: true, content: finalJsonString });

  } catch (error) {
    console.error("Error in generateAstroContent:", error);
    return res.status(500).json({ error: "internal_error", message: error.message || "Unexpected error" });
  }
}

// Segédfüggvény: Birthday Number kinyerése DD/MM/YYYY formátumból
function extractBirthdayFromDdMmYyyy(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length >= 1) {
    const day = parseInt(parts[0], 10);
    if (!isNaN(day) && day >= 1 && day <= 31) {
      return day;
    }
  }
  return 1;
}