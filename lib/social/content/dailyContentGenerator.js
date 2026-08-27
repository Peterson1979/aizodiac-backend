// lib/social/content/dailyContentGenerator.js
import { executeProviderRouting, generateAiContent, AI_PROVIDERS } from "../../aiProvider.js";
import { getTopicStrategyForDate } from "./topicRotation.js";
import { isTopicDuplicate, getRecentTopics, recordTopicUsage } from "./contentHistory.js";

export const VALID_ZODIAC_SIGNS = new Set([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]);

export const DEFAULT_APP_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac";

/**
 * Minimal Creative JSON Schema for social content generation.
 * Contains purely creative fields (topic, items, captions) with ZERO deterministic metadata.
 */
export const SOCIAL_AI_CREATIVE_SCHEMA = {
  type: "object",
  properties: {
    topic: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sign: { type: "string" },
          text: { type: "string" },
        },
        required: ["sign", "text"],
        additionalProperties: false,
      },
    },
    instagramCaption: { type: "string" },
    facebookCaption: { type: "string" },
    pinterestTitle: { type: "string" },
    pinterestDescription: { type: "string" },
  },
  required: [
    "topic",
    "items",
    "instagramCaption",
    "facebookCaption",
    "pinterestTitle",
    "pinterestDescription",
  ],
  additionalProperties: false,
};

// Backwards compatibility alias
export const SOCIAL_CONTENT_SCHEMA = SOCIAL_AI_CREATIVE_SCHEMA;

/**
 * Builds the AI prompt for daily social creative content generation.
 * @param {object} params
 * @param {string} params.publishDate - Date in YYYY-MM-DD
 * @param {object} params.strategy - Rotation strategy object
 * @param {Array<string>} [params.recentTopics=[]] - Topics to exclude
 * @returns {string}
 */
export function buildSocialContentPrompt({ publishDate, strategy, recentTopics = [] }) {
  const recentTopicsText = recentTopics.length > 0
    ? `\nRECENTLY USED TOPICS (DO NOT REPEAT OR USE SUBSTANTIALLY SIMILAR TOPICS):\n${recentTopics.map(t => `- ${t}`).join("\n")}\n`
    : "";

  return `You are the master astrological content editor for the mobile app "AI Zodiac".
Generate engaging, insightful, and creative social media content for ${strategy.dayName}, ${publishDate}.

CATEGORY FOR TODAY: "${strategy.categoryTitle}" (${strategy.category})
THEME GUIDANCE: ${strategy.themeDescription}
FOCUS INSTRUCTIONS: ${strategy.focusPrompt}
SEED INSPIRATIONS (choose one or craft an original within this exact theme):
${strategy.seedTopics.map(t => `* ${t}`).join("\n")}
${recentTopicsText}
STRICT EDITORIAL AND COMPLIANCE RULES:
1. General astrology only. Never request, generate, or assume personal user profiles, personal birth data, or private user questions.
2. English language only.
3. topic: Catchy, high-impact hook headline (5-120 characters, under 60 chars preferred, e.g. "3 Zodiac Signs That Value Loyalty Most").
4. items: Exactly 3 spotlighted zodiac items. Each item must have:
   - "sign": A valid Western zodiac sign name (Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces).
   - "text": 2-3 compelling, punchy sentences (under 180 chars) describing why this sign fits today's topic.
5. NO duplicate zodiac signs across items.
6. NO hashtags in the topic or item text.
7. Safety rules: No deterministic medical, legal, financial, or political advice. No guaranteed predictions presented as scientific fact. No sexual or vulgar content. No defamatory stereotypes.
8. Captions:
   - instagramCaption: 2-4 engaging sentences with 4-8 relevant hashtags (e.g. #astrology #zodiac #horoscope #aizodiac).
   - facebookCaption: 2-3 engaging sentences ending with a prompt to download AI Zodiac on Google Play.
   - pinterestTitle: Catchy search-friendly title (strictly under 100 characters).
   - pinterestDescription: Rich descriptive summary (strictly under 500 characters).

OUTPUT: Respond ONLY with valid JSON matching the requested schema.`;
}

/**
 * Validates the raw creative AI output before deterministic backend assembly.
 * @param {object} creative - The parsed creative JSON from AI
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAiCreativeOutput(creative) {
  const errors = [];

  if (!creative || typeof creative !== "object") {
    return { valid: false, errors: ["Creative output must be a non-null object"] };
  }

  // 1. Topic
  if (!creative.topic || typeof creative.topic !== "string" || creative.topic.trim().length < 5) {
    errors.push("Missing or too short 'topic'");
  } else if (creative.topic.length > 120) {
    errors.push(`'topic' exceeds 120 characters (length: ${creative.topic.length})`);
  }

  // 2. Items
  if (!Array.isArray(creative.items)) {
    errors.push("Missing 'items' array");
  } else {
    if (creative.items.length !== 3) {
      errors.push(`'items' count must be exactly 3, received ${creative.items.length}`);
    }

    const seenSigns = new Set();
    creative.items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`Item at index ${idx} must be an object`);
        return;
      }

      if (!item.sign || typeof item.sign !== "string") {
        errors.push(`Item at index ${idx} missing 'sign'`);
      } else {
        const normSign = item.sign.trim();
        const capitalizedSign = normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase();
        if (!VALID_ZODIAC_SIGNS.has(capitalizedSign)) {
          errors.push(`Item at index ${idx} has invalid zodiac sign: '${item.sign}'`);
        } else if (seenSigns.has(capitalizedSign)) {
          errors.push(`Duplicate zodiac sign '${capitalizedSign}' found at item index ${idx}`);
        } else {
          seenSigns.add(capitalizedSign);
        }
      }

      if (!item.text || typeof item.text !== "string" || item.text.trim().length === 0) {
        errors.push(`Item at index ${idx} requires non-empty 'text'`);
      } else {
        if (item.text.includes("#")) {
          errors.push(`Item at index ${idx} text must not contain hashtags`);
        }
        if (item.text.length > 250) {
          errors.push(`Item at index ${idx} text exceeds 250 characters (length: ${item.text.length})`);
        }
      }
    });
  }

  // 3. Captions
  if (!creative.instagramCaption || typeof creative.instagramCaption !== "string" || creative.instagramCaption.trim().length === 0) {
    errors.push("Missing or empty 'instagramCaption'");
  }
  if (!creative.facebookCaption || typeof creative.facebookCaption !== "string" || creative.facebookCaption.trim().length === 0) {
    errors.push("Missing or empty 'facebookCaption'");
  }
  if (!creative.pinterestTitle || typeof creative.pinterestTitle !== "string" || creative.pinterestTitle.trim().length === 0) {
    errors.push("Missing or empty 'pinterestTitle'");
  } else if (creative.pinterestTitle.length > 100) {
    errors.push(`'pinterestTitle' exceeds 100 characters (length: ${creative.pinterestTitle.length})`);
  }

  if (!creative.pinterestDescription || typeof creative.pinterestDescription !== "string" || creative.pinterestDescription.trim().length === 0) {
    errors.push("Missing or empty 'pinterestDescription'");
  } else if (creative.pinterestDescription.length > 500) {
    errors.push(`'pinterestDescription' exceeds 500 characters (length: ${creative.pinterestDescription.length})`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constructs the canonical 5-slide social content package from validated creative AI output
 * and deterministic backend parameters (contentId, publishDate, category, pinterestLink, slides).
 * @param {object} params
 * @param {object} params.creative - Validated creative content
 * @param {string} params.publishDate - Target date (YYYY-MM-DD)
 * @param {string} params.category - Rotation category
 * @returns {object} - Complete canonical social content package
 */
export function assembleCanonicalSocialContent({ creative, publishDate, category }) {
  const normCategory = category || "general";
  const contentId = `social-${publishDate}`;

  const slides = [
    // Slide 1: Title Hook
    {
      type: "title",
      sign: null,
      headline: creative.topic.trim(),
      body: null,
    },
    // Slides 2-4: Sign Insights
    ...(creative.items || []).map((item) => {
      const normSign = (item.sign || "").trim();
      const capitalizedSign = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "";
      return {
        type: "sign",
        sign: capitalizedSign,
        headline: capitalizedSign,
        body: (item.text || "").trim(),
      };
    }),
    // Slide 5: CTA
    {
      type: "cta",
      sign: null,
      headline: "Discover more with AI Zodiac",
      body: "Free on Google Play",
    },
  ];

  return {
    contentId,
    publishDate,
    category: normCategory,
    topic: creative.topic.trim(),
    slides,
    instagramCaption: creative.instagramCaption.trim(),
    facebookCaption: creative.facebookCaption.trim(),
    pinterestTitle: creative.pinterestTitle.trim(),
    pinterestDescription: creative.pinterestDescription.trim(),
    pinterestLink: DEFAULT_APP_PLAY_STORE_URL,
  };
}

/**
 * Validates a canonical social content object against strict quality guards.
 * @param {object} content - The canonical social content object
 * @param {object} [options={}]
 * @param {Array<string>} [options.recentTopics=[]]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSocialContent(content, { recentTopics = [] } = {}) {
  const errors = [];

  if (!content || typeof content !== "object") {
    return { valid: false, errors: ["Content must be a non-null object"] };
  }

  // 1. Content ID & Publish Date
  if (!content.contentId || typeof content.contentId !== "string" || !content.contentId.startsWith("social-")) {
    errors.push("Invalid or missing 'contentId' (must start with 'social-')");
  }
  if (!content.publishDate || !/^\d{4}-\d{2}-\d{2}$/.test(content.publishDate)) {
    errors.push("Invalid or missing 'publishDate' (expected YYYY-MM-DD)");
  }

  // 2. Category & Topic
  if (!content.category || typeof content.category !== "string") {
    errors.push("Missing 'category'");
  }
  if (!content.topic || typeof content.topic !== "string" || content.topic.trim().length < 5) {
    errors.push("Missing or too short 'topic'");
  } else if (content.topic.length > 120) {
    errors.push(`'topic' exceeds 120 characters (length: ${content.topic.length})`);
  }

  // 3. Slides Array
  if (!Array.isArray(content.slides)) {
    errors.push("Missing 'slides' array");
  } else {
    if (content.slides.length < 2 || content.slides.length > 6) {
      errors.push(`'slides' count must be between 2 and 6, received ${content.slides.length}`);
    }

    const firstSlide = content.slides[0];
    if (!firstSlide || firstSlide.type !== "title") {
      errors.push("First slide must have type 'title'");
    } else if (!firstSlide.headline || typeof firstSlide.headline !== "string" || firstSlide.headline.trim().length === 0) {
      errors.push("First slide requires a non-empty 'headline'");
    }

    const lastSlide = content.slides[content.slides.length - 1];
    if (!lastSlide || lastSlide.type !== "cta") {
      errors.push("Last slide must have type 'cta'");
    } else {
      if (!lastSlide.headline || typeof lastSlide.headline !== "string" || lastSlide.headline.trim().length === 0) {
        errors.push("CTA slide requires a non-empty 'headline'");
      }
      if (!lastSlide.body || typeof lastSlide.body !== "string" || lastSlide.body.trim().length === 0) {
        errors.push("CTA slide requires a non-empty 'body'");
      }
    }

    // Check middle slides & sign duplication
    const seenSigns = new Set();
    content.slides.forEach((slide, idx) => {
      if (!slide || typeof slide !== "object") {
        errors.push(`Slide at index ${idx} must be an object`);
        return;
      }

      if (!slide.headline || typeof slide.headline !== "string" || slide.headline.trim().length === 0) {
        errors.push(`Slide at index ${idx} requires a non-empty 'headline'`);
      }

      // Check hashtags in slides
      if (slide.headline && slide.headline.includes("#")) {
        errors.push(`Slide at index ${idx} headline must not contain hashtags`);
      }
      if (slide.body && slide.body.includes("#")) {
        errors.push(`Slide at index ${idx} body must not contain hashtags`);
      }

      if (slide.type === "sign") {
        if (!slide.sign || typeof slide.sign !== "string") {
          errors.push(`Slide at index ${idx} has type 'sign' but missing 'sign' field`);
        } else {
          const normSign = slide.sign.trim();
          const capitalizedSign = normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase();
          if (!VALID_ZODIAC_SIGNS.has(capitalizedSign)) {
            errors.push(`Slide at index ${idx} has invalid zodiac sign: '${slide.sign}'`);
          } else if (seenSigns.has(capitalizedSign)) {
            errors.push(`Duplicate zodiac sign '${capitalizedSign}' found at slide index ${idx}`);
          } else {
            seenSigns.add(capitalizedSign);
          }
        }
      }
    });
  }

  // 4. Captions
  if (!content.instagramCaption || typeof content.instagramCaption !== "string" || content.instagramCaption.trim().length === 0) {
    errors.push("Missing or empty 'instagramCaption'");
  }
  if (!content.facebookCaption || typeof content.facebookCaption !== "string" || content.facebookCaption.trim().length === 0) {
    errors.push("Missing or empty 'facebookCaption'");
  }
  if (!content.pinterestTitle || typeof content.pinterestTitle !== "string" || content.pinterestTitle.trim().length === 0) {
    errors.push("Missing or empty 'pinterestTitle'");
  } else if (content.pinterestTitle.length > 100) {
    errors.push(`'pinterestTitle' exceeds 100 characters (length: ${content.pinterestTitle.length})`);
  }

  if (!content.pinterestDescription || typeof content.pinterestDescription !== "string" || content.pinterestDescription.trim().length === 0) {
    errors.push("Missing or empty 'pinterestDescription'");
  } else if (content.pinterestDescription.length > 500) {
    errors.push(`'pinterestDescription' exceeds 500 characters (length: ${content.pinterestDescription.length})`);
  }

  if (!content.pinterestLink || typeof content.pinterestLink !== "string" || !/^https?:\/\//i.test(content.pinterestLink.trim())) {
    errors.push(`Invalid 'pinterestLink': '${content.pinterestLink}'`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generates one daily social content package using the AI provider routing system.
 * Implements creative AI generation -> deterministic assembly -> canonical validation.
 * @param {object} params
 * @param {string} params.publishDate - Target date in YYYY-MM-DD
 * @param {object} [params.redis=null] - Upstash Redis client instance
 * @param {string} [params.timeZone="UTC"]
 * @param {number} [params.maxAttempts=3] - Max generation attempts
 * @param {Function} [params.generateFn] - Optional mockable generator function
 * @returns {Promise<object>} - Validated canonical social content JSON
 */
export async function generateDailySocialContent({
  publishDate,
  redis = null,
  timeZone = "UTC",
  maxAttempts = 3,
  generateFn = null,
} = {}) {
  const strategy = getTopicStrategyForDate(publishDate, timeZone);
  const recentTopicsList = await getRecentTopics(redis, { referenceDate: publishDate, thresholdDays: 120 });
  const recentTopicTitles = recentTopicsList.map(t => t.topic);

  let lastErrors = [];
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      const prompt = buildSocialContentPrompt({
        publishDate,
        strategy,
        recentTopics: recentTopicTitles,
      });

      let rawResponse;

      if (generateFn) {
        // Custom / test injected generation function
        rawResponse = await generateFn({
          prompt,
          publishDate,
          strategy,
          attempt,
        });
      } else {
        // Production AI Generation using existing provider routing & budget controls
        const routingResult = await executeProviderRouting({
          type: "social_daily_content",
          prompt,
          responseSchema: SOCIAL_AI_CREATIVE_SCHEMA,
          maxOutputTokens: 800,
          redis,
          date: publishDate,
          groqModel: process.env.GROQ_SOCIAL_MODEL || process.env.GROQ_MODEL || "openai/gpt-oss-20b",
        });

        rawResponse = routingResult?.text;
      }

      if (!rawResponse) {
        throw new Error("AI provider returned empty response");
      }

      // Parse JSON
      let parsed;
      if (typeof rawResponse === "object") {
        parsed = rawResponse;
      } else {
        const cleaned = rawResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        parsed = JSON.parse(cleaned);
      }

      // 1. Creative AI Validation or direct canonical passthrough (for backward-compatible test injection)
      let canonical;
      if (parsed.items && Array.isArray(parsed.items)) {
        const creativeValidation = validateAiCreativeOutput(parsed);
        if (!creativeValidation.valid) {
          lastErrors = creativeValidation.errors;
          console.warn(`⚠️ Creative AI validation failed (attempt ${attempt}/${maxAttempts}):`, creativeValidation.errors);
          continue;
        }

        // 2. Deterministic Assembly in Application Code
        canonical = assembleCanonicalSocialContent({
          creative: parsed,
          publishDate,
          category: strategy.category,
        });
      } else if (parsed.slides && Array.isArray(parsed.slides)) {
        // Backward-compatible direct canonical object from tests
        parsed.publishDate = publishDate;
        parsed.contentId = parsed.contentId || `social-${publishDate}`;
        parsed.category = parsed.category || strategy.category;
        parsed.pinterestLink = parsed.pinterestLink || DEFAULT_APP_PLAY_STORE_URL;
        canonical = parsed;
      } else {
        lastErrors = ["Invalid AI response: missing 'items' array"];
        continue;
      }

      // 3. Final Canonical Validation
      const canonicalValidation = validateSocialContent(canonical, { recentTopics: recentTopicTitles });
      if (!canonicalValidation.valid) {
        lastErrors = canonicalValidation.errors;
        console.warn(`⚠️ Canonical validation failed (attempt ${attempt}/${maxAttempts}):`, canonicalValidation.errors);
        continue;
      }

      // 4. Check 120-day duplicate topic guard
      const dupCheck = await isTopicDuplicate(redis, canonical.topic, {
        publishDate,
        thresholdDays: 120,
        recentTopicsCache: recentTopicsList,
      });

      if (dupCheck.isDuplicate) {
        lastErrors = [`Topic duplicate rejected: ${dupCheck.reason}`];
        console.warn(`⚠️ Topic rejected as duplicate (attempt ${attempt}/${maxAttempts}):`, dupCheck.reason);
        continue;
      }

      // Generation succeeded!
      return canonical;

    } catch (err) {
      lastErrors = [err.message || String(err)];
      console.warn(`⚠️ Error in social content generation attempt ${attempt}/${maxAttempts}:`, err.message);
    }
  }

  const failureErr = new Error(`Failed to generate valid daily social content after ${maxAttempts} attempts. Errors: ${lastErrors.join("; ")}`);
  failureErr.status = 500;
  failureErr.errors = lastErrors;
  throw failureErr;
}
