// lib/social/render/carouselRenderer.js
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  FONT_REGULAR_PATH,
  FONT_BOLD_PATH,
  escapeXml,
  ZODIAC_DATA,
} from "./designSystem.js";
import { renderCoverSlideBg, getCoverSlideTextLayers } from "./templates/coverSlide.js";
import { renderZodiacFeatureSlideBg, getZodiacFeatureSlideTextLayers } from "./templates/zodiacFeatureSlide.js";
import { renderCtaSlideBg, getCtaSlideTextLayers } from "./templates/ctaSlide.js";
import { getTopicStrategyForDate } from "../content/topicRotation.js";

// Re-export font constants
export { FONT_REGULAR_PATH, FONT_BOLD_PATH };

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
 * Generates clear, professional alt text for social platforms.
 * @param {object} slide
 * @returns {string}
 */
export function generateSlideAltText(slide) {
  if (slide.type === "cover" || slide.type === "title") {
    return `${slide.headline || slide.title || "Daily Zodiac Insights"} | AI Zodiac`;
  }
  if (slide.type === "cta") {
    return `${slide.headline || slide.title || "Discover more with AI Zodiac"} | AI Zodiac`;
  }
  if (slide.sign) {
    const headlinePart = slide.headline && slide.headline !== slide.sign
      ? slide.headline
      : (slide.body || "Astrology Insights");
    return `${slide.sign} — ${headlinePart} | AI Zodiac`;
  }
  return `${slide.headline || "Zodiac Guidance"} | AI Zodiac`;
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
  let composites = [];

  if (slide.type === "cover" || slide.type === "title") {
    bgSvg = renderCoverSlideBg();
    composites = await getCoverSlideTextLayers({
      headline: slide.headline || slide.title,
      category,
      categoryTitle,
      slideNumber,
      totalSlides,
      createTextLayer,
      fontBoldPath,
    });
  } else if (slide.type === "cta") {
    bgSvg = renderCtaSlideBg();
    composites = await getCtaSlideTextLayers({
      headline: slide.headline || slide.title,
      body: slide.body || slide.cta,
      slideNumber,
      totalSlides,
      createTextLayer,
      fontBoldPath,
      fontRegularPath,
    });
  } else {
    // "sign" or general feature slide
    bgSvg = renderZodiacFeatureSlideBg({ sign: slide.sign || null, slideNumber });
    composites = await getZodiacFeatureSlideTextLayers({
      sign: slide.sign,
      headline: slide.headline,
      body: slide.body,
      slideNumber,
      totalSlides,
      createTextLayer,
      fontBoldPath,
      fontRegularPath,
    });
  }

  // Render base SVG vector background to 1080x1350 PNG
  const baseBg = await sharp(Buffer.from(bgSvg, "utf-8"))
    .resize(CANVAS_WIDTH, CANVAS_HEIGHT, {
      fit: "contain",
      background: { r: 8, g: 9, b: 20, alpha: 1 },
    })
    .png()
    .toBuffer();

  // Composite all typography layers on top
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

    const altText = generateSlideAltText(slide);

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
