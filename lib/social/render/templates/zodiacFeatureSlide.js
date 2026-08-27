// lib/social/render/templates/zodiacFeatureSlide.js
import sharp from "sharp";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  ZODIAC_DATA,
  renderCosmicBackground,
  renderHeaderBoxes,
  renderZodiacEmblemSvg,
  getAdaptiveHeadlineSize,
  getAdaptiveBodySize,
} from "../designSystem.js";

/**
 * Generates the SVG vector background for the Zodiac Feature Slide (Slides 2, 3, 4).
 * @param {object} params
 * @param {string} [params.sign] - Zodiac sign name
 * @param {number} [params.slideNumber=2]
 * @returns {string}
 */
export function renderZodiacFeatureSlideBg({ sign, slideNumber = 2 } = {}) {
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Central Content Card Container -->
      <g transform="translate(90, 230)">
        <rect width="900" height="910" rx="32" fill="#12152c" fill-opacity="0.90" stroke="#272c50" stroke-width="2" />

        ${renderZodiacEmblemSvg({ sign: capitalized, cx: 450, cy: 115, radius: 55 })}

        <!-- Element & Sign Accent Badge Box -->
        <g transform="translate(450, 210)">
          <rect x="-160" y="-22" width="320" height="44" rx="22" fill="${accent.badgeBg}" stroke="${accent.badgeBorder}" stroke-width="1.5" stroke-opacity="0.8" />
        </g>

        <!-- Divider Line -->
        <line x1="200" y1="410" x2="700" y2="410" stroke="#7c3aed" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="6 6" />
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the Zodiac Feature Slide.
 * @param {object} params
 * @param {string} params.sign - Zodiac sign name
 * @param {string} params.headline - Specific trait headline
 * @param {string} params.body - Short readable insight text
 * @param {number} [params.slideNumber=2]
 * @param {number} [params.totalSlides=5]
 * @param {Function} params.createTextLayer
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
  createTextLayer,
  fontBoldPath,
  fontRegularPath,
}) {
  const composites = [];
  const normSign = (sign || "").trim();
  const capitalized = normSign ? (normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase()) : "Taurus";
  const data = ZODIAC_DATA[capitalized] || ZODIAC_DATA.Taurus;
  const accent = data.accent;

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

  // 3. Sign Name & Element Label in Top Card Badge: box at x: 380, y: 418, w: 320, h: 44
  const signBadgeBuf = await createTextLayer({
    text: `${capitalized.toUpperCase()} • ${accent.label}`,
    fontfile: fontBoldPath,
    fontSize: 17,
    color: accent.color,
    width: 320,
    align: "center",
  });
  composites.push({ input: signBadgeBuf, top: 428, left: 380 });

  // 4. Feature Trait Headline (Adaptive Typography)
  const displayHeadline = headline || capitalized;
  const headlineFontSize = getAdaptiveHeadlineSize(displayHeadline);
  const headlineBuf = await createTextLayer({
    text: displayHeadline,
    fontfile: fontBoldPath,
    fontSize: headlineFontSize,
    color: COLORS.textPrimary,
    width: 800,
    align: "center",
  });
  const hMeta = await sharp(headlineBuf).metadata();
  composites.push({
    input: headlineBuf,
    top: Math.round(545 - hMeta.height / 2),
    left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
  });

  // 5. Body Insight Paragraph (Adaptive Typography)
  const bodyFontSize = getAdaptiveBodySize(body);
  const bodyBuf = await createTextLayer({
    text: body || "",
    fontfile: fontRegularPath,
    fontSize: bodyFontSize,
    color: COLORS.textSecondary,
    width: 780,
    align: "center",
  });
  const bMeta = await sharp(bodyBuf).metadata();
  composites.push({
    input: bodyBuf,
    top: 700,
    left: Math.round((CANVAS_WIDTH - bMeta.width) / 2),
  });

  // 6. Bottom Daily Guidance Prompt
  const bottomBuf = await createTextLayer({
    text: "AI ZODIAC DAILY GUIDANCE",
    fontfile: fontBoldPath,
    fontSize: 17,
    color: COLORS.textMuted,
    width: 500,
    align: "center",
  });
  composites.push({ input: bottomBuf, top: 1205, left: 290 });

  return composites;
}
