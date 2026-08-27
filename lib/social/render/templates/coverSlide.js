// lib/social/render/templates/coverSlide.js
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  LAYOUT_ZONES,
  BACKGROUND_COVER_PATH,
  loadBackgroundImageBuffer,
  renderTextToFit,
} from "../designSystem.js";

/**
 * Loads the master Cover background PNG (1080x1350).
 * @returns {Promise<Buffer>}
 */
export async function getCoverSlideBg() {
  return await loadBackgroundImageBuffer(BACKGROUND_COVER_PATH);
}

/**
 * Generates the minimal SVG vector overlay for the Cover Slide.
 * Zero SVG text elements.
 * @returns {string}
 */
export function renderCoverSlideOverlaySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}"></svg>`.trim();
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
  const padSlide = String(slideNumber).padStart(2, "0");
  const padTotal = String(totalSlides).padStart(2, "0");

  // 1. Header Branding (Zone: y 70-135)
  const brandRes = await renderTextToFit({
    text: "AI ZODIAC",
    fontfile: fontBoldPath,
    preferredSize: 44,
    minSize: 36,
    color: COLORS.accentLavender,
    maxWidth: 380,
    maxHeight: 56,
    align: "left",
  });
  composites.push({ input: brandRes.buffer, top: 76, left: 80 });

  // 2. Pagination Indicator (Zone: y 70-135)
  const pageRes = await renderTextToFit({
    text: `${padSlide} / ${padTotal}`,
    fontfile: fontBoldPath,
    preferredSize: 26,
    minSize: 20,
    color: COLORS.textMuted,
    maxWidth: 150,
    maxHeight: 45,
    align: "right",
  });
  composites.push({
    input: pageRes.buffer,
    top: 82,
    left: Math.round(CANVAS_WIDTH - pageRes.width - 80),
  });

  // 3. Category Label (Zone: y 230-310)
  const rawCat = (categoryTitle ? categoryTitle.split("/")[0].trim() : (category || "")).toUpperCase();
  const displayCategory = (rawCat && rawCat.length <= 16)
    ? `${rawCat} • TOP 3 SIGNS`
    : "TOP 3 ZODIAC SIGNS";

  const catRes = await renderTextToFit({
    text: displayCategory,
    fontfile: fontBoldPath,
    preferredSize: 34,
    minSize: 28,
    color: COLORS.accentGold,
    maxWidth: 800,
    maxHeight: 50,
    align: "center",
  });
  composites.push({
    input: catRes.buffer,
    top: Math.round(270 - catRes.height / 2),
    left: Math.round((CANVAS_WIDTH - catRes.width) / 2),
  });

  // 4. Main Multi-Line Title Hook (Zone: y 380-920, Max Width 860)
  const titleRes = await renderTextToFit({
    text: headline || "Daily Zodiac Insights",
    fontfile: fontBoldPath,
    preferredSize: 76,
    minSize: 52,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.COVER.TITLE.maxWidth,
    maxHeight: LAYOUT_ZONES.COVER.TITLE.height,
    align: "center",
    balance: true,
    maxCharsPerLine: 19,
    spacing: 6,
  });
  composites.push({
    input: titleRes.buffer,
    top: Math.round(590 - titleRes.height / 2),
    left: Math.round((CANVAS_WIDTH - titleRes.width) / 2),
  });

  // 5. Bottom Swipe Prompt (Zone: y 1130-1250)
  const swipeRes = await renderTextToFit({
    text: "Swipe to discover →",
    fontfile: fontBoldPath,
    preferredSize: 40,
    minSize: 32,
    color: COLORS.accentLavender,
    maxWidth: 550,
    maxHeight: 56,
    align: "center",
  });
  composites.push({
    input: swipeRes.buffer,
    top: Math.round(1185 - swipeRes.height / 2),
    left: Math.round((CANVAS_WIDTH - swipeRes.width) / 2),
  });

  return composites;
}
