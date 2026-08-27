// lib/social/render/designSystem.js
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicit absolute paths to bundled Noto Sans fonts
export const FONT_REGULAR_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Regular.ttf");
export const FONT_BOLD_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Bold.ttf");

// Explicit absolute paths to approved master background assets
export const BACKGROUND_COVER_PATH = path.resolve(__dirname, "../../../assets/social/backgrounds/cover-bg.png");
export const BACKGROUND_ZODIAC_PATH = path.resolve(__dirname, "../../../assets/social/backgrounds/zodiac-bg.png");
export const BACKGROUND_CTA_PATH = path.resolve(__dirname, "../../../assets/social/backgrounds/cta-bg.png");

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;

/**
 * Loads and scales a master background image asset to 1080x1350 PNG buffer.
 * Safe for Vercel/serverless execution.
 * @param {string} bgPath - Absolute path to background asset
 * @returns {Promise<Buffer>}
 */
export async function loadBackgroundImageBuffer(bgPath) {
  if (!fs.existsSync(bgPath)) {
    throw new Error(`Master background asset not found at: ${bgPath}`);
  }

  return await sharp(bgPath)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, {
      fit: "cover",
      position: "center",
    })
    .png()
    .toBuffer();
}

/**
 * Strict, Non-Overlapping Vertical Layout Zones
 */
export const LAYOUT_ZONES = Object.freeze({
  HEADER: { top: 70, bottom: 130, height: 60 },

  COVER: {
    CATEGORY: { top: 250, bottom: 310, height: 60 },
    TITLE: { top: 420, bottom: 880, height: 460, maxWidth: 800 },
    FOOTER: { top: 1140, bottom: 1240, height: 100 },
  },

  FEATURE: {
    EMBLEM: { top: 180, bottom: 370, height: 190 },
    SIGN: { top: 400, bottom: 470, height: 70 },
    ELEMENT: { top: 475, bottom: 525, height: 50 },
    HEADLINE: { top: 540, bottom: 640, height: 100, maxWidth: 800 },
    DIVIDER: { top: 655, height: 2 },
    BODY: { top: 670, bottom: 950, height: 280, maxWidth: 680 },
    FOOTER: { top: 1140, bottom: 1240, height: 100 },
  },

  CTA: {
    HEADLINE: { top: 380, bottom: 560, height: 180, maxWidth: 820 },
    BODY: { top: 580, bottom: 720, height: 140, maxWidth: 700 },
    BUTTON: { top: 820, bottom: 920, height: 100, width: 540 },
    SECONDARY: { top: 945, bottom: 995, height: 50 },
    FOOTER: { top: 1140, bottom: 1240, height: 100 },
  },
});

/**
 * Central Color Palette Tokens
 */
export const COLORS = Object.freeze({
  bgPrimary: "#080914",
  bgSecondary: "#0d1024",
  bgTertiary: "#141836",
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
 * Formats multi-word titles into visually balanced lines to avoid single dangling words.
 * @param {string} text
 * @param {number} [maxCharsPerLine=22]
 * @returns {string}
 */
export function formatBalancedLines(text, maxCharsPerLine = 22) {
  if (!text || typeof text !== "string") return "";
  if (text.includes("\n")) return text;

  const words = text.trim().split(/\s+/);
  if (words.length <= 3 || text.length <= maxCharsPerLine) return text;

  const totalLen = text.length;
  const targetLinesCount = Math.ceil(totalLen / maxCharsPerLine);
  const targetLineLen = Math.ceil(totalLen / targetLinesCount);

  const lines = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= targetLineLen + 6) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  // If last line has only 1 short word, balance with previous line
  if (lines.length > 1 && lines[lines.length - 1].split(/\s+/).length === 1) {
    const prevWords = lines[lines.length - 2].split(/\s+/);
    if (prevWords.length > 2) {
      const moved = prevWords.pop();
      lines[lines.length - 2] = prevWords.join(" ");
      lines[lines.length - 1] = moved + " " + lines[lines.length - 1];
    }
  }

  return lines.join("\n");
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
 * Renders text and automatically fits it within a designated bounding box.
 * Uses 1:1 pixel point typography (DPI 72) and iteratively decrements font size until it fits.
 * @param {object} options
 * @param {string} options.text
 * @param {string} options.fontfile
 * @param {number} [options.preferredSize=32]
 * @param {number} [options.minSize=16]
 * @param {string} [options.color="#ffffff"]
 * @param {number} [options.maxWidth=800]
 * @param {number} [options.maxHeight=300]
 * @param {"left"|"center"|"right"} [options.align="center"]
 * @param {boolean} [options.balance=false]
 * @param {number} [options.maxCharsPerLine=22]
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, fontSize: number }>}
 */
export async function renderTextToFit({
  text,
  fontfile,
  preferredSize = 32,
  minSize = 16,
  color = "#ffffff",
  maxWidth = 800,
  maxHeight = 300,
  align = "center",
  balance = false,
  maxCharsPerLine = 22,
}) {
  if (!fontfile) {
    throw new Error("Missing required fontfile for deterministic Sharp text rendering");
  }

  const formatted = balance ? formatBalancedLines(text, maxCharsPerLine) : text;
  let size = preferredSize;
  let bestBuffer = null;
  let bestMeta = null;

  while (size >= minSize) {
    const pango = `<span foreground="${color}" font_size="${Math.round(size * 1024)}">${escapeXml(formatted || "")}</span>`;
    const buf = await sharp({
      text: {
        text: pango,
        fontfile,
        width: maxWidth,
        align,
        rgba: true,
        dpi: 72,
      },
    }).png().toBuffer();

    const meta = await sharp(buf).metadata();
    bestBuffer = buf;
    bestMeta = meta;

    if (meta.height <= maxHeight && meta.width <= maxWidth) {
      break;
    }
    size -= 2;
  }

  return {
    buffer: bestBuffer,
    width: bestMeta ? bestMeta.width : 0,
    height: bestMeta ? bestMeta.height : 0,
    fontSize: size,
  };
}

/**
 * Creates an RGBA text layer buffer using Sharp with explicit fontfile and DPI 72.
 * @param {object} options
 * @returns {Promise<Buffer>}
 */
export async function createTextLayer({
  text,
  fontfile,
  fontSize = 32,
  color = "#ffffff",
  width = 900,
  align = "center",
}) {
  const res = await renderTextToFit({
    text,
    fontfile,
    preferredSize: fontSize,
    minSize: fontSize,
    color,
    maxWidth: width,
    maxHeight: 1200,
    align,
  });
  return res.buffer;
}

/**
 * Renders Top Header Box Layout (Brand & Pagination Indicator Pills).
 * @returns {string}
 */
export function renderHeaderBoxes() {
  return `
    <g transform="translate(90, 70)">
      <rect width="180" height="42" rx="21" fill="#181b30" fill-opacity="0.85" stroke="#a78bfa" stroke-opacity="0.4" stroke-width="1.5" />
    </g>
    <g transform="translate(850, 70)">
      <rect width="140" height="42" rx="21" fill="#181b30" fill-opacity="0.85" stroke="#4b5563" stroke-opacity="0.5" stroke-width="1" />
    </g>
  `;
}

/**
 * Renders a clean 180px diameter zodiac emblem disc.
 * @param {object} params
 * @param {string} params.sign - Zodiac sign name
 * @param {number} [params.cx=540]
 * @param {number} [params.cy=275]
 * @param {number} [params.radius=90]
 * @returns {string}
 */
export function renderZodiacEmblemSvg({ sign, cx = 540, cy = 275, radius = 90 }) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accentColor = data.accent.color;

  return `
    <g transform="translate(${cx}, ${cy})">
      <circle cx="0" cy="0" r="${radius}" fill="#141733" fill-opacity="0.92" stroke="${accentColor}" stroke-width="2.5" />
    </g>
  `;
}
