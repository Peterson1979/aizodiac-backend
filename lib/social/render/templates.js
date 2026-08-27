// lib/social/render/templates.js

export const CANVAS_WIDTH = 1080;
export const CANVAS_HEIGHT = 1350;

/**
 * Escapes XML/SVG special characters to prevent malformed SVG/Pango markup.
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
 * Wraps text into an array of lines based on maximum character count per line.
 * Respects word boundaries and prevents text overflow.
 * @param {string} text - Raw input text
 * @param {number} [maxChars=36] - Maximum characters per line
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

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates shared cosmic SVG background with celestial glows, stars, and orbital rings.
 * Contains purely graphical elements (no text).
 * @returns {string}
 */
export function renderCosmicBackground() {
  return `
    <defs>
      <!-- Background Gradients -->
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#080914" />
        <stop offset="50%" stop-color="#0e1022" />
        <stop offset="100%" stop-color="#141733" />
      </linearGradient>

      <radialGradient id="nebulaViolet" cx="25%" cy="20%" r="50%">
        <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#7c3aed" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="nebulaGold" cx="80%" cy="75%" r="45%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.22" />
        <stop offset="100%" stop-color="#f59e0b" stop-opacity="0" />
      </radialGradient>

      <radialGradient id="nebulaCyan" cx="70%" cy="25%" r="40%">
        <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
      </radialGradient>

      <linearGradient id="goldTextGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#fef08a" />
        <stop offset="50%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>

      <linearGradient id="purpleButtonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7c3aed" />
        <stop offset="100%" stop-color="#4f46e5" />
      </linearGradient>

      <!-- Glow Filters -->
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Base Canvas Background -->
    <rect width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" fill="url(#bgGrad)" />

    <!-- Nebula Glow Overlays -->
    <circle cx="250" cy="250" r="450" fill="url(#nebulaViolet)" />
    <circle cx="850" cy="980" r="450" fill="url(#nebulaGold)" />
    <circle cx="780" cy="300" r="350" fill="url(#nebulaCyan)" />

    <!-- Celestial Orbital Rings -->
    <circle cx="540" cy="675" r="480" fill="none" stroke="#a78bfa" stroke-opacity="0.12" stroke-width="1.5" stroke-dasharray="6 8" />
    <circle cx="540" cy="675" r="360" fill="none" stroke="#38bdf8" stroke-opacity="0.08" stroke-width="1" />
    <circle cx="540" cy="675" r="240" fill="none" stroke="#f59e0b" stroke-opacity="0.10" stroke-width="1" stroke-dasharray="3 6" />

    <!-- Subtle Background Constellation Stars -->
    <g fill="#f8fafc" opacity="0.65">
      <circle cx="140" cy="180" r="2" />
      <circle cx="280" cy="120" r="3" opacity="0.8" />
      <circle cx="920" cy="220" r="2.5" opacity="0.9" />
      <circle cx="880" cy="450" r="1.5" />
      <circle cx="160" cy="890" r="3" opacity="0.85" />
      <circle cx="220" cy="1150" r="2" />
      <circle cx="940" cy="1100" r="3" opacity="0.9" />
      <circle cx="480" cy="180" r="1.5" />
      <circle cx="620" cy="1220" r="2" />
    </g>

    <!-- Celestial Sparks -->
    <g fill="#fbbf24" opacity="0.75">
      <path d="M120 480 Q120 500 100 500 Q120 500 120 520 Q120 500 140 500 Q120 500 120 480 Z" />
      <path d="M960 780 Q960 795 945 795 Q960 795 960 810 Q960 795 975 795 Q960 795 960 780 Z" />
      <path d="M860 140 Q860 155 845 155 Q860 155 860 170 Q860 155 875 155 Q860 155 860 140 Z" opacity="0.5" />
    </g>
  `;
}

/**
 * Renders the top branding header and pagination indicator boxes (SVG graphics only).
 * @returns {string}
 */
export function renderHeaderBg() {
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
 * Generates Title Slide SVG graphic background (Slide 1).
 * @returns {string}
 */
export function renderTitleSlideSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBg()}

      <!-- Category Spotlight Badge Box -->
      <g transform="translate(540, 360)">
        <rect x="-180" y="-24" width="360" height="48" rx="24" fill="#1e1b4b" fill-opacity="0.9" stroke="#7c3aed" stroke-width="1.5" />
      </g>

      <!-- Center Star Crest Graphic -->
      <g transform="translate(540, 480)">
        <circle cx="0" cy="0" r="50" fill="#181b30" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.6" filter="url(#glow)" />
        <path d="M0 -30 Q0 0 -30 0 Q0 0 0 30 Q0 0 30 0 Q0 0 0 -30 Z" fill="url(#goldTextGrad)" />
      </g>

      <!-- Bottom Swipe Prompt Box -->
      <g transform="translate(540, 1200)">
        <rect x="-150" y="-24" width="300" height="48" rx="24" fill="#181b30" fill-opacity="0.8" stroke="#4b5563" stroke-width="1" />
      </g>
    </svg>
  `.trim();
}

/**
 * Generates Sign or Insight Slide SVG graphic background (Slides 2, 3, 4).
 * @param {object} [params={}]
 * @param {string} [params.sign] - Zodiac sign name if applicable
 * @returns {string}
 */
export function renderContentSlideSvg({ sign = null } = {}) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBg()}

      <!-- Central Content Card Container -->
      <g transform="translate(90, 240)">
        <rect width="900" height="880" rx="32" fill="#13162b" fill-opacity="0.88" stroke="#2e3458" stroke-width="2" />

        ${sign ? `
          <!-- Zodiac Sign Highlight Badge Box -->
          <g transform="translate(450, 110)">
            <rect x="-160" y="-30" width="320" height="60" rx="30" fill="#231f42" stroke="#f59e0b" stroke-width="2" />
          </g>
        ` : `
          <!-- Insight Key Indicator Box -->
          <g transform="translate(450, 110)">
            <circle cx="0" cy="0" r="32" fill="#1e1b4b" stroke="#a78bfa" stroke-width="2" />
          </g>
        `}

        <!-- Divider Line -->
        <line x1="250" y1="360" x2="650" y2="360" stroke="#7c3aed" stroke-opacity="0.5" stroke-width="2" stroke-dasharray="8 6" />
      </g>
    </svg>
  `.trim();
}

/**
 * Generates Call to Action (CTA) Slide SVG graphic background (Last Slide).
 * @returns {string}
 */
export function renderCtaSlideSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBg()}

      <!-- Central CTA Card Container -->
      <g transform="translate(90, 260)">
        <rect width="900" height="840" rx="36" fill="#13162b" fill-opacity="0.92" stroke="#7c3aed" stroke-width="2.5" />

        <!-- Glowing Star Emblem -->
        <g transform="translate(450, 140)">
          <circle cx="0" cy="0" r="60" fill="#1e1b4b" stroke="#f59e0b" stroke-width="2" filter="url(#glow)" />
          <path d="M0 -38 Q0 0 -38 0 Q0 0 0 38 Q0 0 38 0 Q0 0 0 -38 Z" fill="url(#goldTextGrad)" />
        </g>

        <!-- App Feature Highlights Pill Box -->
        <g transform="translate(150, 530)">
          <rect width="600" height="64" rx="32" fill="#1a1d36" stroke="#2e3458" stroke-width="1.5" />
        </g>

        <!-- Primary Action Button Box -->
        <g transform="translate(180, 640)">
          <rect width="540" height="88" rx="44" fill="url(#purpleButtonGrad)" filter="url(#glow)" />
        </g>
      </g>
    </svg>
  `.trim();
}
