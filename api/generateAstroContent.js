// api/generateAstroContent.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { calculateLifePathNumber, calculateNumerology } from "../lib/factualCalculations.js";
import { getChineseZodiac_FULL } from "../lib/chineseZodiac.js";
import { calculateAscendant } from "../lib/ascendant.js";

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

const DEFAULT_DAILY_TOKEN_LIMIT = parseInt(process.env.DAILY_TOKEN_LIMIT || "10000000", 10);
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try { return await fn(); }
    catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      if (err?.status === 503) await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      else throw err;
    }
  }
}

async function isAllowedRequest(ip) {
  if (!redis) return true;
  const key = `ratelimit:${ip}`;
  try {
    const current = (await redis.get(key)) || 0;
    if (current >= 20) return false;
    await redis.incr(key);
    await redis.expire(key, 60);
    return true;
  } catch { return true; }
}

async function canUseTokens(tokens) {
  if (!redis) return true;
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_tokens:${today}`;
  try {
    const used = (await redis.get(key)) || 0;
    if (used + tokens > DEFAULT_DAILY_TOKEN_LIMIT) return false;
    await redis.incrby(key, tokens);
    await redis.expire(key, 60 * 60 * 24);
    return true;
  } catch { return true; }
}

function fillTemplate(template, data = {}) {
  let out = template;
  Object.keys(data).forEach(k => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  return out.replace(/{{\w+}}/g, "");
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
  if (parts.length !== 3) return "Becsült";
  const month = parseInt(parts[1], 10);
  if (isNaN(month) || month < 1 || month > 12) return "Becsült";
  const signs = ["Capricorn", "Aquarius", "Pisces", "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo", "Libra", "Scorpio", "Sagittarius"];
  return signs[month - 1];
}

function calculateElementBalance(sunSign, moonSign = "Becsült", ascendant = "Általános") {
  const fire = ["Aries", "Leo", "Sagittarius"];
  const earth = ["Taurus", "Virgo", "Capricorn"];
  const air = ["Gemini", "Libra", "Aquarius"];
  const water = ["Cancer", "Scorpio", "Pisces"];
  const signs = [sunSign, moonSign, ascendant].filter(s => s !== "Becsült" && s !== "Általános" && s !== "Estimated" && s !== "Generalized");
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
    // Következő hónap
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const year = nextMonth.getFullYear();
    const month = nextMonth.getMonth() + 1; // getMonth() 0-tól számol
    dates.push(`${year}-${String(month).padStart(2, '0')}-08`);
    dates.push(`${year}-${String(month).padStart(2, '0')}-16`);
    dates.push(`${year}-${String(month).padStart(2, '0')}-24`);

  } else if (timeRange === 'weekly') {
    // Következő hét hétfője
    const nextMonday = new Date(now);
    nextMonday.setDate(now.getDate() + (8 - now.getDay()) % 7);
    // Hétfő, Szerda, Péntek
    for (let i of [0, 2, 4]) {
      const date = new Date(nextMonday);
      date.setDate(nextMonday.getDate() + i);
      dates.push(date.toISOString().slice(0, 10));
    }

  } else {
    // Napi: ma, holnap, holnapután
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
  if (!(await isAllowedRequest(ip))) {
    return res.status(429).json({ error: "rate_limit_exceeded" });
  }

  try {
    const body = req.body || {};
    console.log("➡️ REQUEST BODY:", JSON.stringify(body, null, 2));

    const { type, data = {}, languageCode = "en" } = body;
    if (!type) return res.status(400).json({ error: "missing_type" });

    const currentDate = data.specificDate || new Date().toISOString().slice(0, 10);
    const currentYear = new Date(currentDate).getFullYear().toString();
    const currentMonth = getMonthName(currentDate, languageCode);
    const weekRange = getWeekRange(currentDate);

    let finalData = { ...data, currentDate };

    if (finalData.dateOfBirth) {
      finalData.sunSign = getWesternZodiac(finalData.dateOfBirth);
      finalData.moonSign = getMoonSignApprox(finalData.dateOfBirth);
      if (type === "ascendant_calc" || type === "personal_horoscope") {
        const latitude = 47.5;
        try {
          finalData.risingSign = calculateAscendant(finalData.dateOfBirth, finalData.timeOfBirth || "12:00 PM", latitude);
        } catch {
          finalData.risingSign = "Általános";
        }
      }
      if (type === "personal_horoscope") {
        const balance = calculateElementBalance(finalData.sunSign, finalData.moonSign, finalData.risingSign);
        finalData.firePercent = balance.fire;
        finalData.earthPercent = balance.earth;
        finalData.airPercent = balance.air;
        finalData.waterPercent = balance.water;
      }
    }

// Helyes kulcs: "birthDate", nem "dateOfBirth"
if (finalData.fullName && finalData.birthDate && type === "numerology") {
  // Kinyerjük a napot közvetlenül
  const birthday = parseInt(finalData.birthDay, 10) || 1;

  // A többi számot kiszámoljuk
  const num = calculateNumerology(finalData.fullName, finalData.birthDate);
console.log("🔍 Numerology output - birthday:", num.birthday); // ← EZ ÚJ
  finalData.lifePathNumber = num.lifePath;
  finalData.expressionNumber = num.expression;
  finalData.soulUrgeNumber = num.soulUrge;
  finalData.personalityNumber = num.personality;
  finalData.birthdayNumber = birthday; // ← EZ A 11!
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
      sunSign: finalData.sunSign || "Ismeretlen",
      moonSign: finalData.moonSign || "Becsült",
      risingSign: finalData.risingSign || "Általános",
      firePercent: finalData.firePercent || 0,
      earthPercent: finalData.earthPercent || 0,
      airPercent: finalData.airPercent || 0,
      waterPercent: finalData.waterPercent || 0,
      SYMBOL: finalData.SYMBOL || "",
      ANIMAL: finalData.ANIMAL || "",
      ELEMENT: finalData.ELEMENT || "",
      YIN_YANG: finalData.YIN_YANG || "",
      zodiacSign: finalData.zodiacSign || "",
      specificDate: finalData.specificDate || "",
      name: finalData.name || "",
      dateOfBirth: finalData.dateOfBirth || "",
      timeOfBirth: finalData.timeOfBirth || "12:00",
      placeOfBirth: finalData.placeOfBirth || "",
      question: finalData.question || "Nincs kérdés megadva",
      fullName: finalData.fullName || "",
      period: finalData.period || "daily",
      periodType: periodType,
      timeRange: finalData.timeRange || "daily",
      lifePathNumber: finalData.lifePathNumber || "X",
      expressionNumber: finalData.expressionNumber || "X",
      soulUrgeNumber: finalData.soulUrgeNumber || "X",
      personalityNumber: finalData.personalityNumber || "X",
      birthdayNumber: finalData.birthdayNumber || "X",
      timelineDate1: finalData.timelineDate1 || "",
      timelineDate2: finalData.timelineDate2 || "",
      timelineDate3: finalData.timelineDate3 || "",
      // --- FIX: Add lowercase keys for Chinese horoscope prompt ---
      animal: finalData.ANIMAL || "",
      element: finalData.ELEMENT || "",
      yinYang: finalData.YIN_YANG || "",
    };

    const filledPrompt = fillTemplate(promptTemplate, templateData);
	console.log("📝 Filled prompt for chinese_horoscope:\n", filledPrompt);
    const estimatedTokens = Math.ceil(filledPrompt.length / 4) + 200;

    if (!(await canUseTokens(estimatedTokens))) {
      return res.status(429).json({ error: "token_limit_exceeded" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "server_config_error" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    const result = await retryWithBackoff(() => model.generateContent(filledPrompt));
    const text = result.response.text();

    console.log("⬅️ AI RESPONSE CONTENT:", text.trim());

    return res.status(200).json({ success: true, content: text.trim() });

  } catch (error) {
    console.error("Error in generateAstroContent:", error);
    return res.status(500).json({ error: "internal_error", message: error.message || "Unexpected error" });
  }
}