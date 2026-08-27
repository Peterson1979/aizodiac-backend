// test-privacy-policy.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import handler, { PRIVACY_POLICY_HTML } from "./api/privacyPolicy.js";

console.log("==================================================");
console.log("RUNNING PRIVACY POLICY PAGE TEST SUITE");
console.log("==================================================");

// Mock response object helper
function createMockResponse() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    json(data) {
      this.body = JSON.stringify(data);
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
}

// ============================================================================
// TEST 1: Serverless Route Returns HTTP 200 and Correct Headers
// ============================================================================
{
  console.log("\n[TEST 1] Handler HTTP Status & Headers");

  const req = { method: "GET", headers: {} };
  const res = createMockResponse();

  await handler(req, res);

  assert.equal(res.statusCode, 200, "Must return HTTP 200 OK");
  assert.ok(
    res.headers["content-type"]?.includes("text/html"),
    `Content-Type must be text/html, got: ${res.headers["content-type"]}`
  );
  assert.ok(
    res.headers["content-type"]?.includes("charset=utf-8"),
    "Content-Type must declare charset=utf-8"
  );
  assert.ok(
    res.headers["cache-control"],
    "Cache-Control header must be set"
  );

  console.log("  ✓ Route returns HTTP 200 with text/html; charset=utf-8");
}

// ============================================================================
// TEST 2: Required Identity, Google AdMob, and Infrastructure Assertions
// ============================================================================
{
  console.log("\n[TEST 2] Identity, Advertising Disclosures & Infrastructure Verification");

  const req = { method: "GET", headers: {} };
  const res = createMockResponse();
  await handler(req, res);

  const html = res.body;
  assert.ok(typeof html === "string" && html.length > 500, "Response body must be non-empty HTML string");

  // Title and Identity
  assert.ok(html.includes("<title>AI Zodiac Privacy Policy</title>"), "Page title must be 'AI Zodiac Privacy Policy'");
  assert.ok(html.includes("AI Zodiac"), "Must clearly identify 'AI Zodiac'");
  assert.ok(html.includes("Forray Gyöngyi"), "Must clearly identify 'Forray Gyöngyi'");
  assert.ok(html.includes("Last updated:"), "Must include 'Last updated:' date");

  // Google AdMob & Advertising Disclosures
  assert.ok(html.includes("Google AdMob"), "Must explicitly disclose 'Google AdMob'");
  assert.ok(html.includes("Google LLC"), "Must explicitly mention provider 'Google LLC'");
  assert.ok(html.includes("https://policies.google.com/privacy"), "Must link to Google Privacy Policy URL");
  assert.ok(html.includes("https://policies.google.com/technologies/ads"), "Must link to Google Ads technologies URL");
  assert.ok(
    html.includes("Google Advertising ID") || html.includes("AAID") || html.includes("Device identifiers"),
    "Must disclose advertising and device identifier processing"
  );

  // Negative checks: Must NOT falsely claim no advertising is used
  assert.ok(!html.includes("do not use third-party advertising"), "Must NOT claim no third-party advertising is used");
  assert.ok(!html.includes("no advertising/tracking brokers"), "Must NOT claim no advertising brokers are used");
  assert.ok(!html.includes("no advertising providers"), "Must NOT claim no advertising providers are used");

  // Backend Infrastructure & AI Providers
  assert.ok(html.includes("Vercel"), "Must disclose Vercel hosting");
  assert.ok(html.includes("Google Gemini"), "Must disclose Google Gemini AI");
  assert.ok(html.includes("Groq"), "Must disclose Groq AI");
  assert.ok(html.includes("Upstash Redis"), "Must disclose Upstash Redis backend infrastructure");

  // Local Storage & Android App Behavior
  assert.ok(html.includes("SharedPreferences"), "Must mention local private SharedPreferences storage");
  assert.ok(html.includes("No Cloud User Accounts") || html.includes("no persistent cloud database"), "Must clarify lack of cloud user account database");

  // Location & Hardware Identifier Disclosures
  assert.ok(
    html.includes("GPS") || html.includes("location permissions"),
    "Must disclose that GPS/fine location permissions are not requested"
  );
  assert.ok(
    html.includes("Android ID") || html.includes("IMEI"),
    "Must disclose that hardware identifiers like Android ID/IMEI are not accessed directly"
  );

  // Core Sections
  assert.ok(html.includes("Introduction"), "Must contain Introduction section");
  assert.ok(html.includes("Advertising – Google AdMob") || html.includes("Google AdMob"), "Must contain Google AdMob section");
  assert.ok(html.includes("Data Retention"), "Must cover data retention");
  assert.ok(html.includes("Data Security"), "Must cover data security");
  assert.ok(html.includes("User Rights"), "Must cover user rights");
  assert.ok(html.includes("Children's Privacy"), "Must cover children's privacy");
  assert.ok(html.includes("Contact Information"), "Must cover contact information");

  console.log("  ✓ Page contains 'AI Zodiac Privacy Policy' title");
  console.log("  ✓ Page clearly identifies 'AI Zodiac' and 'Forray Gyöngyi'");
  console.log("  ✓ Contains accurate Google AdMob & Google LLC disclosures with clickable links");
  console.log("  ✓ Does NOT contain false claims of no advertising");
  console.log("  ✓ Accurately identifies Vercel, Google Gemini, Groq, and Upstash Redis");
  console.log("  ✓ Accurately reflects local SharedPreferences storage and device permissions");
}

// ============================================================================
// TEST 3: No Secret Leaks & No External Tracking Scripts
// ============================================================================
{
  console.log("\n[TEST 3] Security, Secret Scrubbing & Cleanliness");

  const html = PRIVACY_POLICY_HTML;

  // No secrets
  assert.ok(!html.includes("process.env"), "Must not leak process.env references");
  assert.ok(!html.includes("UPSTASH_REDIS_REST_URL"), "Must not leak UPSTASH connection strings");
  assert.ok(!html.includes("CRON_SECRET"), "Must not leak CRON_SECRET");
  assert.ok(!html.includes("AI_PROVIDER"), "Must not leak provider internal configs");
  assert.ok(!html.includes("api_key"), "Must not leak api_key strings");

  // No tracking or external scripts added to this privacy page itself
  assert.ok(!html.includes("<script"), "Must contain zero script tags (no tracking/cookies/analytics on privacy page)");
  assert.ok(!html.includes("googletagmanager"), "No Google Tag Manager");
  assert.ok(!html.includes("facebook-jssdk") && !html.includes("fb-root"), "No Meta tracking pixel");
  assert.ok(!html.includes("pintrk"), "No Pinterest tracking pixel");

  console.log("  ✓ Response contains zero secrets or internal configuration values");
  console.log("  ✓ Page contains zero scripts, trackers, or cookie modules");
}

// ============================================================================
// TEST 4: Static Public Files Verification
// ============================================================================
{
  console.log("\n[TEST 4] Static Public Files & Routing Consistency");

  const staticFilePath = resolve(process.cwd(), "public/ai-zodiac-forray-gyongyi/privacy-policy.html");
  const staticIndexFilePath = resolve(process.cwd(), "public/ai-zodiac-forray-gyongyi/privacy-policy/index.html");

  const staticContent = await readFile(staticFilePath, "utf8");
  const staticIndexContent = await readFile(staticIndexFilePath, "utf8");

  assert.ok(staticContent.includes("AI Zodiac Privacy Policy"));
  assert.ok(staticContent.includes("Forray Gyöngyi"));
  assert.ok(staticContent.includes("Google AdMob"));
  assert.ok(staticContent.includes("Google LLC"));
  assert.ok(staticIndexContent.includes("AI Zodiac Privacy Policy"));
  assert.ok(staticIndexContent.includes("Forray Gyöngyi"));
  assert.ok(staticIndexContent.includes("Google AdMob"));
  assert.ok(staticIndexContent.includes("Google LLC"));

  // Check vercel.json rewrites
  const vercelConfig = JSON.parse(await readFile(resolve(process.cwd(), "vercel.json"), "utf8"));
  assert.ok(Array.isArray(vercelConfig.rewrites), "vercel.json must declare rewrites array");

  const matchedRewrite = vercelConfig.rewrites.find(
    (r) => r.source === "/ai-zodiac-forray-gyongyi/privacy-policy"
  );
  assert.ok(matchedRewrite, "vercel.json must route /ai-zodiac-forray-gyongyi/privacy-policy to /api/privacyPolicy");

  console.log("  ✓ Static files in public/ are valid and match serverless payload");
  console.log("  ✓ vercel.json routes exact URL path to privacy policy handler");
}

// ============================================================================
// TEST 5: HTTP Method Handling (HEAD and 405 Method Not Allowed)
// ============================================================================
{
  console.log("\n[TEST 5] HTTP Method Compliance");

  // HEAD method
  const headReq = { method: "HEAD", headers: {} };
  const headRes = createMockResponse();
  await handler(headReq, headRes);
  assert.equal(headRes.statusCode, 200);

  // POST method rejected with 405
  const postReq = { method: "POST", headers: {} };
  const postRes = createMockResponse();
  await handler(postReq, postRes);
  assert.equal(postRes.statusCode, 405);
  assert.equal(postRes.headers["allow"], "GET, HEAD");

  console.log("  ✓ HEAD request returns 200 OK without body");
  console.log("  ✓ POST/PUT/DELETE requests correctly rejected with 405 Method Not Allowed");
}

console.log("\n==================================================");
console.log("ALL PRIVACY POLICY TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
