// lib/social/render/zodiacVectors.js
/**
 * Deterministic Vector SVG Paths for all 12 Western Zodiac Symbols and UI Vector Icons.
 * Eliminates all font glyph / Unicode codepoint / tofu issues across OS environments.
 */

export const ZODIAC_SVG_PATHS = Object.freeze({
  Aries: `
    <path d="M-22 18 C-22 -4 -12 -20 0 -8 C12 -20 22 -4 22 18 M0 -8 L0 22" />
  `.trim(),

  Taurus: `
    <circle cx="0" cy="8" r="16" />
    <path d="M-22 -14 C-16 -4 -6 -2 0 -2 C6 -2 16 -4 22 -14 M-22 -14 C-20 -22 -12 -20 -8 -10 M22 -14 C20 -22 12 -20 8 -10" />
  `.trim(),

  Gemini: `
    <path d="M-22 -22 C-6 -15 6 -15 22 -22 M-22 22 C-6 15 6 15 22 22 M-10 -18 L-10 18 M10 -18 L10 18" />
  `.trim(),

  Cancer: `
    <circle cx="-11" cy="-6" r="8" />
    <circle cx="11" cy="6" r="8" />
    <path d="M-11 2 C2 2 18 -2 22 -14 M11 -2 C-2 -2 -18 2 -22 14" />
  `.trim(),

  Leo: `
    <circle cx="-14" cy="6" r="8" />
    <path d="M-6 6 C-6 -18 14 -18 14 2 C14 14 22 22 28 18" />
  `.trim(),

  Virgo: `
    <path d="M-24 16 L-24 -12 C-24 -20 -12 -20 -12 -12 L-12 16 M-12 -12 C-12 -20 0 -20 0 -12 L0 16 M0 -12 C0 -20 12 -20 12 -12 L12 12 C12 24 26 24 26 12 C26 0 12 0 8 18" />
  `.trim(),

  Libra: `
    <path d="M-24 -4 L-12 -4 C-12 -18 12 -18 12 -4 L24 -4 M-24 14 L24 14" />
  `.trim(),

  Scorpio: `
    <path d="M-24 16 L-24 -12 C-24 -20 -12 -20 -12 -12 L-12 16 M-12 -12 C-12 -20 0 -20 0 -12 L0 16 M0 -12 C0 -20 12 -20 12 -12 L12 18 L24 18 M17 11 L24 18 L17 25" />
  `.trim(),

  Sagittarius: `
    <path d="M-20 20 L20 -20 M8 -20 L20 -20 L20 -8 M-8 6 L6 -8" />
  `.trim(),

  Capricorn: `
    <path d="M-22 -16 L-11 16 L0 -14 C12 -14 16 -4 16 6 C16 18 6 24 0 18 C-6 12 -4 -2 6 -2" />
  `.trim(),

  Aquarius: `
    <path d="M-24 -10 L-16 -18 L-8 -10 L0 -18 L8 -10 L16 -18 L24 -10 M-24 10 L-16 2 L-8 10 L0 2 L8 10 L16 2 L24 10" />
  `.trim(),

  Pisces: `
    <path d="M-16 -22 C-6 -10 -6 10 -16 22 M16 -22 C6 -10 6 10 16 22 M-22 0 L22 0" />
  `.trim(),
});

/**
 * Returns deterministic SVG markup for a zodiac symbol.
 * @param {string} sign - Zodiac sign name
 * @param {string} [color="#fbbf24"] - Hex stroke color
 * @param {number} [strokeWidth=3.5]
 * @returns {string}
 */
export function getZodiacSvgGlyph(sign, color = "#fbbf24", strokeWidth = 3.5) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const pathMarkup = ZODIAC_SVG_PATHS[capitalized] || ZODIAC_SVG_PATHS.Taurus;

  return `
    <g stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" fill="none">
      ${pathMarkup}
    </g>
  `.trim();
}

/**
 * Renders a crisp deterministic vector arrow SVG (width x height).
 * @param {object} params
 * @param {string} [params.color="#c4b5fd"]
 * @param {number} [params.width=28]
 * @param {number} [params.height=28]
 * @param {number} [params.strokeWidth=3]
 * @returns {string}
 */
export function renderVectorArrowSvg({
  color = "#c4b5fd",
  width = 28,
  height = 28,
  strokeWidth = 3,
} = {}) {
  return `
    <svg width="${width}" height="${height}" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 14H23M23 14L15 6M23 14L15 22" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `.trim();
}
