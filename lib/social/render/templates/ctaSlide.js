// lib/social/render/templates/ctaSlide.js
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  LAYOUT_ZONES,
  BACKGROUND_CTA_PATH,
  loadBackgroundImageBuffer,
  renderTextToFit,
} from "../designSystem.js";

/**
 * Loads the master CTA background PNG (1080x1350).
 * @returns {Promise<Buffer>}
 */
export async function getCtaSlideBg() {
  return await loadBackgroundImageBuffer(BACKGROUND_CTA_PATH);
}

/**
 * Generates the minimal SVG vector overlay for the Call to Action (CTA) Slide (Clean 540x92 Action Button).
 * Zero SVG text elements.
 * @returns {string}
 */
export function renderCtaSlideOverlaySvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      <defs>
        <linearGradient id="purpleButtonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#4f46e5" />
        </linearGradient>
      </defs>

      <!-- Primary Action Button Box (540x92) -->
      <g transform="translate(540, 870)">
        <rect x="-270" y="-46" width="540" height="92" rx="46" fill="url(#purpleButtonGrad)" stroke="#a78bfa" stroke-width="1.5" stroke-opacity="0.6" />
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the CTA Slide with strict bounding box fitting.
 * @param {object} params
 * @param {string} [params.headline="Discover more with\nAI Zodiac"]
 * @param {string} [params.body="Daily astrology, compatibility\nand zodiac insights in one app."]
 * @param {number} [params.slideNumber=5]
 * @param {number} [params.totalSlides=5]
 * @param {string} params.fontBoldPath
 * @param {string} params.fontRegularPath
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getCtaSlideTextLayers({
  headline = "Discover more with\nAI Zodiac",
  body = "Daily astrology, compatibility\nand zodiac insights in one app.",
  slideNumber = 5,
  totalSlides = 5,
  fontBoldPath,
  fontRegularPath,
}) {
  const composites = [];
  const padSlide = String(slideNumber).padStart(2, "0");
  const padTotal = String(totalSlides).padStart(2, "0");

  // 1. Header Branding (Zone: y 70-130)
  const brandRes = await renderTextToFit({
    text: "AI ZODIAC",
    fontfile: fontBoldPath,
    preferredSize: 28,
    minSize: 24,
    color: COLORS.accentLavender,
    maxWidth: 220,
    maxHeight: 40,
    align: "left",
  });
  composites.push({ input: brandRes.buffer, top: 80, left: 80 });

  // 2. Pagination Indicator (Zone: y 70-130)
  const pageRes = await renderTextToFit({
    text: `${padSlide} / ${padTotal}`,
    fontfile: fontBoldPath,
    preferredSize: 22,
    minSize: 18,
    color: COLORS.textMuted,
    maxWidth: 120,
    maxHeight: 35,
    align: "right",
  });
  composites.push({ input: pageRes.buffer, top: 84, left: 900 });

  // 3. CTA Main Headline (Two-line hierarchy, Zone: y 380-560)
  const headlineText = (headline && headline.includes("\n"))
    ? headline
    : (headline ? headline.replace(/with AI Zodiac/i, "with\nAI Zodiac") : "Discover more with\nAI Zodiac");

  const headlineRes = await renderTextToFit({
    text: headlineText,
    fontfile: fontBoldPath,
    preferredSize: 58,
    minSize: 44,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.CTA.HEADLINE.maxWidth,
    maxHeight: LAYOUT_ZONES.CTA.HEADLINE.height,
    align: "center",
  });
  composites.push({
    input: headlineRes.buffer,
    top: Math.round(480 - headlineRes.height / 2),
    left: Math.round((CANVAS_WIDTH - headlineRes.width) / 2),
  });

  // 4. Supporting Descriptive Copy (Zone: y 580-720, Max Width 700)
  const supportCopy = (body && body !== "Free on Google Play")
    ? body
    : "Daily astrology, compatibility\nand zodiac insights in one app.";
  const bodyRes = await renderTextToFit({
    text: supportCopy,
    fontfile: fontRegularPath,
    preferredSize: 29,
    minSize: 22,
    color: COLORS.textSecondary,
    maxWidth: LAYOUT_ZONES.CTA.BODY.maxWidth,
    maxHeight: LAYOUT_ZONES.CTA.BODY.height,
    align: "center",
  });
  composites.push({
    input: bodyRes.buffer,
    top: Math.round(660 - bodyRes.height / 2),
    left: Math.round((CANVAS_WIDTH - bodyRes.width) / 2),
  });

  // 5. Primary Action Button Text (Inside 540x92 Button at cy: 870)
  const btnRes = await renderTextToFit({
    text: "DOWNLOAD FREE",
    fontfile: fontBoldPath,
    preferredSize: 29,
    minSize: 22,
    color: "#ffffff",
    maxWidth: 480,
    maxHeight: 45,
    align: "center",
  });
  composites.push({
    input: btnRes.buffer,
    top: Math.round(870 - btnRes.height / 2),
    left: Math.round((CANVAS_WIDTH - btnRes.width) / 2),
  });

  // 6. Secondary Subtitle Line (Zone: y 945-995)
  const secRes = await renderTextToFit({
    text: "Available on Google Play",
    fontfile: fontBoldPath,
    preferredSize: 22,
    minSize: 18,
    color: COLORS.accentGold,
    maxWidth: 450,
    maxHeight: 35,
    align: "center",
  });
  composites.push({
    input: secRes.buffer,
    top: 965,
    left: Math.round((CANVAS_WIDTH - secRes.width) / 2),
  });

  return composites;
}
