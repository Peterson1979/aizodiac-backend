// lib/social/render/templates/zodiacFeatureSlide.js
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  ZODIAC_DATA,
  LAYOUT_ZONES,
  BACKGROUND_ZODIAC_PATH,
  loadBackgroundImageBuffer,
  renderTextToFit,
} from "../designSystem.js";

/**
 * Loads the master Zodiac Feature background PNG (1080x1350).
 * @returns {Promise<Buffer>}
 */
export async function getZodiacFeatureSlideBg() {
  return await loadBackgroundImageBuffer(BACKGROUND_ZODIAC_PATH);
}

/**
 * Generates the minimal SVG vector overlay for the Zodiac Feature Slide (Emblem Disc & Element Pill).
 * Zero SVG text elements.
 * @param {object} params
 * @param {string} [params.sign] - Zodiac sign name
 * @returns {string}
 */
export function renderZodiacFeatureSlideOverlaySvg({ sign } = {}) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      <!-- 180px Clean Zodiac Celestial Disc -->
      <g transform="translate(540, 255)">
        <circle cx="0" cy="0" r="88" fill="#141733" fill-opacity="0.92" stroke="${accent.color}" stroke-width="2.5" />
      </g>

      <!-- Element Badge Box -->
      <g transform="translate(540, 462)">
        <rect x="-95" y="-17" width="190" height="34" rx="17" fill="${accent.badgeBg}" stroke="${accent.color}" stroke-width="1.2" stroke-opacity="0.8" />
      </g>
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
  const padSlide = String(slideNumber).padStart(2, "0");
  const padTotal = String(totalSlides).padStart(2, "0");

  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

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

  // 3. Zodiac Emblem Glyph (Inside 180px Disc at cx: 540, cy: 255)
  const glyphRes = await renderTextToFit({
    text: data.symbol,
    fontfile: fontBoldPath,
    preferredSize: 64,
    minSize: 48,
    color: accent.color,
    maxWidth: 120,
    maxHeight: 80,
    align: "center",
  });
  composites.push({
    input: glyphRes.buffer,
    top: Math.round(255 - glyphRes.height / 2),
    left: Math.round(540 - glyphRes.width / 2),
  });

  // 4. Sign Name (Zone: y 365-440, e.g. TAURUS)
  const signRes = await renderTextToFit({
    text: capitalized.toUpperCase(),
    fontfile: fontBoldPath,
    preferredSize: 62,
    minSize: 48,
    color: COLORS.textPrimary,
    maxWidth: 600,
    maxHeight: LAYOUT_ZONES.FEATURE.SIGN.height,
    align: "center",
  });
  composites.push({
    input: signRes.buffer,
    top: Math.round(395 - signRes.height / 2),
    left: Math.round((CANVAS_WIDTH - signRes.width) / 2),
  });

  // 5. Element Badge (Zone: y 445-495, e.g. EARTH SIGN)
  const elemRes = await renderTextToFit({
    text: accent.label,
    fontfile: fontBoldPath,
    preferredSize: 18,
    minSize: 14,
    color: accent.color,
    maxWidth: 180,
    maxHeight: 30,
    align: "center",
  });
  composites.push({
    input: elemRes.buffer,
    top: Math.round(462 - elemRes.height / 2),
    left: Math.round((CANVAS_WIDTH - elemRes.width) / 2),
  });

  // 6. Trait Headline (Zone: y 510-620, e.g. Steady and Dependable)
  const rawHeadline = headline || capitalized;
  const cleanHeadline = rawHeadline.trim().replace(/[.,;:!?]+$/, "");
  const headlineRes = await renderTextToFit({
    text: cleanHeadline,
    fontfile: fontBoldPath,
    preferredSize: 46,
    minSize: 36,
    color: COLORS.textPrimary,
    maxWidth: LAYOUT_ZONES.FEATURE.HEADLINE.maxWidth,
    maxHeight: LAYOUT_ZONES.FEATURE.HEADLINE.height,
    align: "center",
  });
  composites.push({
    input: headlineRes.buffer,
    top: Math.round(545 - headlineRes.height / 2),
    left: Math.round((CANVAS_WIDTH - headlineRes.width) / 2),
  });

  // 7. Body Insight Paragraph (Zone: y 640-1040, Max Width 780)
  const bodyRes = await renderTextToFit({
    text: body || "",
    fontfile: fontRegularPath,
    preferredSize: 38,
    minSize: 28,
    color: COLORS.textSecondary,
    maxWidth: LAYOUT_ZONES.FEATURE.BODY.maxWidth,
    maxHeight: LAYOUT_ZONES.FEATURE.BODY.height,
    align: "center",
    spacing: 6,
  });
  composites.push({
    input: bodyRes.buffer,
    top: Math.round(765 - bodyRes.height / 2),
    left: Math.round((CANVAS_WIDTH - bodyRes.width) / 2),
  });

  // 8. Footer Swipe Prompt (Zone: y 1130-1250)
  const footRes = await renderTextToFit({
    text: "Swipe to explore →",
    fontfile: fontBoldPath,
    preferredSize: 38,
    minSize: 30,
    color: COLORS.accentLavender,
    maxWidth: 550,
    maxHeight: 56,
    align: "center",
  });
  composites.push({
    input: footRes.buffer,
    top: Math.round(1185 - footRes.height / 2),
    left: Math.round((CANVAS_WIDTH - footRes.width) / 2),
  });

  return composites;
}
