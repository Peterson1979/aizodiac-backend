// lib/social/content/topicRotation.js
import { getDateInTimeZone } from "../contentManifest.js";

/**
 * All 9 Supported Social Content Formats (Rotation V2)
 */
export const CONTENT_FORMATS = Object.freeze({
  THREE_ZODIAC_SIGNS: "three_zodiac_signs",
  FEATURE_SPOTLIGHT: "feature_spotlight",
  TOOL_OF_DAY: "tool_of_day",
  GUIDE_DISCOVERY: "guide_discovery",
  COMPATIBILITY_INSIGHT: "compatibility_insight",
  AI_ASTROLOGY: "ai_astrology",
  DID_YOU_KNOW: "did_you_know",
  QUESTION_OF_DAY: "question_of_day",
  WEEKLY_DISCOVERY: "weekly_discovery",
});

/**
 * Deterministic 9-Day Content-Type Cycle
 */
export const CONTENT_FORMAT_CYCLE = Object.freeze([
  CONTENT_FORMATS.THREE_ZODIAC_SIGNS,    // Day 1
  CONTENT_FORMATS.FEATURE_SPOTLIGHT,     // Day 2
  CONTENT_FORMATS.TOOL_OF_DAY,           // Day 3
  CONTENT_FORMATS.GUIDE_DISCOVERY,       // Day 4
  CONTENT_FORMATS.COMPATIBILITY_INSIGHT, // Day 5
  CONTENT_FORMATS.AI_ASTROLOGY,          // Day 6
  CONTENT_FORMATS.DID_YOU_KNOW,          // Day 7
  CONTENT_FORMATS.QUESTION_OF_DAY,       // Day 8
  CONTENT_FORMATS.WEEKLY_DISCOVERY,      // Day 9
]);

/**
 * 1. Feature Spotlight Catalog (8 real website features)
 */
export const FEATURE_SPOTLIGHT_CATALOG = Object.freeze([
  {
    key: "personal_horoscope",
    path: "/features/personal-horoscope",
    title: "Personal Horoscope",
    headline: "Your Daily Astrological Forecast",
    featureSummary: "AI-generated daily transit insights tailored to your exact birth placements and planetary movements.",
    seedTopic: "Feature Spotlight: Daily Transits & Personalized Horoscope Guidance",
  },
  {
    key: "ascendant",
    path: "/features/ascendant",
    title: "Ascendant & Rising Sign",
    headline: "Unlocking Your Cosmic Mask",
    featureSummary: "Calculates and decodes how your rising sign shapes first impressions, outer persona, and life trajectory.",
    seedTopic: "Feature Spotlight: How Your Rising Sign Shapes First Impressions",
  },
  {
    key: "zodiac_traits",
    path: "/features/zodiac-traits",
    title: "Zodiac Core Traits",
    headline: "Deep Personality Architecture",
    featureSummary: "Comprehensive breakdowns of elemental traits, ruling planets, modulations, and shadow traits for all 12 signs.",
    seedTopic: "Feature Spotlight: Exploring Core Strengths and Hidden Shadow Traits",
  },
  {
    key: "love_compatibility",
    path: "/features/love-compatibility",
    title: "Love Compatibility",
    headline: "Synastry Chemistry & Dynamics",
    featureSummary: "Multi-dimensional relationship synastry analyzing emotional harmony, communication style, and long-term synergy.",
    seedTopic: "Feature Spotlight: Multi-Dimensional Relationship & Synastry Analysis",
  },
  {
    key: "ask_ai",
    path: "/features/ask-ai",
    title: "Ask AI Astrologer",
    headline: "Instant Astrological Answers",
    featureSummary: "Interactive AI astrology chat for immediate answers to personal birth chart, synastry, and transit questions.",
    seedTopic: "Feature Spotlight: Real-Time Astrological Q&A with AI Astrologer",
  },
  {
    key: "numerology",
    path: "/features/numerology",
    title: "Numerology Insights",
    headline: "Life Path & Cosmic Numbers",
    featureSummary: "Deciphers life path numbers, destiny vibrations, and numerological synergies alongside your zodiac blueprint.",
    seedTopic: "Feature Spotlight: Unveiling Your Life Path & Vibrational Numbers",
  },
  {
    key: "chinese_zodiac",
    path: "/features/chinese-zodiac",
    title: "Chinese Zodiac & Elements",
    headline: "Eastern Astrology Wisdom",
    featureSummary: "Explores Eastern lunar animals, yin/yang balances, and 5-element cycles for a complete astrological perspective.",
    seedTopic: "Feature Spotlight: Eastern Animal Signs and Elemental Cycles",
  },
  {
    key: "personal_calendar",
    path: "/features/personal-calendar",
    title: "Personal Astrology Calendar",
    headline: "Cosmic Timing & Key Transits",
    featureSummary: "Tracks upcoming lunar phases, planetary retrogrades, and high-energy days customized to your chart.",
    seedTopic: "Feature Spotlight: Navigating High-Energy Days and Lunar Phases",
  },
]);

/**
 * 2. Tool of the Day Catalog (4 free interactive tools)
 */
export const TOOL_OF_DAY_CATALOG = Object.freeze([
  {
    key: "zodiac_sign_finder",
    path: "/tools/zodiac-sign",
    title: "Zodiac Sign Finder",
    utility: "Instant date-of-birth zodiac calculator providing element, modality, and ruling planet insights in seconds.",
    seedTopic: "Tool of the Day: Free Instant Zodiac Sign & Element Finder",
  },
  {
    key: "compatibility_calculator",
    path: "/tools/compatibility",
    title: "Compatibility Calculator",
    utility: "Interactive 2-sign compatibility tool delivering instant harmony scores and elemental dynamics.",
    seedTopic: "Tool of the Day: Free Astrological Compatibility Calculator",
  },
  {
    key: "birth_chart_preview",
    path: "/tools/birth-chart",
    title: "Birth Chart Preview",
    utility: "Instant natal wheel preview visualizing Sun, Moon, and Ascendant positions with key planetary house placements.",
    seedTopic: "Tool of the Day: Free Natal Chart Wheel & Big Three Preview",
  },
  {
    key: "ask_ai_tool",
    path: "/ask-ai",
    title: "Ask AI Astrologer",
    utility: "Direct conversational AI tool to ask any astrology, transit, or compatibility question for instant clarity.",
    seedTopic: "Tool of the Day: Conversational AI Astrology Assistant",
  },
]);

/**
 * 3. Guide Discovery Catalog (12 real website articles)
 */
export const GUIDE_DISCOVERY_CATALOG = Object.freeze([
  {
    path: "/articles/astrology-and-communication-mercury-placements",
    title: "Astrology & Communication: Mercury Placements",
    takeaway: "Discover how your Mercury sign governs mental processing, speech rhythms, and debate styles.",
    seedTopic: "Guide Discovery: How Mercury Shapes Your Everyday Communication Style",
  },
  {
    path: "/articles/astrology-basics-how-to-read-birth-chart",
    title: "Astrology Basics: How to Read a Birth Chart",
    takeaway: "Learn the fundamentals of reading natal charts, planets, signs, and house divisions.",
    seedTopic: "Guide Discovery: A Beginner's Blueprint to Reading Your Birth Chart",
  },
  {
    path: "/articles/elemental-harmony-fire-earth-air-water",
    title: "Elemental Harmony: Fire, Earth, Air, and Water",
    takeaway: "Understand how the four elements create natural balance, chemistry, and tension in relationships.",
    seedTopic: "Guide Discovery: The Four Elements and Their Powerful Cosmic Chemistry",
  },
  {
    path: "/articles/guide-to-the-12-astrological-houses",
    title: "A Guide to the 12 Astrological Houses",
    takeaway: "Explore what each of the 12 astrological houses represents, from self-identity to career and spirituality.",
    seedTopic: "Guide Discovery: Navigating the 12 Houses of Your Natal Chart",
  },
  {
    path: "/articles/how-ai-creates-personalized-astrology-insights",
    title: "How AI Creates Personalized Astrology Insights",
    takeaway: "Learn how advanced AI synthesizes complex multi-planetary transits into clear, actionable daily guidance.",
    seedTopic: "Guide Discovery: How AI Modernizes Ancient Astrological Chart Reading",
  },
  {
    path: "/articles/questions-to-ask-an-ai-astrologer",
    title: "Top Questions to Ask an AI Astrologer",
    takeaway: "Get inspired with powerful prompts to uncover deeper synastry, career timing, and personal growth paths.",
    seedTopic: "Guide Discovery: The Best Questions to Ask an AI Astrologer for Deep Insights",
  },
  {
    path: "/articles/the-big-three-sun-moon-rising-signs",
    title: "The Big Three: Sun, Moon, and Rising Signs",
    takeaway: "Unpack the core triad of your astrological identity: core self (Sun), emotional core (Moon), and outer persona (Rising).",
    seedTopic: "Guide Discovery: Decoding Your Big Three — Sun, Moon, and Rising Signs",
  },
  {
    path: "/articles/understanding-relationship-patterns-through-astrology",
    title: "Understanding Relationship Patterns Through Astrology",
    takeaway: "Discover how Venus, Mars, and the 7th house reveal recurring relationship habits and attachment patterns.",
    seedTopic: "Guide Discovery: Uncovering Recurring Relationship Patterns with Astrology",
  },
  {
    path: "/articles/understanding-zodiac-personality-patterns",
    title: "Understanding Zodiac Personality Patterns",
    takeaway: "Explore the psychological archetypes, modalities, and polarities that shape distinct zodiac behaviors.",
    seedTopic: "Guide Discovery: Why Zodiac Modalities and Polarities Define Your Behavior",
  },
  {
    path: "/articles/what-is-a-birth-chart",
    title: "What Is a Birth Chart?",
    takeaway: "A complete snapshot of the sky at your exact moment of birth that acts as your personalized cosmic fingerprint.",
    seedTopic: "Guide Discovery: What Your Natal Chart Really Reveals About Your Blueprint",
  },
  {
    path: "/articles/zodiac-compatibility-beyond-sun-signs",
    title: "Zodiac Compatibility Beyond Sun Signs",
    takeaway: "Why evaluating Moon, Venus, and Mars placements is essential for genuine astrological synastry.",
    seedTopic: "Guide Discovery: Why True Compatibility Goes Far Beyond Just Sun Signs",
  },
  {
    path: "/articles/zodiac-signs-conflict-resolution-styles",
    title: "Zodiac Signs & Conflict Resolution Styles",
    takeaway: "How fire, earth, air, and water signs de-escalate tension, communicate boundaries, and reconcile during conflict.",
    seedTopic: "Guide Discovery: How Different Zodiac Archetypes Handle Conflict & Reconciliation",
  },
]);

/**
 * 4. Did You Know? Catalog (Cosmic Nuances & Educational Insights)
 */
export const DID_YOU_KNOW_CATALOG = Object.freeze([
  {
    path: "/articles/the-big-three-sun-moon-rising-signs",
    theme: "Sun vs Moon vs Rising Nuances",
    seedTopic: "Did You Know? The Hidden Difference Between Your Sun and Moon Signs",
  },
  {
    path: "/articles/guide-to-the-12-astrological-houses",
    theme: "Astrological Houses and Chart Rulers",
    seedTopic: "Did You Know? Your Chart Ruler Governs Your Entire Astrological Path",
  },
  {
    path: "/articles/elemental-harmony-fire-earth-air-water",
    theme: "Triplicities and Elemental Polarities",
    seedTopic: "Did You Know? How Zodiac Element Triplicities Create Instant Rapport",
  },
  {
    path: "/articles/astrology-and-communication-mercury-placements",
    theme: "Mercury Retrogrades & Mental Wiring",
    seedTopic: "Did You Know? Why Mercury Placements Dictate Decision-Making Speed",
  },
  {
    path: "/articles/understanding-zodiac-personality-patterns",
    theme: "Cardinal, Fixed, and Mutable Modalities",
    seedTopic: "Did You Know? Modalities Explain Why Signs of the Same Element Act Differently",
  },
  {
    path: "/tools/compatibility",
    theme: "Synastry Chemistry & Aspects",
    seedTopic: "Did You Know? Opposite Zodiac Signs Share the Strongest Natural Magnetism",
  },
]);

/**
 * 5. Question of the Day Catalog (Thought-Provoking Astrology Inquiries)
 */
export const QUESTION_OF_DAY_CATALOG = Object.freeze([
  {
    path: "/tools/compatibility",
    question: "Which zodiac signs value intellectual connection most in love?",
    seedTopic: "Question of the Day: Which Zodiac Signs Crave Intellectual Romance Most?",
  },
  {
    path: "/features/ascendant",
    question: "How does your Rising sign influence first impressions?",
    seedTopic: "Question of the Day: How Does Your Ascendant Sign Shape First Impressions?",
  },
  {
    path: "/articles/zodiac-compatibility-beyond-sun-signs",
    question: "Can two completely opposite zodiac signs build long-term harmony?",
    seedTopic: "Question of the Day: Can Opposite Zodiac Signs Create Lasting Harmony?",
  },
  {
    path: "/articles/the-big-three-sun-moon-rising-signs",
    question: "What does your Moon sign reveal about your private emotional world?",
    seedTopic: "Question of the Day: What Does Your Moon Sign Reveal About Your Inner World?",
  },
  {
    path: "/articles/zodiac-signs-conflict-resolution-styles",
    question: "How do different zodiac signs handle difficult disagreements?",
    seedTopic: "Question of the Day: How Do Different Zodiac Signs Navigate Disagreements?",
  },
  {
    path: "/features/personal-horoscope",
    question: "How do current planetary transits affect daily focus and motivation?",
    seedTopic: "Question of the Day: How Do Daily Planetary Transits Impact Your Energy?",
  },
]);

/**
 * 6. 3 Zodiac Signs... Catalog (Classic Signature Topic Themes)
 */
export const THREE_ZODIAC_SIGNS_CATALOG = Object.freeze([
  {
    path: "/tools/zodiac-sign",
    theme: "Personality & Core Strengths",
    seedTopic: "3 Zodiac Signs That Value Loyalty and Integrity Most",
  },
  {
    path: "/tools/compatibility",
    theme: "Love & Deep Connection",
    seedTopic: "3 Zodiac Signs That Seek Deep Intellectual and Emotional Romance",
  },
  {
    path: "/features/zodiac-traits",
    theme: "Quiet Poise & Inner Strength",
    seedTopic: "3 Zodiac Signs That Handle Pressure with Quiet Poise",
  },
  {
    path: "/articles/understanding-zodiac-personality-patterns",
    theme: "Intuition & Subconscious Wisdom",
    seedTopic: "3 Zodiac Signs with Unmatched Instinctive Intuition",
  },
  {
    path: "/tools/zodiac-sign",
    theme: "Spontaneous Energy & Adventure",
    seedTopic: "3 Zodiac Signs Most Likely to Plan a Spontaneous Adventure",
  },
  {
    path: "/articles/zodiac-signs-conflict-resolution-styles",
    theme: "Complex Psychology & Boundary Setting",
    seedTopic: "3 Zodiac Signs with the Strongest Instinctive Boundaries",
  },
]);

/**
 * 7. Compatibility Insight Catalog (Synastry & Relationship Dynamics)
 */
export const COMPATIBILITY_CATALOG = Object.freeze([
  {
    path: "/tools/compatibility",
    theme: "Emotional and Mental Chemistry",
    seedTopic: "Compatibility Insight: When Deep Emotional Chemistry Meets Shared Ambition",
  },
  {
    path: "/features/love-compatibility",
    theme: "Complementary Elemental Pairings",
    seedTopic: "Compatibility Insight: Why Earth and Water Signs Build Rock-Solid Trust",
  },
  {
    path: "/articles/zodiac-compatibility-beyond-sun-signs",
    theme: "Communication Synergy in Relationships",
    seedTopic: "Compatibility Insight: The Power of Harmonious Mercury Placements in Love",
  },
  {
    path: "/articles/understanding-relationship-patterns-through-astrology",
    theme: "Navigating Relationship Rhythms",
    seedTopic: "Compatibility Insight: Balancing Spontaneity and Security in Relationships",
  },
  {
    path: "/tools/compatibility",
    theme: "Opposites Attract Dynamics",
    seedTopic: "Compatibility Insight: Why Sister Signs Often Form Powerful Cosmic Bonds",
  },
]);

/**
 * 8. AI Astrology Catalog (Demonstrating AI Zodiac in Action)
 */
export const AI_ASTROLOGY_CATALOG = Object.freeze([
  {
    path: "/tools/birth-chart",
    theme: "Decoding Natal Wheels with AI",
    seedTopic: "AI Astrology: How AI Unlocks Hidden Layers in Your Natal Chart",
  },
  {
    path: "/features/personal-horoscope",
    theme: "Real-Time Planetary Transit Synthesis",
    seedTopic: "AI Astrology: Translating Complex Planetary Transits into Daily Guidance",
  },
  {
    path: "/features/love-compatibility",
    theme: "Multi-Factor Synastry Scoring",
    seedTopic: "AI Astrology: Exploring Multi-Dimensional Synastry Beyond Sun Signs",
  },
  {
    path: "/ask-ai",
    theme: "Instant Astrological Answers",
    seedTopic: "AI Astrology: Asking Real-Time Cosmic Questions to Your AI Astrologer",
  },
  {
    path: "/articles/how-ai-creates-personalized-astrology-insights",
    theme: "Precision Astrology for Modern Life",
    seedTopic: "AI Astrology: Modernizing Ancient Wisdom with Tailored AI Precision",
  },
]);

/**
 * 9. Weekly Discovery Catalog (Flexible Curiosity & Cosmic Patterns)
 */
export const WEEKLY_DISCOVERY_CATALOG = Object.freeze([
  {
    path: "/articles/elemental-harmony-fire-earth-air-water",
    theme: "Cosmic Pattern Recognition",
    seedTopic: "Weekly Discovery: Hidden Elemental Patterns That Influence Your Week",
  },
  {
    path: "/articles/understanding-zodiac-personality-patterns",
    theme: "Misunderstood Zodiac Archetypes",
    seedTopic: "Weekly Discovery: The Most Commonly Misunderstood Zodiac Strengths",
  },
  {
    path: "/features/zodiac-traits",
    theme: "Curiosity & Astrological Nuances",
    seedTopic: "Weekly Discovery: 3 Subtle Astrological Traits People Often Overlook",
  },
  {
    path: "/features/chinese-zodiac",
    theme: "East-West Astrological Interplay",
    seedTopic: "Weekly Discovery: How Eastern Animal Signs Complement Your Western Sun",
  },
  {
    path: "/articles/guide-to-the-12-astrological-houses",
    theme: "The Magic of the Angular Houses",
    seedTopic: "Weekly Discovery: Why the 1st, 4th, 7th, and 10th Houses Drive Major Life Shifts",
  },
]);

/**
 * Content Format Definitions Map
 */
export const CONTENT_FORMAT_DEFINITIONS = Object.freeze({
  [CONTENT_FORMATS.THREE_ZODIAC_SIGNS]: {
    formatKey: CONTENT_FORMATS.THREE_ZODIAC_SIGNS,
    formatTitle: "3 Zodiac Signs...",
    categoryTitle: "Top 3 Zodiac Signs",
    formatLabel: "Top 3 Zodiac Signs",
    themeDescription: "Signature strengths, distinctive archetypes, and top 3 sign spotlights.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that best exemplify a specific admirable trait, dynamic, or behavioral distinction. The topic MUST clearly follow the 3-sign framing (e.g. '3 Zodiac Signs That...').",
    catalog: THREE_ZODIAC_SIGNS_CATALOG,
    defaultPath: "/tools/zodiac-sign",
  },
  [CONTENT_FORMATS.FEATURE_SPOTLIGHT]: {
    formatKey: CONTENT_FORMATS.FEATURE_SPOTLIGHT,
    formatTitle: "Feature Spotlight",
    categoryTitle: "Feature Spotlight",
    formatLabel: "Feature Spotlight",
    themeDescription: "Promote a specific AI Zodiac feature and illustrate its key capabilities and use cases.",
    focusPrompt: "Spotlight a specific AI Zodiac feature. Explain what the feature does, its key capabilities, and user utility across 3 items.",
    catalog: FEATURE_SPOTLIGHT_CATALOG,
    defaultPath: "/features/personal-horoscope",
  },
  [CONTENT_FORMATS.TOOL_OF_DAY]: {
    formatKey: CONTENT_FORMATS.TOOL_OF_DAY,
    formatTitle: "Tool of the Day",
    categoryTitle: "Tool of the Day",
    formatLabel: "Tool of the Day",
    themeDescription: "Promote a free interactive tool on the AI Zodiac website with clear user utility and call-to-action.",
    focusPrompt: "Highlight a free website tool on AI Zodiac. Explain its immediate utility and encourage trying it across 3 items.",
    catalog: TOOL_OF_DAY_CATALOG,
    defaultPath: "/tools/zodiac-sign",
  },
  [CONTENT_FORMATS.GUIDE_DISCOVERY]: {
    formatKey: CONTENT_FORMATS.GUIDE_DISCOVERY,
    formatTitle: "Guide Discovery",
    categoryTitle: "Guide Discovery",
    formatLabel: "Guide Discovery",
    themeDescription: "Promote a deep-dive educational article from the AI Zodiac website catalog with actionable takeaways.",
    focusPrompt: "Promote an existing article from the website catalog. Provide an intriguing takeaway and encourage reading the guide across 3 items.",
    catalog: GUIDE_DISCOVERY_CATALOG,
    defaultPath: "/articles/the-big-three-sun-moon-rising-signs",
  },
  [CONTENT_FORMATS.COMPATIBILITY_INSIGHT]: {
    formatKey: CONTENT_FORMATS.COMPATIBILITY_INSIGHT,
    formatTitle: "Compatibility Insight",
    categoryTitle: "Compatibility Insight",
    formatLabel: "Compatibility Insight",
    themeDescription: "Relationship, chemistry, synastry, and emotional connection framed responsibly with astrological language.",
    focusPrompt: "Explore relationship and compatibility dynamics using nuanced astrological terms ('often associated with', 'may be drawn to') across 3 items.",
    catalog: COMPATIBILITY_CATALOG,
    defaultPath: "/tools/compatibility",
  },
  [CONTENT_FORMATS.AI_ASTROLOGY]: {
    formatKey: CONTENT_FORMATS.AI_ASTROLOGY,
    formatTitle: "AI Astrology",
    categoryTitle: "AI Astrology",
    formatLabel: "AI Astrology",
    themeDescription: "Demonstrate concrete, practical use-cases of AI Zodiac in interpreting astrological placements and personal questions.",
    focusPrompt: "Demonstrate concrete use-cases of AI Zodiac across 3 items.",
    catalog: AI_ASTROLOGY_CATALOG,
    defaultPath: "/tools/birth-chart",
  },
  [CONTENT_FORMATS.DID_YOU_KNOW]: {
    formatKey: CONTENT_FORMATS.DID_YOU_KNOW,
    formatTitle: "Did You Know",
    categoryTitle: "Did You Know",
    formatLabel: "Did You Know",
    themeDescription: "Short educational zodiac/astrology nuances, cosmic curiosities, and chart concepts.",
    focusPrompt: "Present an intriguing educational astrological nuance or chart concept framed responsibly across 3 items.",
    catalog: DID_YOU_KNOW_CATALOG,
    defaultPath: "/articles/the-big-three-sun-moon-rising-signs",
  },
  [CONTENT_FORMATS.QUESTION_OF_DAY]: {
    formatKey: CONTENT_FORMATS.QUESTION_OF_DAY,
    formatTitle: "Question of the Day",
    categoryTitle: "Question of the Day",
    formatLabel: "Question of the Day",
    themeDescription: "Thought-provoking astrology questions followed by concise, useful answers across zodiac archetypes.",
    focusPrompt: "Pose an engaging astrology question and provide concise answers across 3 items.",
    catalog: QUESTION_OF_DAY_CATALOG,
    defaultPath: "/tools/compatibility",
  },
  [CONTENT_FORMATS.WEEKLY_DISCOVERY]: {
    formatKey: CONTENT_FORMATS.WEEKLY_DISCOVERY,
    formatTitle: "Weekly Discovery",
    categoryTitle: "Weekly Discovery",
    formatLabel: "Weekly Discovery",
    themeDescription: "Curiosity-driven cosmic discoveries, surprising zodiac patterns, and fresh astrological comparisons.",
    focusPrompt: "Create a curiosity-driven cosmic discovery exploring subtle zodiac patterns or unusual connections across 3 items.",
    catalog: WEEKLY_DISCOVERY_CATALOG,
    defaultPath: "/articles/elemental-harmony-fire-earth-air-water",
  },
});

/**
 * Standard Display Labels for First Slide and Previews
 */
export const FORMAT_DISPLAY_LABELS = Object.freeze({
  [CONTENT_FORMATS.THREE_ZODIAC_SIGNS]: "Top 3 Zodiac Signs",
  [CONTENT_FORMATS.FEATURE_SPOTLIGHT]: "Feature Spotlight",
  [CONTENT_FORMATS.TOOL_OF_DAY]: "Tool of the Day",
  [CONTENT_FORMATS.GUIDE_DISCOVERY]: "Guide Discovery",
  [CONTENT_FORMATS.COMPATIBILITY_INSIGHT]: "Compatibility Insight",
  [CONTENT_FORMATS.AI_ASTROLOGY]: "AI Astrology",
  [CONTENT_FORMATS.DID_YOU_KNOW]: "Did You Know",
  [CONTENT_FORMATS.QUESTION_OF_DAY]: "Question of the Day",
  [CONTENT_FORMATS.WEEKLY_DISCOVERY]: "Weekly Discovery",
});

/**
 * Resolves the clean display label for a format or category.
 * @param {string} [format]
 * @param {string} [categoryTitle]
 * @param {string} [category]
 * @returns {string}
 */
export function getFormatDisplayLabel(format, categoryTitle = "", category = "") {
  if (format && FORMAT_DISPLAY_LABELS[format]) {
    return FORMAT_DISPLAY_LABELS[format];
  }
  if (category && FORMAT_DISPLAY_LABELS[category]) {
    return FORMAT_DISPLAY_LABELS[category];
  }
  if (categoryTitle && typeof categoryTitle === "string" && categoryTitle.trim()) {
    const cleaned = categoryTitle.split("/")[0].replace(/•.*$/, "").trim();
    if (cleaned) return cleaned;
  }
  return "Top 3 Zodiac Signs";
}

/**
 * Strips redundant format-name prefixes from the main carousel headline.
 * E.g., "Tool of the Day: Conversational AI..." -> "Conversational AI..."
 * Does not strip from "three_zodiac_signs" where "3 Zodiac Signs..." is the core topic.
 * @param {string} headline
 * @param {string} [format]
 * @returns {string}
 */
export function stripFormatHeadlinePrefix(headline, format) {
  if (!headline || typeof headline !== "string") return "";
  let clean = headline.trim();

  // "three_zodiac_signs" retains its "3 Zodiac Signs That..." framing
  if (format === CONTENT_FORMATS.THREE_ZODIAC_SIGNS) {
    return clean;
  }

  const prefixPatterns = [
    /^feature\s+spotlight\s*[:\-–—]\s*/i,
    /^tool\s+of\s+the\s+day\s*[:\-–—]\s*/i,
    /^guide\s+discovery\s*[:\-–—]\s*/i,
    /^compatibility\s+insight\s*[:\-–—]\s*/i,
    /^did\s+you\s+know\s*\??\s*[:\-–—]?\s*/i,
    /^question\s+of\s+the\s+day\s*[:\-–—]\s*/i,
    /^ai\s+astrology\s*[:\-–—]\s*/i,
    /^weekly\s+discovery\s*[:\-–—]\s*/i,
  ];

  for (const pattern of prefixPatterns) {
    if (pattern.test(clean)) {
      const stripped = clean.replace(pattern, "").trim();
      if (stripped.length >= 3) {
        clean = stripped;
        break;
      }
    }
  }

  return clean;
}

/**
 * Calculates a deterministic date integer seed (epoch days since 2026-01-01).
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {number}
 */
export function getEpochDaysForDate(dateStr) {
  const [year, month, day] = (dateStr || "2026-01-01").split("-").map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const baseUtc = Date.UTC(2026, 0, 1);
  return Math.floor((targetUtc - baseUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Resolves the deterministic 9-day format cycle index for a date.
 * @param {string} dateStr - Date string in YYYY-MM-DD
 * @returns {number} - 0 to 8
 */
export function getFormatIndexForDate(dateStr) {
  const epochDays = getEpochDaysForDate(dateStr);
  return ((epochDays % 9) + 9) % 9;
}

/**
 * Backward compatibility map for legacy 7-weekday rotation strategy
 */
export const ROTATION_STRATEGY = Object.freeze({
  0: {
    dayOfWeek: 0,
    dayName: "Sunday",
    category: "self_discovery",
    categoryTitle: "Self-Discovery & Reflection",
    themeDescription: "Deep personal growth, cosmic alignment, natal reflection, and AI Zodiac personalized insights CTA.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that excel at introspective personal growth, emotional self-discovery, or understanding their astrological blueprint.",
    seedTopics: [
      "3 Zodiac Signs with Unmatched Inner Intuition",
      "3 Zodiac Signs That Transform Through Reflection",
      "3 Signs Most in Tune with Their Emotional Blueprint",
      "3 Zodiac Signs with Deep Spiritual Wisdom",
      "3 Zodiac Signs That Inspire Authentic Growth",
      "3 Signs That Master Personal Transformation",
    ],
  },
  1: {
    dayOfWeek: 1,
    dayName: "Monday",
    category: "daily_insight",
    categoryTitle: "Daily Zodiac Insight",
    themeDescription: "Fresh start cosmic energy, planetary motivation, weekly mindset, and focus for all zodiac archetypes.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that best channel fresh weekly momentum, purposeful focus, and new astrological beginnings.",
    seedTopics: [
      "3 Zodiac Signs Starting the Week with Powerful Momentum",
      "3 Zodiac Signs That Channel Cosmic Focus Best",
      "3 Signs Poised for Breakthroughs and New Beginnings",
      "3 Zodiac Signs Ready for a Fresh Weekly Reset",
      "3 Zodiac Signs with Unstoppable Monday Drive",
      "3 Signs That Turn Weekly Intentions into Reality",
    ],
  },
  2: {
    dayOfWeek: 2,
    dayName: "Tuesday",
    category: "personality",
    categoryTitle: "Personality / Top 3 Zodiac Signs",
    themeDescription: "Signature strengths, defining character traits, top 3 sign spotlights, and behavioral distinctions.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that best exemplify a specific admirable or intriguing personality trait (e.g. loyalty, intuition, resilience, eloquence, ambition).",
    seedTopics: [
      "3 Zodiac Signs That Value Loyalty Most",
      "3 Zodiac Signs with Unmatched Emotional Intuition",
      "3 Zodiac Signs That Thrive Under Pressure",
      "The 3 Most Naturally Charismatic Zodiac Signs",
      "3 Zodiac Signs with Unshakeable Mental Resilience",
      "3 Zodiac Signs That Make Unforgettable First Impressions",
    ],
  },
  3: {
    dayOfWeek: 3,
    dayName: "Wednesday",
    category: "love_compatibility",
    categoryTitle: "Love & Compatibility",
    themeDescription: "Elemental synastry, romantic chemistry, emotional bonding, and astrological harmony in relationships.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that best embody a specific romantic strength, compatibility nuance, or love language.",
    seedTopics: [
      "3 Zodiac Signs That Value Deep Emotional Connection",
      "3 Zodiac Signs That Love with Fierce Devotion",
      "3 Zodiac Signs That Seek Intellectual Romance",
      "3 Zodiac Signs Known for Instant Chemistry",
      "3 Zodiac Signs That Are Incredibly Supportive Partners",
      "3 Signs That Build Lifelong Romantic Harmony",
    ],
  },
  4: {
    dayOfWeek: 4,
    dayName: "Thursday",
    category: "zodiac_psychology",
    categoryTitle: "Zodiac Behavior & Psychology",
    themeDescription: "Subconscious drivers, shadow traits, boundary setting, decision-making, and emotional processing.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that illustrate an interesting psychological dynamic, boundary-setting style, or coping mechanism.",
    seedTopics: [
      "3 Zodiac Signs That Guard Their Inner World Fiercely",
      "3 Zodiac Signs That Handle Conflict with Quiet Poise",
      "3 Zodiac Signs with the Most Complex Inner Psychology",
      "3 Zodiac Signs That Process Emotions Beneath the Surface",
      "3 Zodiac Signs with the Strongest Instinctive Boundaries",
      "3 Signs That Adapt to Major Life Changes Best",
    ],
  },
  5: {
    dayOfWeek: 5,
    dayName: "Friday",
    category: "dating_relationships",
    categoryTitle: "Dating & Relationships",
    themeDescription: "Modern dating dynamics, green flags, courtship styles, relationship communication, and weekend connection.",
    focusPrompt: "Spotlight exactly 3 zodiac signs that stand out in modern dating, green flags, genuine connection, or courtship styles.",
    seedTopics: [
      "3 Zodiac Signs That Value Honesty Most in Dating",
      "3 Zodiac Signs with the Most Charming Courtship Style",
      "3 Signs That Value Deep First Date Conversations",
      "3 Zodiac Signs with High Standards for True Love",
      "3 Zodiac Signs That Value Emotional Consistency",
      "3 Signs That Give the Best Relationship Advice",
    ],
  },
  6: {
    dayOfWeek: 6,
    dayName: "Saturday",
    category: "fun_ranking",
    categoryTitle: "Fun / Curiosity / Ranking",
    themeDescription: "Engaging astrological rankings, lighthearted curiosity, weekend vibes, and relatable zodiac observations.",
    focusPrompt: "Create a fun, engaging ranking or archetype spotlight of exactly 3 zodiac signs (e.g. top 3 signs with spontaneous energy, best weekend hosts, deep midnight thinkers).",
    seedTopics: [
      "Top 3 Most Spontaneous Zodiac Signs for Weekend Adventures",
      "3 Zodiac Signs That Are the Ultimate Midnight Thinkers",
      "The 3 Most Naturally Witty Zodiac Signs",
      "The 3 Most Generous Hosts of the Zodiac",
      "3 Zodiac Signs Most Likely to Plan a Spontaneous Road Trip",
      "3 Zodiac Signs with an Uncanny Eye for Aesthetic Beauty",
    ],
  },
});

/**
 * Determines the controlled topic strategy for a given publication date and timezone.
 * Uses the deterministic 9-day content format cycle.
 * @param {string|Date} [dateInput] - Date string (YYYY-MM-DD) or Date instance
 * @param {string} [timeZone="UTC"] - Target timezone
 * @returns {object}
 */
export function getTopicStrategyForDate(dateInput, timeZone = "UTC") {
  const dateStr = typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? dateInput
    : getDateInTimeZone(dateInput || new Date(), timeZone);

  const [year, month, day] = dateStr.split("-").map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = targetDate.getUTCDay();
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // 1. Resolve 9-day rotation format
  const formatIndex = getFormatIndexForDate(dateStr);
  const formatKey = CONTENT_FORMAT_CYCLE[formatIndex];
  const definition = CONTENT_FORMAT_DEFINITIONS[formatKey] || CONTENT_FORMAT_DEFINITIONS[CONTENT_FORMATS.THREE_ZODIAC_SIGNS];

  // 2. Select specific catalog item deterministically
  const catalog = definition.catalog || [];
  const epochDays = getEpochDaysForDate(dateStr);
  const catalogItemIndex = catalog.length > 0 ? Math.abs(epochDays) % catalog.length : 0;
  const catalogItem = catalog[catalogItemIndex] || {};

  const seedTopics = catalog.map(item => item.seedTopic).filter(Boolean);

  return {
    publishDate: dateStr,
    dayOfWeek,
    dayName: dayNames[dayOfWeek],
    format: formatKey,
    formatTitle: definition.formatTitle,
    category: formatKey,
    categoryTitle: definition.categoryTitle,
    themeDescription: definition.themeDescription,
    focusPrompt: definition.focusPrompt,
    seedTopics: seedTopics.length > 0 ? seedTopics : [catalogItem.seedTopic || "Astrological Spotlight"],
    defaultDestinationPath: catalogItem.path || definition.defaultPath,
    catalogItem,
  };
}
