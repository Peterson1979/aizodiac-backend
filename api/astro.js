// api/astro.js
import { Redis } from "@upstash/redis";
import { PROMPTS } from "../lib/prompts.js";
import { getChineseZodiac_FULL } from "../lib/chineseZodiac.js";
import { getSharedCacheKey, TTL_SECONDS } from "../lib/cacheHelper.js";
import { recordUsageTelemetry } from "../lib/telemetryHelper.js";
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

// --- Redis setup ---
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

const MAX_RETRIES = 5;

// --- Retry for legacy astro endpoint ---
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      if (err?.status === 503) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      } else {
        throw err;
      }
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
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const rawIp = request.headers.get("x-forwarded-for") || "unknown";
  const ip = String(rawIp).split(",")[0].trim();

  try {
    const body = await request.json();
    const { type, data = {}, languageCode = data.language || "en", stream = false, debug = false } = body;

    // Chinese horoscope
    if (type === "chinese_horoscope") {
      if (!data.dateOfBirth) {
        return new Response(JSON.stringify({ error: "missing_dateOfBirth" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
      try {
        const zodiac = getChineseZodiac_FULL(data.dateOfBirth);
        data.symbol = zodiac.symbol;
        data.animal = zodiac.animal;
        data.element = zodiac.element;
        data.yinYang = zodiac.yinYang;
      } catch {
        return new Response(JSON.stringify({ error: "invalid_date_format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const promptTemplate = PROMPTS[type];
    if (!promptTemplate) {
      return new Response(JSON.stringify({ error: "unknown_type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const templateData = { ...data, language: languageCode };
    const filledPrompt = fillTemplate(promptTemplate, templateData);
    if (debug) console.log("DEBUG: Filled prompt:", filledPrompt);

    if (stream) {
      const headers = new Headers();
      headers.set("Content-Type", "text/event-stream");
      headers.set("Cache-Control", "no-cache");
      headers.set("Connection", "keep-alive");
      const streamResponse = new Response(null, { status: 200, headers });
      return streamResponse;
    }

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
              return new Response(JSON.stringify({ success: true, type, content: cachedText }), {
                status: 200,
                headers: { "Content-Type": "application/json", "X-AIZ-Cache": "HIT" },
              });
            }
          }
        }

        if (fallbackCacheKey && fallbackCacheKey !== primaryCacheKey) {
          const cachedFallback = await redis.get(fallbackCacheKey);
          if (cachedFallback !== null && cachedFallback !== undefined) {
            const cachedText = typeof cachedFallback === "string" ? cachedFallback.trim() : JSON.stringify(cachedFallback);
            if (cachedText.length > 0) {
              return new Response(JSON.stringify({ success: true, type, content: cachedText }), {
                status: 200,
                headers: { "Content-Type": "application/json", "X-AIZ-Cache": "HIT" },
              });
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
    const abuseCheck = await checkAbuseRateLimit(redis, ip, type);
    if (!abuseCheck.allowed) {
      console.warn(`🛑 Abuse rate limit exceeded for ${type} [IP hash]:`, abuseCheck);
      return new Response(JSON.stringify({ error: "token_limit_exceeded", reason: "AI_RATE_LIMITED" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    }

    // =========================================================================
    // 3. ATOMIC BUDGET ADMISSION & ROUTED GENERATION
    // =========================================================================
    const aiSchema = getInternalAiSchema(type);
    const maxTokens = getMaxOutputTokens(type);

    let generateResult;
    try {
      generateResult = await executeProviderRouting({
        type,
        prompt: filledPrompt,
        responseSchema: aiSchema,
        maxOutputTokens: maxTokens,
        redis,
        geminiRetryFn: retryWithBackoff,
      });
    } catch (routeErr) {
      if (routeErr.status === 429) {
        console.warn(`🛑 Cost protection budget rejected for ${type}:`, routeErr.reason || routeErr.message);
        return new Response(JSON.stringify({
          error: "token_limit_exceeded",
          reason: routeErr.reason || "BUDGET_EXHAUSTED"
        }), {
          status: 429,
          headers: { "Content-Type": "application/json" }
        });
      }
      throw routeErr;
    }

    const text = generateResult?.text || null;
    if (!text) {
      console.error("Empty response from AI", generateResult);
      return new Response(JSON.stringify({ error: "empty_response", message: "No content from AI" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const trimmedText = text.trim();
    let rawAiObj;
    try {
      rawAiObj = JSON.parse(trimmedText);
    } catch (jsonErr) {
      console.error(`❌ Structured output JSON parse failed for ${type} [${generateResult?.provider}]:`, jsonErr.message, "\nRaw text:", trimmedText);
      return new Response(JSON.stringify({ error: "invalid_ai_response", message: "Failed to parse structured JSON from AI" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const finalObj = mergeDeterministicFields(type, rawAiObj, data, languageCode);
    if (!validateResponseObject(type, finalObj)) {
      console.error(`❌ Final response validation failed for ${type}`, finalObj);
      return new Response(JSON.stringify({ error: "invalid_ai_response", message: "Missing required response fields" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const finalJsonString = JSON.stringify(finalObj);

    // Record exact provider token usage telemetry
    const usage = generateResult.usage;
    await recordUsageTelemetry(redis, type, usage, new Date(), generateResult.provider, generateResult.model);

    // =========================================================================
    // 4. CACHE SET (Saved under the ACTUALLY winning provider's identity)
    // =========================================================================
    const winningCacheKey = getSharedCacheKey(type, templateData, generateResult.model, generateResult.provider);
    if (winningCacheKey && redis && finalJsonString.length > 0) {
      const ttl = TTL_SECONDS[type] || 36 * 3600;
      try {
        await redis.set(winningCacheKey, finalJsonString, { ex: ttl });
      } catch (cacheSetErr) {
        console.warn("⚠️ Redis cache SET error (failing open):", cacheSetErr.message);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      type,
      provider: generateResult.provider,
      content: finalJsonString
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-AIZ-Cache": winningCacheKey ? "MISS" : "NONE"
      },
    });

  } catch (error) {
    console.error("Astro API error:", error);
    return new Response(JSON.stringify({ error: "internal_error", message: error.message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}