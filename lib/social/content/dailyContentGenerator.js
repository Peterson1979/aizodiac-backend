// lib/social/content/dailyContentGenerator.js
import { executeProviderRouting, generateAiContent, AI_PROVIDERS } from "../../aiProvider.js";
import { getTopicStrategyForDate, CONTENT_FORMATS, CONTENT_FORMAT_CYCLE } from "./topicRotation.js";
import { isTopicDuplicate, getRecentTopics, recordTopicUsage } from "./contentHistory.js";
import { checkPlaceholderContent, checkMetaLanguage } from "../quality/socialQualityGate.js";
import {
  resolveWebsitePath,
  buildWebsiteDestinationUrl,
  validateWebsiteDestinationUrl,
  formatFacebookCaption,
  formatInstagramCaption,
} from "./destinations.js";

export const VALID_ZODIAC_SIGNS = new Set([
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"
]);

export const DEFAULT_APP_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac";
export const FACEBOOK_TRACKING_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac&referrer=utm_source%3Dfacebook%26utm_medium%3Dsocial%26utm_campaign%3Ddaily_post";
export const INSTAGRAM_BIO_TRACKING_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac&referrer=utm_source%3Dinstagram%26utm_medium%3Dsocial%26utm_campaign%3Dlinkinbio";

/**
 * Ensures the mandatory Google Play link with Facebook UTM attribution is present in the Facebook caption without duplication.
 * @param {string} caption
 * @param {string} [url=FACEBOOK_TRACKING_PLAY_STORE_URL]
 * @returns {string}
 */
export function ensureFacebookGooglePlayLink(caption = "", url = FACEBOOK_TRACKING_PLAY_STORE_URL) {
  const trimmed = String(caption || "").trim();
  if (!trimmed) {
    return url;
  }
  if (trimmed.includes(url) || (trimmed.includes(DEFAULT_APP_PLAY_STORE_URL) && trimmed.includes("referrer="))) {
    return trimmed;
  }
  if (trimmed.includes(DEFAULT_APP_PLAY_STORE_URL)) {
    return trimmed.replace(DEFAULT_APP_PLAY_STORE_URL, url);
  }
  return `${trimmed}\n\n${url}`;
}

/**
 * Forbidden scope-mismatch patterns that claim universal/comprehensive coverage
 * when only 3 signs are generated.
 */
export const FORBIDDEN_SCOPE_PATTERNS = [
  /\bevery\s+(?:zodiac|element|sign)\b/i,
  /\ball\s+(?:zodiac|signs|12\s+signs|twelve\s+signs|four\s+elements|4\s+elements|elements)\b/i,
  /\beach\s+(?:zodiac|element|sign)\b/i,
  /\bentire\s+zodiac\b/i,
  /\bwhole\s+zodiac\b/i,
  /\ball\s+four\b/i,
  /\ball\s+12\b/i,
  /\b(earth,\s*air,\s*fire,?\s*(?:and\s+)?water)\b/i,
];

/**
 * Checks a string against forbidden scope-mismatch language.
 * @param {string} text
 * @returns {string|null} - Matched forbidden phrase or null
 */
export function checkScopeMismatch(text) {
  if (!text || typeof text !== "string") return null;
  for (const pattern of FORBIDDEN_SCOPE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return match[0];
    }
  }
  return null;
}

/**
 * Minimal Creative JSON Schema for social content generation.
 * Contains purely creative fields (topic, items with headline and text, captions) with ZERO deterministic metadata.
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
          headline: { type: "string" },
          text: { type: "string" },
        },
        required: ["sign", "headline", "text"],
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
 * Returns specialized editorial instructions tailored to the given content format.
 * @param {object} strategy
 * @returns {string}
 */
export function getFormatEditorialInstructions(strategy) {
  const format = strategy.format || "three_zodiac_signs";
  const item = strategy.catalogItem || {};

  switch (format) {
    case CONTENT_FORMATS.FEATURE_SPOTLIGHT:
      return `CONTENT FORMAT: FEATURE SPOTLIGHT
- SPOTLIGHTED FEATURE: "${item.title || "Personal Horoscope"}" (Route: ${item.path || "/features/personal-horoscope"})
- FEATURE SUMMARY: ${item.featureSummary || "Comprehensive personalized astrological guidance and transit timing."}
- EDITORIAL GOAL: Explain what this feature does, why users love it, and detail 3 key capabilities, benefits, or use cases across the 3 items (e.g. item 1: Core Functionality, item 2: Practical Benefit, item 3: Astrological Insight). Do not invent artificial mappings between Western zodiac signs and unrelated systems.
- TOPIC GUIDANCE: Craft a high-impact headline (5-120 chars) highlighting the feature (e.g. "${item.seedTopic || "Feature Spotlight: Daily Transits & Personalized Horoscope Guidance"}").`;

    case CONTENT_FORMATS.TOOL_OF_DAY:
      return `CONTENT FORMAT: TOOL OF THE DAY
- SPOTLIGHTED TOOL: "${item.title || "Compatibility Calculator"}" (Route: ${item.path || "/tools/compatibility"})
- TOOL UTILITY: ${item.utility || "Free instant astrological calculation and insights."}
- EDITORIAL GOAL: Make the tool immediately understandable, explain its real utility, encourage trying the tool, and detail 3 clear steps, key features, or useful use cases across the 3 items.
- TOPIC GUIDANCE: Craft an engaging headline (5-120 chars) highlighting the tool (e.g. "${item.seedTopic || "Tool of the Day: Free Astrological Compatibility Calculator"}").`;

    case CONTENT_FORMATS.GUIDE_DISCOVERY:
      return `CONTENT FORMAT: GUIDE DISCOVERY
- SPOTLIGHTED GUIDE: "${item.title || "The Big Three: Sun, Moon, and Rising Signs"}" (Route: ${item.path || "/articles/the-big-three-sun-moon-rising-signs"})
- KEY TAKEAWAY: ${item.takeaway || "Essential astrological knowledge and practical cosmic insights."}
- EDITORIAL GOAL: Introduce the guide's core concept, explain key takeaways, encourage reading the full article, and detail 3 core concepts or lessons from the guide across the 3 items.
- TOPIC GUIDANCE: Craft an engaging headline (5-120 chars) highlighting the guide (e.g. "${item.seedTopic || "Guide Discovery: Decoding Your Big Three — Sun, Moon, and Rising Signs"}").`;

    case CONTENT_FORMATS.DID_YOU_KNOW:
      return `CONTENT FORMAT: DID YOU KNOW?
- CORE THEME: ${item.theme || "Astrological Nuance & Cosmic Insight"} (Relevant Route: ${item.path || "/articles/the-big-three-sun-moon-rising-signs"})
- EDITORIAL GOAL: Present 3 fascinating educational astrology facts or chart nuances across the 3 items, framed responsibly as astrological interpretation (never as scientific certainty).
- TOPIC GUIDANCE: Craft a curiosity-inducing headline (5-120 chars) starting with or featuring 'Did You Know?' (e.g. "${item.seedTopic || "Did You Know? The Hidden Difference Between Your Sun and Moon Signs"}").`;

    case CONTENT_FORMATS.QUESTION_OF_DAY:
      return `CONTENT FORMAT: QUESTION OF THE DAY
- CORE QUESTION: "${item.question || item.seedTopic || "How does your Rising sign influence first impressions?"}" (Relevant Route: ${item.path || "/features/ascendant"})
- EDITORIAL GOAL: Pose an engaging astrology question and structure a clear, insightful 3-part answer across the 3 items.
- TOPIC GUIDANCE: Craft a headline (5-120 chars) featuring 'Question of the Day:' (e.g. "${item.seedTopic || "Question of the Day: How Does Your Ascendant Sign Shape First Impressions?"}").`;

    case CONTENT_FORMATS.COMPATIBILITY_INSIGHT:
      return `CONTENT FORMAT: COMPATIBILITY INSIGHT
- CORE THEME: ${item.theme || "Relationship Dynamics & Synastry"} (Relevant Route: ${item.path || "/tools/compatibility"})
- EDITORIAL GOAL: Discuss romantic, emotional, or intellectual connection using nuanced astrological terms ("often associated with", "may be drawn to"). Avoid deterministic guarantees. Detail 3 relationship dynamics, elemental pairings, or compatibility principles across the 3 items.
- TOPIC GUIDANCE: Craft an engaging compatibility headline (5-120 chars, e.g. "${item.seedTopic || "Compatibility Insight: When Deep Emotional Chemistry Meets Shared Ambition"}").`;

    case CONTENT_FORMATS.AI_ASTROLOGY:
      return `CONTENT FORMAT: AI ASTROLOGY
- CORE USE-CASE: ${item.theme || "Personalized Astrological Analysis"} (Relevant Route: ${item.path || "/tools/birth-chart"})
- EDITORIAL GOAL: Demonstrate concrete, practical ways AI Zodiac helps users explore charts, transits, or synastry without claiming user-specific birth data in public posts. Detail 3 real AI analytical capabilities or practical use cases across the 3 items.
- TOPIC GUIDANCE: Craft an engaging headline (5-120 chars) highlighting the AI use-case (e.g. "${item.seedTopic || "AI Astrology: How AI Unlocks Hidden Layers in Your Natal Chart"}").`;

    case CONTENT_FORMATS.WEEKLY_DISCOVERY:
      return `CONTENT FORMAT: WEEKLY DISCOVERY
- CORE DISCOVERY: ${item.theme || "Cosmic Patterns & Astrological Observations"} (Relevant Route: ${item.path || "/articles/elemental-harmony-fire-earth-air-water"})
- EDITORIAL GOAL: Present an intriguing cosmic pattern, uncommon observation, or subtle chart connection broken into 3 discovery points across the 3 items.
- TOPIC GUIDANCE: Craft a fresh discovery headline (5-120 chars, e.g. "${item.seedTopic || "Weekly Discovery: Hidden Elemental Patterns That Influence Your Week"}").`;

    case CONTENT_FORMATS.THREE_ZODIAC_SIGNS:
    default:
      return `CONTENT FORMAT: 3 ZODIAC SIGNS...
- CORE THEME: ${item.theme || "Zodiac Strengths & Archetypes"} (Relevant Route: ${item.path || "/tools/zodiac-sign"})
- EDITORIAL GOAL: Spotlight exactly 3 Western zodiac signs that best exemplify a specific admirable trait, dynamic, or behavioral distinction.
- TOPIC GUIDANCE: The topic MUST clearly follow the 3-sign framing (5-120 chars, e.g. "3 Zodiac Signs That Value Loyalty and Integrity Most" or "3 Zodiac Signs That Are the Ultimate Midnight Thinkers").`;
  }
}

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

  const formatInstructions = getFormatEditorialInstructions(strategy);
  const isThreeSignsFormat = (strategy.format === CONTENT_FORMATS.THREE_ZODIAC_SIGNS);

  return `You are the master astrological content editor for the mobile app "AI Zodiac".
Generate engaging, insightful, and creative social media content for ${strategy.dayName}, ${publishDate}.

${formatInstructions}

THEME GUIDANCE: ${strategy.themeDescription}
FOCUS INSTRUCTIONS: ${strategy.focusPrompt}
SEED INSPIRATIONS (use as inspiration or craft an original high-impact headline matching this exact format and theme):
${strategy.seedTopics.map(t => `* ${t}`).join("\n")}
${recentTopicsText}
STRICT EDITORIAL AND COMPLIANCE RULES:
1. General astrology only. Never request, generate, or assume personal user profiles, personal birth data, or private user questions.
2. English language only.
3. 3-ITEM SCOPE CONSISTENCY (MANDATORY):
   - Every piece of content covers EXACTLY 3 structured items across its items array.
   - ${isThreeSignsFormat ? "For this 3-sign format, items MUST represent exactly 3 distinct Western zodiac signs." : "For this format, items represent 3 key capabilities, steps, takeaways, facts, or answer components."}
   - NEVER use scope-mismatch phrases such as "every zodiac", "all zodiac", "each zodiac", "every element", "all four elements", "each element", "all 12 signs", or "the entire zodiac".
   - All captions and descriptions must be semantically consistent with today's topic and exact 3 items.
4. topic: Catchy, high-impact headline (5-120 characters, under 60 chars preferred).
5. items: Exactly 3 items. Each item must have:
   - "sign": ${isThreeSignsFormat ? "A valid Western zodiac sign name (Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces)." : "A concise 1-3 word title or label for this item (e.g. 'The Sun', 'Step 01', 'Transit Synthesis', 'Core Benefit', 'Deep Intuition', etc., max 30 chars)."}
   - "headline": A punchy, creative 2-5 word sub-headline (max 45 chars). Must NOT equal or simply repeat the "sign" title.
   - "text": 2-3 compelling, punchy sentences (25-280 chars) describing this item.
6. NO duplicate item titles across items.
7. NO duplicate headlines or copy across items.
8. NO hashtags in the topic or item text.
9. Safety rules: No deterministic medical, legal, financial, or political advice. No guaranteed predictions presented as scientific fact. No sexual or vulgar content. No defamatory stereotypes.
10. Captions:
   - instagramCaption: 2-4 engaging sentences about today's topic, ending with 4-8 relevant hashtags (e.g. #astrology #zodiac #horoscope #aizodiac).
   - facebookCaption: 2-3 engaging sentences discussing today's topic, ending with a prompt to download AI Zodiac on Google Play.
   - pinterestTitle: Catchy search-friendly title (strictly under 100 characters).
   - pinterestDescription: Rich descriptive summary specifically about today's 3 items (strictly under 500 characters, no claims about all 12 signs or all elements).

OUTPUT: Respond ONLY with valid JSON matching the requested schema.`;
}

/**
 * Validates the raw creative AI output before deterministic backend assembly.
 * @param {object} creative - The parsed creative JSON from AI
 * @param {object} [options={}]
 * @param {string} [options.format] - Specific content format
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAiCreativeOutput(creative, options = {}) {
  const errors = [];

  if (!creative || typeof creative !== "object") {
    return { valid: false, errors: ["Creative output must be a non-null object"] };
  }

  const format = options.format || creative.format || CONTENT_FORMATS.THREE_ZODIAC_SIGNS;

  // 1. Topic
  if (!creative.topic || typeof creative.topic !== "string" || creative.topic.trim().length < 5) {
    errors.push("Missing or too short 'topic'");
  } else if (creative.topic.length > 120) {
    errors.push(`'topic' exceeds 120 characters (length: ${creative.topic.length})`);
  } else {
    // Check 3-sign list framing if format is three_zodiac_signs
    if (format === CONTENT_FORMATS.THREE_ZODIAC_SIGNS) {
      if (!/\b(?:3|three)\b/i.test(creative.topic)) {
        errors.push(`'topic' must describe a 3-sign selection (e.g. '3 Zodiac Signs That...'): received "${creative.topic}"`);
      }
    }

    // Check scope mismatch in topic
    const topicMismatch = checkScopeMismatch(creative.topic);
    if (topicMismatch) {
      errors.push(`'topic' contains forbidden scope-mismatch phrase: '${topicMismatch}'`);
    }

    const topicPlaceholder = checkPlaceholderContent(creative.topic);
    if (topicPlaceholder) {
      errors.push(`'topic' contains placeholder text: '${topicPlaceholder}'`);
    }

    const topicMeta = checkMetaLanguage(creative.topic);
    if (topicMeta) {
      errors.push(`'topic' contains forbidden meta/model language: '${topicMeta}'`);
    }
  }

  // 2. Items
  if (!Array.isArray(creative.items)) {
    errors.push("Missing 'items' array");
  } else {
    if (creative.items.length !== 3) {
      errors.push(`'items' count must be exactly 3, received ${creative.items.length}`);
    }

    const seenSigns = new Set();
    const seenHeadlines = new Set();
    creative.items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`Item at index ${idx} must be an object`);
        return;
      }

      if (!item.sign || typeof item.sign !== "string" || item.sign.trim().length === 0) {
        errors.push(`Item at index ${idx} missing 'sign'`);
      } else {
        const normSign = item.sign.trim();
        const capitalizedSign = normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase();

        if (format === CONTENT_FORMATS.THREE_ZODIAC_SIGNS) {
          if (!VALID_ZODIAC_SIGNS.has(capitalizedSign)) {
            errors.push(`Item at index ${idx} has invalid zodiac sign: '${item.sign}'`);
          } else if (seenSigns.has(capitalizedSign)) {
            errors.push(`Duplicate zodiac sign '${capitalizedSign}' found at item index ${idx}`);
          } else {
            seenSigns.add(capitalizedSign);
          }
        } else {
          if (normSign.length > 40) {
            errors.push(`Item at index ${idx} sign/title exceeds 40 characters (length: ${normSign.length})`);
          }
          if (seenSigns.has(normSign.toLowerCase())) {
            errors.push(`Duplicate item title '${normSign}' found at item index ${idx}`);
          } else {
            seenSigns.add(normSign.toLowerCase());
          }
        }
      }

      if (!item.headline || typeof item.headline !== "string" || item.headline.trim().length === 0) {
        errors.push(`Item at index ${idx} requires a non-empty 'headline'`);
      } else {
        const hl = item.headline.trim();
        if (hl.length > 45) {
          errors.push(`Item at index ${idx} headline exceeds 45 characters (length: ${hl.length})`);
        }
        if (item.sign && hl.toLowerCase() === item.sign.trim().toLowerCase()) {
          errors.push(`Item at index ${idx} headline must not equal sign name: '${hl}'`);
        }
        if (seenHeadlines.has(hl.toLowerCase())) {
          errors.push(`Duplicate headline '${hl}' at item index ${idx}`);
        } else {
          seenHeadlines.add(hl.toLowerCase());
        }
        const hlPlaceholder = checkPlaceholderContent(hl);
        if (hlPlaceholder) {
          errors.push(`Item at index ${idx} headline contains placeholder: '${hlPlaceholder}'`);
        }
        const hlMeta = checkMetaLanguage(hl);
        if (hlMeta) {
          errors.push(`Item at index ${idx} headline contains meta/model language: '${hlMeta}'`);
        }
      }

      if (!item.text || typeof item.text !== "string" || item.text.trim().length === 0) {
        errors.push(`Item at index ${idx} requires non-empty 'text'`);
      } else {
        const text = item.text.trim();
        if (text.length > 280) {
          errors.push(`Item at index ${idx} text exceeds 280 characters (length: ${text.length})`);
        }
        if (text.includes("#")) {
          errors.push(`Item at index ${idx} text must not contain hashtags`);
        }
        const bodyMismatch = checkScopeMismatch(text);
        if (bodyMismatch) {
          errors.push(`Item at index ${idx} text contains forbidden scope-mismatch phrase: '${bodyMismatch}'`);
        }
        const bodyPlaceholder = checkPlaceholderContent(text);
        if (bodyPlaceholder) {
          errors.push(`Item at index ${idx} text contains placeholder: '${bodyPlaceholder}'`);
        }
        const bodyMeta = checkMetaLanguage(text);
        if (bodyMeta) {
          errors.push(`Item at index ${idx} text contains meta/model language: '${bodyMeta}'`);
        }
      }
    });
  }

  // 3. Captions
  if (!creative.instagramCaption || typeof creative.instagramCaption !== "string" || creative.instagramCaption.trim().length === 0) {
    errors.push("Missing or empty 'instagramCaption'");
  } else {
    const igMismatch = checkScopeMismatch(creative.instagramCaption);
    if (igMismatch) {
      errors.push(`'instagramCaption' contains forbidden scope-mismatch phrase: '${igMismatch}'`);
    }
    const igMeta = checkMetaLanguage(creative.instagramCaption);
    if (igMeta) {
      errors.push(`'instagramCaption' contains meta language: '${igMeta}'`);
    }
  }

  if (!creative.facebookCaption || typeof creative.facebookCaption !== "string" || creative.facebookCaption.trim().length === 0) {
    errors.push("Missing or empty 'facebookCaption'");
  } else {
    const fbMismatch = checkScopeMismatch(creative.facebookCaption);
    if (fbMismatch) {
      errors.push(`'facebookCaption' contains forbidden scope-mismatch phrase: '${fbMismatch}'`);
    }
    const fbMeta = checkMetaLanguage(creative.facebookCaption);
    if (fbMeta) {
      errors.push(`'facebookCaption' contains meta language: '${fbMeta}'`);
    }
  }

  if (!creative.pinterestTitle || typeof creative.pinterestTitle !== "string" || creative.pinterestTitle.trim().length === 0) {
    errors.push("Missing or empty 'pinterestTitle'");
  } else if (creative.pinterestTitle.length > 100) {
    errors.push(`'pinterestTitle' exceeds 100 characters (length: ${creative.pinterestTitle.length})`);
  } else {
    const pinTitleMismatch = checkScopeMismatch(creative.pinterestTitle);
    if (pinTitleMismatch) {
      errors.push(`'pinterestTitle' contains forbidden scope-mismatch phrase: '${pinTitleMismatch}'`);
    }
    const pinTitleMeta = checkMetaLanguage(creative.pinterestTitle);
    if (pinTitleMeta) {
      errors.push(`'pinterestTitle' contains meta language: '${pinTitleMeta}'`);
    }
  }

  if (!creative.pinterestDescription || typeof creative.pinterestDescription !== "string" || creative.pinterestDescription.trim().length === 0) {
    errors.push("Missing or empty 'pinterestDescription'");
  } else if (creative.pinterestDescription.length > 500) {
    errors.push(`'pinterestDescription' exceeds 500 characters (length: ${creative.pinterestDescription.length})`);
  } else {
    const pinDescMismatch = checkScopeMismatch(creative.pinterestDescription);
    if (pinDescMismatch) {
      errors.push(`'pinterestDescription' contains forbidden scope-mismatch phrase: '${pinDescMismatch}'`);
    }
    const pinDescMeta = checkMetaLanguage(creative.pinterestDescription);
    if (pinDescMeta) {
      errors.push(`'pinterestDescription' contains meta language: '${pinDescMeta}'`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Constructs the canonical 5-slide social content package from validated creative AI output
 * and deterministic backend parameters (contentId, publishDate, category, format, pinterestLink, slides).
 * @param {object} params
 * @param {object} params.creative - Validated creative content
 * @param {string} params.publishDate - Target date (YYYY-MM-DD)
 * @param {string} [params.category] - Rotation category
 * @param {string} [params.format] - Content format
 * @param {string} [params.destinationPath] - Override destination path
 * @returns {object} - Complete canonical social content package
 */
export function assembleCanonicalSocialContent({
  creative,
  publishDate,
  category = "personality",
  format = null,
  destinationPath = null,
}) {
  const normCategory = (category || "personality").trim().toLowerCase();
  const normFormat = format || (CONTENT_FORMAT_CYCLE.includes(normCategory) ? normCategory : "three_zodiac_signs");
  const contentId = `social-${publishDate}`;

  const resolvedPath = destinationPath || resolveWebsitePath({
    category: normCategory,
    format: normFormat,
    publishDate,
  });

  const facebookDestinationUrl = buildWebsiteDestinationUrl({
    path: resolvedPath,
    platform: "facebook",
    campaign: normCategory,
    contentId,
  });
  const instagramDestinationUrl = buildWebsiteDestinationUrl({
    path: resolvedPath,
    platform: "instagram",
    campaign: normCategory,
    contentId,
  });
  const pinterestDestinationUrl = buildWebsiteDestinationUrl({
    path: resolvedPath,
    platform: "pinterest",
    campaign: normCategory,
    contentId,
  });

  const formattedInstagramCaption = formatInstagramCaption({
    baseCaption: creative.instagramCaption,
  });

  const formattedFacebookCaption = formatFacebookCaption({
    baseCaption: creative.facebookCaption,
    websiteUrl: facebookDestinationUrl,
    playStoreUrl: FACEBOOK_TRACKING_PLAY_STORE_URL,
  });

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
      if (typeof item.headline !== "string" || item.headline.trim().length === 0) {
        throw new Error(`Cannot assemble feature slide for ${capitalizedSign || "unknown sign"}: headline is required`);
      }
      const rawHeadline = item.headline.trim();
      const cleanHeadline = rawHeadline.replace(/[.,;:!?]+$/, "").trim();
      return {
        type: "sign",
        sign: capitalizedSign,
        headline: cleanHeadline,
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
    format: normFormat,
    category: normCategory,
    topic: creative.topic.trim(),
    destinationPath: resolvedPath,
    destinationUrl: pinterestDestinationUrl,
    destinations: {
      facebook: facebookDestinationUrl,
      instagram: instagramDestinationUrl,
      pinterest: pinterestDestinationUrl,
    },
    slides,
    instagramCaption: formattedInstagramCaption,
    facebookCaption: formattedFacebookCaption,
    pinterestTitle: creative.pinterestTitle.trim(),
    pinterestDescription: creative.pinterestDescription.trim(),
    pinterestLink: pinterestDestinationUrl,
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
  } else {
    const topicMismatch = checkScopeMismatch(content.topic);
    if (topicMismatch) {
      errors.push(`'topic' contains forbidden scope-mismatch phrase: '${topicMismatch}'`);
    }
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

      const bodyMismatch = checkScopeMismatch(slide.body);
      if (bodyMismatch) {
        errors.push(`Slide at index ${idx} body contains forbidden scope-mismatch phrase: '${bodyMismatch}'`);
      }

      if (slide.type === "sign") {
        if (!slide.sign || typeof slide.sign !== "string") {
          errors.push(`Slide at index ${idx} has type 'sign' but missing 'sign' field`);
        } else {
          const normSign = slide.sign.trim();
          const capitalizedSign = normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase();
          const isThreeSignRequired = content.format === CONTENT_FORMATS.THREE_ZODIAC_SIGNS || (!content.format && content.category === "three_zodiac_signs");

          if (isThreeSignRequired) {
            if (!VALID_ZODIAC_SIGNS.has(capitalizedSign)) {
              errors.push(`Slide at index ${idx} has invalid zodiac sign: '${slide.sign}'`);
            } else if (seenSigns.has(capitalizedSign)) {
              errors.push(`Duplicate zodiac sign '${capitalizedSign}' found at slide index ${idx}`);
            } else {
              seenSigns.add(capitalizedSign);
            }
          } else {
            if (normSign.length > 40) {
              errors.push(`Slide at index ${idx} title exceeds 40 characters (length: ${normSign.length})`);
            }
            if (seenSigns.has(normSign.toLowerCase())) {
              errors.push(`Duplicate slide title '${normSign}' found at slide index ${idx}`);
            } else {
              seenSigns.add(normSign.toLowerCase());
            }
          }
        }
      }
    });
  }

  // 4. Captions & Scope Consistency
  if (!content.instagramCaption || typeof content.instagramCaption !== "string" || content.instagramCaption.trim().length === 0) {
    errors.push("Missing or empty 'instagramCaption'");
  } else {
    const igMismatch = checkScopeMismatch(content.instagramCaption);
    if (igMismatch) {
      errors.push(`'instagramCaption' contains forbidden scope-mismatch phrase: '${igMismatch}'`);
    }
  }

  if (!content.facebookCaption || typeof content.facebookCaption !== "string" || content.facebookCaption.trim().length === 0) {
    errors.push("Missing or empty 'facebookCaption'");
  } else {
    if (!content.facebookCaption.includes(DEFAULT_APP_PLAY_STORE_URL)) {
      errors.push(`'facebookCaption' must contain the mandatory Google Play link: '${DEFAULT_APP_PLAY_STORE_URL}'`);
    }
    const fbMismatch = checkScopeMismatch(content.facebookCaption);
    if (fbMismatch) {
      errors.push(`'facebookCaption' contains forbidden scope-mismatch phrase: '${fbMismatch}'`);
    }
  }

  if (!content.pinterestTitle || typeof content.pinterestTitle !== "string" || content.pinterestTitle.trim().length === 0) {
    errors.push("Missing or empty 'pinterestTitle'");
  } else if (content.pinterestTitle.length > 100) {
    errors.push(`'pinterestTitle' exceeds 100 characters (length: ${content.pinterestTitle.length})`);
  } else {
    const pinTitleMismatch = checkScopeMismatch(content.pinterestTitle);
    if (pinTitleMismatch) {
      errors.push(`'pinterestTitle' contains forbidden scope-mismatch phrase: '${pinTitleMismatch}'`);
    }
  }

  if (!content.pinterestDescription || typeof content.pinterestDescription !== "string" || content.pinterestDescription.trim().length === 0) {
    errors.push("Missing or empty 'pinterestDescription'");
  } else if (content.pinterestDescription.length > 500) {
    errors.push(`'pinterestDescription' exceeds 500 characters (length: ${content.pinterestDescription.length})`);
  } else {
    const pinDescMismatch = checkScopeMismatch(content.pinterestDescription);
    if (pinDescMismatch) {
      errors.push(`'pinterestDescription' contains forbidden scope-mismatch phrase: '${pinDescMismatch}'`);
    }
  }

  if (!content.pinterestLink || typeof content.pinterestLink !== "string" || !/^https?:\/\//i.test(content.pinterestLink.trim())) {
    errors.push(`Invalid 'pinterestLink': '${content.pinterestLink}'`);
  } else {
    const pinVal = validateWebsiteDestinationUrl(content.pinterestLink, { expectedPlatform: "pinterest" });
    if (!pinVal.valid && content.pinterestLink !== DEFAULT_APP_PLAY_STORE_URL) {
      errors.push(...pinVal.errors);
    }
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
        const creativeValidation = validateAiCreativeOutput(parsed, { format: strategy.format });
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
          format: strategy.format,
          destinationPath: strategy.defaultDestinationPath,
        });
      } else if (parsed.slides && Array.isArray(parsed.slides)) {
        // Backward-compatible direct canonical object from tests
        parsed.publishDate = publishDate;
        parsed.contentId = parsed.contentId || `social-${publishDate}`;
        parsed.category = parsed.category || strategy.category;
        parsed.format = parsed.format || strategy.format;
        if (!parsed.destinationPath) {
          parsed.destinationPath = strategy.defaultDestinationPath || resolveWebsitePath({ category: parsed.category, format: parsed.format, publishDate });
        }
        if (!parsed.destinationUrl) {
          parsed.destinationUrl = buildWebsiteDestinationUrl({
            path: parsed.destinationPath,
            platform: "pinterest",
            campaign: parsed.category,
            contentId: parsed.contentId,
          });
        }
        if (!parsed.destinations) {
          parsed.destinations = {
            facebook: buildWebsiteDestinationUrl({ path: parsed.destinationPath, platform: "facebook", campaign: parsed.category, contentId: parsed.contentId }),
            instagram: buildWebsiteDestinationUrl({ path: parsed.destinationPath, platform: "instagram", campaign: parsed.category, contentId: parsed.contentId }),
            pinterest: parsed.destinationUrl,
          };
        }
        parsed.pinterestLink = parsed.pinterestLink || parsed.destinations.pinterest;
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
