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
 * JSON Schema for social content generation.
 */
export const SOCIAL_CONTENT_SCHEMA = {
  type: "object",
  properties: {
    contentId: { type: "string" },
    publishDate: { type: "string" },
    category: { type: "string" },
    topic: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["title", "sign", "insight", "cta"] },
          sign: { type: ["string", "null"] },
          headline: { type: "string" },
          body: { type: ["string", "null"] },
        },
        required: ["type", "headline"],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 6,
    },
    instagramCaption: { type: "string" },
    facebookCaption: { type: "string" },
    pinterestTitle: { type: "string" },
    pinterestDescription: { type: "string" },
    pinterestLink: { type: "string" },
  },
  required: [
    "contentId",
    "publishDate",
    "category",
    "topic",
    "slides",
    "instagramCaption",
    "facebookCaption",
    "pinterestTitle",
    "pinterestDescription",
    "pinterestLink",
  ],
  additionalProperties: false,
};

/**
 * Builds the AI prompt for daily social content generation.
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
Generate an engaging, insightful, and beautifully structured 5-slide social media carousel for ${strategy.dayName}, ${publishDate}.

CATEGORY FOR TODAY: "${strategy.categoryTitle}" (${strategy.category})
THEME GUIDANCE: ${strategy.themeDescription}
FOCUS INSTRUCTIONS: ${strategy.focusPrompt}
SEED INSPIRATIONS (choose one or craft an original within this exact theme):
${strategy.seedTopics.map(t => `* ${t}`).join("\n")}
${recentTopicsText}
STRICT EDITORIAL AND COMPLIANCE RULES:
1. General astrology only. Never request, generate, or assume personal user profiles, personal birth data, or private user questions.
2. English language only.
3. Keep carousel copy concise, high-impact, punchy, and easily readable on mobile cards.
4. Exactly 5 slides structured as follows:
   - Slide 1 (type: "title"): Catchy hook headline (under 60 chars). Body must be null.
   - Slide 2 (type: "sign" or "insight"): First spotlighted zodiac sign or core insight. Sign field must be a valid Western sign (e.g. "Taurus"). Headline must be the sign or keyword. Body should be 2-3 compelling sentences (under 180 chars).
   - Slide 3 (type: "sign" or "insight"): Second distinct zodiac sign or core insight. Body under 180 chars.
   - Slide 4 (type: "sign" or "insight"): Third distinct zodiac sign or core insight. Body under 180 chars.
   - Slide 5 (type: "cta"): Call to action. Headline must be "Discover more with AI Zodiac" (or very similar). Body must state "Free on Google Play".
5. NO duplicate zodiac signs across slides.
6. NO hashtags inside the slide headlines or slide bodies.
7. Safety rules: No deterministic medical, legal, financial, or political advice. No guaranteed predictions presented as scientific fact. No sexual or vulgar content. No defamatory stereotypes.
8. Platform Captions:
   - instagramCaption: 2-4 engaging sentences with 4-8 relevant hashtags (e.g. #astrology #zodiac #horoscope #aizodiac).
   - facebookCaption: 2-3 engaging sentences ending with a prompt to download AI Zodiac on Google Play.
   - pinterestTitle: Catchy search-friendly title (strictly under 100 characters).
   - pinterestDescription: Rich descriptive summary (strictly under 500 characters).
   - pinterestLink: Must be "${DEFAULT_APP_PLAY_STORE_URL}".

OUTPUT: Respond ONLY with valid JSON matching the requested schema.`;
}

/**
 * Validates a generated social content object against strict quality guards.
 * @param {object} content - The parsed JSON content
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
 * Implements bounded retries and quality validation.
 * @param {object} params
 * @param {string} params.publishDate - Target date in YYYY-MM-DD
 * @param {object} [params.redis=null] - Upstash Redis client instance
 * @param {string} [params.timeZone="UTC"]
 * @param {number} [params.maxAttempts=3] - Max generation attempts
 * @param {Function} [params.generateFn] - Optional mockable generator function
 * @returns {Promise<object>} - Validated social content JSON
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
          responseSchema: SOCIAL_CONTENT_SCHEMA,
          maxOutputTokens: 1000,
          redis,
          date: publishDate,
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
        // Clean markdown code fence blocks if returned by model
        const cleaned = rawResponse
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/, "")
          .trim();
        parsed = JSON.parse(cleaned);
      }

      // Enforce publishDate and contentId consistency
      parsed.publishDate = publishDate;
      parsed.contentId = parsed.contentId || `social-${publishDate}`;
      parsed.category = parsed.category || strategy.category;

      // Validate Quality Guards
      const validation = validateSocialContent(parsed, { recentTopics: recentTopicTitles });
      if (!validation.valid) {
        lastErrors = validation.errors;
        console.warn(`⚠️ Social content generation validation failed (attempt ${attempt}/${maxAttempts}):`, validation.errors);
        continue;
      }

      // Check 120-day duplicate topic guard
      const dupCheck = await isTopicDuplicate(redis, parsed.topic, {
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
      return parsed;

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
