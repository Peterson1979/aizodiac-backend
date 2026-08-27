// lib/social/render/templates.js
/**
 * Backward compatibility re-export module.
 * Directs template rendering to the modular design system and specialized slide templates.
 */

export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BACKGROUND_COVER_PATH,
  BACKGROUND_ZODIAC_PATH,
  BACKGROUND_CTA_PATH,
  loadBackgroundImageBuffer,
  LAYOUT_ZONES,
  COLORS,
  ELEMENT_ACCENTS,
  ZODIAC_DATA,
  escapeXml,
  wrapTextToLines,
  renderTextToFit,
  createTextLayer,
  renderHeaderBoxes,
  renderZodiacEmblemSvg,
} from "./designSystem.js";

export {
  getCoverSlideBg,
  renderCoverSlideOverlaySvg,
  renderCoverSlideOverlaySvg as renderTitleSlideSvg,
} from "./templates/coverSlide.js";

export {
  getZodiacFeatureSlideBg,
  renderZodiacFeatureSlideOverlaySvg,
  renderZodiacFeatureSlideOverlaySvg as renderContentSlideSvg,
} from "./templates/zodiacFeatureSlide.js";

export {
  getCtaSlideBg,
  renderCtaSlideOverlaySvg,
  renderCtaSlideOverlaySvg as renderCtaSlideSvg,
} from "./templates/ctaSlide.js";
