// lib/social/render/templates/ctaSlide.js
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
 * Generates the SVG vector background for the Call to Action (CTA) Slide (Last Slide).
 * Zero SVG text elements.
 * @returns {string}
 */
export function renderCtaSlideBg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Glowing Star Celestial Crest -->
      <g transform="translate(540, 280)">
        <circle cx="0" cy="0" r="48" fill="#1e1b4b" stroke="#f59e0b" stroke-width="2" filter="url(#glow)" />
        <path d="M0 -30 Q0 0 -30 0 Q0 0 0 30 Q0 0 30 0 Q0 0 0 -30 Z" fill="url(#goldTextGrad)" />
      </g>

      <!-- Primary Action Button Box -->
      <g transform="translate(540, 868)">
        <rect x="-300" y="-48" width="600" height="96" rx="48" fill="url(#purpleButtonGrad)" filter="url(#glow)" />
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the CTA Slide with strict bounding box fitting.
 * @param {object} params
 * @param {string} [params.headline="Discover more with AI Zodiac"]
 * @param {string} [params.body="Daily astrology, compatibility and zodiac insights in one app."]
 * @param {number} [params.slideNumber=5]
 * @param {number} [params.totalSlides=5]
 * @param {string} params.fontBoldPath
 * @param {string} params.fontRegularPath
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getCtaSlideTextLayers({
  headline = "Discover more with AI Zodiac",
  body = "Daily astrology, compatibility and zodiac insights in one app.",
  slideNumber = 5,
  totalSlides = 5,
  fontBoldPath,
  fontRegularPath,
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

  // 3. CTA Main Headline (Zone: y 390-570, e.g. Discover more with AI Zodiac)
  const headlineRes = await renderTextToFit({
    text: headline || "Discover more with AI Zodiac",
    fontfile: fontBoldPath,
    preferredSize: 56,
    minSize: 42,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.CTA.HEADLINE.maxWidth,
    maxHeight: LAYOUT_ZONES.CTA.HEADLINE.height,
    align: "center",
  });
  composites.push({
    input: headlineRes.buffer,
    top: Math.round(475 - headlineRes.height / 2),
    left: Math.round((CANVAS_WIDTH - headlineRes.width) / 2),
  });

  // 4. Supporting Descriptive Copy (Zone: y 600-740)
  const supportCopy = (body && body !== "Free on Google Play")
    ? body
    : "Daily astrology, compatibility and zodiac insights in one app.";
  const bodyRes = await renderTextToFit({
    text: supportCopy,
    fontfile: fontRegularPath,
    preferredSize: 30,
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

  // 5. Primary Action Button Text (Inside Button at cy: 868, w: 600, h: 96)
  const btnRes = await renderTextToFit({
    text: "DOWNLOAD FREE",
    fontfile: fontBoldPath,
    preferredSize: 30,
    minSize: 22,
    color: "#ffffff",
    maxWidth: 540,
    maxHeight: 45,
    align: "center",
  });
  composites.push({
    input: btnRes.buffer,
    top: Math.round(868 - btnRes.height / 2),
    left: Math.round((CANVAS_WIDTH - btnRes.width) / 2),
  });

  // 6. Secondary Subtitle Line (Zone: y 955-1015)
  const secRes = await renderTextToFit({
    text: "Available on Google Play",
    fontfile: fontBoldPath,
    preferredSize: 22,
    minSize: 18,
    color: COLORS.accentGold,
    maxWidth: 500,
    maxHeight: 35,
    align: "center",
  });
  composites.push({
    input: secRes.buffer,
    top: 965,
    left: Math.round((CANVAS_WIDTH - secRes.width) / 2),
  });

  // 7. Footer Legal / Entertainment Disclaimer (Zone: y 1160-1240)
  const footRes = await renderTextToFit({
    text: "© 2026 AI Zodiac • Astrology for Entertainment & Self-Discovery",
    fontfile: fontRegularPath,
    preferredSize: 17,
    minSize: 14,
    color: COLORS.textSubtle,
    maxWidth: 800,
    maxHeight: 30,
    align: "center",
  });
  composites.push({
    input: footRes.buffer,
    top: 1195,
    left: Math.round((CANVAS_WIDTH - footRes.width) / 2),
  });

  return composites;
}
