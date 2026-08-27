// lib/social/render/designSystem.js
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicit absolute paths to bundled Noto Sans fonts
export const FONT_REGULAR_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Regular.ttf");
export const FONT_BOLD_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Bold.ttf");

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;

/**
 * Deterministic Spacing & Layout Coordinates
 */
export const SPACING = Object.freeze({
  CANVAS_WIDTH: 1080,
  CANVAS_HEIGHT: 1350,
  SAFE_MARGIN_X: 90,
  CONTENT_WIDTH: 900,
  TOP_HEADER_Y: 80,
  HEADER_HEIGHT: 42,
  CARD_Y: 230,
  CARD_HEIGHT: 890,
  CARD_WIDTH: 900,
  FOOTER_Y: 1200,
});

/**
 * Central Color Palette Tokens
 */
export const COLORS = Object.freeze({
  bgPrimary: "#080914",
  bgSecondary: "#0d1024",
  bgTertiary: "#141836",
  cardBg: "#12152c",
  cardBorder: "#272c50",
  textPrimary: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  textSubtle: "#64748b",
  accentGold: "#fbbf24",
  accentAmber: "#f59e0b",
  accentPurple: "#7c3aed",
  accentLavender: "#c4b5fd",
  accentIndigo: "#4f46e5",
  accentCyan: "#38bdf8",
  accentEmerald: "#10b981",
});

/**
 * Element-Specific Theme Accents
 */
export const ELEMENT_ACCENTS = Object.freeze({
  Fire: {
    color: "#f59e0b",
    secondary: "#fb7185",
    badgeBg: "#291407",
    badgeBorder: "#f59e0b",
    label: "FIRE SIGN",
  },
  Earth: {
    color: "#10b981",
    secondary: "#fbbf24",
    badgeBg: "#062219",
    badgeBorder: "#10b981",
    label: "EARTH SIGN",
  },
  Air: {
    color: "#38bdf8",
    secondary: "#a78bfa",
    badgeBg: "#081d2c",
    badgeBorder: "#38bdf8",
    label: "AIR SIGN",
  },
  Water: {
    color: "#a855f7",
    secondary: "#38bdf8",
    badgeBg: "#1d0e2f",
    badgeBorder: "#a855f7",
    label: "WATER SIGN",
  },
});

/**
 * Deterministic Zodiac Visual & Astrological Data for all 12 Signs
 */
export const ZODIAC_DATA = Object.freeze({
  Aries: {
    name: "Aries",
    symbol: "♈",
    element: "Fire",
    modality: "Cardinal",
    ruler: "Mars",
    keywords: "Courage • Initiative • Passion",
    accent: ELEMENT_ACCENTS.Fire,
  },
  Taurus: {
    name: "Taurus",
    symbol: "♉",
    element: "Earth",
    modality: "Fixed",
    ruler: "Venus",
    keywords: "Steadfast • Grounded • Loyal",
    accent: ELEMENT_ACCENTS.Earth,
  },
  Gemini: {
    name: "Gemini",
    symbol: "♊",
    element: "Air",
    modality: "Mutable",
    ruler: "Mercury",
    keywords: "Curious • Expressive • Adaptive",
    accent: ELEMENT_ACCENTS.Air,
  },
  Cancer: {
    name: "Cancer",
    symbol: "♋",
    element: "Water",
    modality: "Cardinal",
    ruler: "Moon",
    keywords: "Intuitive • Protective • Nurturing",
    accent: ELEMENT_ACCENTS.Water,
  },
  Leo: {
    name: "Leo",
    symbol: "♌",
    element: "Fire",
    modality: "Fixed",
    ruler: "Sun",
    keywords: "Radiant • Generous • Inspiring",
    accent: ELEMENT_ACCENTS.Fire,
  },
  Virgo: {
    name: "Virgo",
    symbol: "♍",
    element: "Earth",
    modality: "Mutable",
    ruler: "Mercury",
    keywords: "Insightful • Precise • Devoted",
    accent: ELEMENT_ACCENTS.Earth,
  },
  Libra: {
    name: "Libra",
    symbol: "♎",
    element: "Air",
    modality: "Cardinal",
    ruler: "Venus",
    keywords: "Harmonious • Graceful • Fair",
    accent: ELEMENT_ACCENTS.Air,
  },
  Scorpio: {
    name: "Scorpio",
    symbol: "♏",
    element: "Water",
    modality: "Fixed",
    ruler: "Pluto",
    keywords: "Profound • Magnetic • Unshakable",
    accent: ELEMENT_ACCENTS.Water,
  },
  Sagittarius: {
    name: "Sagittarius",
    symbol: "♐",
    element: "Fire",
    modality: "Mutable",
    ruler: "Jupiter",
    keywords: "Visionary • Candid • Adventurous",
    accent: ELEMENT_ACCENTS.Fire,
  },
  Capricorn: {
    name: "Capricorn",
    symbol: "♑",
    element: "Earth",
    modality: "Cardinal",
    ruler: "Saturn",
    keywords: "Ambitious • Resilient • Disciplined",
    accent: ELEMENT_ACCENTS.Earth,
  },
  Aquarius: {
    name: "Aquarius",
    symbol: "♒",
    element: "Air",
    modality: "Fixed",
    ruler: "Uranus",
    keywords: "Innovative • Independent • Idealistic",
    accent: ELEMENT_ACCENTS.Air,
  },
  Pisces: {
    name: "Pisces",
    symbol: "♓",
    element: "Water",
    modality: "Mutable",
    ruler: "Neptune",
    keywords: "Empathetic • Mystical • Compassionate",
    accent: ELEMENT_ACCENTS.Water,
  },
});

/**
 * Escapes XML/Pango special characters.
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Wraps text into lines cleanly respecting word boundaries.
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
export function wrapTextToLines(text, maxChars = 36) {
  if (!text || typeof text !== "string") return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxChars) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

/**
 * Adaptive Typography Sizing Helpers
 */
export function getAdaptiveCoverTitleSize(headline = "") {
  const len = (headline || "").length;
  if (len <= 35) return 56;
  if (len <= 55) return 48;
  return 42;
}

export function getAdaptiveHeadlineSize(headline = "") {
  const len = (headline || "").length;
  if (len <= 25) return 48;
  if (len <= 45) return 42;
  return 36;
}

export function getAdaptiveBodySize(body = "") {
  const len = (body || "").length;
  if (len <= 120) return 32;
  if (len <= 170) return 28;
  return 26;
}

/**
 * Shared Cosmic SVG Background Vector Generator.
 * @returns {string}
 */
export function renderCosmicBackground() {
  return `
    <defs>
      <!-- Base Gradients -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#080914" />
        <stop offset="45%" stop-color="#0d1024" />
        <stop offset="100%" stop-color="#141836" />
      </linearGradient>

      <!-- Nebula Glows -->
      <radialGradient id="nebulaViolet" cx="22%" cy="18%" r="48%">
        <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.32" />
        <stop offset="100%" stop-color="#7c3aed" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="nebulaGold" cx="82%" cy="78%" r="46%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.20" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="nebulaCyan" cx="75%" cy="22%" r="38%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.16" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
      </radialGradient>

      <!-- Metallic Gold Gradient -->
      <linearGradient id="goldTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="50%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>

      <!-- Button Gradient -->
      <linearGradient id="purpleButtonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7c3aed" />
        <stop offset="100%" stop-color="#4f46e5" />
      </linearGradient>

      <!-- Glow Filter -->
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
      <filter id="glowSubtle" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Base Canvas Background -->
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#bgGrad)" />

    <!-- Nebula Overlays -->
    <circle cx="240" cy="240" r="460" fill="url(#nebulaViolet)" />
    <circle cx="860" cy="990" r="460" fill="url(#nebulaGold)" />
    <circle cx="790" cy="310" r="360" fill="url(#nebulaCyan)" />

    <!-- Thin Celestial Orbital Rings -->
    <circle cx="540" cy="675" r="490" fill="none" stroke="#a78bfa" stroke-opacity="0.12" stroke-width="1.5" stroke-dasharray="6 8" />
    <circle cx="540" cy="675" r="370" fill="none" stroke="#38bdf8" stroke-opacity="0.08" stroke-width="1" />
    <circle cx="540" cy="675" r="250" fill="none" stroke="#f59e0b" stroke-opacity="0.10" stroke-width="1" stroke-dasharray="3 6" />

    <!-- Subtle Background Constellation Stars -->
    <g fill="#f8fafc" opacity="0.65">
      <circle cx="130" cy="170" r="2" />
      <circle cx="270" cy="115" r="3" opacity="0.8" />
      <circle cx="930" cy="210" r="2.5" opacity="0.9" />
      <circle cx="890" cy="440" r="1.5" />
      <circle cx="150" cy="880" r="3" opacity="0.85" />
      <circle cx="210" cy="1140" r="2" />
      <circle cx="950" cy="1090" r="3" opacity="0.9" />
      <circle cx="470" cy="170" r="1.5" />
      <circle cx="630" cy="1210" r="2" />
      <circle cx="340" cy="740" r="2.5" opacity="0.5" />
      <circle cx="720" cy="830" r="1.8" opacity="0.6" />
    </g>

    <!-- Celestial Diamond Sparks -->
    <g fill="#fbbf24" opacity="0.75">
      <path d="M120 480 Q120 500 100 500 Q120 500 120 520 Q120 500 140 500 Q120 500 120 480 Z" />
      <path d="M960 770 Q960 785 945 785 Q960 785 960 800 Q960 785 975 785 Q960 785 960 770 Z" />
      <path d="M860 140 Q860 155 845 155 Q860 155 860 170 Q860 155 875 155 Q860 155 860 140 Z" opacity="0.5" />
    </g>
  `;
}

/**
 * Renders Top Header Box Layout (Brand & Pagination Indicator).
 * @returns {string}
 */
export function renderHeaderBoxes() {
  return `
    <!-- Top Branding Pill Box -->
    <g transform="translate(90, 80)">
      <rect width="180" height="42" rx="21" fill="#181b30" fill-opacity="0.85" stroke="#a78bfa" stroke-opacity="0.4" stroke-width="1.5" />
    </g>

    <!-- Slide Pagination Indicator Pill Box -->
    <g transform="translate(850, 80)">
      <rect width="140" height="42" rx="21" fill="#181b30" fill-opacity="0.85" stroke="#4b5563" stroke-opacity="0.5" stroke-width="1" />
    </g>
  `;
}

/**
 * Renders a deterministic vector zodiac emblem for a specific sign.
 * @param {object} params
 * @param {string} params.sign - Zodiac sign name
 * @param {number} [params.cx=540]
 * @param {number} [params.cy=360]
 * @param {number} [params.radius=55]
 * @returns {string}
 */
export function renderZodiacEmblemSvg({ sign, cx = 540, cy = 360, radius = 55 }) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accentColor = data.accent.color;

  return `
    <!-- Zodiac Celestial Emblem -->
    <g transform="translate(${cx}, ${cy})">
      <!-- Outer Pulsing Aura -->
      <circle cx="0" cy="0" r="${radius + 18}" fill="${accentColor}" fill-opacity="0.08" />
      <circle cx="0" cy="0" r="${radius + 8}" fill="none" stroke="${accentColor}" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="4 4" />

      <!-- Inner Card Disc -->
      <circle cx="0" cy="0" r="${radius}" fill="#191c36" stroke="${accentColor}" stroke-width="2" filter="url(#glowSubtle)" />

      <!-- Geometric Celestial Accents -->
      <circle cx="0" cy="-${radius - 8}" r="2.5" fill="${accentColor}" />
      <circle cx="0" cy="${radius - 8}" r="2.5" fill="${accentColor}" />
      <circle cx="-${radius - 8}" cy="0" r="2.5" fill="${accentColor}" />
      <circle cx="${radius - 8}" cy="0" r="2.5" fill="${accentColor}" />

      <!-- Unicode Zodiac Vector Symbol -->
      <text x="0" y="15" text-anchor="middle" fill="${accentColor}" font-family="sans-serif" font-size="44" font-weight="bold">${data.symbol}</text>
    </g>
  `;
}
