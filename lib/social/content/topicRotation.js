// lib/social/content/topicRotation.js
import { getDateInTimeZone } from "../contentManifest.js";

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
