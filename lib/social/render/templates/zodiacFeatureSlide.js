// lib/social/render/templates/zodiacFeatureSlide.js
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  ZODIAC_DATA,
  LAYOUT_ZONES,
  renderCosmicBackground,
  renderHeaderBoxes,
  renderTextToFit,
} from "../designSystem.js";

/**
 * Generates the SVG vector background for the Zodiac Feature Slide (Slides 2, 3, 4).
 * Zero SVG text elements.
 * @param {object} params
 * @param {string} [params.sign] - Zodiac sign name
 * @returns {string}
 */
export function renderZodiacFeatureSlideBg({ sign } = {}) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Emblem Celestial Disc Background -->
      <g transform="translate(540, 285)">
        <circle cx="0" cy="0" r="82" fill="${accent.color}" fill-opacity="0.08" />
        <circle cx="0" cy="0" r="72" fill="none" stroke="${accent.color}" stroke-opacity="0.25" stroke-width="1.5" stroke-dasharray="4 4" />
        <circle cx="0" cy="0" r="64" fill="#141733" stroke="${accent.color}" stroke-width="2" filter="url(#glowSubtle)" />
        <circle cx="0" cy="-56" r="2.5" fill="${accent.color}" />
        <circle cx="0" cy="56" r="2.5" fill="${accent.color}" />
        <circle cx="-56" cy="0" r="2.5" fill="${accent.color}" />
        <circle cx="56" cy="0" r="2.5" fill="${accent.color}" />
      </g>

      <!-- Element Badge Box -->
      <g transform="translate(540, 510)">
        <rect x="-95" y="-17" width="190" height="34" rx="17" fill="${accent.badgeBg}" stroke="${accent.badgeBorder}" stroke-width="1.2" stroke-opacity="0.8" />
      </g>

      <!-- Subtle Divider Line -->
      <line x1="340" y1="695" x2="740" y2="695" stroke="#7c3aed" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="6 6" />
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the Zodiac Feature Slide with strict bounding box fitting.
 * @param {object} params
 * @param {string} params.sign - Zodiac sign name
 * @param {string} params.headline - Specific trait headline
 * @param {string} params.body - Short readable insight text
 * @param {number} [params.slideNumber=2]
 * @param {number} [params.totalSlides=5]
 * @param {string} params.fontBoldPath
 * @param {string} params.fontRegularPath
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getZodiacFeatureSlideTextLayers({
  sign,
  headline,
  body,
  slideNumber = 2,
  totalSlides = 5,
  fontBoldPath,
  fontRegularPath,
}) {
  const composites = [];
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

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

  // 3. Zodiac Emblem Glyph (Inside Celestial Disc at cx: 540, cy: 285)
  const glyphRes = await renderTextToFit({
    text: data.symbol,
    fontfile: fontBoldPath,
    preferredSize: 46,
    minSize: 36,
    color: accent.color,
    maxWidth: 100,
    maxHeight: 60,
    align: "center",
  });
  composites.push({
    input: glyphRes.buffer,
    top: Math.round(285 - glyphRes.height / 2),
    left: Math.round(540 - glyphRes.width / 2),
  });

  // 4. Sign Name (Zone: y 410-475, e.g. TAURUS)
  const signRes = await renderTextToFit({
    text: capitalized.toUpperCase(),
    fontfile: fontBoldPath,
    preferredSize: 52,
    minSize: 40,
    color: COLORS.textPrimary,
    maxWidth: 600,
    maxHeight: LAYOUT_ZONES.FEATURE.SIGN.height,
    align: "center",
  });
  composites.push({
    input: signRes.buffer,
    top: Math.round(442 - signRes.height / 2),
    left: Math.round((CANVAS_WIDTH - signRes.width) / 2),
  });

  // 5. Element Badge (Zone: y 485-535, e.g. EARTH SIGN)
  const elemRes = await renderTextToFit({
    text: accent.label,
    fontfile: fontBoldPath,
    preferredSize: 17,
    minSize: 14,
    color: accent.color,
    maxWidth: 180,
    maxHeight: 26,
    align: "center",
  });
  composites.push({
    input: elemRes.buffer,
    top: 501,
    left: Math.round((CANVAS_WIDTH - elemRes.width) / 2),
  });

  // 6. Trait Headline (Zone: y 560-680, e.g. Steady and Dependable)
  const displayHeadline = headline || capitalized;
  const headlineRes = await renderTextToFit({
    text: displayHeadline,
    fontfile: fontBoldPath,
    preferredSize: 44,
    minSize: 32,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.FEATURE.HEADLINE.maxWidth,
    maxHeight: LAYOUT_ZONES.FEATURE.HEADLINE.height,
    align: "center",
  });
  composites.push({
    input: headlineRes.buffer,
    top: Math.round(615 - headlineRes.height / 2),
    left: Math.round((CANVAS_WIDTH - headlineRes.width) / 2),
  });

  // 7. Body Insight Paragraph (Zone: y 720-1020)
  const bodyRes = await renderTextToFit({
    text: body || "",
    fontfile: fontRegularPath,
    preferredSize: 30,
    minSize: 22,
    color: COLORS.textSecondary,
    maxWidth: LAYOUT_ZONES.FEATURE.BODY.maxWidth,
    maxHeight: LAYOUT_ZONES.FEATURE.BODY.height,
    align: "center",
  });
  composites.push({
    input: bodyRes.buffer,
    top: Math.round(840 - bodyRes.height / 2),
    left: Math.round((CANVAS_WIDTH - bodyRes.width) / 2),
  });

  // 8. Footer Swipe Prompt (Zone: y 1140-1240)
  const footRes = await renderTextToFit({
    text: "Swipe to explore →",
    fontfile: fontBoldPath,
    preferredSize: 16,
    minSize: 14,
    color: COLORS.textMuted,
    maxWidth: 400,
    maxHeight: 30,
    align: "center",
  });
  composites.push({
    input: footRes.buffer,
    top: 1180,
    left: Math.round((CANVAS_WIDTH - footRes.width) / 2),
  });

  return composites;
}
