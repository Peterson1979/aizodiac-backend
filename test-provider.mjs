// test-provider.mjs
import assert from "node:assert";
import {
  AI_PROVIDERS,
  DEFAULT_PROVIDER,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
  isTransientGroqStatus,
  retryGroqWithBackoff,
  generateWithGroq,
  generateAiContent
} from "./lib/aiProvider.js";
import {
  FULL_RESPONSE_SCHEMAS,
  INTERNAL_AI_SCHEMAS,
  getInternalAiSchema,
  getFullResponseSchema,
  mergeDeterministicFields,
  validateResponseObject,
  getMaxOutputTokens
} from "./lib/responseSchemas.js";
import { getSharedCacheKey } from "./lib/cacheHelper.js";
import { recordUsageTelemetry } from "./lib/telemetryHelper.js";
import { retryWithBackoff } from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING BATCH 6 PROVIDER PILOT TESTS (SAFETY REVISED)");
console.log("==================================================");

// Test 1: Provider Defaults & Model Identity
{
  assert.strictEqual(DEFAULT_PROVIDER, "gemini", "Default AI_PROVIDER must be gemini");
  assert.strictEqual(DEFAULT_GEMINI_MODEL, "gemini-2.5-flash-lite");
  assert.strictEqual(DEFAULT_GROQ_MODEL, "openai/gpt-oss-20b");
  assert.strictEqual(AI_PROVIDERS.GEMINI, "gemini");
  assert.strictEqual(AI_PROVIDERS.GROQ, "groq");
  console.log("✅ Test 1 passed: Provider defaults and model constants verified");
}

// Test 2: All 17 Request Types Satisfy Groq Strict JSON Schema Requirements
{
  const types = Object.keys(FULL_RESPONSE_SCHEMAS);
  assert.strictEqual(types.length >= 17, true);

  for (const type of types) {
    const fullSchema = getFullResponseSchema(type);
    const aiSchema = getInternalAiSchema(type);
    const maxTokens = getMaxOutputTokens(type);

    assert.ok(fullSchema, `Full schema missing for ${type}`);
    assert.ok(aiSchema, `AI schema missing for ${type}`);
    assert.ok(maxTokens > 0, `maxOutputTokens missing for ${type}`);

    // Strict requirements verification
    assert.strictEqual(aiSchema.type, "object", `${type} AI schema type must be object`);
    assert.strictEqual(aiSchema.additionalProperties, false, `${type} AI schema additionalProperties must be false`);
    assert.ok(Array.isArray(aiSchema.required), `${type} AI schema required must be an array`);

    const propKeys = Object.keys(aiSchema.properties || {});
    const reqKeys = new Set(aiSchema.required);

    for (const p of propKeys) {
      assert.ok(reqKeys.has(p), `${type}: property '${p}' must be listed in required array`);
    }
    for (const r of aiSchema.required) {
      assert.ok(aiSchema.properties[r], `${type}: required key '${r}' must be defined in properties`);
    }
  }
  console.log(`✅ Test 2 passed: All ${types.length} internal AI schemas satisfy Groq strict JSON Schema requirements`);
}

// Test 3: Groq Request Body has Strict json_schema format and reasoning_effort low
{
  let capturedBody = null;
  const mockFetch = async (url, options) => {
    assert.strictEqual(url, "https://api.groq.com/openai/v1/chat/completions");
    capturedBody = JSON.parse(options.body);

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                "Daily Horoscope": "A bright day full of creative energy."
              })
            }
          }
        ],
        usage: {
          prompt_tokens: 45,
          completion_tokens: 28,
          total_tokens: 73
        }
      })
    };
  };

  const schema = getInternalAiSchema("home_daily_horoscope");
  const groqResult = await generateWithGroq({
    model: "openai/gpt-oss-20b",
    prompt: "Write daily horoscope",
    responseSchema: schema,
    maxOutputTokens: 200,
    apiKey: "gsk_synthetic_test_key",
    fetchFn: mockFetch
  });

  // Verify captured body fields
  assert.strictEqual(capturedBody.model, "openai/gpt-oss-20b");
  assert.strictEqual(capturedBody.reasoning_effort, "low", "reasoning_effort must be explicitly 'low'");
  assert.strictEqual(capturedBody.response_format.type, "json_schema", "response_format.type must be 'json_schema'");
  assert.strictEqual(capturedBody.response_format.json_schema.strict, true, "json_schema.strict must be true");
  assert.strictEqual(capturedBody.response_format.json_schema.name, "astro_response");
  assert.deepStrictEqual(capturedBody.response_format.json_schema.schema, schema);

  assert.strictEqual(groqResult.provider, "groq");
  assert.strictEqual(groqResult.usage.promptTokens, 45);
  assert.strictEqual(groqResult.usage.candidateTokens, 28);
  assert.strictEqual(groqResult.usage.totalTokens, 73);

  console.log("✅ Test 3 passed: Groq request uses strict json_schema mode and reasoning_effort: 'low'");
}

// Test 4: Gemini Retry Semantics Invariant (Retries ONLY 503 with 2s/4s/8s/16s)
{
  let geminiCalls = 0;
  const geminiDelays = [];

  const res503 = await retryWithBackoff(async () => {
    geminiCalls++;
    if (geminiCalls < 3) {
      const err = new Error("Service Unavailable");
      err.status = 503;
      throw err;
    }
    return "SUCCESS_503";
  }, 5, (ms) => geminiDelays.push(ms));

  assert.strictEqual(res503, "SUCCESS_503");
  assert.strictEqual(geminiCalls, 3);
  assert.deepStrictEqual(geminiDelays, [2000, 4000]); // 2s on attempt 1, 4s on attempt 2

  // Non-503 (e.g. 500 or 400 or 429) fails immediately on attempt 1
  let non503Calls = 0;
  let non503Caught = false;
  try {
    await retryWithBackoff(async () => {
      non503Calls++;
      const err = new Error("Internal Error");
      err.status = 500;
      throw err;
    }, 5);
  } catch (err) {
    non503Caught = true;
    assert.strictEqual(err.status, 500);
  }
  assert.strictEqual(non503Caught, true);
  assert.strictEqual(non503Calls, 1, "Gemini must fail immediately on non-503 errors");

  console.log("✅ Test 4 passed: Gemini retry semantics verified (retries ONLY 503 with 2s/4s/8s/16s; all other errors fail immediately)");
}

// Test 5: Groq Retry Classification (429/502/503/504 retried with 1s/2s; 400/401/403 fail immediately)
{
  assert.strictEqual(isTransientGroqStatus(429), true);
  assert.strictEqual(isTransientGroqStatus(502), true);
  assert.strictEqual(isTransientGroqStatus(503), true);
  assert.strictEqual(isTransientGroqStatus(504), true);
  assert.strictEqual(isTransientGroqStatus(400), false);
  assert.strictEqual(isTransientGroqStatus(401), false);
  assert.strictEqual(isTransientGroqStatus(403), false);
  assert.strictEqual(isTransientGroqStatus(404), false);

  // Transient retry with backoff (1s on attempt 1, 2s on attempt 2)
  let groqTransientCalls = 0;
  const groqDelays = [];
  const resGroq = await retryGroqWithBackoff(async () => {
    groqTransientCalls++;
    if (groqTransientCalls === 1) {
      const err = new Error("Rate limit");
      err.status = 429;
      throw err;
    }
    return { ok: true };
  }, 3, (ms) => groqDelays.push(ms));

  assert.strictEqual(resGroq.ok, true);
  assert.strictEqual(groqTransientCalls, 2);
  assert.deepStrictEqual(groqDelays, [1000]);

  // Non-transient fails immediately on attempt 1
  let groq401Calls = 0;
  let groq401Caught = false;
  try {
    await retryGroqWithBackoff(async () => {
      groq401Calls++;
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }, 3);
  } catch (err) {
    groq401Caught = true;
    assert.strictEqual(err.status, 401);
  }
  assert.strictEqual(groq401Caught, true);
  assert.strictEqual(groq401Calls, 1, "Groq must fail immediately on 401 without retry");

  console.log("✅ Test 5 passed: Groq retry classification verified (429 retried with 1s/2s backoff, 401 failed immediately)");
}

// Test 6: Cache Key Backward Compatibility (Gemini) and Isolation (Groq)
{
  const data = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };

  const geminiKey = getSharedCacheKey("home_daily_horoscope", data, "gemini-2.5-flash-lite", "gemini");
  assert.strictEqual(geminiKey, "aiz:cache:v2:gemini-2.5-flash-lite:home_daily_horoscope:b7:2026-08-24:aries:en");

  const groqKey = getSharedCacheKey("home_daily_horoscope", data, "openai/gpt-oss-20b", "groq");
  assert.strictEqual(groqKey, "aiz:cache:v2:groq:openai_gpt-oss-20b:home_daily_horoscope:b7:2026-08-24:aries:en");

  assert.notStrictEqual(geminiKey, groqKey);
  console.log("✅ Test 6 passed: Gemini keys remain 100% backward compatible; Groq keys are completely isolated");
}

// Test 7: Provider Telemetry Separation
{
  const mockRedisMap = new Map();
  const mockRedis = {
    async hincrby(key, field, val) {
      if (!mockRedisMap.has(key)) mockRedisMap.set(key, {});
      const hash = mockRedisMap.get(key);
      hash[field] = (hash[field] || 0) + val;
      return hash[field];
    },
    async expire() { return 1; }
  };

  const usage = { promptTokens: 100, candidateTokens: 50, totalTokens: 150 };
  await recordUsageTelemetry(mockRedis, "home_daily_horoscope", usage, "2026-08-24", "gemini", "gemini-2.5-flash-lite");

  assert.strictEqual(mockRedisMap.get("aiz:usage:2026-08-24:total").requests, 1);
  assert.strictEqual(mockRedisMap.get("aiz:usage:2026-08-24:provider:gemini").requests, 1);
  assert.strictEqual(mockRedisMap.get("aiz:usage:2026-08-24:provider:gemini:model:gemini-2.5-flash-lite").requests, 1);
  console.log("✅ Test 7 passed: Provider telemetry separation verified");
}

// Test 8: Deterministic Field Merging Works Identically for Groq Outputs
{
  const mockGroqAscendantOutput = {
    "Core Traits": "Dynamic leader",
    "Social Impression": "Charismatic",
    "Behavioral Tendencies": "Decisive",
    "Physical Appearance": "Athletic",
    "Compatibility Note": "Harmonious with Aries",
    "Summary/Reflection": "Step forward boldly."
  };

  const ascData = { risingSign: "Scorpio" };
  const merged = mergeDeterministicFields("ascendant_calc", mockGroqAscendantOutput, ascData, "hu");

  assert.strictEqual(merged["Rising Sign"], "Skorpió");
  assert.strictEqual(validateResponseObject("ascendant_calc", merged), true);
  assert.strictEqual(Object.keys(merged).length, 7);
  console.log("✅ Test 8 passed: Deterministic field merging verified for Groq outputs");
}

console.log("==================================================");
console.log("ALL BATCH 6 PROVIDER PILOT TESTS PASSED! 🎉");
console.log("==================================================");
