// lib/aiProvider.js
import { GoogleGenAI } from "@google/genai";
import { extractUsageMetadata } from "./telemetryHelper.js";

export const AI_PROVIDERS = {
  GEMINI: "gemini",
  GROQ: "groq",
};

export const DEFAULT_PROVIDER = process.env.AI_PROVIDER || AI_PROVIDERS.GEMINI;
export const DEFAULT_GEMINI_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";
export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Checks if a Groq HTTP status is transient and eligible for retry.
 * @param {number} status
 * @returns {boolean}
 */
export function isTransientGroqStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Bounded retry mechanism for Groq with exponential backoff.
 * Retries only 429, 502, 503, 504 (max 3 total attempts).
 * Fails immediately on 400, 401, 403, 404, etc.
 */
export async function retryGroqWithBackoff(
  fn,
  retries = 3,
  sleepFn = (ms) => new Promise((r) => setTimeout(r, ms))
) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      const status = Number(err.status) || 0;
      const isTransient = isTransientGroqStatus(status);

      if (attempt >= retries || !isTransient) {
        throw err;
      }

      // Backoff: attempt 1 -> 1000ms (1s), attempt 2 -> 2000ms (2s)
      const delay = Math.pow(2, attempt - 1) * 1000;
      await sleepFn(delay);
    }
  }
  throw new Error("Groq retry attempts exhausted");
}

/**
 * Gemini Provider implementation.
 */
export async function generateWithGemini({
  model = DEFAULT_GEMINI_MODEL,
  prompt,
  responseSchema,
  maxOutputTokens,
  apiKey = process.env.GEMINI_API_KEY,
  retryFn,
}) {
  if (!apiKey) {
    const err = new Error("server_config_error: Missing GEMINI_API_KEY");
    err.status = 500;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey });

  const generateConfig = {};
  if (responseSchema) {
    generateConfig.responseMimeType = "application/json";
    generateConfig.responseJsonSchema = responseSchema;
  }
  if (maxOutputTokens) {
    generateConfig.maxOutputTokens = maxOutputTokens;
  }

  const executeGen = () =>
    ai.models.generateContent({
      model,
      contents: prompt,
      ...(Object.keys(generateConfig).length > 0 ? { config: generateConfig } : {}),
    });

  const result = retryFn ? await retryFn(executeGen) : await executeGen();
  const text = result?.text || "";
  const usage = extractUsageMetadata(result);

  return {
    provider: AI_PROVIDERS.GEMINI,
    model,
    text: text.trim(),
    usage,
  };
}

/**
 * Groq Provider implementation (OpenAI-compatible HTTP API, zero extra SDK).
 * Supports strict JSON Schema mode and reasoning_effort configuration for openai/gpt-oss-20b.
 */
export async function generateWithGroq({
  model = DEFAULT_GROQ_MODEL,
  prompt,
  responseSchema,
  maxOutputTokens,
  apiKey = process.env.GROQ_API_KEY,
  fetchFn = fetch,
  sleepFn,
}) {
  if (!apiKey) {
    const err = new Error("server_config_error: Missing GROQ_API_KEY");
    err.status = 500;
    throw err;
  }

  const body = {
    model,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    reasoning_effort: "low",
  };

  if (responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "astro_response",
        strict: true,
        schema: responseSchema,
      },
    };
  }

  if (maxOutputTokens) {
    body.max_tokens = maxOutputTokens;
  }

  const responseJson = await retryGroqWithBackoff(
    async () => {
      const res = await fetchFn(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorText = await res.text().catch(() => "");
        const err = new Error(`Groq API error ${res.status}: ${errorText.slice(0, 200)}`);
        err.status = res.status;
        throw err;
      }

      return await res.json();
    },
    3,
    sleepFn
  );

  const text = responseJson?.choices?.[0]?.message?.content || "";
  const usage = {
    promptTokens: Number(responseJson?.usage?.prompt_tokens) || 0,
    candidateTokens: Number(responseJson?.usage?.completion_tokens) || 0,
    totalTokens: Number(responseJson?.usage?.total_tokens) || 0,
    thoughtsTokens: 0,
    cachedTokens: 0,
  };

  return {
    provider: AI_PROVIDERS.GROQ,
    model,
    text: text.trim(),
    usage,
  };
}

/**
 * Unified AI Generation abstraction supporting Gemini and Groq.
 */
export async function generateAiContent({
  provider = DEFAULT_PROVIDER,
  model,
  prompt,
  responseSchema,
  maxOutputTokens,
  apiKey,
  retryFn,
  fetchFn = fetch,
  sleepFn,
}) {
  const normProvider = String(provider || AI_PROVIDERS.GEMINI).trim().toLowerCase();

  if (normProvider === AI_PROVIDERS.GROQ) {
    return await generateWithGroq({
      model: model || DEFAULT_GROQ_MODEL,
      prompt,
      responseSchema,
      maxOutputTokens,
      apiKey: apiKey || process.env.GROQ_API_KEY,
      fetchFn,
      sleepFn,
    });
  }

  // Default to Gemini
  return await generateWithGemini({
    model: model || DEFAULT_GEMINI_MODEL,
    prompt,
    responseSchema,
    maxOutputTokens,
    apiKey: apiKey || process.env.GEMINI_API_KEY,
    retryFn,
  });
}
