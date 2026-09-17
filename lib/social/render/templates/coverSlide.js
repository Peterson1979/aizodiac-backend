// lib/social/render/templates/coverSlide.js
import sharp from "sharp";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  LAYOUT_ZONES,
  BACKGROUND_COVER_PATH,
  loadBackgroundImageBuffer,
  renderTextToFit,
} from "../designSystem.js";
import { renderVectorArrowSvg } from "../zodiacVectors.js";
import { getFormatDisplayLabel, stripFormatHeadlinePrefix } from "../../content/topicRotation.js";

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

export async function getCoverSlideVectorLayers() {
  const arrowSvg = renderVectorArrowSvg({ color: COLORS.accentLavender, width: 30, height: 30, strokeWidth: 3 });
  const arrowBuffer = await sharp(Buffer.from(arrowSvg)).png().toBuffer();
  return [{ input: arrowBuffer, top: 1170, left: 0, vectorType: "swipe-arrow" }];
}

/**
 * Computes Sharp text layer specifications for the Cover Slide with strict bounding box fitting.
 * Restores the original typography configuration used across all first cards.
 * @param {object} params
 * @param {string} params.headline - Main hook title
 * @param {string} [params.category] - Category slug
 * @param {string} [params.categoryTitle] - Human readable category
 * @param {string} [params.format] - Social content format key
 * @param {number} [params.slideNumber=1]
 * @param {number} [params.totalSlides=5]
 * @param {string} params.fontBoldPath - Absolute path to bold font
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number, width?: number, height?: number }>>}
 */
export async function getCoverSlideTextLayers({
  headline,
  category,
  categoryTitle,
  format,
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

  // 3. Category / Format Label (Zone: y 220-330)
  // Format-aware resolution: TOP 3 ZODIAC SIGNS for three_zodiac_signs, and format names for others
  const rawLabel = getFormatDisplayLabel(format, categoryTitle, category);
  const displayLabel = rawLabel.toUpperCase();

  const catRes = await renderTextToFit({
    text: displayLabel,
    fontfile: fontBoldPath,
    preferredSize: 56,
    minSize: 36,
    color: COLORS.accentGold,
    maxWidth: 900,
    maxHeight: 80,
    align: "center",
  });
  composites.push({
    input: catRes.buffer,
    top: Math.round(270 - catRes.height / 2),
    left: Math.round((CANVAS_WIDTH - catRes.width) / 2),
    width: catRes.width,
    height: catRes.height,
  });

  // 4. Main Multi-Line Title Hook (Zone: y 380-920, Max Width 860)
  const rawHeadline = (headline || "Daily Zodiac Insights").trim();
  const cleanHeadline = stripFormatHeadlinePrefix(rawHeadline, format);

  const titleRes = await renderTextToFit({
    text: cleanHeadline,
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
    width: titleRes.width,
    height: titleRes.height,
  });

  // 5. Bottom Swipe Prompt with Deterministic Vector Arrow (Zone: y 1130-1250)
  const swipeTextRes = await renderTextToFit({
    text: "Swipe to discover",
    fontfile: fontBoldPath,
    preferredSize: 40,
    minSize: 32,
    color: COLORS.accentLavender,
    maxWidth: 480,
    maxHeight: 56,
    align: "left",
  });
  const totalSwipeWidth = swipeTextRes.width + 12 + 30;
  const swipeStartLeft = Math.round((CANVAS_WIDTH - totalSwipeWidth) / 2);

  composites.push({
    input: swipeTextRes.buffer,
    top: Math.round(1185 - swipeTextRes.height / 2),
    left: swipeStartLeft,
    width: swipeTextRes.width,
  });
  return composites;
}

