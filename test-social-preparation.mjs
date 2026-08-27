// test-social-preparation.mjs
import assert from "node:assert/strict";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { getTopicStrategyForDate, ROTATION_STRATEGY } from "./lib/social/content/topicRotation.js";
import {
  normalizeTopic,
  computeTopicSimilarity,
  isTopicDuplicate,
  recordTopicUsage,
  getRecentTopics,
  getDaysDifference,
} from "./lib/social/content/contentHistory.js";
import {
  SOCIAL_AI_CREATIVE_SCHEMA,
  SOCIAL_CONTENT_SCHEMA,
  buildSocialContentPrompt,
  validateAiCreativeOutput,
  assembleCanonicalSocialContent,
  validateSocialContent,
  generateDailySocialContent,
  VALID_ZODIAC_SIGNS,
  DEFAULT_APP_PLAY_STORE_URL,
} from "./lib/social/content/dailyContentGenerator.js";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  wrapTextToLines,
  escapeXml,
  renderTitleSlideSvg,
  renderContentSlideSvg,
  renderCtaSlideSvg,
} from "./lib/social/render/templates.js";
import {
  getSlideStorageKey,
  renderCarouselSlides,
  renderSlidePng,
  createTextLayer,
  convertSvgToPng,
  FONT_REGULAR_PATH,
  FONT_BOLD_PATH,
} from "./lib/social/render/carouselRenderer.js";
import {
  getR2Config,
  validateR2Config,
  getPublicR2Url,
  uploadCarouselSlides,
} from "./lib/social/storage/r2Storage.js";
import {
  getPrepareState,
  savePrepareState,
  updatePrepareStage,
  PREPARE_STAGES,
  getPrepareStateKey,
} from "./lib/social/prepareStateHelper.js";
import { executeDailyPreparation } from "./lib/social/prepareCoordinator.js";
import { validateManifest, resolveManifestForDate } from "./lib/social/contentManifest.js";
import { MEDIA_TYPES } from "./lib/social/types.js";
import prepareCronHandler from "./api/cron/prepareDailySocial.js";

console.log("==================================================");
console.log("RUNNING SOCIAL PREPARATION PIPELINE TEST SUITE");
console.log("==================================================");

/**
 * In-Memory Mock Redis implementing hash commands, string commands, expirations, and lua eval.
 */
class MockRedis {
  constructor() {
    this.store = new Map();
    this.hashes = new Map();
    this.expirations = new Map();
  }

  async get(key) {
    if (this.expirations.has(key) && Date.now() > this.expirations.get(key)) {
      this.store.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async set(key, value, options = {}) {
    if (options.nx) {
      const exists = await this.get(key);
      if (exists !== null) return null;
    }
    this.store.set(key, String(value));
    if (options.ex) {
      this.expirations.set(key, Date.now() + options.ex * 1000);
    }
    return "OK";
  }

  async del(key) {
    const d1 = this.store.delete(key);
    const d2 = this.hashes.delete(key);
    this.expirations.delete(key);
    return d1 || d2 ? 1 : 0;
  }

  async hset(key, obj) {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const map = this.hashes.get(key);
    for (const [f, v] of Object.entries(obj)) {
      map.set(f, String(v));
    }
    return Object.keys(obj).length;
  }

  async hget(key, field) {
    const map = this.hashes.get(key);
    return map?.get(field) ?? null;
  }

  async hgetall(key) {
    const map = this.hashes.get(key);
    if (!map) return null;
    const result = {};
    for (const [f, v] of map.entries()) {
      result[f] = v;
    }
    return result;
  }

  async hincrby(key, field, amount) {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const map = this.hashes.get(key);
    const current = Number(map.get(field) || 0);
    const updated = current + Number(amount);
    map.set(field, String(updated));
    return updated;
  }

  async expire(key, seconds) {
    this.expirations.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async eval(script, keys, args) {
    // 1. Basic distributed lock release lua script support
    if (script.includes("return redis.call('DEL', KEYS[1])")) {
      const key = keys[0];
      const expectedOwner = String(args[0]);
      const currentVal = await this.get(key);
      if (currentVal === expectedOwner) {
        await this.del(key);
        return 1;
      }
      return 0;
    }

    // 2. Budget Reservation Lua script
    if (script.includes("GLOBAL_BUDGET_EXHAUSTED")) {
      const globalKey = keys[0];
      const providerKey = keys[1];
      const reserveAmount = Number(args[0]);
      const globalLimit = Number(args[1]);
      const providerLimit = Number(args[2]);

      const globalUsed = Number((await this.get(globalKey)) || 0);
      const providerUsed = Number((await this.get(providerKey)) || 0);

      if (globalUsed + reserveAmount > globalLimit) {
        return [0, "GLOBAL_BUDGET_EXHAUSTED", String(globalUsed), String(globalLimit)];
      }

      if (providerUsed + reserveAmount > providerLimit) {
        return [0, "PROVIDER_BUDGET_EXHAUSTED", String(providerUsed), String(providerLimit)];
      }

      const newGlobal = globalUsed + reserveAmount;
      const newProvider = providerUsed + reserveAmount;

      await this.set(globalKey, newGlobal);
      await this.set(providerKey, newProvider);

      return [1, "RESERVED", String(newGlobal), String(newProvider)];
    }

    // 3. Budget Settlement Lua script
    if (script.includes("SETTLED")) {
      const globalKey = keys[0];
      const providerKey = keys[1];
      const reservedAmount = Number(args[0]);
      const actualAmount = Number(args[1]);

      const diff = reservedAmount - actualAmount;

      let globalUsed = Number((await this.get(globalKey)) || 0) - diff;
      if (globalUsed < 0) globalUsed = 0;
      let providerUsed = Number((await this.get(providerKey)) || 0) - diff;
      if (providerUsed < 0) providerUsed = 0;

      await this.set(globalKey, globalUsed);
      await this.set(providerKey, providerUsed);

      return [1, "SETTLED", String(globalUsed), String(providerUsed)];
    }

    return 1;
  }
}

/**
 * Mock S3 Client for testing Cloudflare R2 uploads without network traffic.
 */
class MockS3Client {
  constructor() {
    this.uploadedObjects = new Map();
    this.sendCalls = [];
  }

  async send(command) {
    this.sendCalls.push(command);
    const cmdName = command.constructor?.name || "Command";

    if (cmdName === "PutObjectCommand") {
      const input = command.input;
      const key = input.Key;
      this.uploadedObjects.set(key, {
        bucket: input.Bucket,
        key: input.Key,
        body: input.Body,
        contentType: input.ContentType,
      });
      return { $metadata: { httpStatusCode: 200 } };
    }

    if (cmdName === "HeadObjectCommand") {
      const key = command.input.Key;
      if (this.uploadedObjects.has(key)) {
        return { $metadata: { httpStatusCode: 200 } };
      }
      const err = new Error("Not Found");
      err.name = "NotFound";
      err.$metadata = { httpStatusCode: 404 };
      throw err;
    }

    return { $metadata: { httpStatusCode: 200 } };
  }
}

// Sample Raw Creative AI Output (before deterministic assembly)
function createSampleAiCreative(overrides = {}) {
  return {
    topic: "3 Zodiac Signs That Value Loyalty Most",
    items: [
      {
        sign: "Taurus",
        text: "Grounded and unwavering, Taurus builds trust slowly but defends it fiercely.",
      },
      {
        sign: "Scorpio",
        text: "Intensely devoted, Scorpio gives all-or-nothing loyalty to those who earn it.",
      },
      {
        sign: "Capricorn",
        text: "Steadfast and reliable, Capricorn stands by commitments through every storm.",
      },
    ],
    instagramCaption: "Which zodiac sign has shown you the deepest loyalty? ✨ Explore your personal astrological blueprint with AI Zodiac. Link in bio! 🔮 #astrology #zodiac #horoscope #aizodiac #taurus #scorpio #capricorn",
    facebookCaption: "Loyalty runs deep in these 3 zodiac signs. Do you agree with this ranking? Download AI Zodiac free on Google Play for personalized daily horoscopes and compatibility insights! 🌟 https://play.google.com/store/apps/details?id=com.oberon.aizodiac",
    pinterestTitle: "3 Zodiac Signs That Value Loyalty Most | Astrology Insights",
    pinterestDescription: "Discover which zodiac signs value loyalty above all else in friendships and relationships. Explore your complete astrological profile with the free AI Zodiac app.",
    ...overrides,
  };
}

// Sample Canonical Assembled Content
function createSampleAiContent(overrides = {}) {
  const creative = createSampleAiCreative(overrides);
  return assembleCanonicalSocialContent({
    creative,
    publishDate: overrides.publishDate || "2026-09-01",
    category: overrides.category || "personality",
  });
}

// ============================================================================
// TEST 1: Weekday Topic Rotation Strategy
// ============================================================================
{
  console.log("\n[TEST 1] Weekday Topic Rotation Strategy");

  // 2026-08-30 is Sunday (0)
  const sunday = getTopicStrategyForDate("2026-08-30");
  assert.equal(sunday.dayOfWeek, 0);
  assert.equal(sunday.dayName, "Sunday");
  assert.equal(sunday.category, "self_discovery");

  // 2026-08-31 is Monday (1)
  const monday = getTopicStrategyForDate("2026-08-31");
  assert.equal(monday.dayOfWeek, 1);
  assert.equal(monday.dayName, "Monday");
  assert.equal(monday.category, "daily_insight");

  // 2026-09-01 is Tuesday (2)
  const tuesday = getTopicStrategyForDate("2026-09-01");
  assert.equal(tuesday.dayOfWeek, 2);
  assert.equal(tuesday.dayName, "Tuesday");
  assert.equal(tuesday.category, "personality");

  // 2026-09-02 is Wednesday (3)
  const wednesday = getTopicStrategyForDate("2026-09-02");
  assert.equal(wednesday.dayOfWeek, 3);
  assert.equal(wednesday.dayName, "Wednesday");
  assert.equal(wednesday.category, "love_compatibility");

  // 2026-09-03 is Thursday (4)
  const thursday = getTopicStrategyForDate("2026-09-03");
  assert.equal(thursday.dayOfWeek, 4);
  assert.equal(thursday.dayName, "Thursday");
  assert.equal(thursday.category, "zodiac_psychology");

  // 2026-09-04 is Friday (5)
  const friday = getTopicStrategyForDate("2026-09-04");
  assert.equal(friday.dayOfWeek, 5);
  assert.equal(friday.dayName, "Friday");
  assert.equal(friday.category, "dating_relationships");

  // 2026-09-05 is Saturday (6)
  const saturday = getTopicStrategyForDate("2026-09-05");
  assert.equal(saturday.dayOfWeek, 6);
  assert.equal(saturday.dayName, "Saturday");
  assert.equal(saturday.category, "fun_ranking");

  console.log("  ✓ All 7 weekdays map deterministically to required controlled categories");
}

// ============================================================================
// TEST 2: 120-Day Duplicate Topic Prevention
// ============================================================================
{
  console.log("\n[TEST 2] 120-Day Duplicate Topic Prevention in Redis");

  const redis = new MockRedis();
  const testDate = "2026-09-01";
  const testTopic = "3 Zodiac Signs That Value Loyalty Most";

  // 1. Initial check on empty Redis: not duplicate
  const check1 = await isTopicDuplicate(redis, testTopic, { publishDate: testDate, thresholdDays: 120 });
  assert.equal(check1.isDuplicate, false);

  // 2. Record topic on 2026-09-01
  await recordTopicUsage(redis, {
    topic: testTopic,
    category: "personality",
    publishDate: testDate,
    contentId: "social-2026-09-01",
  });

  // 3. Exact match 30 days later (2026-10-01) -> MUST BE DUPLICATE
  const check2 = await isTopicDuplicate(redis, testTopic, { publishDate: "2026-10-01", thresholdDays: 120 });
  assert.equal(check2.isDuplicate, true);
  assert.ok(check2.reason.includes("30 days ago"));

  // 4. Substantially similar topic (minor wording shift) within 120 days -> MUST BE DUPLICATE
  const similarTopic = "The 3 Zodiac Signs That Value Loyalty The Most";
  const check3 = await isTopicDuplicate(redis, similarTopic, { publishDate: "2026-10-15", thresholdDays: 120 });
  assert.equal(check3.isDuplicate, true);
  assert.ok(check3.reason.includes("SIMILARITY") || check3.reason.includes("EXACT_MATCH"));

  // 5. Completely different topic within 120 days -> ALLOWED
  const diffTopic = "Top 3 Most Spontaneous Signs for Weekend Travel";
  const check4 = await isTopicDuplicate(redis, diffTopic, { publishDate: "2026-10-01", thresholdDays: 120 });
  assert.equal(check4.isDuplicate, false);

  // 6. Same topic 130 days later (2027-01-09) -> ALLOWED (exceeds 120-day window)
  const check5 = await isTopicDuplicate(redis, testTopic, { publishDate: "2027-01-09", thresholdDays: 120 });
  assert.equal(check5.isDuplicate, false);

  console.log("  ✓ 120-day duplicate prevention blocks exact and high-similarity topics");
  console.log("  ✓ Same topic correctly allowed after 120 days elapsed");
}

// ============================================================================
// TEST 3: Strict AI JSON Quality Guards & Schema Validation
// ============================================================================
{
  console.log("\n[TEST 3] Strict AI JSON Quality Guards & Schema Validation");

  // 0. Recursive Groq Structured Outputs JSON Schema Compliance Check
  function assertStrictGroqJsonSchema(schema, path = "root") {
    assert.ok(schema && typeof schema === "object", `${path} must be an object schema`);

    if (schema.type === "object") {
      assert.strictEqual(
        schema.additionalProperties,
        false,
        `${path}: additionalProperties must be explicitly set to false`
      );

      assert.ok(
        Array.isArray(schema.required),
        `${path}: required must be an array`
      );

      const propKeys = schema.properties ? Object.keys(schema.properties) : [];
      const requiredKeys = schema.required;

      // Check: Every property must be present in required
      for (const key of propKeys) {
        assert.ok(
          requiredKeys.includes(key),
          `${path}: property "${key}" must be included in required array`
        );
      }

      // Check: No unknown required properties exist
      for (const reqKey of requiredKeys) {
        assert.ok(
          propKeys.includes(reqKey),
          `${path}: required key "${reqKey}" is not defined in properties`
        );
      }

      // Recursively check each property
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          assertStrictGroqJsonSchema(propSchema, `${path}.properties.${key}`);
        }
      }
    } else if (schema.type === "array") {
      assert.ok(schema.items, `${path}: array must define items schema`);
      assertStrictGroqJsonSchema(schema.items, `${path}.items`);
    }
  }

  assertStrictGroqJsonSchema(SOCIAL_AI_CREATIVE_SCHEMA, "SOCIAL_AI_CREATIVE_SCHEMA");

  // Verify creative AI schema contains NO deterministic metadata
  assert.strictEqual(SOCIAL_AI_CREATIVE_SCHEMA.properties.contentId, undefined);
  assert.strictEqual(SOCIAL_AI_CREATIVE_SCHEMA.properties.publishDate, undefined);
  assert.strictEqual(SOCIAL_AI_CREATIVE_SCHEMA.properties.category, undefined);
  assert.strictEqual(SOCIAL_AI_CREATIVE_SCHEMA.properties.pinterestLink, undefined);
  assert.strictEqual(SOCIAL_AI_CREATIVE_SCHEMA.properties.slides, undefined);

  // Creative AI schema requires items array of { sign, text }
  const itemSchema = SOCIAL_AI_CREATIVE_SCHEMA.properties.items.items;
  assert.strictEqual(itemSchema.type, "object");
  assert.strictEqual(itemSchema.additionalProperties, false);
  assert.deepEqual(itemSchema.required, ["sign", "text"]);

  // 1. Creative Validation
  const validCreative = createSampleAiCreative();
  const creativeCheck = validateAiCreativeOutput(validCreative);
  assert.equal(creativeCheck.valid, true);

  // Rejects invalid items count !== 3
  const badCount = validateAiCreativeOutput({
    ...validCreative,
    items: validCreative.items.slice(0, 2),
  });
  assert.equal(badCount.valid, false);
  assert.ok(badCount.errors.some(e => e.includes("count must be exactly 3")));

  // Rejects duplicate sign
  const dupSignCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", text: "Text 1" },
      { sign: "Taurus", text: "Text 2" },
      { sign: "Leo", text: "Text 3" },
    ],
  });
  assert.equal(dupSignCreative.valid, false);
  assert.ok(dupSignCreative.errors.some(e => e.includes("Duplicate zodiac sign 'Taurus'")));

  // Rejects invalid sign
  const invalidSignCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Ophiuchus", text: "Text 1" },
      { sign: "Virgo", text: "Text 2" },
      { sign: "Leo", text: "Text 3" },
    ],
  });
  assert.equal(invalidSignCreative.valid, false);
  assert.ok(invalidSignCreative.errors.some(e => e.includes("invalid zodiac sign")));

  // Rejects hashtags in item text
  const hashtagCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", text: "Text with #hashtag" },
      { sign: "Virgo", text: "Text 2" },
      { sign: "Leo", text: "Text 3" },
    ],
  });
  assert.equal(hashtagCreative.valid, false);
  assert.ok(hashtagCreative.errors.some(e => e.includes("must not contain hashtags")));

  // Rejects topic with scope mismatch language (e.g. "Every Zodiac Element")
  const scopeMismatchTopic = validateAiCreativeOutput({
    ...validCreative,
    topic: "Green Flags Every Zodiac Element Loves",
  });
  assert.equal(scopeMismatchTopic.valid, false);
  assert.ok(scopeMismatchTopic.errors.some(e => e.includes("scope-mismatch")));

  // Rejects topic without 3-sign list framing
  const non3SignTopic = validateAiCreativeOutput({
    ...validCreative,
    topic: "Signs That Love Loyalty in Relationships",
  });
  assert.equal(non3SignTopic.valid, false);
  assert.ok(non3SignTopic.errors.some(e => e.includes("3-sign selection")));

  // Rejects Pinterest description claiming coverage of all four elements / every element
  const scopeMismatchPin = validateAiCreativeOutput({
    ...validCreative,
    pinterestDescription: "Discover green flags for earth, air, fire, and water across all four elements in astrology.",
  });
  assert.equal(scopeMismatchPin.valid, false);
  assert.ok(scopeMismatchPin.errors.some(e => e.includes("scope-mismatch")));

  // Rejects Instagram caption claiming coverage of every zodiac sign
  const scopeMismatchIg = validateAiCreativeOutput({
    ...validCreative,
    instagramCaption: "Here is what every zodiac sign needs in relationships! #astrology",
  });
  assert.equal(scopeMismatchIg.valid, false);
  assert.ok(scopeMismatchIg.errors.some(e => e.includes("scope-mismatch")));

  // 2. Deterministic Assembly & Canonical Validation
  const canonical = assembleCanonicalSocialContent({
    creative: validCreative,
    publishDate: "2026-09-01",
    category: "personality",
  });

  assert.equal(canonical.contentId, "social-2026-09-01");
  assert.equal(canonical.publishDate, "2026-09-01");
  assert.equal(canonical.category, "personality");
  assert.equal(canonical.pinterestLink, DEFAULT_APP_PLAY_STORE_URL);
  assert.equal(canonical.slides.length, 5);
  assert.equal(canonical.slides[0].type, "title");
  assert.equal(canonical.slides[0].headline, validCreative.topic);
  assert.equal(canonical.slides[4].type, "cta");
  assert.equal(canonical.slides[4].headline, "Discover more with AI Zodiac");
  assert.equal(canonical.slides[4].body, "Free on Google Play");

  const canonicalCheck = validateSocialContent(canonical);
  assert.equal(canonicalCheck.valid, true);

  console.log("  ✓ SOCIAL_AI_CREATIVE_SCHEMA satisfies all strict Groq Structured Outputs requirements");
  console.log("  ✓ Creative output validator enforces 3 items, valid signs, and no hashtags");
  console.log("  ✓ Scope mismatch language (every zodiac, all elements, etc.) strictly rejected");
  console.log("  ✓ Deterministic assembly builds canonical 5-slide object with guaranteed metadata");
  console.log("  ✓ Resulting canonical object passes validateSocialContent");
}

// ============================================================================
// TEST 4: No PII Entry into AI Social Prompt
// ============================================================================
{
  console.log("\n[TEST 4] No PII in Daily Social Generation Prompt");

  const strategy = getTopicStrategyForDate("2026-09-01");
  const prompt = buildSocialContentPrompt({
    publishDate: "2026-09-01",
    strategy,
    recentTopics: ["Topic 1", "Topic 2"],
  });

  assert.ok(prompt.includes("General astrology only"));
  assert.ok(prompt.includes("Never request, generate, or assume personal user profiles"));
  assert.ok(!prompt.includes("birthDate"));
  assert.ok(!prompt.includes("birthCity"));
  assert.ok(!prompt.includes("userProfile"));

  console.log("  ✓ Verified zero PII fields or personal user parameters in daily social prompt");
}

// ============================================================================
// TEST 5: Carousel Renderer - Deterministic Fontfile, Glyph Verification & Sharp PNG
// ============================================================================
{
  console.log("\n[TEST 5] Carousel Renderer: Bundled Fontfile, Glyph Verification & 1080x1350 PNG");

  // 1. Verify Bundled Font Files Exist on Local Filesystem
  assert.ok(fs.existsSync(FONT_REGULAR_PATH), `Regular font file must exist at ${FONT_REGULAR_PATH}`);
  assert.ok(fs.existsSync(FONT_BOLD_PATH), `Bold font file must exist at ${FONT_BOLD_PATH}`);
  assert.ok(fs.statSync(FONT_REGULAR_PATH).size > 100000, "Regular font file must be a non-empty TTF font");
  assert.ok(fs.statSync(FONT_BOLD_PATH).size > 100000, "Bold font file must be a non-empty TTF font");

  // 2. Text wrapping test with very long sentence
  const longText = "This is an extraordinarily long sentence designed to test whether the SVG word wrapping algorithm safely splits sentences without ever overflowing the 900px content box margins.";
  const wrappedLines = wrapTextToLines(longText, 36);
  assert.ok(wrappedLines.length >= 4);
  wrappedLines.forEach(line => {
    assert.ok(line.length <= 45, `Line exceeded safe wrapping length: ${line}`);
  });

  // 3. XML escaping test
  const dangerousText = `Signs that value "trust" & <loyalty> > everything else`;
  const escaped = escapeXml(dangerousText);
  assert.ok(!escaped.includes("<loyalty>"));
  assert.ok(escaped.includes("&amp;"));
  assert.ok(escaped.includes("&lt;loyalty&gt;"));

  // 4. Production-like Glyph Rendering & Text Bounding Box Pixel Variance Verification
  // Test slide containing all required strings:
  // "AI Zodiac", "Taurus", "Emotional consistency", "Discover more with AI Zodiac", "Free on Google Play", "1234567890"
  const glyphTestSlide = {
    type: "sign",
    sign: "Taurus",
    headline: "Emotional consistency",
    body: "Grounded Taurus offers steadfast devotion and 1234567890 cosmic balance.",
  };

  const glyphSlideBuffer = await renderSlidePng({
    slide: glyphTestSlide,
    slideNumber: 2,
    totalSlides: 5,
    category: "personality",
    categoryTitle: "Personality / Top 3",
  });

  const glyphMeta = await sharp(glyphSlideBuffer).metadata();
  assert.equal(glyphMeta.width, 1080);
  assert.equal(glyphMeta.height, 1350);
  assert.equal(glyphMeta.format, "png");

  // Helper function to extract crop and verify non-empty text pixel variation (luminance delta)
  async function assertRegionHasTextGlyphs(buffer, cropRect, regionName) {
    const rawPixels = await sharp(buffer)
      .extract(cropRect)
      .raw()
      .toBuffer();

    let minLum = 255;
    let maxLum = 0;
    for (let i = 0; i < rawPixels.length; i += 4) {
      const r = rawPixels[i];
      const g = rawPixels[i + 1];
      const b = rawPixels[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
    const delta = maxLum - minLum;
    assert.ok(
      delta > 60,
      `Region '${regionName}' failed glyph verification (lum delta: ${delta.toFixed(1)}, expected > 60). Text may be missing or tofu!`
    );
  }

  // Verify Header Brand region ("AI Zodiac")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 95, top: 88, width: 170, height: 26 }, "Header AI Zodiac");
  // Verify Taurus Sign Badge region ("Taurus")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 390, top: 334, width: 300, height: 36 }, "Taurus Sign Badge");
  // Verify Headline region ("Emotional consistency")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 200, top: 460, width: 680, height: 40 }, "Headline 'Emotional consistency'");
  // Verify Body region with numbers ("1234567890")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 200, top: 670, width: 680, height: 80 }, "Body with 1234567890 numbers");

  // Also verify CTA slide text regions ("Discover more with AI Zodiac", "Free on Google Play")
  const ctaTestSlide = {
    type: "cta",
    headline: "Discover more with AI Zodiac",
    body: "Free on Google Play",
  };
  const ctaSlideBuffer = await renderSlidePng({
    slide: ctaTestSlide,
    slideNumber: 5,
    totalSlides: 5,
    category: "self_discovery",
    categoryTitle: "Self-Discovery",
  });
  await assertRegionHasTextGlyphs(ctaSlideBuffer, { left: 200, top: 430, width: 680, height: 50 }, "CTA Headline 'Discover more with AI Zodiac'");
  await assertRegionHasTextGlyphs(ctaSlideBuffer, { left: 200, top: 670, width: 680, height: 50 }, "CTA Body 'Free on Google Play'");

  // 5. Render 5-slide sample carousel to PNG and save to local verification directory (tmp/social-render-check/)
  const sample = createSampleAiContent();
  const outputDir = path.resolve("./tmp/social-render-check");
  const rendered = await renderCarouselSlides(sample, { outputDir });

  assert.equal(rendered.length, 5);

  for (let i = 0; i < rendered.length; i++) {
    const slide = rendered[i];
    assert.equal(slide.slideNumber, i + 1);
    assert.equal(slide.key, `social/2026/09/01/slide-0${i + 1}.png`);
    assert.equal(slide.mimeType, "image/png");
    assert.ok(slide.buffer.length > 50000, "PNG buffer should be substantial");

    // Verify sharp metadata
    const meta = await sharp(slide.buffer).metadata();
    assert.equal(meta.width, 1080, "Width must be exactly 1080px");
    assert.equal(meta.height, 1350, "Height must be exactly 1350px");
    assert.equal(meta.format, "png");
  }

  console.log("  ✓ Bundled Noto Sans TTF font files verified on disk");
  console.log("  ✓ Text wrapping safely controls lines without margin overflow");
  console.log("  ✓ Production-like glyph test confirmed actual foreground text pixel variation in all regions");
  console.log("  ✓ All 5 carousel slides render to deterministic 1080x1350 PNG images in tmp/social-render-check/");
}

// ============================================================================
// TEST 6: Cloudflare R2 Upload Mocking, Deterministic Keys & Public URLs
// ============================================================================
{
  console.log("\n[TEST 6] Cloudflare R2 Transport (Mocked, Deterministic Keys)");

  const mockS3 = new MockS3Client();
  const sample = createSampleAiContent();
  const rendered = await renderCarouselSlides(sample);

  const r2Config = {
    accountId: "test_account_123",
    accessKeyId: "test_key_456",
    secretAccessKey: "test_secret_789",
    bucketName: "aizodiac-social",
    publicBaseUrl: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev",
  };

  // 1. Mock Upload Execution
  const uploaded = await uploadCarouselSlides({
    slides: rendered,
    r2Config,
    s3Client: mockS3,
    dryRun: false,
  });

  assert.equal(uploaded.length, 5);
  assert.equal(mockS3.uploadedObjects.size, 5);

  uploaded.forEach((item, idx) => {
    const expectedKey = `social/2026/09/01/slide-0${idx + 1}.png`;
    const expectedUrl = `https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/${expectedKey}`;

    assert.equal(item.key, expectedKey);
    assert.equal(item.url, expectedUrl);
    assert.equal(item.alreadyExisted, false);

    const s3Obj = mockS3.uploadedObjects.get(expectedKey);
    assert.ok(s3Obj, `S3 must contain object for ${expectedKey}`);
    assert.equal(s3Obj.contentType, "image/png");
    assert.equal(s3Obj.bucket, "aizodiac-social");
  });

  // 2. Re-upload with existing object check (Idempotency test)
  const reUploaded = await uploadCarouselSlides({
    slides: rendered,
    r2Config,
    s3Client: mockS3,
    dryRun: false,
    overwriteExisting: false,
  });

  assert.equal(reUploaded.length, 5);
  reUploaded.forEach(item => {
    assert.equal(item.alreadyExisted, true, "Should identify existing object without re-uploading");
  });

  console.log("  ✓ Mocked S3 client successfully uploaded all slides to R2 bucket");
  console.log("  ✓ Deterministic keys & public URLs correctly formatted");
  console.log("  ✓ Idempotent re-upload detects existing objects without duplicate PutObject");
}

// ============================================================================
// TEST 7: Manual Manifest Override -> ZERO AI Calls & No Overwrite
// ============================================================================
{
  console.log("\n[TEST 7] Manual Manifest Override (Zero AI Calls, No Overwrite)");

  const redis = new MockRedis();
  const mockS3 = new MockS3Client();
  const date = "2026-09-01";

  // Pre-seed an approved manual manifest in Redis
  const manualManifest = {
    date,
    id: "manual-manifest-2026-09-01",
    type: MEDIA_TYPES.CAROUSEL,
    media: [
      { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/manual1.png" },
      { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/manual2.png" },
    ],
    captions: {
      instagram: "Pre-approved manual Instagram caption",
      facebook: "Pre-approved manual Facebook caption",
      pinterest: {
        title: "Pre-approved Pin Title",
        description: "Pre-approved Pin Description",
        link: "https://play.google.com/store/apps/details?id=com.oberon.aizodiac",
      },
    },
  };

  await redis.set(`aiz:social:manifest:${date}`, JSON.stringify(manualManifest));

  let aiGenerateCalls = 0;
  const mockGenerateFn = async () => {
    aiGenerateCalls++;
    return createSampleAiContent();
  };

  const res = await executeDailyPreparation({
    redis,
    targetDate: date,
    generateFn: mockGenerateFn,
    s3Client: mockS3,
    dryRun: false,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, "EXISTING_MANIFEST_FOUND");
  assert.equal(res.manifestId, "manual-manifest-2026-09-01");
  assert.equal(aiGenerateCalls, 0, "AI generation MUST NOT have been invoked when manual manifest exists!");

  // Verify the manifest in Redis was NOT overwritten
  const storedManifest = JSON.parse(await redis.get(`aiz:social:manifest:${date}`));
  assert.equal(storedManifest.id, "manual-manifest-2026-09-01");

  console.log("  ✓ Pre-approved manifest in Redis overrides AI generation with ZERO AI calls");
}

// ============================================================================
// TEST 8: Full End-to-End Preparation Flow & Manifest Creation
// ============================================================================
{
  console.log("\n[TEST 8] Full End-to-End Preparation Flow & Manifest Creation");

  const redis = new MockRedis();
  const mockS3 = new MockS3Client();
  const date = "2026-09-01";

  let aiCalls = 0;
  const mockGenerateFn = async () => {
    aiCalls++;
    return createSampleAiCreative();
  };

  const prepRes = await executeDailyPreparation({
    redis,
    targetDate: date,
    generateFn: mockGenerateFn,
    s3Client: mockS3,
    dryRun: false,
  });

  assert.equal(prepRes.success, true);
  assert.equal(prepRes.status, "PREPARED");
  assert.equal(prepRes.slideCount, 5);
  assert.equal(aiCalls, 1, "Exactly ONE AI call must occur in normal flow");

  // Validate the manifest written to Redis using canonical validateManifest
  const savedManifestRaw = await redis.get(`aiz:social:manifest:${date}`);
  assert.ok(savedManifestRaw, "Manifest must be written to Redis key aiz:social:manifest:<date>");

  const savedManifest = JSON.parse(savedManifestRaw);
  const validation = validateManifest(savedManifest);
  assert.equal(validation.valid, true, `Generated manifest must pass validateManifest: ${validation.errors?.join(", ")}`);
  assert.equal(savedManifest.type, MEDIA_TYPES.CAROUSEL);
  assert.equal(savedManifest.media.length, 5);
  assert.equal(savedManifest.captions.pinterest.link, "https://play.google.com/store/apps/details?id=com.oberon.aizodiac");

  // Verify preparation state tracking in Redis
  const prepState = await getPrepareState(redis, date);
  assert.equal(prepState.stage, PREPARE_STAGES.MANIFEST_READY);
  assert.equal(prepState.manifestId, "social-2026-09-01");
  assert.ok(prepState.generatedContent);
  assert.ok(prepState.uploadedMedia);

  console.log("  ✓ End-to-end preparation completes with exactly 1 AI call");
  console.log("  ✓ Valid manifest stored in Redis and confirmed by validateManifest");
  console.log("  ✓ Preparation state successfully reached MANIFEST_READY");
}

// ============================================================================
// TEST 9: Idempotency & Resumption from Intermediate Stages
// ============================================================================
{
  console.log("\n[TEST 9] Idempotency & Resumption from Intermediate Stages");

  const redis = new MockRedis();
  const mockS3 = new MockS3Client();
  const date = "2026-09-02";

  // Simulate CONTENT_GENERATED already in Redis (e.g. AI succeeded, but upload previously crashed)
  const cachedContent = createSampleAiContent({
    publishDate: date,
    contentId: `social-${date}`,
    topic: "3 Signs with Unshakeable Mental Resilience",
  });

  await savePrepareState(redis, date, {
    publishDate: date,
    stage: PREPARE_STAGES.CONTENT_GENERATED,
    generatedContent: cachedContent,
    topic: cachedContent.topic,
    category: cachedContent.category,
    attempts: 1,
  });

  let aiCalls = 0;
  const mockGenerateFn = async () => {
    aiCalls++;
    return createSampleAiCreative({ publishDate: date });
  };

  // Run preparation - it should resume without calling AI again!
  const res = await executeDailyPreparation({
    redis,
    targetDate: date,
    generateFn: mockGenerateFn,
    s3Client: mockS3,
    dryRun: false,
  });

  assert.equal(res.success, true);
  assert.equal(res.status, "PREPARED");
  assert.equal(aiCalls, 0, "Must NOT call AI generator if CONTENT_GENERATED is already in Redis state!");

  const finalState = await getPrepareState(redis, date);
  assert.equal(finalState.stage, PREPARE_STAGES.MANIFEST_READY);
  assert.equal(finalState.topic, "3 Signs with Unshakeable Mental Resilience");

  console.log("  ✓ Successfully resumed preparation from CONTENT_GENERATED with ZERO additional AI calls");
}

// ============================================================================
// TEST 10: Dry-Run Mode Performs Zero Writes
// ============================================================================
{
  console.log("\n[TEST 10] Dry-Run Mode Performs Zero Writes");

  const redis = new MockRedis();
  const mockS3 = new MockS3Client();
  const date = "2026-09-03";

  let aiCalls = 0;
  const mockGenerateFn = async () => {
    aiCalls++;
    return createSampleAiCreative({ publishDate: date });
  };

  const dryRunRes = await executeDailyPreparation({
    redis,
    targetDate: date,
    generateFn: mockGenerateFn,
    s3Client: mockS3,
    dryRun: true,
  });

  assert.equal(dryRunRes.success, true);
  assert.equal(dryRunRes.dryRun, true);
  assert.equal(mockS3.uploadedObjects.size, 0, "Dry-run must perform ZERO S3/R2 writes!");

  // Redis manifest must not be created
  const redisManifest = await redis.get(`aiz:social:manifest:${date}`);
  assert.equal(redisManifest, null, "Dry-run must perform ZERO Redis manifest writes!");

  console.log("  ✓ Dry-run mode completed with zero R2 writes and zero Redis manifest writes");
}

// ============================================================================
// TEST 11: Serverless Cron Endpoint Authentication & Error Handling
// ============================================================================
{
  console.log("\n[TEST 11] Serverless Cron Endpoint (api/cron/prepareDailySocial.js)");

  process.env.CRON_SECRET = "test_cron_secret_777";

  let statusCode = null;
  let jsonResponse = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonResponse = data;
      return this;
    },
  };

  // 1. Missing Authorization Header -> 401
  await prepareCronHandler({ method: "POST", headers: {} }, mockRes);
  assert.equal(statusCode, 401);
  assert.equal(jsonResponse.error, "unauthorized");

  // 2. Invalid Method -> 405
  await prepareCronHandler({ method: "DELETE", headers: {} }, mockRes);
  assert.equal(statusCode, 405);
  assert.equal(jsonResponse.error, "method_not_allowed");

  // Clean up
  delete process.env.CRON_SECRET;

  console.log("  ✓ prepareDailySocial cron endpoint enforces CRON_SECRET and HTTP methods");
}

// ============================================================================
// TEST 12: Groq Structured Outputs Request Payload for Social Content
// ============================================================================
{
  console.log("\n[TEST 12] Groq Structured Outputs Request Payload for Social Content");

  let capturedUrl = null;
  let capturedBody = null;

  const mockGroqFetch = async (url, options) => {
    capturedUrl = url;
    capturedBody = JSON.parse(options.body);

    return {
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify(createSampleAiCreative()),
            },
          },
        ],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 200,
          total_tokens: 350,
        },
      }),
    };
  };

  const redis = new MockRedis();
  const { executeProviderRouting } = await import("./lib/aiProvider.js");

  const routingResult = await executeProviderRouting({
    type: "social_daily_content",
    prompt: "Test prompt for daily social content",
    responseSchema: SOCIAL_AI_CREATIVE_SCHEMA,
    maxOutputTokens: 800,
    redis,
    date: "2026-09-01",
    primaryProvider: "groq",
    groqApiKey: "gsk_test_groq_key_123",
    groqFetchFn: mockGroqFetch,
    groqModel: "openai/gpt-oss-20b",
  });

  assert.strictEqual(capturedUrl, "https://api.groq.com/openai/v1/chat/completions");
  assert.strictEqual(capturedBody.model, "openai/gpt-oss-20b");
  assert.strictEqual(capturedBody.response_format.type, "json_schema");
  assert.strictEqual(capturedBody.response_format.json_schema.strict, true, "strict must be explicitly true");
  assert.strictEqual(capturedBody.response_format.json_schema.name, "astro_response");
  assert.deepStrictEqual(capturedBody.response_format.json_schema.schema, SOCIAL_AI_CREATIVE_SCHEMA);
  assert.strictEqual(routingResult.provider, "groq");

  console.log("  ✓ Groq request body includes model 'openai/gpt-oss-20b', strict: true, and exact SOCIAL_AI_CREATIVE_SCHEMA");
}

// ============================================================================
// TEST 13: Deterministic Boundary & Anti-Metadata Injection Verification
// ============================================================================
{
  console.log("\n[TEST 13] Deterministic Boundary & Anti-Metadata Injection Verification");

  // 1. AI Schema contains ZERO metadata keys
  const schemaKeys = Object.keys(SOCIAL_AI_CREATIVE_SCHEMA.properties);
  assert.ok(!schemaKeys.includes("contentId"), "AI Schema must NOT contain contentId");
  assert.ok(!schemaKeys.includes("publishDate"), "AI Schema must NOT contain publishDate");
  assert.ok(!schemaKeys.includes("category"), "AI Schema must NOT contain category");
  assert.ok(!schemaKeys.includes("pinterestLink"), "AI Schema must NOT contain pinterestLink");
  assert.ok(!schemaKeys.includes("slides"), "AI Schema must NOT contain slides");
  assert.ok(!schemaKeys.includes("generatedAt"), "AI Schema must NOT contain generatedAt");

  // 2. Even if an AI mock attempts to inject a malformed contentId or wrong date,
  // assembleCanonicalSocialContent deterministically computes contentId from requested date
  const mockAiWithInjectedBadMetadata = {
    ...createSampleAiCreative(),
    contentId: "malformed-injected-id-12345",
    publishDate: "1999-01-01",
    category: "hacked_category",
    pinterestLink: "http://malicious-link.com",
  };

  const assembled = assembleCanonicalSocialContent({
    creative: mockAiWithInjectedBadMetadata,
    publishDate: "2026-09-05",
    category: "love_compatibility",
  });

  assert.strictEqual(assembled.contentId, "social-2026-09-05", "contentId must be constructed deterministically by backend");
  assert.strictEqual(assembled.publishDate, "2026-09-05", "publishDate must be exact requested date");
  assert.strictEqual(assembled.category, "love_compatibility", "category must match topic rotation");
  assert.strictEqual(assembled.pinterestLink, DEFAULT_APP_PLAY_STORE_URL, "pinterestLink must be official Google Play link");
  assert.strictEqual(assembled.slides[0].type, "title", "Title slide must be constructed by backend");
  assert.strictEqual(assembled.slides[4].type, "cta", "CTA slide must be constructed by backend");
  assert.strictEqual(assembled.slides[4].body, "Free on Google Play");

  // 3. Verify resulting canonical passes validation and renders to 1080x1350 PNG slides
  const validCheck = validateSocialContent(assembled);
  assert.strictEqual(validCheck.valid, true);

  const renderedSlides = await renderCarouselSlides(assembled);
  assert.strictEqual(renderedSlides.length, 5);
  for (const slide of renderedSlides) {
    const meta = await sharp(slide.buffer).metadata();
    assert.strictEqual(meta.width, 1080);
    assert.strictEqual(meta.height, 1350);
  }

  console.log("  ✓ Verified AI schema has zero metadata fields");
  console.log("  ✓ Backend deterministically enforces contentId, publishDate, category, CTA, and link");
  console.log("  ✓ Assembled package renders cleanly to 5 1080x1350 PNG slides");
}

console.log("\n==================================================");
console.log("ALL SOCIAL PREPARATION TESTS PASSED SUCCESSFULLY! 🎉");
console.log("==================================================");
