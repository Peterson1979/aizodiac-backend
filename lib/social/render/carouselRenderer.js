// lib/social/render/carouselRenderer.js
import sharp from "sharp";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  renderTitleSlideSvg,
  renderContentSlideSvg,
  renderCtaSlideSvg,
} from "./templates.js";
import { getTopicStrategyForDate } from "../content/topicRotation.js";

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
 * Generates SVG string for a given slide based on its type.
 * @param {object} params
 * @param {object} params.slide - Slide object from AI content
 * @param {number} params.slideNumber - 1-indexed slide number
 * @param {number} params.totalSlides - Total count
 * @param {string} params.category - Category slug
 * @param {string} params.categoryTitle - Human readable category title
 * @returns {string} - SVG string
 */
export function generateSlideSvg({ slide, slideNumber, totalSlides, category, categoryTitle }) {
  if (slide.type === "title") {
    return renderTitleSlideSvg({
      headline: slide.headline,
      category,
      categoryTitle,
      slideNumber,
      totalSlides,
    });
  }

  if (slide.type === "cta") {
    return renderCtaSlideSvg({
      headline: slide.headline,
      body: slide.body,
      categoryTitle,
      slideNumber,
      totalSlides,
    });
  }

  // "sign" or "insight" or general content slide
  return renderContentSlideSvg({
    sign: slide.sign || null,
    headline: slide.headline,
    body: slide.body || "",
    categoryTitle,
    slideNumber,
    totalSlides,
  });
}

/**
 * Converts an SVG string into a high-quality 1080x1350 PNG buffer using Sharp.
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
 * @returns {Promise<Array<object>>} - Array of rendered slide records
 */
export async function renderCarouselSlides(socialContent) {
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

    const svgString = generateSlideSvg({
      slide,
      slideNumber,
      totalSlides,
      category: socialContent.category,
      categoryTitle,
    });

    const buffer = await convertSvgToPng(svgString);

    const altText = slide.type === "title"
      ? `${slide.headline} - AI Zodiac Daily Astrology`
      : (slide.sign
          ? `${slide.sign}: ${slide.headline} - AI Zodiac`
          : `${slide.headline} - AI Zodiac`);

    return {
      slideNumber,
      key,
      buffer,
      svg: svgString,
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
