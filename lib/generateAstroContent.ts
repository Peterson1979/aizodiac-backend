// File: /lib/generateAstroContent.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { getChineseZodiac_FULL, calculateLifePathNumber } from "./factualCalculations";
import { PROMPTS } from "./prompts";

// --- Redis setup ---
let redis: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// --- Configuration ---
const DEFAULT_DAILY_TOKEN_LIMIT = 10_000_000;
const DAILY_TOKEN_LIMIT = process.env.DAILY_TOKEN_LIMIT ? parseInt(process.env.DAILY_TOKEN_LIMIT, 10) : DEFAULT_DAILY_TOKEN_LIMIT;
const GEMINI_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";

// --- IP Rate Limiting (6 requests per minute per IP) ---
async function isAllowedRequest(ip: string): Promise<boolean> {
  if (!redis) return true; // fail-open
  const key = `ratelimit:${ip}`;
  try {
    const current = (await redis.get<number>(key)) ?? 0;
    if (current >= 6) return false;
    await redis.incr(key);
    await redis.expire(key, 60); // 1 perc
    return true;
  } catch (e) {
    console.warn("Rate limit check failed:", e);
    return true; // fail-open
  }
}

// --- Token estimation ---
function estimateTokensFromText(text: string): number {
  return text ? Math.ceil(text.length / 4) : 0;
}

async function canUseTokens(tokens: number): Promise<boolean> {
  if (!redis) return true;
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_tokens:${today}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used + tokens > DAILY_TOKEN_LIMIT) return false;
    await redis.incrby(key, tokens);
    await redis.expire(key, 60 * 60 * 24);
    return true;
  } catch (e) {
    return true; // fail-open
  }
}

// --- Retry with backoff ---
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (e) {
      attempt++;
      if (attempt >= retries) throw e;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 200));
    }
  }
  throw new Error("Retry attempts exhausted");
}

// --- Language mapping ---
function getLanguageName(code: string) {
  const map: Record<string, string> = {
    en: "English", hu: "Hungarian", de: "German", fr: "French", it: "Italian", ru: "Russian",
    es: "Spanish", pt: "Portuguese", zh: "Chinese", ja: "Japanese", ko: "Korean", sw: "Swahili",
    fa: "Persian", ta: "Tamil", bn: "Bengali", hi: "Hindi", id: "Indonesian", th: "Thai",
    vi: "Vietnamese", ur: "Urdu", te: "Telugu", pl: "Polish", tr: "Turkish", uk: "Ukrainian",
    ro: "Romanian", nl: "Dutch", ms: "Malay", ar: "Arabic"
  };
  return map[code] || "English";
}

// --- Safe placeholder replacement ---
function fillTemplate(template: string, data: Record<string, any> = {}) {
  let out = template;
  Object.keys(data).forEach(k => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  return out.replace(/{{\w+}}/g, "");
}

// --- Main handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed", message: "Only POST allowed" });
  }

  // ✅ IP Rate Limiting – MINDEN kérésre
  const ip = (req.headers["x-forwarded-for"]?.split(',')[0].trim() || req.socket.remoteAddress || "unknown").toString();
  if (!(await isAllowedRequest(ip))) {
    return res.status(429).json({ error: "rate_limit_exceeded", message: "Too many requests. Try again later." });
  }

  try {
    const body = req.body || {};
    const {
      type,
      data = {},
      languageCode = data.language || data.languageCode || "en",
      stream = false
    } = body;

    if (!type) {
      return res.status(400).json({ error: "missing_type", message: "Request 'type' is required." });
    }

    const languageName = getLanguageName(languageCode);
    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) {
      return res.status(400).json({ error: "unknown_type", message: `Unknown type: ${type}` });
    }

    let finalData = { ...data };

    // --- Determinisztikus számítások ---
    if (finalData.dateOfBirth && type === "numerology") {
      finalData.lifePathNumber = calculateLifePathNumber(finalData.dateOfBirth);
    }
    if (finalData.dateOfBirth && type === "chinese_horoscope") {
      try {
        const zodiac = getChineseZodiac_FULL(finalData.dateOfBirth);
        finalData.SYMBOL = zodiac.symbol;
        finalData.ANIMAL = zodiac.animal;
        finalData.ELEMENT = zodiac.element;
        finalData.YIN_YANG = zodiac.yinYang;
      } catch (e) {
        return res.status(400).json({ error: "invalid_date", message: "Use DD/MM/YYYY." });
      }
    }

    const filledPrompt = fillTemplate(promptTemplate, {
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
    });

    const estimatedTokens = estimateTokensFromText(filledPrompt) + 200;
    if (!(await canUseTokens(estimatedTokens))) {
      return res.status(429).json({ error: "token_limit_exceeded", message: "Daily token quota exceeded." });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "server_config_error", message: "GEMINI API key missing." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    if (stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      await retryWithBackoff(async () => {
        const streamResponse = await model.generateContentStream(filledPrompt, { timeout: GEMINI_TIMEOUT_MS });
        for await (const chunk of streamResponse.stream) {
          const text = chunk.text?.() || "";
          if (text) res.write(` ${JSON.stringify({ delta: text })}\n\n`);
        }
        res.write(" [DONE]\n\n");
        res.end();
      });
      return;
    }

    const generateResult = await retryWithBackoff(() =>
      model.generateContent(filledPrompt, { timeout: GEMINI_TIMEOUT_MS })
    );

    let text = "";
    try {
      if (generateResult?.response?.text) {
        text = generateResult.response.text();
      } else if (generateResult?.text) {
        text = generateResult.text;
      } else {
        text = String(generateResult || "");
      }
    } catch (e) {
      text = String(generateResult || "");
    }

    return res.status(200).json({
      success: true,
      type,
      estimatedTokens,
      content: text.trim(),
    });

  } catch (error: any) {
    console.error("Error in generateAstroContent:", error);

    let statusCode = 500;
    let errorCode = "internal_error";
    let message = "An unexpected error occurred.";

    if (error?.code === "ETIMEDOUT" || error.message?.includes("timeout")) {
      statusCode = 504;
      errorCode = "timeout";
      message = "The request to the model timed out.";
    } else if (error?.status === 503) {
      statusCode = 503;
      errorCode = "model_overloaded";
      message = "The model is currently overloaded.";
    } else if (error?.status === 429) {
      statusCode = 429;
      errorCode = "rate_limited";
      message = "Too many requests to the model.";
    } else if ([401, 403].includes(error?.status)) {
      statusCode = error.status;
      errorCode = "unauthorized";
      message = "Unauthorized request. Check API key.";
    }

    if (!res.headersSent) {
      return res.status(statusCode).json({ error: errorCode, message });
    } else {
      try {
        res.write(` ${JSON.stringify({ error: errorCode, message })}\n\n`);
        res.write(" [DONE]\n\n");
        res.end();
      } catch (e) {
        // silent
      }
    }
  }
}