// api/generateAstroContent.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";

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

// --- Rate Limiting ---
async function isAllowedRequest(ip) {
  if (!redis) return true;
  const key = `ratelimit:${ip}`;
  try {
    const current = (await redis.get(key)) || 0;
    if (current >= 6) return false;
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

// --- Life Path Number (determinisztikus) ---
function calculateLifePathNumber(dateOfBirth) {
  const digits = dateOfBirth.replace(/\D/g, '').split('').map(Number);
  const sumDigits = (arr) => arr.reduce((a, b) => a + b, 0);
  let total = sumDigits(digits);
  while (total > 9) total = sumDigits(total.toString().split('').map(Number));
  return total;
}

// --- Chinese Zodiac ---
function getChineseZodiac(year) {
  const animals = ["Rat","Ox","Tiger","Rabbit","Dragon","Snake","Horse","Goat","Monkey","Rooster","Dog","Pig"];
  const elements = ["Wood","Fire","Earth","Metal","Water"];
  const yinYang = ["Yang","Yin"];
  const animal = animals[(year - 4) % 12];
  const element = elements[(year - 4) % 10 % 5];
  const yy = yinYang[(year - 4) % 2];
  return { animal, element, yinYang: yy, symbol: `${element} ${animal}` };
}

function getChineseZodiac_FULL(dateStr) {
  const parts = dateStr.split("/");
  if (parts.length !== 3) throw new Error("Invalid date");
  const year = parseInt(parts[2], 10);
  return getChineseZodiac(year);
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
export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  if (!(await isAllowedRequest(ip))) {
    return new Response(JSON.stringify({ error: "rate_limit_exceeded" }), { status: 429 });
  }

  try {
    const body = await request.json();
    const { type, data = {}, languageCode = "en" } = body;

    if (!type) return new Response(JSON.stringify({ error: "missing_type" }), { status: 400 });

    // Faktikus számítások
    let finalData = { ...data };
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

    // Prompt kiválasztás
    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) return new Response(JSON.stringify({ error: "unknown_type" }), { status: 400 });

    // Language name mapping (egyszerűsítve)
    const languageName = languageCode;

    // Adatok előkészítése a template-be
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
    };

    const filledPrompt = fillTemplate(promptTemplate, templateData);
    const estimatedTokens = Math.ceil(filledPrompt.length / 4) + 200;

    if (!(await canUseTokens(estimatedTokens))) {
      return new Response(JSON.stringify({ error: "token_limit_exceeded" }), { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "server_config_error" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    const result = await model.generateContent(filledPrompt);
    const text = result.response.text();

    return new Response(JSON.stringify({ success: true, content: text.trim() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in generateAstroContent:", error);
    return new Response(JSON.stringify({ error: "internal_error", message: error.message || "Unexpected error" }), { status: 500 });
  }
}