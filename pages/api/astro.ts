// File: pages/api/astro.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../../lib/prompts";
import { getChineseZodiac_FULL } from "../../lib/factualCalculations";

interface RedisInstance {
  get<T>(key: string): Promise<T | null>;
  incrby(key: string, amount: number): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

let redis: RedisInstance | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

const DEFAULT_DAILY_TOKEN_LIMIT = 10_000_000;
const DAILY_TOKEN_LIMIT = process.env.DAILY_TOKEN_LIMIT
  ? parseInt(process.env.DAILY_TOKEN_LIMIT, 10)
  : DEFAULT_DAILY_TOKEN_LIMIT;

const GEMINI_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 3;
const DEFAULT_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";

function fillTemplate(template: string, data: Record<string, any> = {}) {
  let out = template;
  Object.keys(data).forEach(k => {
    const val = data[k] === undefined || data[k] === null ? "" : String(data[k]);
    out = out.split(`{{${k}}}`).join(val);
  });
  return out.replace(/{{\w+}}/g, "");
}

async function canUseTokens(estimatedTokens: number) {
  if (!redis) return true;
  const today = new Date().toISOString().slice(0, 10);
  const key = `daily_tokens:${today}`;
  try {
    const used = (await redis.get<number>(key)) ?? 0;
    if (used + estimatedTokens > DAILY_TOKEN_LIMIT) return false;
    await redis.incrby(key, estimatedTokens);
    await redis.expire(key, 60 * 60 * 24);
    return true;
  } catch {
    return true;
  }
}

async function retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};
    const { type, data = {}, languageCode = data.language || "en", stream = false, debug = false } = body;

    // Chinese horoscope faktikus értékek
    if (type === "chinese_horoscope") {
      if (!data.dateOfBirth) return res.status(400).json({ error: "missing_dateOfBirth" });
      try {
        const zodiac = getChineseZodiac_FULL(data.dateOfBirth);
        data.symbol = zodiac.symbol;
        data.animal = zodiac.animal;
        data.element = zodiac.element;
        data.yinYang = zodiac.yinYang;
      } catch {
        return res.status(400).json({ error: "invalid_date_format" });
      }
    }

    // Prompt lekérése minden típushoz
    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) return res.status(400).json({ error: "unknown_type" });

    const filledPrompt = fillTemplate(promptTemplate, { ...data, language: languageCode });
    if (debug) console.log("DEBUG: Filled prompt:", filledPrompt);

    // Token limit ellenőrzés
    const estimatedTokens = Math.ceil(filledPrompt.length / 4) + 200;
    const allowed = await canUseTokens(estimatedTokens);
    if (!allowed) return res.status(429).json({ error: "token_limit_exceeded" });

    // API kulcs ellenőrzés
    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "server_config_error" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: DEFAULT_MODEL });

    if (stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
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

    // Normál generálás
    const generateResult = await retryWithBackoff(() => model.generateContent(filledPrompt, { timeout: GEMINI_TIMEOUT_MS }));
    if (debug) console.log("DEBUG: Generate result raw:", generateResult);

    const text = generateResult?.response?.text?.() || generateResult?.text || null;
    if (!text) {
      console.error("Empty response from Gemini API", generateResult);
      return res.status(500).json({ error: "empty_response", message: "No content from AI" });
    }

    return res.status(200).json({ success: true, type, estimatedTokens, content: text.trim() });

  } catch (error: any) {
    console.error("Astro API error:", error);
    return res.status(500).json({ error: "internal_error", message: error?.message || "Unexpected error" });
  }
}
