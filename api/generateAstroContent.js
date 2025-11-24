// api/generateAstroContent.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { calculateLifePathNumber, getChineseZodiac_FULL } from "../lib/factualCalculations.js";
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
    const { type, data = {}, languageCode = "en" } = body;
    if (!type) return res.status(400).json({ error: "missing_type" });

    const currentDate = new Date().toISOString().slice(0, 10); // ← MAI DÁTUM
    let finalData = { ...data, currentDate };

    if (finalData.dateOfBirth) {
      finalData.sunSign = getWesternZodiac(finalData.dateOfBirth);
      finalData.moonSign = "Estimated";
      
      if (type === "ascendant_calc" || type === "personal_horoscope") {
        const latitude = 47.5;
        try {
          finalData.risingSign = calculateAscendant(
            finalData.dateOfBirth,
            finalData.timeOfBirth || "12:00 PM",
            latitude
          );
        } catch {
          finalData.risingSign = "Generalized";
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

    if (finalData.dateOfBirth && type === "numerology") {
      finalData.lifePathNumber = calculateLifePathNumber(finalData.dateOfBirth);
    }

    if (finalData.dateOfBirth && type === "chinese_horoscope") {
      const zodiac = getChineseZodiac_FULL(finalData.dateOfBirth);
      finalData.SYMBOL = zodiac.symbol;
      finalData.ANIMAL = zodiac.animal;
      finalData.ELEMENT = zodiac.element;
      finalData.YIN_YANG = zodiac.yinYang;
    }

    let promptTemplate = PROMPTS[type];

// Ha az adott horoszkóptípus időperiódus szerint bontott
if (typeof promptTemplate === "object" && promptTemplate[templateData.period]) {
  promptTemplate = promptTemplate[templateData.period];
}

if (!promptTemplate) {
  return res.status(400).json({ error: "unknown_type_or_period" });
}

    if (!promptTemplate) return res.status(400).json({ error: "unknown_type" });

    const templateData = {
      language: languageCode,
      currentDate: currentDate,
      sunSign: finalData.sunSign || "Unknown",
      moonSign: finalData.moonSign || "Estimated",
      risingSign: finalData.risingSign || "Generalized",
      firePercent: finalData.firePercent || 0,
      earthPercent: finalData.earthPercent || 0,
      airPercent: finalData.airPercent || 0,
      waterPercent: finalData.waterPercent || 0,
      SYMBOL: finalData.SYMBOL || "",
      ANIMAL: finalData.ANIMAL || "",
      ELEMENT: finalData.ELEMENT || "",
      YIN_YANG: finalData.YIN_YANG || "",
      zodiacSign: finalData.zodiacSign || "",
      specificDate: finalData.specificDate || finalData.date || "",
      name: finalData.name || "",
      dateOfBirth: finalData.dateOfBirth || "",
      timeOfBirth: finalData.timeOfBirth || "12:00 PM",
      placeOfBirth: finalData.placeOfBirth || "",
      question: finalData.question || "",
      fullName: finalData.fullName || "",
      period: finalData.period || "daily",
      timeRange: finalData.timeRange || "day",
      focusArea: finalData.focusArea || "general",
      lifePathNumber: finalData.lifePathNumber || "X",
    };

    const filledPrompt = fillTemplate(promptTemplate, templateData);
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
    return res.status(200).json({ success: true, content: text.trim() });

  } catch (error) {
    console.error("Error in generateAstroContent:", error);
    return res.status(500).json({ error: "internal_error", message: error.message || "Unexpected error" });
  }
}