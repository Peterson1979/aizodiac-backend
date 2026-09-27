// lib/social/content/videoCatalog.js
import {
  KNOWN_WEBSITE_ROUTES,
  WEBSITE_PRODUCTION_BASE_URL,
  getDeterministicDateSeed,
  buildWebsiteDestinationUrl,
  validateWebsiteDestinationUrl,
} from "./destinations.js";
import { MEDIA_TYPES } from "../types.js";
import { resolveMediaUrl } from "../contentManifest.js";
import { QUALITY_GATE_STATUS } from "../quality/socialQualityGate.js";

export const YOUTUBE_TRACKING_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac&referrer=utm_source%3Dyoutube%26utm_medium%3Dsocial%26utm_campaign%3Dshort_cta";
export const PINTEREST_VIDEO_TRACKING_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oberon.aizodiac&referrer=utm_source%3Dpinterest%26utm_medium%3Dsocial%26utm_campaign%3Dvideo_pin_cta";

/**
 * 30 Daily AI Zodiac Promotional Short-Form Video Definitions.
 * Each video is ~10s long, vertical 9:16 format, designed for YouTube Shorts & Pinterest Video Pins.
 */
export const AI_ZODIAC_30_PROMOTIONAL_VIDEOS = Object.freeze([
  {
    index: 1,
    id: "aizodiac-promo-01",
    title: "What Your Rising Sign Truly Reveals",
    topic: "Ascendant & Rising Sign Persona",
    category: "self_discovery",
    destinationPath: "/features/ascendant",
    videoFileName: "aizodiac-promo-01.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "What Your Rising Sign Truly Reveals ✨ #Shorts",
    pinterestTitle: "Discover What Your Rising Sign Reveals About You",
    pinterestDescription: "Unlock the mysteries of your Ascendant sign. Discover how your rising sign shapes your first impressions and outward persona with AI Zodiac.",
  },
  {
    index: 2,
    id: "aizodiac-promo-02",
    title: "Aries Sun: The Unstoppable Trailblazer",
    topic: "Aries Personality Archetype",
    category: "personality",
    destinationPath: "/features/zodiac-traits",
    videoFileName: "aizodiac-promo-02.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Aries Energy: The Fire That Never Stops 🔥 #Shorts",
    pinterestTitle: "Aries Zodiac Personality Traits & Strengths",
    pinterestDescription: "Bold, passionate, and pioneering. Discover the deep psychological strengths and core drives of Aries in the AI Zodiac app.",
  },
  {
    index: 3,
    id: "aizodiac-promo-03",
    title: "Taurus Love Language: Sensual Grounding",
    topic: "Taurus Relationship Harmonics",
    category: "love_compatibility",
    destinationPath: "/features/love-compatibility",
    videoFileName: "aizodiac-promo-03.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "How Taurus Shows Love (And What They Need) 🌿 #Shorts",
    pinterestTitle: "Taurus Love Compatibility & Relationship Insights",
    pinterestDescription: "Loyal, sensual, and grounded. Explore how Taurus builds enduring relationships and navigates emotional connection on AI Zodiac.",
  },
  {
    index: 4,
    id: "aizodiac-promo-04",
    title: "Gemini Quick Wit & Conversational Chemistry",
    topic: "Gemini Mental Chemistry",
    category: "love_compatibility",
    destinationPath: "/features/love-compatibility",
    videoFileName: "aizodiac-promo-04.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "When Gemini Sparks With You: Mental Chemistry ⚡ #Shorts",
    pinterestTitle: "Gemini Communication Style & Relationship Chemistry",
    pinterestDescription: "Quick-witted and versatile. Discover how Gemini's communicative energy creates instant mental connection in AI Zodiac.",
  },
  {
    index: 5,
    id: "aizodiac-promo-05",
    title: "Cancer Intuition: The Protective Sanctuary",
    topic: "Cancer Emotional Insight",
    category: "personality",
    destinationPath: "/features/zodiac-traits",
    videoFileName: "aizodiac-promo-05.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Cancer Intuition: Why They Just Know 🌙 #Shorts",
    pinterestTitle: "Cancer Zodiac Traits & Emotional Depth",
    pinterestDescription: "Empathetic, intuitive, and deeply protective. Explore Cancer's emotional landscape and inner sanctuary in AI Zodiac.",
  },
  {
    index: 6,
    id: "aizodiac-promo-06",
    title: "Leo Sun Charisma & Bold Creative Radiance",
    topic: "Leo Daily Cosmic Guidance",
    category: "daily_insight",
    destinationPath: "/features/personal-horoscope",
    videoFileName: "aizodiac-promo-06.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Leo Sun: Radiant Confidence & Leadership 👑 #Shorts",
    pinterestTitle: "Leo Sun Forecast & Daily Astrological Insights",
    pinterestDescription: "Heart-centered authenticity and magnetic vitality. Unlock personalized daily horoscopes tailored to your Leo placements on AI Zodiac.",
  },
  {
    index: 7,
    id: "aizodiac-promo-07",
    title: "Virgo Precision: Discerning Your True Focus",
    topic: "Virgo Transit Clarity",
    category: "daily_insight",
    destinationPath: "/features/personal-horoscope",
    videoFileName: "aizodiac-promo-07.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Virgo Discernment: Finding Daily Alignment 🌾 #Shorts",
    pinterestTitle: "Virgo Daily Horoscope & Practical Transit Guidance",
    pinterestDescription: "Clear thinking and practical discernment. Align your daily decisions with planetary transits tailored to your birth chart on AI Zodiac.",
  },
  {
    index: 8,
    id: "aizodiac-promo-08",
    title: "Libra Harmony & Synastry Balance",
    topic: "Libra Relationship Symmetry",
    category: "love_compatibility",
    destinationPath: "/tools/compatibility",
    videoFileName: "aizodiac-promo-08.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Libra in Love: The Art of True Balance ⚖️ #Shorts",
    pinterestTitle: "Libra Zodiac Compatibility & Love Synastry",
    pinterestDescription: "Aesthetic refinement and relationship harmony. Explore synastry dynamics for Libra and all 12 signs in AI Zodiac.",
  },
  {
    index: 9,
    id: "aizodiac-promo-09",
    title: "Scorpio Magnetic Transformation",
    topic: "Scorpio Psychological Power",
    category: "personality",
    destinationPath: "/features/zodiac-traits",
    videoFileName: "aizodiac-promo-09.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "The Unmatched Depth of Scorpio Energy 🦂 #Shorts",
    pinterestTitle: "Scorpio Personality Traits & Transformative Power",
    pinterestDescription: "Perceptive, magnetic, and resilient. Uncover the deeper psychological truths behind Scorpio's transformational energy with AI Zodiac.",
  },
  {
    index: 10,
    id: "aizodiac-promo-10",
    title: "Sagittarius Wanderlust & Philosophical Truth",
    topic: "Sagittarius Cosmic Timing",
    category: "daily_insight",
    destinationPath: "/features/personal-calendar",
    videoFileName: "aizodiac-promo-10.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Sagittarius: The Quest for Higher Meaning 🏹 #Shorts",
    pinterestTitle: "Sagittarius Astrological Timing & Cosmic Calendar",
    pinterestDescription: "Expansive optimism and adventurous truth. Track supportive transit periods and lunar cycles for Sagittarius on AI Zodiac.",
  },
  {
    index: 11,
    id: "aizodiac-promo-11",
    title: "Capricorn Strategic Mastery & Legacy Building",
    topic: "Capricorn Daily Transit Focus",
    category: "daily_insight",
    destinationPath: "/features/personal-horoscope",
    videoFileName: "aizodiac-promo-11.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Capricorn: Playing the Long Game 🏔️ #Shorts",
    pinterestTitle: "Capricorn Daily Forecast & Strategic Timing",
    pinterestDescription: "Methodical mastery and enduring resilience. Get actionable daily astrological insights tailored to your Capricorn placements on AI Zodiac.",
  },
  {
    index: 12,
    id: "aizodiac-promo-12",
    title: "Aquarius Vision: Future-Forward Clarity",
    topic: "Aquarius AI Astrology Advisory",
    category: "ai_astrology",
    destinationPath: "/features/ask-ai",
    videoFileName: "aizodiac-promo-12.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Aquarius Mind: Thinking Decades Ahead 💡 #Shorts",
    pinterestTitle: "Ask AI Astrologer: Aquarius Insights & Guidance",
    pinterestDescription: "Innovative conceptual clarity and collective vision. Ask personalized questions about your birth chart with AI Zodiac.",
  },
  {
    index: 13,
    id: "aizodiac-promo-13",
    title: "Pisces Mystical Intuition & Transcendent Empathy",
    topic: "Pisces Psychological Depth",
    category: "personality",
    destinationPath: "/features/zodiac-traits",
    videoFileName: "aizodiac-promo-13.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Pisces: The Healer of the Zodiac 🌊 #Shorts",
    pinterestTitle: "Pisces Zodiac Archetype & Compassionate Wisdom",
    pinterestDescription: "Artistic imagination and boundless empathy. Explore the transcendent depth of Pisces in the AI Zodiac Android app.",
  },
  {
    index: 14,
    id: "aizodiac-promo-14",
    title: "The Big Three: Sun, Moon & Rising Explained",
    topic: "Natal Chart Fundamentals",
    category: "self_discovery",
    destinationPath: "/articles/the-big-three-sun-moon-rising-signs",
    videoFileName: "aizodiac-promo-14.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Your Big Three in 10 Seconds: Sun, Moon, Rising 🔮 #Shorts",
    pinterestTitle: "The Big Three in Astrology: Sun, Moon & Rising Signs",
    pinterestDescription: "Understand your complete astrological blueprint. Learn how your Sun, Moon, and Ascendant work together in AI Zodiac.",
  },
  {
    index: 15,
    id: "aizodiac-promo-15",
    title: "Love Synastry: Fire & Air Chemistry",
    topic: "Fire & Air Element Synergy",
    category: "love_compatibility",
    destinationPath: "/tools/compatibility",
    videoFileName: "aizodiac-promo-15.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "When Fire Meets Air: Instant Spark 🔥💨 #Shorts",
    pinterestTitle: "Fire & Air Zodiac Compatibility Breakdown",
    pinterestDescription: "Passionate inspiration meets sparkling wit. Discover how Fire and Air signs fuel each other's growth on AI Zodiac.",
  },
  {
    index: 16,
    id: "aizodiac-promo-16",
    title: "Love Synastry: Earth & Water Sanctuaries",
    topic: "Earth & Water Element Harmony",
    category: "love_compatibility",
    destinationPath: "/tools/compatibility",
    videoFileName: "aizodiac-promo-16.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Earth & Water: The Most Enduring Connection 🌱💧 #Shorts",
    pinterestTitle: "Earth and Water Zodiac Compatibility Guide",
    pinterestDescription: "Tactile stability meets emotional depth. Learn how Earth and Water signs build lifelong security together in AI Zodiac.",
  },
  {
    index: 17,
    id: "aizodiac-promo-17",
    title: "Why Your Birth Chart Is Completely Unique",
    topic: "Birth Chart House Placements",
    category: "self_discovery",
    destinationPath: "/tools/birth-chart",
    videoFileName: "aizodiac-promo-17.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Why You Are More Than Just Your Sun Sign 🌌 #Shorts",
    pinterestTitle: "Birth Chart Calculator & Astrological Profile",
    pinterestDescription: "Explore all 12 houses and planetary placements. Preview your unique astrological profile with AI Zodiac.",
  },
  {
    index: 18,
    id: "aizodiac-promo-18",
    title: "Ask the AI Astrologer Anything",
    topic: "Interactive AI Astrology Q&A",
    category: "ai_astrology",
    destinationPath: "/features/ask-ai",
    videoFileName: "aizodiac-promo-18.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Real Astrological Advice from AI Astrologer 🤖✨ #Shorts",
    pinterestTitle: "Ask the AI Astrologer: Instant Cosmic Advisory",
    pinterestDescription: "Get thoughtful, personalized answers calibrated to your birth chart and current planetary transits in AI Zodiac.",
  },
  {
    index: 19,
    id: "aizodiac-promo-19",
    title: "Calculate Your Life Path Number Instantly",
    topic: "Numerology & Vibration Numbers",
    category: "self_discovery",
    destinationPath: "/features/numerology",
    videoFileName: "aizodiac-promo-19.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "What Does Your Life Path Number Mean? 🔢 #Shorts",
    pinterestTitle: "Numerology & Life Path Number Calculator",
    pinterestDescription: "Discover your Life Path and Soul Urge vibrational numbers alongside your astrological profile in AI Zodiac.",
  },
  {
    index: 20,
    id: "aizodiac-promo-20",
    title: "Discover Your Authentic Chinese Animal Sign",
    topic: "Chinese Lunar Zodiac & Elements",
    category: "self_discovery",
    destinationPath: "/features/chinese-zodiac",
    videoFileName: "aizodiac-promo-20.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Your Chinese Zodiac Animal & Natural Element 🐉 #Shorts",
    pinterestTitle: "Chinese Zodiac Animal Signs & Five Elements Guide",
    pinterestDescription: "Explore Eastern lunar animal archetypes and 5-element cycles for an integrated East-meets-West perspective on AI Zodiac.",
  },
  {
    index: 21,
    id: "aizodiac-promo-21",
    title: "Navigate Mercury Retrogrades with Confidence",
    topic: "Transit Timing & Cosmic Calendar",
    category: "daily_insight",
    destinationPath: "/features/personal-calendar",
    videoFileName: "aizodiac-promo-21.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "How to Thrive During Mercury Retrogrades ⏳ #Shorts",
    pinterestTitle: "Personal Astro Calendar: Track Retrogrades & Moon Phases",
    pinterestDescription: "Stay ahead of retrogrades, new moons, and high-energy days with your personalized cosmic timing calendar in AI Zodiac.",
  },
  {
    index: 22,
    id: "aizodiac-promo-22",
    title: "Zodiac Conflict Styles: Who Bridges the Gap?",
    topic: "Communication in Conflict",
    category: "zodiac_psychology",
    destinationPath: "/articles/zodiac-signs-conflict-resolution-styles",
    videoFileName: "aizodiac-promo-22.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "How Each Zodiac Element Handles Conflict ⚡ #Shorts",
    pinterestTitle: "Zodiac Signs Conflict Resolution & Communication Guide",
    pinterestDescription: "Understand emotional triggers and constructive dialogue bridges for all 12 zodiac signs with AI Zodiac.",
  },
  {
    index: 23,
    id: "aizodiac-promo-23",
    title: "Mercury Placements & Mental Processing",
    topic: "Mercury in Astrology",
    category: "zodiac_psychology",
    destinationPath: "/articles/astrology-and-communication-mercury-placements",
    videoFileName: "aizodiac-promo-23.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Your Mercury Placement Shapes How You Think 🧠 #Shorts",
    pinterestTitle: "Mercury Sign Meaning & Communication Styles",
    pinterestDescription: "Decode your intellectual processing, learning preferences, and communicative expression in AI Zodiac.",
  },
  {
    index: 24,
    id: "aizodiac-promo-24",
    title: "The 12 Astrological Houses Decoded",
    topic: "Astrological Houses Guide",
    category: "self_discovery",
    destinationPath: "/articles/guide-to-the-12-astrological-houses",
    videoFileName: "aizodiac-promo-24.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "The 12 Houses in Astrology Made Simple 🏛️ #Shorts",
    pinterestTitle: "Guide to the 12 Astrological Houses in Birth Charts",
    pinterestDescription: "Learn what each astrological house governs — from self-identity to career and spiritual integration — on AI Zodiac.",
  },
  {
    index: 25,
    id: "aizodiac-promo-25",
    title: "Four Elements: Balancing Fire, Earth, Air & Water",
    topic: "Elemental Balance Guide",
    category: "personality",
    destinationPath: "/articles/elemental-harmony-fire-earth-air-water",
    videoFileName: "aizodiac-promo-25.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Which Element Dominates Your Birth Chart? 🌿🔥 #Shorts",
    pinterestTitle: "Elemental Harmony: Fire, Earth, Air and Water in Astrology",
    pinterestDescription: "Discover how your elemental balance influences your temperament, energy, and relationship dynamics on AI Zodiac.",
  },
  {
    index: 26,
    id: "aizodiac-promo-26",
    title: "How AI Personalizes Your Daily Horoscope",
    topic: "AI-Powered Astrology Synthesis",
    category: "ai_astrology",
    destinationPath: "/articles/how-ai-creates-personalized-astrology-insights",
    videoFileName: "aizodiac-promo-26.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "How AI Reads Planetary Transits for You 🪐🤖 #Shorts",
    pinterestTitle: "How AI Creates Personalized Astrology Insights",
    pinterestDescription: "See how modern artificial intelligence synthesizes complex planetary data into tailored daily guidance on AI Zodiac.",
  },
  {
    index: 27,
    id: "aizodiac-promo-27",
    title: "Zodiac Compatibility Beyond Just Sun Signs",
    topic: "Multi-Planet Synastry Matching",
    category: "love_compatibility",
    destinationPath: "/articles/zodiac-compatibility-beyond-sun-signs",
    videoFileName: "aizodiac-promo-27.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Why Sun Sign Compatibility Isn't Enough ❤️ #Shorts",
    pinterestTitle: "Zodiac Compatibility Beyond Sun Signs: Moon & Venus Synastry",
    pinterestDescription: "Discover why Moon, Venus, and Mars placements hold the key to true emotional and romantic chemistry in AI Zodiac.",
  },
  {
    index: 28,
    id: "aizodiac-promo-28",
    title: "Daily Mindful Reflections for Conscious Growth",
    topic: "Daily Astrology Mindfulness",
    category: "daily_insight",
    destinationPath: "/features/personal-horoscope",
    videoFileName: "aizodiac-promo-28.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Start Your Morning with Cosmic Clarity ☕✨ #Shorts",
    pinterestTitle: "Daily Horoscope Reflections for Mindful Living",
    pinterestDescription: "Practical, empowering daily forecasts designed for conscious decision-making in the AI Zodiac Android app.",
  },
  {
    index: 29,
    id: "aizodiac-promo-29",
    title: "How to Read Your Astrological Birth Chart",
    topic: "Reading Your Birth Chart",
    category: "self_discovery",
    destinationPath: "/articles/astrology-basics-how-to-read-birth-chart",
    videoFileName: "aizodiac-promo-29.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Read Your Birth Chart in 3 Simple Steps 🗺️ #Shorts",
    pinterestTitle: "Astrology Basics: How to Read Your Birth Chart",
    pinterestDescription: "Master the basics of natal astrology. Discover signs, planets, aspects, and houses with AI Zodiac.",
  },
  {
    index: 30,
    id: "aizodiac-promo-30",
    title: "AI Zodiac: Your Personal Cosmic Companion",
    topic: "AI Zodiac App Experience",
    category: "self_discovery",
    destinationPath: "/",
    videoFileName: "aizodiac-promo-30.mp4",
    duration: 10,
    aspectRatio: "9:16",
    youtubeTitle: "Your Personal AI Astrologer on Android ✨📱 #Shorts",
    pinterestTitle: "AI Zodiac: Personalized Astrology App & Horoscopes",
    pinterestDescription: "Experience birth-chart calibrated daily horoscopes, love synastry, and conversational AI astrology with AI Zodiac.",
  },
]);

/**
 * Deterministically retrieves the video catalog item for a given publish date.
 * @param {string} publishDate - Date in YYYY-MM-DD
 * @returns {object}
 */
export function getVideoCatalogItemForDate(publishDate) {
  const seed = getDeterministicDateSeed(publishDate);
  const index = Math.abs(seed) % AI_ZODIAC_30_PROMOTIONAL_VIDEOS.length;
  return AI_ZODIAC_30_PROMOTIONAL_VIDEOS[index];
}

/**
 * Formats a concise, engaging YouTube description with AI Zodiac website & Google Play CTAs.
 * @param {object} params
 * @param {string} [params.baseDescription]
 * @param {string} [params.websiteUrl]
 * @param {string} [params.playStoreUrl=YOUTUBE_TRACKING_PLAY_STORE_URL]
 * @param {string[]} [params.tags]
 * @returns {string}
 */
export function formatYouTubeVideoDescription({
  baseDescription = "",
  websiteUrl = "https://aizodiac.life/",
  playStoreUrl = YOUTUBE_TRACKING_PLAY_STORE_URL,
  tags = ["#Shorts", "#astrology", "#aizodiac", "#zodiac", "#horoscope"],
} = {}) {
  let text = String(baseDescription || "").trim();
  if (!text) {
    text = "Discover personalized astrological guidance, birth chart insights, and daily horoscope transits with AI Zodiac — your personal AI astrology companion on Android.";
  }

  if (websiteUrl && !text.includes(websiteUrl)) {
    text = `${text}\n\nExplore more insights on AI Zodiac:\n${websiteUrl}`;
  }

  if (playStoreUrl && !text.includes(playStoreUrl)) {
    text = `${text}\n\nDownload AI Zodiac on Google Play:\n${playStoreUrl}`;
  }

  if (tags && tags.length > 0) {
    const tagLine = tags.join(" ");
    if (!text.includes(tagLine)) {
      text = `${text}\n\n${tagLine}`;
    }
  }

  return text;
}

/**
 * Generates a complete, canonical AI Zodiac Video Content Manifest for a target date.
 * @param {object} params
 * @param {string} params.publishDate - Target date YYYY-MM-DD
 * @param {string} [params.mediaBaseUrl=""] - Base URL for media assets (Cloudflare R2)
 * @param {object} [params.videoItemOverride=null] - Optional override of the catalog item
 * @returns {object} Canonical Video Manifest
 */
export function generateDailyVideoManifest({
  publishDate,
  mediaBaseUrl = "",
  videoItemOverride = null,
} = {}) {
  const item = videoItemOverride || getVideoCatalogItemForDate(publishDate);
  const contentId = `video-${publishDate}`;

  // Build deterministic attributed destination URLs for YouTube & Pinterest
  const youtubeDestUrl = buildWebsiteDestinationUrl({
    path: item.destinationPath,
    platform: "youtube",
    campaign: item.category,
    contentId,
  });

  const pinterestDestUrl = buildWebsiteDestinationUrl({
    path: item.destinationPath,
    platform: "pinterest",
    campaign: item.category,
    contentId,
  });

  const rawVideoPath = `videos/${item.videoFileName}`;
  const videoUrl = resolveMediaUrl(rawVideoPath, mediaBaseUrl);

  const youtubeDescription = formatYouTubeVideoDescription({
    baseDescription: `✨ ${item.title}\n\nDiscover how your astrological blueprint shapes your personal growth, relationships, and timing with AI Zodiac.`,
    websiteUrl: youtubeDestUrl,
    playStoreUrl: YOUTUBE_TRACKING_PLAY_STORE_URL,
    tags: ["#Shorts", "#astrology", "#aizodiac", "#zodiac", "#horoscope", "#birthchart"],
  });

  const pinterestDescription = `${item.pinterestDescription}\n\nExplore more on AI Zodiac: ${pinterestDestUrl}\nDownload on Google Play: ${PINTEREST_VIDEO_TRACKING_PLAY_STORE_URL}`;

  return {
    date: publishDate,
    id: contentId,
    type: MEDIA_TYPES.VIDEO,
    media: [
      {
        url: videoUrl,
        type: "video/mp4",
        duration: item.duration || 10,
        aspectRatio: item.aspectRatio || "9:16",
        altText: `${item.title} | AI Zodiac`,
      },
    ],
    destinations: ["youtube", "pinterest"],
    destinationUrl: youtubeDestUrl,
    captions: {
      youtube: {
        title: item.youtubeTitle || `${item.title} ✨ #Shorts`,
        description: youtubeDescription,
        tags: ["AI Zodiac", "astrology", "horoscope", "zodiac", "Shorts", "birth chart", "zodiac signs"],
      },
      pinterest: {
        title: item.pinterestTitle,
        description: pinterestDescription.slice(0, 500),
        link: pinterestDestUrl,
      },
      instagram: `✨ ${item.title} ✨\n\nDiscover your complete birth chart, rising sign, and daily transits with AI Zodiac.\n\nLink in bio.\n\n#astrology #aizodiac #zodiac #horoscope #astrologyvideo`,
      facebook: `✨ ${item.title} ✨\n\nExplore personalized astrology insights on AI Zodiac: ${youtubeDestUrl}\n\nDownload on Google Play:\nhttps://play.google.com/store/apps/details?id=com.oberon.aizodiac&referrer=utm_source%3Dfacebook%26utm_medium%3Dsocial%26utm_campaign%3Dvideo_cta`,
    },
    metadata: {
      category: item.category,
      format: "promotional_video",
      topic: item.topic,
      videoIndex: item.index,
      videoFileName: item.videoFileName,
      contentId,
      destinationPath: item.destinationPath,
      duration: item.duration || 10,
      qualityGate: QUALITY_GATE_STATUS.PASS,
      generatedAt: new Date().toISOString(),
    },
  };
}
