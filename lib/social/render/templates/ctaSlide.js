// lib/social/render/templates/ctaSlide.js
import sharp from "sharp";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  COLORS,
  renderCosmicBackground,
  renderHeaderBoxes,
} from "../designSystem.js";

/**
 * Generates the SVG vector background for the Call to Action (CTA) Slide (Last Slide).
 * @returns {string}
 */
export function renderCtaSlideBg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}">
      ${renderCosmicBackground()}
      ${renderHeaderBoxes()}

      <!-- Central CTA Card Container -->
      <g transform="translate(90, 230)">
        <rect width="900" height="910" rx="36" fill="#12152c" fill-opacity="0.94" stroke="#7c3aed" stroke-width="2.5" />

        <!-- Glowing Star Celestial Crest -->
        <g transform="translate(450, 115)">
          <circle cx="0" cy="0" r="55" fill="#1e1b4b" stroke="#f59e0b" stroke-width="2" filter="url(#glow)" />
          <path d="M0 -34 Q0 0 -34 0 Q0 0 0 34 Q0 0 34 0 Q0 0 0 -34 Z" fill="url(#goldTextGrad)" />
        </g>

        <!-- App Feature Highlights Pill Box -->
        <g transform="translate(150, 520)">
          <rect width="600" height="56" rx="28" fill="#1a1d36" stroke="#2e3458" stroke-width="1.5" />
        </g>

        <!-- Primary Action Button Box -->
        <g transform="translate(150, 620)">
          <rect width="600" height="88" rx="44" fill="url(#purpleButtonGrad)" filter="url(#glow)" />
        </g>
      </g>
    </svg>
  `.trim();
}

/**
 * Computes Sharp text layer specifications for the CTA Slide.
 * @param {object} params
 * @param {string} [params.headline="Discover more with AI Zodiac"]
 * @param {string} [params.body="Your daily horoscope, compatibility & personal astrology."]
 * @param {number} [params.slideNumber=5]
 * @param {number} [params.totalSlides=5]
 * @param {Function} params.createTextLayer
 * @param {string} params.fontBoldPath
 * @param {string} params.fontRegularPath
 * @returns {Promise<Array<{ input: Buffer, top: number, left: number }>>}
 */
export async function getCtaSlideTextLayers({
  headline = "Discover more with AI Zodiac",
  body = "Your daily horoscope, compatibility and astrology insights in one app.",
  slideNumber = 5,
  totalSlides = 5,
  createTextLayer,
  fontBoldPath,
  fontRegularPath,
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

  // 3. CTA Main Headline
  const headlineBuf = await createTextLayer({
    text: headline || "Discover more with AI Zodiac",
    fontfile: fontBoldPath,
    fontSize: 46,
    color: COLORS.textPrimary,
    width: 800,
    align: "center",
  });
  const hMeta = await sharp(headlineBuf).metadata();
  composites.push({
    input: headlineBuf,
    top: Math.round(485 - hMeta.height / 2),
    left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
  });

  // 4. Supporting Descriptive Copy
  const supportCopy = (body && body !== "Free on Google Play")
    ? body
    : "Your zodiac insights, compatibility and daily astrology in one app.";
  const bodyBuf = await createTextLayer({
    text: supportCopy,
    fontfile: fontRegularPath,
    fontSize: 28,
    color: COLORS.textSecondary,
    width: 780,
    align: "center",
  });
  const bMeta = await sharp(bodyBuf).metadata();
  composites.push({
    input: bodyBuf,
    top: 620,
    left: Math.round((CANVAS_WIDTH - bMeta.width) / 2),
  });

  // 5. Feature Highlights Pill Text: box at x: 240, y: 750, w: 600, h: 56
  const featuresBuf = await createTextLayer({
    text: "HOROSCOPES • COMPATIBILITY • NUMEROLOGY",
    fontfile: fontBoldPath,
    fontSize: 18,
    color: COLORS.accentLavender,
    width: 600,
    align: "center",
  });
  composites.push({ input: featuresBuf, top: 766, left: 240 });

  // 6. Primary Action Button Text: box at x: 240, y: 850, w: 600, h: 88
  const btnBuf = await createTextLayer({
    text: "GET AI ZODIAC ON GOOGLE PLAY",
    fontfile: fontBoldPath,
    fontSize: 23,
    color: "#ffffff",
    width: 600,
    align: "center",
  });
  composites.push({ input: btnBuf, top: 908, left: 240 });

  // 7. Free on Google Play subtitle badge
  const freeBadgeBuf = await createTextLayer({
    text: "✦ FREE ON GOOGLE PLAY ✦",
    fontfile: fontBoldPath,
    fontSize: 15,
    color: COLORS.accentGold,
    width: 400,
    align: "center",
  });
  composites.push({ input: freeBadgeBuf, top: 980, left: 340 });

  // 8. Footer Legal / Entertainment Disclaimer: y: 1205
  const footerBuf = await createTextLayer({
    text: "© 2026 AI Zodiac • Astrology for Entertainment & Self-Discovery",
    fontfile: fontRegularPath,
    fontSize: 17,
    color: COLORS.textSubtle,
    width: 800,
    align: "center",
  });
  composites.push({ input: footerBuf, top: 1205, left: 140 });

  return composites;
}
