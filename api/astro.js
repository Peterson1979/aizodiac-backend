// api/astro.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { getChineseZodiac_FULL } from "../lib/factualCalculations.js";

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
const GEMINI_TIMEOUT_MS = 25000;
const MAX_RETRIES = 3;

// --- Token limit ---
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
  } catch {
    return true;
  }
}

// --- Retry ---
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch {
      attempt++;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
  throw new Error("Retry attempts exhausted");
}

// --- Fill template ---
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

  try {
    const body = await request.json();
    const { type, data = {}, languageCode = data.language || "en", stream = false, debug = false } = body;

    // Chinese horoscope
    if (type === "chinese_horoscope") {
      if (!data.dateOfBirth) return new Response(JSON.stringify({ error: "missing_dateOfBirth" }), { status: 400 });
      try {
        const zodiac = getChineseZodiac_FULL(data.dateOfBirth);
        data.symbol = zodiac.symbol;
        data.animal = zodiac.animal;
        data.element = zodiac.element;
        data.yinYang = zodiac.yinYang;
      } catch {
        return new Response(JSON.stringify({ error: "invalid_date_format" }), { status: 400 });
      }
    }

    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) return new Response(JSON.stringify({ error: "unknown_type" }), { status: 400 });

    const filledPrompt = fillTemplate(promptTemplate, { ...data, language: languageCode });
    if (debug) console.log("DEBUG: Filled prompt:", filledPrompt);

    const estimatedTokens = Math.ceil(filledPrompt.length / 4) + 200;
    if (!(await canUseTokens(estimatedTokens))) {
      return new Response(JSON.stringify({ error: "token_limit_exceeded" }), { status: 429 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({ error: "server_config_error" }), { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    if (stream) {
      const headers = new Headers();
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("Connection", "keep-alive");
      const streamResponse = new Response(null, { status: 200, headers });
      // Stream nem támogatott ebben a környezetben – kihagyva
      return streamResponse;
    }

    const generateResult = await retryWithBackoff(() =>
      model.generateContent(filledPrompt, { timeout: GEMINI_TIMEOUT_MS })
    );

    const text = generateResult?.response?.text?.() || generateResult?.text || null;
    if (!text) {
      console.error("Empty response from Gemini API", generateResult);
      return new Response(JSON.stringify({ error: "empty_response", message: "No content from AI" }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true, type, estimatedTokens, content: text.trim() }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Astro API error:", error);
    return new Response(JSON.stringify({ error: "internal_error", message: error.message || "Unexpected error" }), { status: 500 });
  }
}