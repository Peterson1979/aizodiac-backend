// lib/aiProvider.js
import { GoogleGenAI } from "@google/genai";
import { extractUsageMetadata, recordRoutingTelemetry } from "./telemetryHelper.js";
import {
  reserveBudget,
  settleBudget,
  releaseBudget,
  calculateReservationAmount,
  DEFAULT_PRIMARY_PROVIDER,
  DEFAULT_FALLBACK_PROVIDER,
  DEFAULT_FALLBACK_ENABLED,
} from "./budgetHelper.js";

export const AI_PROVIDERS = {
  GEMINI: "gemini",
  GROQ: "groq",
};

export const DEFAULT_PROVIDER = process.env.AI_PROVIDER || AI_PROVIDERS.GEMINI;
export const DEFAULT_GEMINI_MODEL = process.env.GENERATIVE_MODEL || "gemini-2.5-flash-lite";
export const DEFAULT_GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
export const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Checks if a Groq HTTP status is transient and eligible for retry or fallback.
 * @param {number} status
 * @returns {boolean}
 */
export function isTransientGroqStatus(status) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/**
 * Checks if an error status is strictly fail-closed (no retry, no fallback).
 * @param {number} status
 * @returns {boolean}
 */
export function isFailClosedStatus(status) {
  return status === 400 || status === 401 || status === 403 || status === 404;
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
 * Direct AI Generation abstraction supporting Gemini and Groq without routing/budget.
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

/**
 * Production-ready Provider Routing with Atomic Budget Reservation, Bounded Retries,
 * Fail-Closed Guards, and Fallback Settlement.
 *
 * Routing:
 * Primary (Gemini by default / Groq if env var set) -> Admission Check -> Call -> Settlement
 * If Primary Budget exhausted -> Fallback Admission (if enabled) -> Fallback Call
 * If Primary Transient Failure (429/502/503/504) -> Fallback Admission (if enabled) -> Fallback Call
 * If Fail-Closed (400/401/403/Schema/Code/Redis error) -> Fail Closed (No Fallback)
 * If Global Budget exhausted -> Fail Closed (No Fallback)
 */
export async function executeProviderRouting({
  type,
  prompt,
  responseSchema,
  maxOutputTokens,
  redis,
  date = new Date(),
  primaryProvider = process.env.AI_PRIMARY_PROVIDER || DEFAULT_PRIMARY_PROVIDER,
  fallbackProvider = process.env.AI_FALLBACK_PROVIDER || DEFAULT_FALLBACK_PROVIDER,
  fallbackEnabled = process.env.AI_FALLBACK_ENABLED !== undefined
    ? process.env.AI_FALLBACK_ENABLED === "true"
    : DEFAULT_FALLBACK_ENABLED,
  groqApiKey = process.env.GROQ_API_KEY,
  geminiApiKey = process.env.GEMINI_API_KEY,
  geminiRetryFn,
  groqFetchFn = fetch,
  groqSleepFn,
}) {
  const normPrimary = String(primaryProvider || "gemini").trim().toLowerCase();
  const normFallback = String(fallbackProvider || "gemini").trim().toLowerCase();

  const primaryModel = normPrimary === AI_PROVIDERS.GROQ
    ? (process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL)
    : (process.env.GENERATIVE_MODEL || DEFAULT_GEMINI_MODEL);

  const fallbackModel = normFallback === AI_PROVIDERS.GEMINI
    ? (process.env.GENERATIVE_MODEL || DEFAULT_GEMINI_MODEL)
    : (process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL);

  // 1. Calculate and attempt pre-request reservation for Primary
  const primaryReserveAmount = calculateReservationAmount(type, prompt, responseSchema, normPrimary);
  const primaryAdmission = await reserveBudget({
    redis,
    provider: normPrimary,
    reserveAmount: primaryReserveAmount,
    date,
  });

  // Helper to execute Fallback if eligible
  async function attemptFallback(triggerReason) {
    if (!fallbackEnabled || normFallback === normPrimary) {
      await recordRoutingTelemetry(redis, "budgetRejected", date);
      const quotaErr = new Error(`Cost protection: ${triggerReason}`);
      quotaErr.status = 429;
      quotaErr.reason = triggerReason;
      throw quotaErr;
    }

    await recordRoutingTelemetry(redis, "fallbackAttempt", date);

    // Reserve for fallback
    const fallbackReserveAmount = calculateReservationAmount(type, prompt, responseSchema, normFallback);
    const fallbackAdmission = await reserveBudget({
      redis,
      provider: normFallback,
      reserveAmount: fallbackReserveAmount,
      date,
    });

    if (!fallbackAdmission.success) {
      await recordRoutingTelemetry(redis, "budgetRejected", date);
      const quotaErr = new Error(`Fallback cost protection: ${fallbackAdmission.reason}`);
      quotaErr.status = 429;
      quotaErr.reason = fallbackAdmission.reason;
      throw quotaErr;
    }

    try {
      let fallbackResult;
      if (normFallback === AI_PROVIDERS.GEMINI) {
        fallbackResult = await generateWithGemini({
          model: fallbackModel,
          prompt,
          responseSchema,
          maxOutputTokens,
          apiKey: geminiApiKey,
          retryFn: geminiRetryFn,
        });
      } else {
        fallbackResult = await generateWithGroq({
          model: fallbackModel,
          prompt,
          responseSchema,
          maxOutputTokens,
          apiKey: groqApiKey,
          fetchFn: groqFetchFn,
          sleepFn: groqSleepFn,
        });
      }

      // Settle fallback reservation
      const actualTokens = fallbackResult?.usage?.totalTokens || 0;
      await settleBudget({
        redis,
        provider: normFallback,
        reservedAmount: fallbackReserveAmount,
        actualAmount: actualTokens,
        date,
      });

      if (normFallback === AI_PROVIDERS.GEMINI) {
        await recordRoutingTelemetry(redis, "geminiFallbackSuccess", date);
      }

      return {
        ...fallbackResult,
        fallbackUsed: true,
        primaryProvider: normPrimary,
      };
    } catch (fallbackErr) {
      await releaseBudget({
        redis,
        provider: normFallback,
        reservedAmount: fallbackReserveAmount,
        date,
      });
      throw fallbackErr;
    }
  }

  // --- Handling Primary Admission Rejection ---
  if (!primaryAdmission.success) {
    // FAIL CLOSED: If Global budget exhausted OR Redis/Budget service unavailable/error, NEVER fallback
    if (
      primaryAdmission.reason === "GLOBAL_BUDGET_EXHAUSTED" ||
      primaryAdmission.reason.startsWith("BUDGET_SERVICE_")
    ) {
      await recordRoutingTelemetry(redis, "budgetRejected", date);
      const quotaErr = new Error(`Hard cost brake: ${primaryAdmission.reason}`);
      quotaErr.status = 429;
      quotaErr.reason = primaryAdmission.reason;
      throw quotaErr;
    }

    // If Primary Provider budget exhausted, attempt Fallback within fallback's independent budget
    return await attemptFallback(primaryAdmission.reason);
  }

  // --- Primary Admitted: Execute Primary Call ---
  try {
    let primaryResult;
    if (normPrimary === AI_PROVIDERS.GROQ) {
      primaryResult = await generateWithGroq({
        model: primaryModel,
        prompt,
        responseSchema,
        maxOutputTokens,
        apiKey: groqApiKey,
        fetchFn: groqFetchFn,
        sleepFn: groqSleepFn,
      });
    } else {
      primaryResult = await generateWithGemini({
        model: primaryModel,
        prompt,
        responseSchema,
        maxOutputTokens,
        apiKey: geminiApiKey,
        retryFn: geminiRetryFn,
      });
    }

    // Primary Succeeded: Settle reservation with actual provider tokens
    const actualTokens = primaryResult?.usage?.totalTokens || 0;
    await settleBudget({
      redis,
      provider: normPrimary,
      reservedAmount: primaryReserveAmount,
      actualAmount: actualTokens,
      date,
    });

    if (normPrimary === AI_PROVIDERS.GROQ) {
      await recordRoutingTelemetry(redis, "groqSuccess", date);
    }

    return {
      ...primaryResult,
      fallbackUsed: false,
      primaryProvider: normPrimary,
    };

  } catch (primaryErr) {
    // Primary call failed. Release primary reservation first.
    await releaseBudget({
      redis,
      provider: normPrimary,
      reservedAmount: primaryReserveAmount,
      date,
    });

    const status = Number(primaryErr?.status) || 0;

    // Fail-Closed Check: If 400, 401, 403, 404 or non-transient, fail closed immediately (DO NOT CALL FALLBACK)
    if (isFailClosedStatus(status) || !isTransientGroqStatus(status)) {
      throw primaryErr;
    }

    // Transient Groq failure (429, 502, 503, 504) after Groq retries exhausted -> Attempt Fallback
    return await attemptFallback(`GROQ_TRANSIENT_FAILURE_${status || "ERR"}`);
  }
}
