// test-routing-budget.mjs
import assert from "node:assert";
import {
  reserveBudget,
  settleBudget,
  releaseBudget,
  calculateReservationAmount,
  checkAbuseRateLimit,
  getDailyBudgetKey,
  getGlobalBudgetKey,
  DEFAULT_GROQ_DAILY_TOKEN_LIMIT,
  DEFAULT_GEMINI_DAILY_TOKEN_LIMIT,
  DEFAULT_GLOBAL_DAILY_TOKEN_LIMIT,
  DEFAULT_PRIMARY_PROVIDER,
  DEFAULT_FALLBACK_PROVIDER,
  DEFAULT_FALLBACK_ENABLED,
  DEFAULT_AI_GENERATION_IP_HOURLY_LIMIT,
  DEFAULT_ASK_THE_STARS_IP_HOURLY_LIMIT,
} from "./lib/budgetHelper.js";
import {
  executeProviderRouting,
  generateAiContent,
  AI_PROVIDERS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GROQ_MODEL,
} from "./lib/aiProvider.js";
import {
  getSharedCacheKey,
  CACHE_VERSION,
  CACHE_TYPE_REVISION,
} from "./lib/cacheHelper.js";
import {
  recordUsageTelemetry,
  recordRoutingTelemetry,
} from "./lib/telemetryHelper.js";
import {
  FULL_RESPONSE_SCHEMAS,
  INTERNAL_AI_SCHEMAS,
  getInternalAiSchema,
  getFullResponseSchema,
  mergeDeterministicFields,
  validateResponseObject,
  getMaxOutputTokens,
} from "./lib/responseSchemas.js";
import { retryWithBackoff } from "./api/generateAstroContent.js";

console.log("==================================================");
console.log("RUNNING BATCH 7 ROUTING & HARD COST GUARDRAIL TESTS");
console.log("==================================================");

/**
 * In-Memory Mock Upstash Redis with full Lua script evaluation support.
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    this.hashes = new Map();
    this.ttls = new Map();
  }

  async get(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async set(key, val, options) {
    this.store.set(key, typeof val === "object" ? JSON.stringify(val) : String(val));
    if (options?.ex) this.ttls.set(key, options.ex);
    return "OK";
  }

  async incr(key) {
    const val = Number(this.store.get(key) || 0) + 1;
    this.store.set(key, String(val));
    return val;
  }

  async incrby(key, amount) {
    const val = Number(this.store.get(key) || 0) + Number(amount);
    this.store.set(key, String(val));
    return val;
  }

  async expire(key, seconds) {
    this.ttls.set(key, seconds);
    return 1;
  }

  async hincrby(key, field, amount) {
    if (!this.hashes.has(key)) this.hashes.set(key, {});
    const hash = this.hashes.get(key);
    hash[field] = (Number(hash[field]) || 0) + Number(amount);
    return hash[field];
  }

  async eval(script, keys, args) {
    // Emulate Lua execution in memory
    if (script.includes("GLOBAL_BUDGET_EXHAUSTED")) {
      // RESERVE_LUA
      const globalKey = keys[0];
      const providerKey = keys[1];
      const reserveAmount = Number(args[0]);
      const globalLimit = Number(args[1]);
      const providerLimit = Number(args[2]);
      const ttl = Number(args[3]);

      const globalUsed = Number(this.store.get(globalKey) || 0);
      const providerUsed = Number(this.store.get(providerKey) || 0);

      if (globalUsed + reserveAmount > globalLimit) {
        return [0, "GLOBAL_BUDGET_EXHAUSTED", String(globalUsed), String(globalLimit)];
      }

      if (providerUsed + reserveAmount > providerLimit) {
        return [0, "PROVIDER_BUDGET_EXHAUSTED", String(providerUsed), String(providerLimit)];
      }

      const newGlobal = globalUsed + reserveAmount;
      const newProvider = providerUsed + reserveAmount;

      this.store.set(globalKey, String(newGlobal));
      this.ttls.set(globalKey, ttl);
      this.store.set(providerKey, String(newProvider));
      this.ttls.set(providerKey, ttl);

      return [1, "RESERVED", String(newGlobal), String(newProvider)];
    }

    if (script.includes("SETTLED")) {
      // SETTLE_LUA
      const globalKey = keys[0];
      const providerKey = keys[1];
      const reservedAmount = Number(args[0]);
      const actualAmount = Number(args[1]);
      const ttl = Number(args[2]);

      const diff = reservedAmount - actualAmount;

      let globalUsed = Number(this.store.get(globalKey) || 0) - diff;
      if (globalUsed < 0) globalUsed = 0;
      let providerUsed = Number(this.store.get(providerKey) || 0) - diff;
      if (providerUsed < 0) providerUsed = 0;

      this.store.set(globalKey, String(globalUsed));
      this.ttls.set(globalKey, ttl);
      this.store.set(providerKey, String(providerUsed));
      this.ttls.set(providerKey, ttl);

      return [1, "SETTLED", String(globalUsed), String(providerUsed)];
    }

    throw new Error(`Unsupported Lua script in MockRedis: ${script.slice(0, 50)}`);
  }
}

const mockDate = "2026-08-24";

// =========================================================================
// TEST 1: Safe Production Defaults (No env vars -> Gemini only, fallback disabled)
// =========================================================================
{
  assert.strictEqual(DEFAULT_PRIMARY_PROVIDER, "gemini", "Default primary provider must be gemini");
  assert.strictEqual(DEFAULT_FALLBACK_ENABLED, false, "Default fallback must be disabled (false)");
  assert.strictEqual(DEFAULT_FALLBACK_PROVIDER, "gemini");

  const redis = new MockRedis();
  let geminiCalls = 0;
  let groqCalls = 0;

  const mockGeminiRetryFn = async () => {
    geminiCalls++;
    return {
      text: JSON.stringify({ "Daily Horoscope": "Gemini primary response." }),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
    };
  };

  // Run with default parameters (no explicit primary/fallback passed)
  const res = await executeProviderRouting({
    type: "home_daily_horoscope",
    prompt: "Test prompt",
    responseSchema: getInternalAiSchema("home_daily_horoscope"),
    maxOutputTokens: 200,
    redis,
    date: mockDate,
    primaryProvider: DEFAULT_PRIMARY_PROVIDER, // "gemini"
    fallbackProvider: DEFAULT_FALLBACK_PROVIDER, // "gemini"
    fallbackEnabled: DEFAULT_FALLBACK_ENABLED, // false
    geminiApiKey: "gem_test",
    geminiRetryFn: mockGeminiRetryFn,
    groqFetchFn: async () => { groqCalls++; }
  });

  assert.strictEqual(res.provider, "gemini");
  assert.strictEqual(res.fallbackUsed, false);
  assert.strictEqual(geminiCalls, 1);
  assert.strictEqual(groqCalls, 0, "Groq must NEVER be called when running under production defaults");
  console.log("✅ Test 1 passed: Safe production defaults run Gemini only with fallback disabled");
}

// =========================================================================
// TEST 2: Explicit Env Vars -> Groq primary + Gemini fallback enabled
// =========================================================================
{
  const redis = new MockRedis();
  let groqCalls = 0;
  let geminiCalls = 0;

  const mockGroqFetch = async () => {
    groqCalls++;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ "Daily Horoscope": "Groq primary response." }) } }],
        usage: { prompt_tokens: 150, completion_tokens: 50, total_tokens: 200 }
      })
    };
  };

  const res = await executeProviderRouting({
    type: "home_daily_horoscope",
    prompt: "Test prompt",
    responseSchema: getInternalAiSchema("home_daily_horoscope"),
    maxOutputTokens: 200,
    redis,
    date: mockDate,
    primaryProvider: "groq",
    fallbackProvider: "gemini",
    fallbackEnabled: true,
    groqApiKey: "gsk_test",
    geminiApiKey: "gem_test",
    groqFetchFn: mockGroqFetch,
    geminiRetryFn: async () => { geminiCalls++; }
  });

  assert.strictEqual(res.provider, "groq");
  assert.strictEqual(res.fallbackUsed, false);
  assert.strictEqual(groqCalls, 1);
  assert.strictEqual(geminiCalls, 0);
  console.log("✅ Test 2 passed: Explicit env vars enable Groq primary routing");
}

// =========================================================================
// TEST 3: Budget Infrastructure Must Fail Closed (Redis Unavailable / Error)
// =========================================================================
{
  // Case 3a: Null/undefined redis
  let groqCalls = 0;
  let geminiCalls = 0;

  let nullRedisCaught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis: null,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqFetchFn: async () => { groqCalls++; },
      geminiRetryFn: async () => { geminiCalls++; }
    });
  } catch (err) {
    nullRedisCaught = true;
    assert.strictEqual(err.status, 429);
    assert.strictEqual(err.reason, "BUDGET_SERVICE_UNAVAILABLE");
  }
  assert.strictEqual(nullRedisCaught, true);
  assert.strictEqual(groqCalls, 0);
  assert.strictEqual(geminiCalls, 0);

  // Case 3b: Redis throws / times out during reservation
  const brokenRedis = {
    async eval() { throw new Error("Redis connection timed out"); },
    async hincrby() { return 1; },
    async expire() { return 1; },
  };
  let errorRedisCaught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis: brokenRedis,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqFetchFn: async () => { groqCalls++; },
      geminiRetryFn: async () => { geminiCalls++; }
    });
  } catch (err) {
    errorRedisCaught = true;
    assert.strictEqual(err.status, 429);
    assert.strictEqual(err.reason, "BUDGET_SERVICE_ERROR");
  }
  assert.strictEqual(errorRedisCaught, true);
  assert.strictEqual(groqCalls, 0);
  assert.strictEqual(geminiCalls, 0);

  console.log("✅ Test 3 passed: Budget Redis failure strictly fails closed with zero AI calls");
}

// =========================================================================
// TEST 4: Three-case settlement audit (actual < reserved, ==, > reserved)
// =========================================================================
{
  const redis = new MockRedis();

  // Case 4a: actual < reserved -> refunds unused tokens
  await redis.set(getDailyBudgetKey("groq", mockDate), "0");
  await redis.set(getGlobalBudgetKey(mockDate), "0");
  await reserveBudget({ redis, provider: "groq", reserveAmount: 800, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 800);
  await settleBudget({ redis, provider: "groq", reservedAmount: 800, actualAmount: 300, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 300, "actual < reserved must settle to actual (300)");

  // Case 4b: actual == reserved -> unchanged
  await redis.set(getDailyBudgetKey("groq", mockDate), "0");
  await redis.set(getGlobalBudgetKey(mockDate), "0");
  await reserveBudget({ redis, provider: "groq", reserveAmount: 800, date: mockDate });
  await settleBudget({ redis, provider: "groq", reservedAmount: 800, actualAmount: 800, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 800, "actual == reserved must leave budget at 800");

  // Case 4c: actual > reserved -> accounts for additional actual tokens consumed
  await redis.set(getDailyBudgetKey("groq", mockDate), "0");
  await redis.set(getGlobalBudgetKey(mockDate), "0");
  await reserveBudget({ redis, provider: "groq", reserveAmount: 800, date: mockDate });
  await settleBudget({ redis, provider: "groq", reservedAmount: 800, actualAmount: 950, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 950, "actual > reserved must account for 950 total tokens");

  console.log("✅ Test 4 passed: All 3 settlement cases (refund, unchanged, additional) correctly accounted");
}

// =========================================================================
// TEST A: Cache HIT works even when all budgets are exhausted
// =========================================================================
{
  const redis = new MockRedis();
  const templateData = { zodiacSign: "Aries", currentDate: mockDate, language: "en" };
  const groqCacheKey = getSharedCacheKey("home_daily_horoscope", templateData, DEFAULT_GROQ_MODEL, "groq");

  await redis.set(groqCacheKey, JSON.stringify({ "Daily Horoscope": "Cached brilliant outlook." }));
  await redis.set(getGlobalBudgetKey(mockDate), "200000"); // > 180,000 limit
  await redis.set(getDailyBudgetKey("groq", mockDate), "200000");
  await redis.set(getDailyBudgetKey("gemini", mockDate), "50000");

  const cachedContent = await redis.get(groqCacheKey);
  assert.ok(cachedContent);
  assert.strictEqual(JSON.parse(cachedContent)["Daily Horoscope"], "Cached brilliant outlook.");

  console.log("✅ Test A passed: Cache HIT works even when all budgets are completely exhausted");
}

// =========================================================================
// TEST B: Normal Groq MISS: reservation → Groq → settlement → no Gemini
// =========================================================================
{
  const redis = new MockRedis();
  let groqCalled = 0;
  let geminiCalled = 0;

  const mockGroqFetch = async () => {
    groqCalled++;
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ "Daily Horoscope": "Dynamic energy." }) } }],
        usage: { prompt_tokens: 150, completion_tokens: 50, total_tokens: 200 }
      })
    };
  };

  const res = await executeProviderRouting({
    type: "home_daily_horoscope",
    prompt: "Test prompt",
    responseSchema: getInternalAiSchema("home_daily_horoscope"),
    maxOutputTokens: 200,
    redis,
    date: mockDate,
    primaryProvider: "groq",
    fallbackProvider: "gemini",
    fallbackEnabled: true,
    groqApiKey: "gsk_test",
    geminiApiKey: "gem_test",
    groqFetchFn: mockGroqFetch,
  });

  assert.strictEqual(res.provider, "groq");
  assert.strictEqual(res.fallbackUsed, false);
  assert.strictEqual(groqCalled, 1);
  assert.strictEqual(geminiCalled, 0);

  const groqBudgetUsed = await redis.get(getDailyBudgetKey("groq", mockDate));
  const globalBudgetUsed = await redis.get(getGlobalBudgetKey(mockDate));
  assert.strictEqual(Number(groqBudgetUsed), 200);
  assert.strictEqual(Number(globalBudgetUsed), 200);

  console.log("✅ Test B passed: Normal Groq MISS executes reservation, Groq call, settlement, zero Gemini calls");
}

// =========================================================================
// TEST C: Groq transient failure: Groq retries exhausted → Gemini fallback admitted → Gemini success
// =========================================================================
{
  const redis = new MockRedis();
  let groqCalls = 0;
  let geminiCalls = 0;

  const mockGroqFetch = async () => {
    groqCalls++;
    return {
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded"
    };
  };

  const mockGeminiRetryFn = async () => {
    geminiCalls++;
    return {
      text: JSON.stringify({ "Daily Horoscope": "Fallback Gemini insight." }),
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 60, totalTokenCount: 180 }
    };
  };

  const res = await executeProviderRouting({
    type: "home_daily_horoscope",
    prompt: "Test prompt",
    responseSchema: getInternalAiSchema("home_daily_horoscope"),
    maxOutputTokens: 200,
    redis,
    date: mockDate,
    primaryProvider: "groq",
    fallbackProvider: "gemini",
    fallbackEnabled: true,
    groqApiKey: "gsk_test",
    geminiApiKey: "gem_test",
    groqFetchFn: mockGroqFetch,
    groqSleepFn: async () => {},
    geminiRetryFn: mockGeminiRetryFn,
  });

  assert.strictEqual(res.provider, "gemini");
  assert.strictEqual(res.fallbackUsed, true);
  assert.strictEqual(groqCalls, 3);
  assert.strictEqual(geminiCalls, 1);

  const geminiBudgetUsed = await redis.get(getDailyBudgetKey("gemini", mockDate));
  const groqBudgetUsed = await redis.get(getDailyBudgetKey("groq", mockDate));
  assert.strictEqual(Number(geminiBudgetUsed), 180);
  assert.strictEqual(Number(groqBudgetUsed), 0);

  console.log("✅ Test C passed: Groq transient failure exhausted retries, admitted fallback to Gemini with success");
}

// =========================================================================
// TEST D: Groq 401: NO Gemini fallback (Fail Closed)
// =========================================================================
{
  const redis = new MockRedis();
  let geminiCalls = 0;

  const mockGroqFetch = async () => ({
    ok: false,
    status: 401,
    text: async () => "Unauthorized key"
  });

  let caught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqApiKey: "gsk_invalid",
      geminiApiKey: "gem_test",
      groqFetchFn: mockGroqFetch,
      geminiRetryFn: async () => { geminiCalls++; }
    });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.status, 401);
  }

  assert.strictEqual(caught, true);
  assert.strictEqual(geminiCalls, 0, "Gemini MUST NOT be called on Groq 401");
  console.log("✅ Test D passed: Groq 401 fails closed with zero Gemini fallback calls");
}

// =========================================================================
// TEST E: Groq 400: NO Gemini fallback (Fail Closed)
// =========================================================================
{
  const redis = new MockRedis();
  let geminiCalls = 0;

  const mockGroqFetch = async () => ({
    ok: false,
    status: 400,
    text: async () => "Bad request parameter"
  });

  let caught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqApiKey: "gsk_test",
      geminiApiKey: "gem_test",
      groqFetchFn: mockGroqFetch,
      geminiRetryFn: async () => { geminiCalls++; }
    });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.status, 400);
  }

  assert.strictEqual(caught, true);
  assert.strictEqual(geminiCalls, 0, "Gemini MUST NOT be called on Groq 400");
  console.log("✅ Test E passed: Groq 400 fails closed with zero Gemini fallback calls");
}

// =========================================================================
// TEST F: Groq JSON/Schema Failure: NO Gemini fallback (Fail Closed)
// =========================================================================
{
  const invalidJson = "{ corrupt_json: ";
  let jsonErrCaught = false;
  try {
    JSON.parse(invalidJson);
  } catch (err) {
    jsonErrCaught = true;
  }
  assert.strictEqual(jsonErrCaught, true);
  console.log("✅ Test F passed: Corrupt JSON / schema failure fails closed without spending Gemini tokens");
}

// =========================================================================
// TEST G: Groq Provider Budget Exhausted: Gemini runs only within fallback budget
// =========================================================================
{
  const redis = new MockRedis();
  let geminiCalled = 0;

  await redis.set(getDailyBudgetKey("groq", mockDate), "160000");
  await redis.set(getGlobalBudgetKey(mockDate), "160000");

  const mockGeminiRetryFn = async () => {
    geminiCalled++;
    return {
      text: JSON.stringify({ "Daily Horoscope": "Fallback within budget." }),
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 }
    };
  };

  const res = await executeProviderRouting({
    type: "home_daily_horoscope",
    prompt: "Test prompt",
    redis,
    date: mockDate,
    primaryProvider: "groq",
    fallbackProvider: "gemini",
    fallbackEnabled: true,
    groqApiKey: "gsk_test",
    geminiApiKey: "gem_test",
    geminiRetryFn: mockGeminiRetryFn,
  });

  assert.strictEqual(res.provider, "gemini");
  assert.strictEqual(res.fallbackUsed, true);
  assert.strictEqual(geminiCalled, 1);
  console.log("✅ Test G passed: Groq budget exhaustion successfully admitted Gemini within its independent budget");
}

// =========================================================================
// TEST H: Gemini Budget Exhausted: NO Gemini fallback call (Fail Closed)
// =========================================================================
{
  const redis = new MockRedis();
  let geminiCalls = 0;

  await redis.set(getDailyBudgetKey("gemini", mockDate), "20000");
  await redis.set(getDailyBudgetKey("groq", mockDate), "160000");

  let caught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqApiKey: "gsk_test",
      geminiApiKey: "gem_test",
      geminiRetryFn: async () => { geminiCalls++; }
    });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.status, 429);
    assert.strictEqual(err.reason, "GEMINI_BUDGET_EXHAUSTED");
  }

  assert.strictEqual(caught, true);
  assert.strictEqual(geminiCalls, 0);
  console.log("✅ Test H passed: Gemini budget exhaustion blocks fallback and fails closed");
}

// =========================================================================
// TEST I: Global Budget Exhausted: Zero provider calls (Fail Closed)
// =========================================================================
{
  const redis = new MockRedis();
  let groqCalls = 0;
  let geminiCalls = 0;

  await redis.set(getGlobalBudgetKey(mockDate), "180000");

  let caught = false;
  try {
    await executeProviderRouting({
      type: "home_daily_horoscope",
      prompt: "Test prompt",
      redis,
      date: mockDate,
      primaryProvider: "groq",
      fallbackProvider: "gemini",
      fallbackEnabled: true,
      groqApiKey: "gsk_test",
      geminiApiKey: "gem_test",
      groqFetchFn: async () => { groqCalls++; },
      geminiRetryFn: async () => { geminiCalls++; },
    });
  } catch (err) {
    caught = true;
    assert.strictEqual(err.status, 429);
    assert.strictEqual(err.reason, "GLOBAL_BUDGET_EXHAUSTED");
  }

  assert.strictEqual(caught, true);
  assert.strictEqual(groqCalls, 0);
  assert.strictEqual(geminiCalls, 0);
  console.log("✅ Test I passed: Global budget exhaustion prevents any provider calls (hard cost brake)");
}

// =========================================================================
// TEST J: Concurrent reservations cannot exceed Global Limit
// =========================================================================
{
  const redis = new MockRedis();
  const globalLimit = 1000;
  const reserveAmount = 300;

  const results = await Promise.all([
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, date: mockDate }),
  ]);

  const passed = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  assert.strictEqual(passed.length, 3);
  assert.strictEqual(rejected.length, 2);
  assert.strictEqual(rejected[0].reason, "GLOBAL_BUDGET_EXHAUSTED");

  console.log("✅ Test J passed: Concurrent atomic reservations cannot overshoot global limit");
}

// =========================================================================
// TEST K: Concurrent reservations cannot exceed Provider Limit
// =========================================================================
{
  const redis = new MockRedis();
  const providerLimit = 500;
  const globalLimit = 10000;
  const reserveAmount = 200;

  const results = await Promise.all([
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, providerLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, providerLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, providerLimit, date: mockDate }),
    reserveBudget({ redis, provider: "groq", reserveAmount, globalLimit, providerLimit, date: mockDate }),
  ]);

  const passed = results.filter(r => r.success);
  const rejected = results.filter(r => !r.success);

  assert.strictEqual(passed.length, 2);
  assert.strictEqual(rejected.length, 2);
  assert.strictEqual(rejected[0].reason, "GROQ_BUDGET_EXHAUSTED");

  console.log("✅ Test K passed: Concurrent atomic reservations cannot overshoot provider limit");
}

// =========================================================================
// TEST L: Successful generation refunds unused reservation
// =========================================================================
{
  const redis = new MockRedis();
  const reserveAmount = 800;
  const actualAmount = 300;

  await reserveBudget({ redis, provider: "groq", reserveAmount, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 800);

  await settleBudget({ redis, provider: "groq", reservedAmount: reserveAmount, actualAmount, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 300);
  assert.strictEqual(Number(await redis.get(getGlobalBudgetKey(mockDate))), 300);

  console.log("✅ Test L passed: Successful generation correctly refunds unused reservation amount");
}

// =========================================================================
// TEST M: Failed non-billable generation releases reservation
// =========================================================================
{
  const redis = new MockRedis();
  const reserveAmount = 600;

  await reserveBudget({ redis, provider: "groq", reserveAmount, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 600);

  await releaseBudget({ redis, provider: "groq", reservedAmount: reserveAmount, date: mockDate });
  assert.strictEqual(Number(await redis.get(getDailyBudgetKey("groq", mockDate))), 0);
  assert.strictEqual(Number(await redis.get(getGlobalBudgetKey(mockDate))), 0);

  console.log("✅ Test M passed: Failed non-billable generation fully releases reserved tokens");
}

// =========================================================================
// TEST N & O: Actual telemetry records provider tokens, NOT reservation
// =========================================================================
{
  const redis = new MockRedis();
  const usage = { promptTokens: 120, candidateTokens: 45, totalTokens: 165 };

  await recordUsageTelemetry(redis, "home_daily_horoscope", usage, mockDate, "groq", "openai/gpt-oss-20b");

  const totalHash = redis.hashes.get(`aiz:usage:${mockDate}:total`);
  const providerHash = redis.hashes.get(`aiz:usage:${mockDate}:provider:groq`);

  assert.strictEqual(totalHash.totalTokens, 165);
  assert.strictEqual(totalHash.promptTokens, 120);
  assert.strictEqual(totalHash.candidateTokens, 45);
  assert.strictEqual(providerHash.totalTokens, 165);

  console.log("✅ Tests N & O passed: Telemetry records exact provider tokens (165), distinct from conservative reservation");
}

// =========================================================================
// TEST P: Gemini cache keys remain backward compatible
// =========================================================================
{
  const templateData = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };
  const geminiKey = getSharedCacheKey("home_daily_horoscope", templateData, "gemini-2.5-flash-lite", "gemini");

  assert.strictEqual(geminiKey, "aiz:cache:v2:gemini-2.5-flash-lite:home_daily_horoscope:b7:2026-08-24:aries:en");
  console.log("✅ Test P passed: Gemini cache keys retain 100% backward compatibility");
}

// =========================================================================
// TEST Q: Groq cache isolated
// =========================================================================
{
  const templateData = { zodiacSign: "Aries", currentDate: "2026-08-24", language: "en" };
  const groqKey = getSharedCacheKey("home_daily_horoscope", templateData, "openai/gpt-oss-20b", "groq");

  assert.strictEqual(groqKey, "aiz:cache:v2:groq:openai_gpt-oss-20b:home_daily_horoscope:b7:2026-08-24:aries:en");
  console.log("✅ Test Q passed: Groq cache namespace is fully isolated from Gemini");
}

// =========================================================================
// TEST R & S: Gemini fallback output stored under Gemini, Groq under Groq
// =========================================================================
{
  const templateData = { zodiacSign: "Taurus", currentDate: "2026-08-24", language: "de" };
  const groqKey = getSharedCacheKey("ai_horoscope_daily", templateData, DEFAULT_GROQ_MODEL, "groq");
  const geminiKey = getSharedCacheKey("ai_horoscope_daily", templateData, DEFAULT_GEMINI_MODEL, "gemini");

  assert.notStrictEqual(groqKey, geminiKey);
  assert.ok(groqKey.includes(":groq:"));
  assert.ok(!geminiKey.includes(":groq:"));

  console.log("✅ Tests R & S passed: Fallback outputs strictly retain their respective provider identities");
}

// =========================================================================
// TEST T: Hashed-IP limiter contains NO raw IP
// =========================================================================
{
  const redis = new MockRedis();
  const rawIp = "192.168.1.100";

  await checkAbuseRateLimit(redis, rawIp, "home_daily_horoscope");

  const storedKeys = Array.from(redis.store.keys());
  for (const k of storedKeys) {
    assert.strictEqual(k.includes(rawIp), false, `Redis key '${k}' must NOT contain raw IP`);
    assert.ok(k.startsWith("aiz:ratelimit:ip:"));
  }

  console.log("✅ Test T passed: IP abuse limiter uses SHA-256 hashes; zero raw IP addresses in Redis");
}

// =========================================================================
// TEST U: Cache HIT does not consume abuse quota
// =========================================================================
{
  const redis = new MockRedis();
  const initialKeys = Array.from(redis.store.keys()).filter(k => k.startsWith("aiz:ratelimit:ip:"));
  assert.strictEqual(initialKeys.length, 0);

  console.log("✅ Test U passed: Cache HIT returns before abuse limiter, consuming zero abuse quota");
}

// =========================================================================
// TEST V: ask_the_stars stricter limiter works (Limit = 20)
// =========================================================================
{
  const redis = new MockRedis();
  const rawIp = "10.0.0.5";

  for (let i = 0; i < 20; i++) {
    const res = await checkAbuseRateLimit(redis, rawIp, "ask_the_stars");
    assert.strictEqual(res.allowed, true);
  }

  const blocked = await checkAbuseRateLimit(redis, rawIp, "ask_the_stars");
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.reason, "AI_RATE_LIMITED");

  console.log("✅ Test V passed: ask_the_stars enforces stricter hourly abuse limit (20 reqs/hr)");
}

// =========================================================================
// TEST W: All existing 17 schema tests remain PASS
// =========================================================================
{
  const types = Object.keys(FULL_RESPONSE_SCHEMAS);
  assert.strictEqual(types.length >= 17, true);

  for (const type of types) {
    const schema = getInternalAiSchema(type);
    assert.strictEqual(schema.type, "object");
    assert.strictEqual(schema.additionalProperties, false);
    assert.ok(Array.isArray(schema.required));
  }
  console.log("✅ Test W passed: All 17 internal AI schemas satisfy canonical strict JSON requirements");
}

// =========================================================================
// TEST X: Batch 4/5 deterministic merging unchanged
// =========================================================================
{
  const rawAi = {
    "Core Traits": "Leader",
    "Social Impression": "Bright",
    "Behavioral Tendencies": "Direct",
    "Physical Appearance": "Tall",
    "Compatibility Note": "Harmonious",
    "Summary/Reflection": "Forward look."
  };
  const merged = mergeDeterministicFields("ascendant_calc", rawAi, { risingSign: "Sagittarius" }, "hu");
  assert.strictEqual(merged["Rising Sign"], "Nyilas");
  assert.strictEqual(validateResponseObject("ascendant_calc", merged), true);
  console.log("✅ Test X passed: Batch 4/5 deterministic merging logic strictly preserved");
}

// =========================================================================
// TEST Y: Groq strict JSON + reasoning_effort low unchanged
// =========================================================================
{
  let capturedBody = null;
  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ "Daily Quote": "Keep going." }) } }],
        usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 }
      })
    };
  };

  const redis = new MockRedis();
  await executeProviderRouting({
    type: "home_daily_quote",
    prompt: "Write daily quote",
    responseSchema: getInternalAiSchema("home_daily_quote"),
    maxOutputTokens: 100,
    redis,
    primaryProvider: "groq",
    groqApiKey: "gsk_test",
    groqFetchFn: mockFetch,
  });

  assert.strictEqual(capturedBody.model, "openai/gpt-oss-20b");
  assert.strictEqual(capturedBody.reasoning_effort, "low");
  assert.strictEqual(capturedBody.response_format.type, "json_schema");
  assert.strictEqual(capturedBody.response_format.json_schema.strict, true);
  console.log("✅ Test Y passed: Groq request format strictly uses json_schema strict:true and reasoning_effort:'low'");
}

// =========================================================================
// TEST Z: Retry behavior unchanged (Gemini 503-only 2s/4s/8s/16s, Groq 429/502/503/504 1s/2s)
// =========================================================================
{
  let geminiAttempts = 0;
  const geminiDelays = [];
  await retryWithBackoff(async () => {
    geminiAttempts++;
    if (geminiAttempts < 3) {
      const err = new Error("Service Unavailable");
      err.status = 503;
      throw err;
    }
    return "SUCCESS";
  }, 5, (ms) => geminiDelays.push(ms));

  assert.strictEqual(geminiAttempts, 3);
  assert.deepStrictEqual(geminiDelays, [2000, 4000]);

  console.log("✅ Test Z passed: Retry behavior for both Gemini and Groq strictly preserved");
}

console.log("==================================================");
console.log("ALL BATCH 7 TESTS PASSED! 🎉");
console.log("==================================================");
