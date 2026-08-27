// lib/social/content/topicRotation.js
import { getDateInTimeZone } from "../contentManifest.js";

export const ROTATION_STRATEGY = Object.freeze({
  0: {
    dayOfWeek: 0,
    dayName: "Sunday",
    category: "self_discovery",
    categoryTitle: "Self-Discovery & Reflection",
    themeDescription: "Deep personal growth, cosmic alignment, natal reflection, and AI Zodiac personalized insights CTA.",
    focusPrompt: "Focus on introspective personal growth, inner strengths of zodiac elements, or understanding one's astrological blueprint. Emphasize self-discovery and direct the reader to explore deeper with AI Zodiac.",
    seedTopics: [
      "How Your Sun and Moon Signs Shape Your Inner World",
      "The Hidden Cosmic Superpower of Each Zodiac Element",
      "Why Knowing Your Ascendant Changes Everything",
      "3 Ways Your Astrological Blueprint Guides Self-Discovery",
      "Understanding Your Cosmic Energy and Emotional Needs",
      "The Astrological Art of Personal Transformation",
    ],
  },
  1: {
    dayOfWeek: 1,
    dayName: "Monday",
    category: "daily_insight",
    categoryTitle: "Daily Zodiac Insight",
    themeDescription: "Fresh start cosmic energy, planetary motivation, weekly mindset, and focus for all zodiac archetypes.",
    focusPrompt: "Focus on fresh energy, cosmic momentum, embracing new beginnings, and how different zodiac signs channel focus and intention for the week ahead.",
    seedTopics: [
      "Cosmic Energy for the Week: What Each Element Needs Most",
      "3 Zodiac Signs Starting the Week with Powerful Momentum",
      "How to Channel Your Zodiac Energy for Peak Focus",
      "The Cosmic Mindset Shift Every Zodiac Sign Needs",
      "Weekly Astrological Weather: Navigating Today's Transits",
      "3 Signs Poised for Breakthroughs and New Beginnings",
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
    focusPrompt: "Explore astrological chemistry, elemental pairings, communication dynamics in love, and how different signs express deep affection.",
    seedTopics: [
      "The Most Magnetic Zodiac Pairs in Love & Romance",
      "How Different Zodiac Elements Express True Affection",
      "3 Zodiac Signs That Need Emotional Depth in Love",
      "Why Fire and Air Signs Create Instant Romantic Sparks",
      "The Secret to Long-Term Harmony for Earth and Water Signs",
      "3 Zodiac Combinations That Balance Each Other Perfectly",
    ],
  },
  4: {
    dayOfWeek: 4,
    dayName: "Thursday",
    category: "zodiac_psychology",
    categoryTitle: "Zodiac Behavior & Psychology",
    themeDescription: "Subconscious drivers, shadow traits, boundary setting, decision-making, and emotional processing.",
    focusPrompt: "Analyze the psychological motivations, coping styles, instinctive defense mechanisms, and subconscious habits of zodiac archetypes.",
    seedTopics: [
      "How Each Zodiac Element Handles Conflict and Stress",
      "The Subconscious Motivations Driving Each Zodiac Sign",
      "How the 3 Modalities (Cardinal, Fixed, Mutable) Process Change",
      "Why Certain Zodiac Signs Guard Their Inner Circle So Fiercely",
      "The Emotional Decision-Making Style of Each Element",
      "How Zodiac Signs Protect Their Personal Energy and Boundaries",
    ],
  },
  5: {
    dayOfWeek: 5,
    dayName: "Friday",
    category: "dating_relationships",
    categoryTitle: "Dating & Relationships",
    themeDescription: "Modern dating dynamics, green flags, courtship styles, relationship communication, and weekend connection.",
    focusPrompt: "Explore dating tendencies, romantic green flags, courtship nuances, and what attracts each zodiac archetype when getting to know someone new.",
    seedTopics: [
      "Top Green Flags in Dating for Each Zodiac Element",
      "How to Tell When a Water Sign Truly Likes You",
      "What Each Zodiac Sign Needs on a First Date",
      "3 Signs That Value Intellectual Connection Above All",
      "The Unique Courtship Style of Earth Signs",
      "How to Connect Authentically with Air Signs in Dating",
    ],
  },
  6: {
    dayOfWeek: 6,
    dayName: "Saturday",
    category: "fun_ranking",
    categoryTitle: "Fun / Curiosity / Ranking",
    themeDescription: "Engaging astrological rankings, lighthearted curiosity, weekend vibes, and relatable zodiac observations.",
    focusPrompt: "Create a fun, engaging ranking or archetype breakdown of zodiac signs (e.g. top 3 signs with spontaneous energy, best weekend hosts, deep midnight thinkers).",
    seedTopics: [
      "Top 3 Most Spontaneous Zodiac Signs for Weekend Adventures",
      "Ranking the Zodiac Signs by Their Sense of Humor",
      "3 Zodiac Signs That Are the Ultimate Midnight Thinkers",
      "The 3 Most Generous Hosts of the Zodiac",
      "Which Signs Are Most Likely to Plan a Spontaneous Road Trip",
      "3 Zodiac Signs with an Uncanny Eye for Aesthetic Beauty",
    ],
  },
});

/**
 * Determines the controlled topic strategy for a given publication date and timezone.
 * @param {string|Date} [dateInput] - Date string (YYYY-MM-DD) or Date instance
 * @param {string} [timeZone="UTC"] - Target timezone
 * @returns {object}
 */
export function getTopicStrategyForDate(dateInput, timeZone = "UTC") {
  const dateStr = typeof dateInput === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)
    ? dateInput
    : getDateInTimeZone(dateInput || new Date(), timeZone);

  // Parse YYYY-MM-DD components safely at UTC noon to avoid day shifts
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayOfWeek = targetDate.getUTCDay();

  const strategy = ROTATION_STRATEGY[dayOfWeek] || ROTATION_STRATEGY[1];

  return {
    publishDate: dateStr,
    dayOfWeek,
    dayName: strategy.dayName,
    category: strategy.category,
    categoryTitle: strategy.categoryTitle,
    themeDescription: strategy.themeDescription,
    focusPrompt: strategy.focusPrompt,
    seedTopics: [...strategy.seedTopics],
  };
}
