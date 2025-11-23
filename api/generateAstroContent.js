// api/generateAstroContent.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { calculateLifePathNumber, getChineseZodiac_FULL } from "../lib/factualCalculations.js";
import { calculateAscendant } from "../lib/ascendant.js";

// --- Redis setup ---
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// --- Config ---
const DEFAULT_DAILY_TOKEN_LIMIT = parseInt(process.env.DAILY_TOKEN_LIMIT || "10000000", 10);
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

// --- Retry with backoff ---
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      if (err?.status === 503) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 500));
      } else {
        throw err;
      }
    }
  }
}

// --- Rate Limiting ---
async function isAllowedRequest(ip) {
  if (!redis) return true;
  const key = `ratelimit:${ip}`;
  try {
    const current = (await redis.get(key)) || 0;
    if (current >= 20) return false;
    await redis.incr(key);
    await redis.expire(key, 60);
    return true;
  } catch (e) {
    return true;
  }
}

// --- Token Limit ---
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
  } catch (e) {
    return true;
  }
}

// --- Fill Template ---
function fillTemplate(template, data = {}) {
  let out = template;
  Object.keys(data).forEach(k => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  return out.replace(/{{\w+}}/g, "");
}

// --- Main handler ---
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

    let finalData = { ...data };

    // Aszcendens számítása ASCENDANT_CALC és PERSONAL_HOROSCOPE esetén is
    if (finalData.dateOfBirth && (type === "ascendant_calc" || type === "personal_horoscope")) {
      const latitude = 47.5; // Budapest közelében
      try {
        finalData.risingSign = calculateAscendant(
          finalData.dateOfBirth,
          finalData.timeOfBirth || "12:00 PM",
          latitude
        );
      } catch (e) {
        finalData.risingSign = "Generalized";
      }
    }

    // Numerológia
    if (finalData.dateOfBirth && type === "numerology") {
      finalData.lifePathNumber = calculateLifePathNumber(finalData.dateOfBirth);
    }

    // Kínai horoszkóp
    if (finalData.dateOfBirth && type === "chinese_horoscope") {
      const zodiac = getChineseZodiac_FULL(finalData.dateOfBirth);
      finalData.SYMBOL = zodiac.symbol;
      finalData.ANIMAL = zodiac.animal;
      finalData.ELEMENT = zodiac.element;
      finalData.YIN_YANG = zodiac.yinYang;
    }

    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) return res.status(400).json({ error: "unknown_type" });

    const languageName = languageCode;

    const templateData = {
      language: languageName,
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
      lifePathNumber: finalData.lifePathNumber || "",
      risingSign: finalData.risingSign || "Generalized",
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

    const result = await retryWithBackoff(async () => {
      try {
        return await model.generateContent(filledPrompt);
      } catch (err) {
        if (err?.status === 503) {
          throw err;
        }
        throw new Error("Non-retryable error");
      }
    });

    const text = result.response.text();
    return res.status(200).json({ success: true, content: text.trim() });

  } catch (error) {
    console.error("Error in generateAstroContent:", error);
    return res.status(500).json({ error: "internal_error", message: error.message || "Unexpected error" });
  }
}