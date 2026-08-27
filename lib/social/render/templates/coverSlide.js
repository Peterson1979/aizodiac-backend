// lib/social/render/templates/coverSlide.js
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  LAYOUT_ZONES,
  renderCosmicBackground,
  renderHeaderBoxes,
  renderTextToFit,
} from "../designSystem.js";

/**
 * Generates the SVG vector background for the Cover Slide (Slide 1).
 * Zero SVG text elements.
 * @returns {string}
 */
export function renderCoverSlideBg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Category Spotlight Badge Box -->
      <g transform="translate(540, 270)">
        <rect x="-160" y="-22" width="320" height="44" rx="22" fill="#1e1b4b" fill-opacity="0.9" stroke="#7c3aed" stroke-width="1.5" />
      </g>

      <!-- Center Celestial Star Crest -->
      <g transform="translate(540, 390)">
        <circle cx="0" cy="0" r="38" fill="#181b30" stroke="#f59e0b" stroke-width="1.8" stroke-opacity="0.6" filter="url(#glow)" />
        <path d="M0 -22 Q0 0 -22 0 Q0 0 0 22 Q0 0 22 0 Q0 0 0 -22 Z" fill="url(#goldTextGrad)" />
      </g>

      <!-- 3 Small Celestial Indicator Dots -->
      <g transform="translate(540, 990)" fill="#a78bfa" opacity="0.6">
        <circle cx="-28" cy="0" r="4" fill="#fbbf24" opacity="0.9" />
        <circle cx="0" cy="0" r="4" fill="#a78bfa" opacity="0.7" />
        <circle cx="28" cy="0" r="4" fill="#38bdf8" opacity="0.7" />
      </g>

      <!-- Bottom Swipe Prompt Pill Box -->
      <g transform="translate(540, 1185)">
        <rect x="-150" y="-23" width="300" height="46" rx="23" fill="#181b30" fill-opacity="0.85" stroke="#4b5563" stroke-width="1.2" />
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the Cover Slide with strict bounding box fitting.
 * @param {object} params
 * @param {string} params.headline - Main hook title
 * @param {string} params.category - Category slug
 * @param {string} params.categoryTitle - Human readable category
 * @param {number} [params.slideNumber=1]
 * @param {number} [params.totalSlides=5]
 * @param {string} params.fontBoldPath - Absolute path to bold font
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getCoverSlideTextLayers({
  headline,
  category,
  categoryTitle,
  slideNumber = 1,
  totalSlides = 5,
  fontBoldPath,
}) {
  const composites = [];

  // 1. Header Branding (Zone: y 70-145)
  const brandRes = await renderTextToFit({
    text: "AI ZODIAC",
    fontfile: fontBoldPath,
    preferredSize: 16,
    minSize: 14,
    color: COLORS.accentLavender,
    maxWidth: 180,
    maxHeight: 30,
    align: "center",
  });
  composites.push({ input: brandRes.buffer, top: 78, left: 90 });

  // 2. Pagination Indicator (Zone: y 70-145)
  const pageRes = await renderTextToFit({
    text: `${slideNumber} / ${totalSlides}`,
    fontfile: fontBoldPath,
    preferredSize: 16,
    minSize: 14,
    color: COLORS.textMuted,
    maxWidth: 140,
    maxHeight: 30,
    align: "center",
  });
  composites.push({ input: pageRes.buffer, top: 78, left: 850 });

  // 3. Category Badge Text (Zone: y 240-310)
  const displayCategory = (categoryTitle || category || "ZODIAC INSIGHT").toUpperCase();
  const catRes = await renderTextToFit({
    text: `✦ ${displayCategory} ✦`,
    fontfile: fontBoldPath,
    preferredSize: 16,
    minSize: 13,
    color: COLORS.accentGold,
    maxWidth: 300,
    maxHeight: 30,
    align: "center",
  });
  composites.push({ input: catRes.buffer, top: 258, left: 390 });

  // 4. Main Multi-Line Title Hook (Zone: y 470-920, Max Width 820)
  const titleRes = await renderTextToFit({
    text: headline || "Daily Zodiac Insights",
    fontfile: fontBoldPath,
    preferredSize: 62,
    minSize: 42,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.COVER.TITLE.maxWidth,
    maxHeight: LAYOUT_ZONES.COVER.TITLE.height,
    align: "center",
  });
  composites.push({
    input: titleRes.buffer,
    top: Math.round(660 - titleRes.height / 2),
    left: Math.round((CANVAS_WIDTH - titleRes.width) / 2),
  });

  // 5. Bottom Swipe Prompt (Zone: y 1140-1240)
  const swipeRes = await renderTextToFit({
    text: "Swipe to discover →",
    fontfile: fontBoldPath,
    preferredSize: 17,
    minSize: 14,
    color: COLORS.accentLavender,
    maxWidth: 280,
    maxHeight: 30,
    align: "center",
  });
  composites.push({ input: swipeRes.buffer, top: 1172, left: 400 });

  return composites;
}
