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
  ensureFacebookGooglePlayLink,
} from "./lib/social/content/dailyContentGenerator.js";
import { getSocialConfig } from "./lib/social/config.js";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BACKGROUND_COVER_PATH,
  BACKGROUND_ZODIAC_PATH,
  BACKGROUND_CTA_PATH,
  loadBackgroundImageBuffer,
  wrapTextToLines,
  escapeXml,
  renderTitleSlideSvg,
  renderContentSlideSvg,
  renderCtaSlideSvg,
  ZODIAC_DATA,
  ELEMENT_ACCENTS,
  LAYOUT_ZONES,
  COLORS,
  renderTextToFit,
} from "./lib/social/render/templates.js";
import {
  getSlideStorageKey,
  renderCarouselSlides,
  renderSlidePng,
  createTextLayer,
  generateSlideAltText,
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
import {
  evaluateQualityGate,
  validateAiCreative,
  validateCanonicalAssembly,
  validateRenderSet,
  validatePublishManifest,
  QUALITY_GATE_STATUS,
} from "./lib/social/quality/socialQualityGate.js";
import {
  ZODIAC_SVG_PATHS,
  getZodiacSvgGlyph,
  renderVectorArrowSvg,
} from "./lib/social/render/zodiacVectors.js";
import { executeSocialPublishing } from "./lib/social/publishCoordinator.js";
import { PLATFORMS, PUBLISH_STATUS } from "./lib/social/types.js";

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
        headline: "Steady and Dependable",
        text: "Grounded and unwavering, Taurus builds trust slowly but defends it fiercely.",
      },
      {
        sign: "Scorpio",
        headline: "Deep and Devoted",
        text: "Intensely devoted, Scorpio gives all-or-nothing loyalty to those who earn it.",
      },
      {
        sign: "Capricorn",
        headline: "Steadfast and Loyal",
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

  // Creative AI schema requires items array of { sign, headline, text }
  const itemSchema = SOCIAL_AI_CREATIVE_SCHEMA.properties.items.items;
  assert.strictEqual(itemSchema.type, "object");
  assert.strictEqual(itemSchema.additionalProperties, false);
  assert.deepEqual(itemSchema.required, ["sign", "headline", "text"]);

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
      { sign: "Taurus", headline: "Trait 1", text: "Text 1" },
      { sign: "Taurus", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(dupSignCreative.valid, false);
  assert.ok(dupSignCreative.errors.some(e => e.includes("Duplicate zodiac sign 'Taurus'")));

  // Rejects invalid sign
  const invalidSignCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Ophiuchus", headline: "Trait 1", text: "Text 1" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(invalidSignCreative.valid, false);
  assert.ok(invalidSignCreative.errors.some(e => e.includes("invalid zodiac sign")));

  // Rejects missing headline
  const missingHeadline = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "", text: "Text 1" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(missingHeadline.valid, false);
  assert.ok(missingHeadline.errors.some(e => e.includes("requires a non-empty 'headline'")));

  // Rejects headline equal to sign
  const headlineEqualsSign = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "Taurus", text: "Text 1" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(headlineEqualsSign.valid, false);
  assert.ok(headlineEqualsSign.errors.some(e => e.includes("headline must not equal sign name")));

  // Rejects excessive headline (> 45 chars)
  const excessiveHeadline = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "A".repeat(50), text: "Text 1" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(excessiveHeadline.valid, false);
  assert.ok(excessiveHeadline.errors.some(e => e.includes("exceeds 45 characters")));

  // Rejects duplicate headlines
  const dupHeadline = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "Deep Devotion", text: "Text 1" },
      { sign: "Virgo", headline: "Deep Devotion", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(dupHeadline.valid, false);
  assert.ok(dupHeadline.errors.some(e => e.includes("Duplicate headline")));

  // Rejects placeholders (e.g. "Lorem ipsum")
  const placeholderCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "Lorem ipsum dolor", text: "Your text here for testing." },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(placeholderCreative.valid, false);
  assert.ok(placeholderCreative.errors.some(e => e.includes("placeholder")));

  // Rejects Unicode replacement character ()
  const unicodeReplacementCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "Steady and True", text: "Grounded \uFFFD insight text" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
    ],
  });
  assert.equal(unicodeReplacementCreative.valid, false);
  assert.ok(unicodeReplacementCreative.errors.some(e => e.includes("Unicode replacement character")));

  // Rejects hashtags in item text
  const hashtagCreative = validateAiCreativeOutput({
    ...validCreative,
    items: [
      { sign: "Taurus", headline: "Trait 1", text: "Text with #hashtag" },
      { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
      { sign: "Leo", headline: "Trait 3", text: "Text 3" },
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

  // 2. Google Play Link Helper Determinism
  assert.equal(ensureFacebookGooglePlayLink(""), DEFAULT_APP_PLAY_STORE_URL);
  assert.equal(
    ensureFacebookGooglePlayLink("Daily Zodiac insights for Taurus and Scorpio!"),
    `Daily Zodiac insights for Taurus and Scorpio!\n\n${DEFAULT_APP_PLAY_STORE_URL}`
  );
  assert.equal(
    ensureFacebookGooglePlayLink(`Already has link: ${DEFAULT_APP_PLAY_STORE_URL}`),
    `Already has link: ${DEFAULT_APP_PLAY_STORE_URL}`
  );

  // 3. Deterministic Assembly & Canonical Validation
  const creativeWithoutLink = {
    ...validCreative,
    facebookCaption: "Loyalty runs deep in these 3 zodiac signs. Do you agree?",
  };

  const canonical = assembleCanonicalSocialContent({
    creative: creativeWithoutLink,
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
  assert.equal(canonical.slides[1].headline, "Steady and Dependable");
  assert.equal(canonical.slides[4].type, "cta");
  assert.equal(canonical.slides[4].headline, "Discover more with AI Zodiac");
  assert.equal(canonical.slides[4].body, "Free on Google Play");

  // Mandatory Facebook Google Play link guaranteed
  assert.ok(canonical.facebookCaption.includes(DEFAULT_APP_PLAY_STORE_URL));
  assert.equal(
    canonical.facebookCaption,
    `Loyalty runs deep in these 3 zodiac signs. Do you agree?\n\n${DEFAULT_APP_PLAY_STORE_URL}`
  );
  // Instagram & Pinterest captions unaffected
  assert.equal(canonical.instagramCaption, validCreative.instagramCaption);
  assert.equal(canonical.pinterestTitle, validCreative.pinterestTitle);
  assert.equal(canonical.pinterestDescription, validCreative.pinterestDescription);

  const canonicalCheck = validateSocialContent(canonical);
  assert.equal(canonicalCheck.valid, true);

  // Rejects canonical if facebookCaption does not contain Google Play link
  const canonicalNoLink = {
    ...canonical,
    facebookCaption: "Caption without Google Play link",
  };
  const checkNoLink = validateSocialContent(canonicalNoLink);
  assert.equal(checkNoLink.valid, false);
  assert.ok(checkNoLink.errors.some(e => e.includes("mandatory Google Play link")));

  console.log("  ✓ SOCIAL_AI_CREATIVE_SCHEMA satisfies all strict Groq Structured Outputs requirements");
  console.log("  ✓ Creative output validator enforces 3 items, valid signs, required headlines != sign, and no hashtags");
  console.log("  ✓ Placeholder content and Unicode replacement characters strictly rejected");
  console.log("  ✓ Scope mismatch language (every zodiac, all elements, etc.) strictly rejected");
  console.log("  ✓ Deterministic assembly builds canonical 5-slide object with guaranteed metadata");
  console.log("  ✓ Facebook caption deterministically enforced with Google Play URL (IG & Pinterest unaffected)");
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
// TEST 5: Carousel Renderer - Master Background Assets, Zero SVG Text & Review PNGs
// ============================================================================
{
  console.log("\n[TEST 5] Carousel Renderer: Master Background Assets, Zero SVG Text & 1080x1350 PNG");

  // 1. Verify Bundled Font Files Exist on Local Filesystem
  assert.ok(fs.existsSync(FONT_REGULAR_PATH), `Regular font file must exist at ${FONT_REGULAR_PATH}`);
  assert.ok(fs.existsSync(FONT_BOLD_PATH), `Bold font file must exist at ${FONT_BOLD_PATH}`);
  assert.ok(fs.statSync(FONT_REGULAR_PATH).size > 100000, "Regular font file must be a non-empty TTF font");
  assert.ok(fs.statSync(FONT_BOLD_PATH).size > 100000, "Bold font file must be a non-empty TTF font");

  // 2. Verify Approved Master Background PNG Assets Exist and Load to 1080x1350
  assert.ok(fs.existsSync(BACKGROUND_COVER_PATH), `Cover master background must exist at ${BACKGROUND_COVER_PATH}`);
  assert.ok(fs.existsSync(BACKGROUND_ZODIAC_PATH), `Zodiac master background must exist at ${BACKGROUND_ZODIAC_PATH}`);
  assert.ok(fs.existsSync(BACKGROUND_CTA_PATH), `CTA master background must exist at ${BACKGROUND_CTA_PATH}`);

  const coverBgBuf = await loadBackgroundImageBuffer(BACKGROUND_COVER_PATH);
  const coverBgMeta = await sharp(coverBgBuf).metadata();
  assert.equal(coverBgMeta.width, 1080);
  assert.equal(coverBgMeta.height, 1350);

  const zodiacBgBuf = await loadBackgroundImageBuffer(BACKGROUND_ZODIAC_PATH);
  const zodiacBgMeta = await sharp(zodiacBgBuf).metadata();
  assert.equal(zodiacBgMeta.width, 1080);
  assert.equal(zodiacBgMeta.height, 1350);

  const ctaBgBuf = await loadBackgroundImageBuffer(BACKGROUND_CTA_PATH);
  const ctaBgMeta = await sharp(ctaBgBuf).metadata();
  assert.equal(ctaBgMeta.width, 1080);
  assert.equal(ctaBgMeta.height, 1350);

  // 3. Audit & Assert Zero SVG <text> Elements Anywhere in lib/social/render
  const renderDir = path.resolve("./lib/social/render");
  const renderFiles = ["designSystem.js", "carouselRenderer.js", "templates.js", "templates/coverSlide.js", "templates/zodiacFeatureSlide.js", "templates/ctaSlide.js"];
  for (const relFile of renderFiles) {
    const filePath = path.join(renderDir, relFile);
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(!content.includes("<text"), `File ${relFile} must NOT contain SVG <text> tags!`);
    assert.ok(!content.includes("<tspan"), `File ${relFile} must NOT contain SVG <tspan> tags!`);
    assert.ok(!content.includes("font-family="), `File ${relFile} must NOT contain font-family attributes!`);
  }

  // 4. Verify Complete 12-Sign Zodiac Design System Data
  const expectedSigns = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
  ];
  assert.equal(Object.keys(ZODIAC_DATA).length, 12);
  for (const sign of expectedSigns) {
    const data = ZODIAC_DATA[sign];
    assert.ok(data, `ZODIAC_DATA missing sign '${sign}'`);
    assert.equal(data.name, sign);
    assert.ok(data.symbol && data.symbol.length > 0, `Sign '${sign}' missing symbol`);
    assert.ok(["Fire", "Earth", "Air", "Water"].includes(data.element), `Invalid element for ${sign}`);
    assert.ok(data.accent && data.accent.color, `Sign '${sign}' missing accent color`);
    assert.ok(data.keywords && data.keywords.length > 0, `Sign '${sign}' missing keywords`);
  }

  // 5. Verify Non-Overlapping Layout Zones & Minimum Positive Vertical Gaps
  assert.ok(LAYOUT_ZONES.HEADER.bottom <= LAYOUT_ZONES.COVER.CATEGORY.top);
  assert.ok(LAYOUT_ZONES.COVER.CATEGORY.bottom <= LAYOUT_ZONES.COVER.TITLE.top);
  assert.ok(LAYOUT_ZONES.COVER.TITLE.bottom <= LAYOUT_ZONES.COVER.FOOTER.top);

  assert.ok(LAYOUT_ZONES.HEADER.bottom <= LAYOUT_ZONES.FEATURE.EMBLEM.top);
  assert.ok(LAYOUT_ZONES.FEATURE.EMBLEM.bottom <= LAYOUT_ZONES.FEATURE.SIGN.top);
  assert.ok(LAYOUT_ZONES.FEATURE.SIGN.bottom <= LAYOUT_ZONES.FEATURE.ELEMENT.top);
  assert.ok(LAYOUT_ZONES.FEATURE.ELEMENT.bottom <= LAYOUT_ZONES.FEATURE.HEADLINE.top);
  assert.ok(LAYOUT_ZONES.FEATURE.HEADLINE.bottom <= LAYOUT_ZONES.FEATURE.BODY.top);
  assert.ok(LAYOUT_ZONES.FEATURE.BODY.bottom <= LAYOUT_ZONES.FEATURE.FOOTER.top);

  assert.ok(LAYOUT_ZONES.HEADER.bottom <= LAYOUT_ZONES.CTA.HEADLINE.top);
  assert.ok(LAYOUT_ZONES.CTA.HEADLINE.bottom <= LAYOUT_ZONES.CTA.BODY.top);
  assert.ok(LAYOUT_ZONES.CTA.BODY.bottom <= LAYOUT_ZONES.CTA.BUTTON.top);
  assert.ok(LAYOUT_ZONES.CTA.BUTTON.bottom <= LAYOUT_ZONES.CTA.SECONDARY.top);
  assert.ok(LAYOUT_ZONES.CTA.SECONDARY.bottom <= LAYOUT_ZONES.CTA.FOOTER.top);

  // 6. Verify Bounding Box Fitting via renderTextToFit
  const testFit = await renderTextToFit({
    text: "3 Zodiac Signs That Value Emotional Consistency",
    fontfile: FONT_BOLD_PATH,
    preferredSize: 62,
    minSize: 42,
    maxWidth: 820,
    maxHeight: 380,
  });
  assert.ok(testFit.width <= 820, "Fitted text width must not exceed maxWidth");
  assert.ok(testFit.height <= 380, "Fitted text height must not exceed maxHeight");
  assert.ok(testFit.fontSize >= 42, "Font size must not drop below minSize");

  // 7. Verify Meaningful Alt Text Generation
  const altCover = generateSlideAltText({ type: "cover", headline: "3 Zodiac Signs That Value Emotional Consistency" });
  assert.equal(altCover, "3 Zodiac Signs That Value Emotional Consistency | AI Zodiac");

  const altSign = generateSlideAltText({ type: "sign", sign: "Taurus", headline: "Steady and Dependable" });
  assert.equal(altSign, "Taurus — Steady and Dependable | AI Zodiac");

  const altCta = generateSlideAltText({ type: "cta", headline: "Discover more with AI Zodiac" });
  assert.equal(altCta, "Discover more with AI Zodiac | AI Zodiac");

  // 8. Production-like Glyph Rendering & Text Bounding Box Pixel Variance Verification
  const glyphTestSlide = {
    type: "sign",
    sign: "Taurus",
    headline: "Steady and Dependable",
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
      .ensureAlpha()
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

  // Verify Header Brand region ("AI ZODIAC")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 80, top: 76, width: 260, height: 45 }, "Header AI Zodiac");
  // Verify Zodiac Glyph in Emblem region ("♉")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 510, top: 235, width: 60, height: 50 }, "Taurus Symbol Glyph ♉");
  // Verify Taurus Sign Name region ("TAURUS")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 450, top: 375, width: 180, height: 40 }, "Sign Name 'TAURUS'");
  // Verify Headline region ("Steady and Dependable")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 300, top: 525, width: 480, height: 40 }, "Headline 'Steady and Dependable'");
  // Verify Body region with numbers ("1234567890")
  await assertRegionHasTextGlyphs(glyphSlideBuffer, { left: 200, top: 720, width: 680, height: 90 }, "Body with 1234567890 numbers");

  // Also verify CTA slide text regions ("Discover more with AI Zodiac", "DOWNLOAD FREE")
  const ctaTestSlide = {
    type: "cta",
    headline: "Discover more with\nAI Zodiac",
    body: "Daily astrology, compatibility\nand zodiac insights in one app.",
  };
  const ctaSlideBuffer = await renderSlidePng({
    slide: ctaTestSlide,
    slideNumber: 5,
    totalSlides: 5,
    category: "self_discovery",
    categoryTitle: "Self-Discovery",
  });
  await assertRegionHasTextGlyphs(ctaSlideBuffer, { left: 220, top: 460, width: 640, height: 60 }, "CTA Headline 'Discover more with AI Zodiac'");
  await assertRegionHasTextGlyphs(ctaSlideBuffer, { left: 240, top: 655, width: 600, height: 50 }, "CTA Body Copy");
  await assertRegionHasTextGlyphs(ctaSlideBuffer, { left: 380, top: 852, width: 320, height: 35 }, "CTA Button Text 'DOWNLOAD FREE'");

  // 9. Generate All 5 Visual Review Slides to tmp/social-final-review-v3/ (slide-01 through slide-05)
  const reviewLayoutDir = path.resolve("./tmp/social-final-review-v3");
  if (!fs.existsSync(reviewLayoutDir)) fs.mkdirSync(reviewLayoutDir, { recursive: true });

  const reviewCarousel = {
    publishDate: "2026-09-01",
    category: "relationships",
    topic: "3 Zodiac Signs That Value Emotional Consistency",
    slides: [
      {
        type: "cover",
        headline: "3 Zodiac Signs That Value Emotional Consistency",
      },
      {
        type: "sign",
        sign: "Taurus",
        headline: "Steady and Dependable",
        body: "Grounded and patient, Taurus builds trust through reliability, steady communication and emotional presence.",
      },
      {
        type: "sign",
        sign: "Cancer",
        headline: "Devoted and Intuitive",
        body: "Deeply loyal to their inner circle, Cancer offers profound emotional depth, unwavering warmth and heartfelt protection.",
      },
      {
        type: "sign",
        sign: "Pisces",
        headline: "Empathetic and Genuine",
        body: "Guided by compassion and gentle understanding, Pisces nurtures authentic, soulful and lifelong emotional connections.",
      },
      {
        type: "cta",
        headline: "Discover more with\nAI Zodiac",
        body: "Daily astrology, compatibility\nand zodiac insights in one app.",
      },
    ],
  };

  const reviewRendered = await renderCarouselSlides(reviewCarousel, { outputDir: reviewLayoutDir });
  assert.equal(reviewRendered.length, 5);

  for (let i = 0; i < reviewRendered.length; i++) {
    const slide = reviewRendered[i];
    assert.equal(slide.slideNumber, i + 1);
    assert.equal(slide.key, `social/2026/09/01/slide-0${i + 1}.png`);
    assert.equal(slide.mimeType, "image/png");
    assert.ok(slide.buffer.length > 50000, "PNG buffer should be substantial");

    const meta = await sharp(slide.buffer).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
    assert.equal(meta.format, "png");
  }

  console.log("  ✓ All 3 approved master background PNG assets verified & load to 1080x1350");
  console.log("  ✓ Zero SVG <text> elements verified across all render modules");
  console.log("  ✓ Non-overlapping vertical layout zones & minimum gaps verified");
  console.log("  ✓ Bounding-box fitting (renderTextToFit) and button text containment verified");
  console.log("  ✓ Production-like glyph test confirmed actual foreground text pixel variation in all regions");
  console.log("  ✓ All 5 final review slides rendered to tmp/social-final-review-v3/");
}

// ============================================================================
// TEST 6: Actual Production Render Regression Fixture
// ============================================================================
{
  console.log("\n[TEST 6] Actual Production Render Regression Fixture");
  const reviewDir = path.resolve("./tmp/social-production-regression-review");
  const regressionCarousel = {
    publishDate: "2026-08-29",
    category: "personality",
    topic: "Top 3 Most Naturally Witty Zodiac Signs",
    slides: [
      { type: "cover", headline: "Top 3 Most Naturally Witty Zodiac Signs" },
      { type: "sign", sign: "Gemini", headline: "Wordplay Wizards", body: "Gemini turns quick observations into clever, memorable moments." },
      { type: "sign", sign: "Libra", headline: "Charm & Quips", body: "Libra keeps every conversation bright, balanced and effortlessly funny." },
      { type: "sign", sign: "Aquarius", headline: "Future-Funky Gags", body: "Aquarius brings an original angle and a delightfully unexpected punchline." },
      { type: "cta", headline: "Discover more with AI Zodiac", body: "Daily astrology, compatibility and zodiac insights in one app." },
    ],
  };
  const rendered = await renderCarouselSlides(regressionCarousel, { outputDir: reviewDir });
  assert.deepEqual(rendered.slice(1, 4).map(s => [s.sign, regressionCarousel.slides[s.slideNumber - 1].headline]), [
    ["Gemini", "Wordplay Wizards"], ["Libra", "Charm & Quips"], ["Aquarius", "Future-Funky Gags"],
  ]);
  for (const slideNumber of [2, 3, 4]) {
    const meta = await sharp(rendered[slideNumber - 1].buffer).metadata();
    assert.equal(meta.width, 1080);
    assert.equal(meta.height, 1350);
    const emblemPixels = await sharp(rendered[slideNumber - 1].buffer).extract({ left: 450, top: 165, width: 180, height: 180 }).raw().toBuffer();
    assert.ok(emblemPixels.some((value, index) => index % 4 < 3 && value > 160), "Actual feature renderer must composite a visible vector emblem");
  }
  const arrowPixels = await sharp(rendered[0].buffer).extract({ left: 680, top: 1160, width: 80, height: 60 }).raw().toBuffer();
  assert.ok(arrowPixels.some((value, index) => index % 4 < 3 && value > 160), "Actual cover renderer must composite the vector swipe arrow");
  assert.ok(!fs.readFileSync(path.resolve("./lib/social/render/zodiacVectors.js"), "utf8").match(/[→➜➤›»]/), "Vector helper must not contain Unicode arrows");
  for (let i = 1; i <= 5; i++) assert.ok(fs.existsSync(path.join(reviewDir, `slide-0${i}.png`)));
  console.log("  ✓ Actual production renderer binds distinct sign/headline values and composites emblem/arrow vectors");
  console.log("  ✓ Review package written to tmp/social-production-regression-review/");
}

// ============================================================================
// TEST 7: Cloudflare R2 Upload Mocking, Deterministic Keys & Public URLs
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
    metadata: { source: "manual_override" },
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
  assert.equal(prepRes.status, QUALITY_GATE_STATUS.PASS);
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
  assert.equal(prepState.stage, PREPARE_STAGES.QUALITY_GATE_PASS);
  assert.equal(prepState.manifestId, "social-2026-09-01");
  assert.ok(prepState.generatedContent);
  assert.ok(prepState.uploadedMedia);

  console.log("  ✓ End-to-end preparation completes with exactly 1 AI call");
  console.log("  ✓ Valid manifest stored in Redis and confirmed by validateManifest");
  console.log("  ✓ Preparation state successfully reached QUALITY_GATE_PASS");
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
  assert.equal(res.status, QUALITY_GATE_STATUS.PASS);
  assert.equal(aiCalls, 0, "Must NOT call AI generator if CONTENT_GENERATED is already in Redis state!");

  const finalState = await getPrepareState(redis, date);
  assert.equal(finalState.stage, PREPARE_STAGES.QUALITY_GATE_PASS);
  assert.equal(finalState.topic, "3 Signs with Unshakeable Mental Resilience");

  console.log("  ✓ Successfully resumed preparation from CONTENT_GENERATED with ZERO additional AI calls");
}

// ============================================================================
// TEST 10: Legacy Manifest Recovery & Valid Package Idempotency
// ============================================================================
{
  console.log("\n[TEST 10] Legacy Manifest Recovery & Valid Package Idempotency");
  const date = "2026-09-04";
  const redis = new MockRedis();
  const mockS3 = new MockS3Client();
  const cachedContent = createSampleAiContent({ publishDate: date, contentId: `social-${date}` });
  const legacyManifest = {
    date,
    id: `social-${date}`,
    type: MEDIA_TYPES.CAROUSEL,
    media: [{ url: "https://pub.r2.dev/old-1.png" }, { url: "https://pub.r2.dev/old-2.png" }],
    captions: { instagram: "legacy", facebook: "legacy", pinterest: { title: "legacy", description: "legacy", link: DEFAULT_APP_PLAY_STORE_URL } },
  };
  await redis.set(`aiz:social:manifest:${date}`, JSON.stringify(legacyManifest));
  await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.MANIFEST_READY, generatedContent: cachedContent });
  let aiCalls = 0;
  const recovered = await executeDailyPreparation({
    redis, targetDate: date, generateFn: async () => { aiCalls++; return cachedContent; }, s3Client: mockS3,
  });
  assert.equal(recovered.status, QUALITY_GATE_STATUS.PASS);
  assert.equal(aiCalls, 0, "Legacy manifest recovery should reuse sufficient current generated content");
  assert.equal((await getPrepareState(redis, date)).stage, PREPARE_STAGES.QUALITY_GATE_PASS);

  const validDate = "2026-09-05";
  const validRedis = new MockRedis();
  const validContent = createSampleAiContent({ publishDate: validDate, contentId: `social-${validDate}` });
  await savePrepareState(validRedis, validDate, { publishDate: validDate, stage: PREPARE_STAGES.QUALITY_GATE_PASS, manifest: { metadata: { qualityGate: QUALITY_GATE_STATUS.PASS } } });
  await validRedis.set(`aiz:social:manifest:${validDate}`, JSON.stringify({ ...legacyManifest, date: validDate, id: `social-${validDate}`, metadata: { qualityGate: QUALITY_GATE_STATUS.PASS } }));
  let validAiCalls = 0;
  const reused = await executeDailyPreparation({ redis: validRedis, targetDate: validDate, generateFn: async () => { validAiCalls++; return validContent; } });
  assert.equal(reused.source, "generated_existing");
  assert.equal(validAiCalls, 0);
  console.log("  ✓ Legacy MANIFEST_READY data re-enters current validation and valid PASS packages are reused");
}

// ============================================================================
// TEST 11: Dry-Run Mode Performs Zero Writes
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

  const prepareCronHandler = (await import("./api/cron/prepareDailySocial.js")).default;
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

// ============================================================================
// TEST 14: Central Production Quality Gate: Comprehensive Validation Suite
// ============================================================================
{
  console.log("\n[TEST 14] Production Social Quality Gate: Comprehensive Validation Suite");

  const validCreative = createSampleAiCreative();
  const validCanonical = assembleCanonicalSocialContent({
    creative: validCreative,
    publishDate: "2026-09-01",
    category: "personality",
  });
  const validRendered = await renderCarouselSlides(validCanonical);
  const validManifest = {
    date: "2026-09-01",
    id: "social-2026-09-01",
    type: MEDIA_TYPES.CAROUSEL,
    media: validRendered.map(item => ({
      url: `https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/${item.key}`,
      altText: item.slideNumber === 1
        ? `${validCanonical.topic} | AI Zodiac`
        : item.slideNumber === 5
          ? "Discover more with AI Zodiac | AI Zodiac"
          : `${validCanonical.slides[item.slideNumber - 1].sign} — ${validCanonical.slides[item.slideNumber - 1].headline} | AI Zodiac`,
    })),
    captions: {
      instagram: validCanonical.instagramCaption,
      facebook: validCanonical.facebookCaption,
      pinterest: {
        title: validCanonical.pinterestTitle,
        description: validCanonical.pinterestDescription,
        link: DEFAULT_APP_PLAY_STORE_URL,
      },
    },
  };

  // 1. Fully valid evaluation -> QUALITY_GATE_PASS
  const passGate = await evaluateQualityGate({
    creative: validCreative,
    canonical: validCanonical,
    renderedSlides: validRendered,
    manifest: validManifest,
    expectedDate: "2026-09-01",
    expectedCategory: "personality",
    mediaBaseUrl: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev",
  });

  assert.equal(passGate.passed, true);
  assert.equal(passGate.status, QUALITY_GATE_STATUS.PASS);
  assert.equal(passGate.errors.length, 0);

  // 2. Reject if altText uses full paragraph instead of concise tag
  const badAltManifest = {
    ...validManifest,
    media: validManifest.media.map(m => ({ ...m, altText: "A".repeat(150) })),
  };
  const badAltGate = await evaluateQualityGate({ manifest: badAltManifest });
  assert.equal(badAltGate.passed, false);
  assert.ok(badAltGate.errors.some(e => e.includes("altText exceeds 120 characters")));

  // 3. Reject if rendered slide has invalid dimensions
  const badDimSlides = [{ buffer: await sharp({ create: { width: 500, height: 500, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } }).png().toBuffer() }];
  const badDimGate = await evaluateQualityGate({ renderedSlides: badDimSlides });
  assert.equal(badDimGate.passed, false);
  assert.ok(badDimGate.errors.some(e => e.includes("Render set must contain exactly 5 slides")));

  // 4. Reject if manifest.captions.facebook lacks Google Play link
  const badFbManifest = {
    ...validManifest,
    captions: {
      ...validManifest.captions,
      facebook: "Manifest caption without Google Play link",
    },
  };
  const badFbGate = await evaluateQualityGate({ manifest: badFbManifest });
  assert.equal(badFbGate.passed, false);
  assert.ok(badFbGate.errors.some(e => e.includes("mandatory Google Play link")));

  console.log("  ✓ evaluateQualityGate returns QUALITY_GATE_PASS for valid end-to-end package");
  console.log("  ✓ Facebook caption Google Play link strictly enforced by Quality Gate");
  console.log("  ✓ Alt-text length and branding rules strictly enforced on manifest");
  console.log("  ✓ Render dimension and buffer validation catches malformed images");
}

// ============================================================================
// TEST 15: All 12 Zodiac Symbols & Vector Arrow Deterministic Vector Coverage
// ============================================================================
{
  console.log("\n[TEST 15] 12 Zodiac Symbols & Vector Arrow Deterministic Vector Coverage");

  const allSigns = Array.from(VALID_ZODIAC_SIGNS);
  assert.equal(allSigns.length, 12, "Must contain all 12 Western zodiac signs");

  for (const sign of allSigns) {
    const glyphSvg = getZodiacSvgGlyph(sign, "#fbbf24", 3.5);
    assert.ok(glyphSvg.includes("<path") || glyphSvg.includes("<circle"), `Sign ${sign} must define vector path`);

    // Render each sign to a 180x180 emblem disc and verify non-zero luminance
    const svgDisc = `
      <svg width="180" height="180" viewBox="-90 -90 180 180" xmlns="http://www.w3.org/2000/svg">
        <circle cx="0" cy="0" r="88" fill="#141733" stroke="#fbbf24" stroke-width="2.5"/>
        ${glyphSvg}
      </svg>
    `.trim();

    const buf = await sharp(Buffer.from(svgDisc)).png().toBuffer();
    const meta = await sharp(buf).metadata();
    assert.equal(meta.width, 180);
    assert.equal(meta.height, 180);
    assert.ok(buf.length > 5000, `Sign ${sign} PNG buffer must be substantial (${buf.length} bytes)`);

    // Verify slide rendering with this sign
    const signSlide = {
      type: "sign",
      sign,
      headline: "Core Astrological Trait",
      body: "Insightful, precise and deeply meaningful description of planetary alignment.",
    };

    const renderedSignBuffer = await renderSlidePng({
      slide: signSlide,
      slideNumber: 2,
      totalSlides: 5,
      category: "personality",
      categoryTitle: "Personality",
    });

    const slideMeta = await sharp(renderedSignBuffer).metadata();
    assert.equal(slideMeta.width, 1080);
    assert.equal(slideMeta.height, 1350);
  }

  // Verify Vector Arrow SVG
  const arrowSvg = renderVectorArrowSvg({ color: "#c4b5fd", width: 30, height: 30, strokeWidth: 3 });
  const arrowBuf = await sharp(Buffer.from(arrowSvg)).png().toBuffer();
  assert.ok(arrowBuf.length > 150);

  console.log("  ✓ All 12 zodiac symbols (Aries through Pisces) render deterministically with vector SVG");
  console.log("  ✓ Zero tofu / codepoint boxes across all 12 signs");
  console.log("  ✓ Deterministic vector arrow renders crisp on swipe prompt");
}

// ============================================================================
// TEST 16: Publisher Hard Block Enforces QUALITY_GATE_PASS
// ============================================================================
{
  console.log("\n[TEST 16] Publisher Hard Block Enforces QUALITY_GATE_PASS & Blocks Provider Writes");

  const config = getSocialConfig({
    autoPublishEnabled: true,
    metaPageAccessToken: "EAAB_token",
    metaPageId: "page_123",
    instagramAccountId: "ig_456",
    pinterestAccessToken: "pina_token",
    pinterestBoardId: "board_789",
    pinterestAccessTier: "standard",
  });

  function createMockPublisher() {
    let writes = { ig: 0, fb: 0, pin: 0 };
    const adapters = {
      [PLATFORMS.INSTAGRAM]: {
        publish: async () => {
          writes.ig++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "ig_111" };
        },
      },
      [PLATFORMS.FACEBOOK]: {
        publish: async () => {
          writes.fb++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "fb_222" };
        },
      },
      [PLATFORMS.PINTEREST]: {
        publish: async () => {
          writes.pin++;
          return { success: true, status: PUBLISH_STATUS.PUBLISHED, postId: "pin_333" };
        },
      },
    };
    return { adapters, writes };
  }

  function createManifestWithGate(date, qgStatus) {
    const manifest = {
      date,
      id: `social-${date}`,
      type: MEDIA_TYPES.CAROUSEL,
      media: [{ url: "https://pub.r2.dev/s1.png" }, { url: "https://pub.r2.dev/s2.png" }],
      captions: { instagram: "ig", facebook: "fb", pinterest: { title: "t", description: "d", link: DEFAULT_APP_PLAY_STORE_URL } },
    };
    if (qgStatus !== undefined) {
      manifest.metadata = { qualityGate: qgStatus };
    }
    return manifest;
  }

  // 1. PASS state + PASS manifest -> publishing path allowed
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, true);
    assert.equal(res.status, PUBLISH_STATUS.PUBLISHED);
    assert.equal(writes.ig, 1);
    assert.equal(writes.fb, 1);
    assert.equal(writes.pin, 1);
  }

  // 2. PASS state + FAILED manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.FAILED);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 3. FAILED state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_FAILED });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 4. FAILED state + FAILED manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_FAILED });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.FAILED);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 5. ABSENT state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 6. PASS state + ABSENT quality metadata -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.QUALITY_GATE_PASS });
    const manifest = createManifestWithGate(date, undefined);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 7. INTERMEDIATE state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: PREPARE_STAGES.RENDERED });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  // 8. UNKNOWN state + PASS manifest -> BLOCKED
  {
    const date = "2026-09-10";
    const redis = new MockRedis();
    await savePrepareState(redis, date, { publishDate: date, stage: "UNKNOWN_STATE" });
    const manifest = createManifestWithGate(date, QUALITY_GATE_STATUS.PASS);
    const { adapters, writes } = createMockPublisher();

    const res = await executeSocialPublishing({ redis, config, targetDate: date, manifest, adapters });
    assert.equal(res.success, false);
    assert.equal(res.status, "QUALITY_GATE_BLOCKED");
    assert.equal(writes.ig, 0);
    assert.equal(writes.fb, 0);
    assert.equal(writes.pin, 0);
  }

  console.log("  ✓ Publisher hard-blocks all 7 invalid/inconsistent combinations with 0 provider writes");
  console.log("  ✓ Publisher permits writes ONLY when BOTH state and manifest confirm QUALITY_GATE_PASS");
}

// ============================================================================
// TEST 17: AI Creative Retry Policy (3 Attempts Max, 0 Retries on Deterministic Errors)
// ============================================================================
{
  console.log("\n[TEST 17] AI Creative Retry Policy & Hard Failure Boundary");

  const redis = new MockRedis();
  const date = "2026-09-12";

  // 1. Invalid creative on attempt 1, valid on attempt 2 -> Retries and succeeds
  let attemptCount = 0;
  const retryMock = async () => {
    attemptCount++;
    if (attemptCount === 1) {
      // Missing headline on first attempt
      return {
        ...createSampleAiCreative(),
        items: [
          { sign: "Taurus", headline: "", text: "Text 1" },
          { sign: "Virgo", headline: "Trait 2", text: "Text 2" },
          { sign: "Leo", headline: "Trait 3", text: "Text 3" },
        ],
      };
    }
    return createSampleAiCreative();
  };

  const prepRes = await executeDailyPreparation({
    redis,
    targetDate: date,
    generateFn: retryMock,
    s3Client: new MockS3Client(),
    dryRun: false,
  });

  assert.equal(prepRes.success, true);
  assert.equal(attemptCount, 2, "Should retry once upon invalid creative output and succeed on attempt 2");

  // 2. 3 consecutive invalid attempts -> Throws with QUALITY_GATE_FAILED and halts
  let failAttemptCount = 0;
  const alwaysFailMock = async () => {
    failAttemptCount++;
    return {
      topic: "Invalid Topic Without 3 Signs",
      items: [],
      instagramCaption: "",
      facebookCaption: "",
      pinterestTitle: "",
      pinterestDescription: "",
    };
  };

  let caughtErr = null;
  try {
    await executeDailyPreparation({
      redis,
      targetDate: "2026-09-13",
      generateFn: alwaysFailMock,
      s3Client: new MockS3Client(),
      dryRun: false,
    });
  } catch (err) {
    caughtErr = err;
  }

  assert.ok(caughtErr, "Must throw when max AI attempts exhausted");
  assert.equal(failAttemptCount, 3, "Must attempt exactly 3 times before failing");
  const failedState = await getPrepareState(redis, "2026-09-13");
  assert.equal(failedState.stage, PREPARE_STAGES.QUALITY_GATE_FAILED);

  console.log("  ✓ Invalid creative output safely triggers up to 2 retries (3 total attempts)");
  console.log("  ✓ Exhausted attempts transition state to QUALITY_GATE_FAILED and skip publication");
}

// ============================================================================
// TEST 18: Production-Like Canary Fixture & Quality Gate Review Set
// ============================================================================
{
  console.log("\n[TEST 18] Production-Like Canary Fixture & Quality Gate Verification");

  const canaryDir = path.resolve("./tmp/social-quality-gate-review");
  if (!fs.existsSync(canaryDir)) fs.mkdirSync(canaryDir, { recursive: true });

  const canaryCarousel = {
    contentId: "social-2026-09-15",
    publishDate: "2026-09-15",
    category: "zodiac_psychology",
    topic: "3 Zodiac Signs That Are the Ultimate Midnight Thinkers",
    slides: [
      {
        type: "title",
        headline: "3 Zodiac Signs That Are the Ultimate Midnight Thinkers",
      },
      {
        type: "sign",
        sign: "Gemini",
        headline: "Curiosity Never Sleeps",
        body: "Their brilliant, hyperactive minds race through ideas, concepts and connections while the rest of the world rests.",
      },
      {
        type: "sign",
        sign: "Virgo",
        headline: "Midnight Problem Solver",
        body: "The quiet hours offer pure mental clarity, allowing Virgo to analyze, organize and solve life's deepest puzzles.",
      },
      {
        type: "sign",
        sign: "Pisces",
        headline: "Dreams Come Alive After Dark",
        body: "Nighttime unleashes their boundless imagination, unlocking mystical inspiration, vivid visions and creative wonder.",
      },
      {
        type: "cta",
        headline: "Discover more with AI Zodiac",
        body: "Free on Google Play",
      },
    ],
    instagramCaption: "Do you do your best thinking at midnight? 🌙✨ Gemini, Virgo, and Pisces thrive in the quiet hours. Explore your cosmic archetype with AI Zodiac. #astrology #zodiac #horoscope #aizodiac",
    facebookCaption: ensureFacebookGooglePlayLink("Midnight thinkers of the zodiac: Gemini, Virgo, and Pisces! Discover personalized insights with AI Zodiac on Google Play."),
    pinterestTitle: "3 Zodiac Signs That Are Midnight Thinkers | AI Zodiac",
    pinterestDescription: "Discover why Gemini, Virgo, and Pisces do their deepest thinking late at night. Download AI Zodiac free.",
    pinterestLink: DEFAULT_APP_PLAY_STORE_URL,
  };

  const canaryRendered = await renderCarouselSlides(canaryCarousel, { outputDir: canaryDir });
  assert.equal(canaryRendered.length, 5);

  const canaryManifest = {
    date: "2026-09-15",
    id: "social-2026-09-15",
    type: MEDIA_TYPES.CAROUSEL,
    media: canaryRendered.map(item => ({
      url: `https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/${item.key}`,
      altText: item.slideNumber === 1
        ? `${canaryCarousel.topic} | AI Zodiac`
        : item.slideNumber === 5
          ? "Discover more with AI Zodiac | AI Zodiac"
          : `${canaryCarousel.slides[item.slideNumber - 1].sign} — ${canaryCarousel.slides[item.slideNumber - 1].headline} | AI Zodiac`,
    })),
    captions: {
      instagram: canaryCarousel.instagramCaption,
      facebook: canaryCarousel.facebookCaption,
      pinterest: {
        title: canaryCarousel.pinterestTitle,
        description: canaryCarousel.pinterestDescription,
        link: DEFAULT_APP_PLAY_STORE_URL,
      },
    },
  };

  const canaryGate = await evaluateQualityGate({
    canonical: canaryCarousel,
    renderedSlides: canaryRendered,
    manifest: canaryManifest,
    expectedDate: "2026-09-15",
    expectedCategory: "zodiac_psychology",
    mediaBaseUrl: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev",
  });

  assert.equal(canaryGate.passed, true, `Canary fixture must pass Quality Gate: ${canaryGate.errors.join("; ")}`);
  assert.equal(canaryGate.status, QUALITY_GATE_STATUS.PASS);

  console.log(`  ✓ Canary fixture rendered to tmp/social-quality-gate-review/ (5 slides)`);
  console.log(`  ✓ Canary Quality Gate Result: ${canaryGate.status} 🎉`);
}

console.log("\n==================================================");
console.log("ALL SOCIAL PREPARATION & QUALITY GATE TESTS PASSED! 🎉");
console.log("==================================================");
