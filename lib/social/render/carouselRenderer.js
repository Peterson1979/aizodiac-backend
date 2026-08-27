// lib/social/render/carouselRenderer.js
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  escapeXml,
  renderTitleSlideSvg,
  renderContentSlideSvg,
  renderCtaSlideSvg,
} from "./templates.js";
import { getTopicStrategyForDate } from "../content/topicRotation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicit absolute paths to bundled Noto Sans font files
export const FONT_REGULAR_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Regular.ttf");
export const FONT_BOLD_PATH = path.resolve(__dirname, "../../../assets/fonts/NotoSans-Bold.ttf");

/**
 * Creates an RGBA text layer buffer using Sharp with explicit fontfile.
 * @param {object} options
 * @param {string} options.text - Raw text string
 * @param {string} options.fontfile - Absolute path to font TTF
 * @param {number} [options.fontSize=32] - Font size in px/pt
 * @param {string} [options.color="#ffffff"] - Hex color
 * @param {number} [options.width=900] - Bounding box width
 * @param {string} [options.align="center"] - Alignment (left, center, right)
 * @param {number} [options.dpi=150] - Rendering DPI
 * @returns {Promise<Buffer>}
 */
export async function createTextLayer({
  text,
  fontfile,
  fontSize = 32,
  color = "#ffffff",
  width = 900,
  align = "center",
  dpi = 150,
}) {
  if (!fontfile) {
    throw new Error("Missing required fontfile for deterministic Sharp text rendering");
  }
  const cleanText = escapeXml(text || "");
  const pangoText = `<span foreground="${color}" font_size="${Math.round(fontSize * 1024)}">${cleanText}</span>`;

  return await sharp({
    text: {
      text: pangoText,
      fontfile,
      width,
      align,
      rgba: true,
      dpi,
    },
  }).png().toBuffer();
}

/**
 * Builds the deterministic R2 storage key for a slide.
 * @param {string} publishDate - Date in YYYY-MM-DD
 * @param {number} slideNumber - 1-indexed slide number
 * @returns {string} - e.g. "social/2026/09/01/slide-01.png"
 */
export function getSlideStorageKey(publishDate, slideNumber) {
  const [year, month, day] = publishDate.split("-");
  const paddedSlide = String(slideNumber).padStart(2, "0");
  return `social/${year}/${month}/${day}/slide-${paddedSlide}.png`;
}

/**
 * Renders a single slide PNG buffer using Sharp text layers with bundled fontfile.
 * @param {object} params
 * @param {object} params.slide
 * @param {number} params.slideNumber
 * @param {number} params.totalSlides
 * @param {string} params.category
 * @param {string} params.categoryTitle
 * @param {string} [params.fontRegularPath]
 * @param {string} [params.fontBoldPath]
 * @returns {Promise<Buffer>}
 */
export async function renderSlidePng({
  slide,
  slideNumber,
  totalSlides,
  category,
  categoryTitle = "",
  fontRegularPath = FONT_REGULAR_PATH,
  fontBoldPath = FONT_BOLD_PATH,
}) {
  let bgSvg;
  const composites = [];

  // 1. Render Header Text Layers (Common to all slides)
  // Branding pill: box at x: 90, y: 80, w: 180, h: 42
  const brandBuf = await createTextLayer({
    text: "AI ZODIAC",
    fontfile: fontBoldPath,
    fontSize: 16,
    color: "#c4b5fd",
    width: 180,
    align: "center",
  });
  composites.push({ input: brandBuf, top: 88, left: 90 });

  // Pagination indicator pill: box at x: 850, y: 80, w: 140, h: 42
  const pageBuf = await createTextLayer({
    text: `${slideNumber} / ${totalSlides}`,
    fontfile: fontBoldPath,
    fontSize: 16,
    color: "#94a3b8",
    width: 140,
    align: "center",
  });
  composites.push({ input: pageBuf, top: 88, left: 850 });

  // 2. Slide Type Specific Layers
  if (slide.type === "title") {
    bgSvg = renderTitleSlideSvg();

    // Category Badge: box at x: 360, y: 336, w: 360, h: 48
    const displayCategory = (categoryTitle || category || "ZODIAC INSIGHT").toUpperCase();
    const catBuf = await createTextLayer({
      text: `✦ ${displayCategory} ✦`,
      fontfile: fontBoldPath,
      fontSize: 17,
      color: "#fcd34d",
      width: 360,
      align: "center",
    });
    composites.push({ input: catBuf, top: 347, left: 360 });

    // Main Title Hook: centered around y: 700
    const headlineFontSize = (slide.headline && slide.headline.length > 55) ? 44 : 52;
    const headlineBuf = await createTextLayer({
      text: slide.headline,
      fontfile: fontBoldPath,
      fontSize: headlineFontSize,
      color: "#f8fafc",
      width: 880,
      align: "center",
    });
    const hMeta = await sharp(headlineBuf).metadata();
    composites.push({
      input: headlineBuf,
      top: Math.round(700 - hMeta.height / 2),
      left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
    });

    // Swipe Prompt: box at x: 390, y: 1176, w: 300, h: 48
    const swipeBuf = await createTextLayer({
      text: "SWIPE TO EXPLORE ➔",
      fontfile: fontBoldPath,
      fontSize: 17,
      color: "#a78bfa",
      width: 300,
      align: "center",
    });
    composites.push({ input: swipeBuf, top: 1188, left: 390 });

  } else if (slide.type === "cta") {
    bgSvg = renderCtaSlideSvg();

    // CTA Headline
    const headlineBuf = await createTextLayer({
      text: slide.headline || "Discover more with AI Zodiac",
      fontfile: fontBoldPath,
      fontSize: 46,
      color: "#f8fafc",
      width: 800,
      align: "center",
    });
    const hMeta = await sharp(headlineBuf).metadata();
    composites.push({
      input: headlineBuf,
      top: Math.round(490 - hMeta.height / 2),
      left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
    });

    // CTA Body / Description
    const bodyBuf = await createTextLayer({
      text: slide.body || "Free on Google Play",
      fontfile: fontRegularPath,
      fontSize: 32,
      color: "#cbd5e1",
      width: 780,
      align: "center",
    });
    const bMeta = await sharp(bodyBuf).metadata();
    composites.push({
      input: bodyBuf,
      top: 670,
      left: Math.round((CANVAS_WIDTH - bMeta.width) / 2),
    });

    // Features pill: box at x: 240, y: 770, w: 600, h: 64
    const featuresBuf = await createTextLayer({
      text: "HOROSCOPES • COMPATIBILITY • NUMEROLOGY",
      fontfile: fontBoldPath,
      fontSize: 18,
      color: "#a78bfa",
      width: 600,
      align: "center",
    });
    composites.push({ input: featuresBuf, top: 808, left: 240 });

    // Action button: box at x: 270, y: 880, w: 540, h: 88
    const btnBuf = await createTextLayer({
      text: "GET AI ZODIAC ON GOOGLE PLAY",
      fontfile: fontBoldPath,
      fontSize: 24,
      color: "#ffffff",
      width: 540,
      align: "center",
    });
    composites.push({ input: btnBuf, top: 928, left: 270 });

    // Footer Disclaimer: y: 1210
    const footerBuf = await createTextLayer({
      text: "© 2026 AI Zodiac • Astrology for Entertainment & Self-Discovery",
      fontfile: fontRegularPath,
      fontSize: 18,
      color: "#64748b",
      width: 800,
      align: "center",
    });
    composites.push({ input: footerBuf, top: 1210, left: 140 });

  } else {
    // "sign" or "insight" slide
    bgSvg = renderContentSlideSvg({ sign: slide.sign || null });

    if (slide.sign) {
      // Sign highlight badge: box at x: 380, y: 320, w: 320, h: 60
      const signBuf = await createTextLayer({
        text: `✦ ${slide.sign.toUpperCase()} ✦`,
        fontfile: fontBoldPath,
        fontSize: 26,
        color: "#fbbf24",
        width: 320,
        align: "center",
      });
      composites.push({ input: signBuf, top: 334, left: 380 });
    } else {
      // Insight number indicator: circle at x: 450, y: 320
      const numBuf = await createTextLayer({
        text: `#${slideNumber - 1}`,
        fontfile: fontBoldPath,
        fontSize: 22,
        color: "#c4b5fd",
        width: 100,
        align: "center",
      });
      composites.push({ input: numBuf, top: 338, left: 490 });
    }

    // Headline (sign name or trait headline)
    const headlineBuf = await createTextLayer({
      text: slide.headline || slide.sign || "",
      fontfile: fontBoldPath,
      fontSize: 46,
      color: "#f8fafc",
      width: 800,
      align: "center",
    });
    const hMeta = await sharp(headlineBuf).metadata();
    composites.push({
      input: headlineBuf,
      top: Math.round(480 - hMeta.height / 2),
      left: Math.round((CANVAS_WIDTH - hMeta.width) / 2),
    });

    // Body Paragraph
    const bodyBuf = await createTextLayer({
      text: slide.body || "",
      fontfile: fontRegularPath,
      fontSize: (slide.body && slide.body.length > 180) ? 28 : 32,
      color: "#cbd5e1",
      width: 780,
      align: "center",
    });
    const bMeta = await sharp(bodyBuf).metadata();
    composites.push({
      input: bodyBuf,
      top: 670,
      left: Math.round((CANVAS_WIDTH - bMeta.width) / 2),
    });

    // Bottom prompt: y: 1210
    const bottomBuf = await createTextLayer({
      text: "AI ZODIAC DAILY GUIDANCE",
      fontfile: fontBoldPath,
      fontSize: 18,
      color: "#94a3b8",
      width: 500,
      align: "center",
    });
    composites.push({ input: bottomBuf, top: 1210, left: 290 });
  }

  // 3. Render base SVG to 1080x1350 PNG and composite text layers
  const baseBg = await sharp(Buffer.from(bgSvg, "utf-8"))
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, {
      fit: "contain",
      background: { r: 8, g: 9, b: 20, alpha: 1 },
    })
    .png()
    .toBuffer();

  return await sharp(baseBg)
    .composite(composites)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

/**
 * Converts an SVG string into a PNG buffer using Sharp.
 * (Preserved for backward-compatible utilities)
 * @param {string} svgString
 * @returns {Promise<Buffer>}
 */
export async function convertSvgToPng(svgString) {
  const svgBuffer = Buffer.from(svgString, "utf-8");

  return await sharp(svgBuffer)
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, {
      fit: "contain",
      background: { r: 8, g: 9, b: 20, alpha: 1 },
    })
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();
}

/**
 * Renders all slides in a structured social content package into PNG buffers.
 * @param {object} socialContent - Validated social content JSON
 * @param {object} [options={}]
 * @param {string} [options.outputDir] - Optional directory to save rendered PNGs
 * @returns {Promise<Array<object>>} - Array of rendered slide records
 */
export async function renderCarouselSlides(socialContent, options = {}) {
  if (!socialContent || !Array.isArray(socialContent.slides)) {
    throw new Error("Invalid social content: missing slides array");
  }

  const publishDate = socialContent.publishDate;
  const strategy = getTopicStrategyForDate(publishDate);
  const totalSlides = socialContent.slides.length;
  const categoryTitle = strategy.categoryTitle;

  const renderPromises = socialContent.slides.map(async (slide, idx) => {
    const slideNumber = idx + 1;
    const key = getSlideStorageKey(publishDate, slideNumber);

    const buffer = await renderSlidePng({
      slide,
      slideNumber,
      totalSlides,
      category: socialContent.category,
      categoryTitle,
    });

    if (options.outputDir) {
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }
      const filename = `slide-${String(slideNumber).padStart(2, "0")}.png`;
      fs.writeFileSync(path.join(options.outputDir, filename), buffer);
    }

    const altText = slide.type === "title"
      ? `${slide.headline} - AI Zodiac Daily Astrology`
      : (slide.sign
          ? `${slide.sign}: ${slide.headline} - AI Zodiac`
          : `${slide.headline} - AI Zodiac`);

    return {
      slideNumber,
      key,
      buffer,
      mimeType: "image/png",
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      altText,
      type: slide.type,
      sign: slide.sign || null,
    };
  });

  return await Promise.all(renderPromises);
}
