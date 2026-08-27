// lib/social/render/templates.js
/**
 * Backward compatibility re-export module.
 * Directs template rendering to the modular design system and specialized slide templates.
 */

export {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  LAYOUT_ZONES,
  COLORS,
  ELEMENT_ACCENTS,
  ZODIAC_DATA,
  escapeXml,
  wrapTextToLines,
  renderTextToFit,
  createTextLayer,
  renderCosmicBackground,
  renderHeaderBoxes,
  renderZodiacEmblemSvg,
} from "./designSystem.js";

export { renderCoverSlideBg, renderCoverSlideBg as renderTitleSlideSvg } from "./templates/coverSlide.js";
export { renderZodiacFeatureSlideBg, renderZodiacFeatureSlideBg as renderContentSlideSvg } from "./templates/zodiacFeatureSlide.js";
export { renderCtaSlideBg, renderCtaSlideBg as renderCtaSlideSvg } from "./templates/ctaSlide.js";
