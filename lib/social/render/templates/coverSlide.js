// lib/social/render/templates/coverSlide.js
import sharp from "sharp";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  renderCosmicBackground,
  renderHeaderBoxes,
  getAdaptiveCoverTitleSize,
} from "../designSystem.js";

/**
 * Generates the SVG vector background for the Cover Slide (Slide 1).
 * @returns {string}
 */
export function renderCoverSlideBg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Category Spotlight Badge Box -->
      <g transform="translate(540, 360)">
        <rect x="-180" y="-23" width="360" height="46" rx="23" fill="#1e1b4b" fill-opacity="0.9" stroke="#7c3aed" stroke-width="1.5" />
      </g>

      <!-- Center Celestial Star Crest -->
      <g transform="translate(540, 480)">
        <circle cx="0" cy="0" r="50" fill="#181b30" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.6" filter="url(#glow)" />
        <path d="M0 -30 Q0 0 -30 0 Q0 0 0 30 Q0 0 30 0 Q0 0 0 -30 Z" fill="url(#goldTextGrad)" />
      </g>

      <!-- 3 Small Celestial Indicator Dots -->
      <g transform="translate(540, 1060)" fill="#a78bfa" opacity="0.6">
        <circle cx="-30" cy="0" r="4" fill="#fbbf24" opacity="0.9" />
        <circle cx="0" cy="0" r="4" fill="#a78bfa" opacity="0.7" />
        <circle cx="30" cy="0" r="4" fill="#38bdf8" opacity="0.7" />
      </g>

      <!-- Bottom Swipe Prompt Pill Box -->
      <g transform="translate(540, 1200)">
        <rect x="-160" y="-24" width="320" height="48" rx="24" fill="#181b30" fill-opacity="0.85" stroke="#4b5563" stroke-width="1.2" />
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the Cover Slide.
 * @param {object} params
 * @param {string} params.headline - Main hook title
 * @param {string} params.category - Category slug
 * @param {string} params.categoryTitle - Human readable category
 * @param {number} [params.slideNumber=1]
 * @param {number} [params.totalSlides=5]
 * @param {Function} params.createTextLayer - Helper to create RGBA buffer
 * @param {string} params.fontBoldPath - Absolute path to bold font
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getCoverSlideTextLayers({
  headline,
  category,
  categoryTitle,
  slideNumber = 1,
  totalSlides = 5,
  createTextLayer,
  fontBoldPath,
}) {
  const composites = [];

  // 1. Header Branding
  const brandBuf = await createTextLayer({
    text: "AI ZODIAC",
    fontfile: fontBoldPath,
    fontSize: 16,
    color: COLORS.accentLavender,
    width: 180,
    align: "center",
  });
  composites.push({ input: brandBuf, top: 88, left: 90 });

  // 2. Pagination Indicator
  const pageBuf = await createTextLayer({
    text: `${slideNumber} / ${totalSlides}`,
    fontfile: fontBoldPath,
    fontSize: 16,
    color: COLORS.textMuted,
    width: 140,
    align: "center",
  });
  composites.push({ input: pageBuf, top: 88, left: 850 });

  // 3. Category Spotlight Badge Text
  const displayCategory = (categoryTitle || category || "ZODIAC INSIGHT").toUpperCase();
  const catBuf = await createTextLayer({
    text: `✦ ${displayCategory} ✦`,
    fontfile: fontBoldPath,
    fontSize: 16,
    color: COLORS.accentGold,
    width: 360,
    align: "center",
  });
  composites.push({ input: catBuf, top: 348, left: 360 });

  // 4. Main Multi-Line Title Hook (Adaptive Typography)
  const titleFontSize = getAdaptiveCoverTitleSize(headline);
  const headlineBuf = await createTextLayer({
    text: headline || "Daily Zodiac Insights",
    fontfile: fontBoldPath,
    fontSize: titleFontSize,
    color: COLORS.textPrimary,
    width: 880,
    align: "center",
  });
  const hMeta = await sharp(headlineBuf).metadata();
  composites.push({
    input: headlineBuf,
    top: Math.round(710 - hMeta.height / 2),
    left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
  });

  // 5. Bottom Swipe Prompt
  const swipeBuf = await createTextLayer({
    text: "SWIPE TO EXPLORE ➔",
    fontfile: fontBoldPath,
    fontSize: 17,
    color: COLORS.accentLavender,
    width: 320,
    align: "center",
  });
  composites.push({ input: swipeBuf, top: 1188, left: 380 });

  return composites;
}
