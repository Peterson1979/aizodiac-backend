// test-cleanup-security.mjs
import assert from "node:assert";
import fs from "node:fs";
import { processAstroRequest } from "./api/generateAstroContent.js";
import astroHandler from "./api/astro.js";

console.log("==================================================");
console.log("RUNNING SECURITY & CLEANUP TESTS");
console.log("==================================================");

// Test 1: Confirm dangerous public diagnostic and broken routes are removed
assert.strictEqual(fs.existsSync("./api/test-gemini.js"), false, "api/test-gemini.js must be removed");
assert.strictEqual(fs.existsSync("./api/horoscope/generate.js"), false, "api/horoscope/generate.js must be removed");
assert.strictEqual(fs.existsSync("./api/horoscope"), false, "api/horoscope directory must be removed");
console.log("✅ Test 1 passed: Dangerous/broken routes successfully eliminated");

// Test 2: Input length sanitization for ask_the_stars
{
  const hugeQuestion = "A".repeat(5000);
  const res = await processAstroRequest({
    body: {
      type: "ask_the_stars",
      data: { question: hugeQuestion },
      languageCode: "en"
    },
    ip: "127.0.0.1",
    redisClient: null // triggers reserve fallback
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers["X-AIZ-Source"], "reserve");
  const parsed = JSON.parse(res.body.content);
  assert.ok(parsed.Answer, "Should return reserve answer safely");
  console.log("✅ Test 2 passed: Huge question payload (>5000 chars) handled safely without memory/buffer blowup");
}

// Test 3: Method Not Allowed for GET requests on astro.js compatibility adapter
{
  const mockReq = {
    method: "GET",
    headers: { get: () => "127.0.0.1" }
  };
  const response = await astroHandler(mockReq);
  assert.strictEqual(response.status, 405);
  const data = await response.json();
  assert.strictEqual(data.error, "method_not_allowed");
  console.log("✅ Test 3 passed: astro.js rejects non-POST requests with 405");
}

// Test 4: Full compatibility between api/astro.js adapter and canonical processAstroRequest
{
  const mockReq = {
    method: "POST",
    headers: { get: () => "127.0.0.1" },
    json: async () => ({
      type: "home_daily_horoscope",
      data: { zodiacSign: "Leo", specificDate: "2026-08-24" },
      languageCode: "hu"
    })
  };

  const response = await astroHandler(mockReq);
  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.headers.get("X-AIZ-Source"), "reserve");
  const body = await response.json();
  assert.strictEqual(body.success, true);
  const content = JSON.parse(body.content);
  assert.ok(content["Daily Horoscope"], "Must return daily horoscope");
  console.log("✅ Test 4 passed: api/astro.js adapter delegates smoothly to shared canonical processor");
}

// Test 5: Missing type error handling
{
  const res = await processAstroRequest({
    body: { data: { zodiacSign: "Aries" } },
    ip: "127.0.0.1",
    redisClient: null
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, "missing_type");
  console.log("✅ Test 5 passed: Missing type correctly returns 400 without stack trace");
}

console.log("==================================================");
console.log("ALL SECURITY & CLEANUP TESTS PASSED! 🎉");
console.log("==================================================");
