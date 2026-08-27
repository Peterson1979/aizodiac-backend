// lib/social/quality/socialQualityGate.js
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  VALID_ZODIAC_SIGNS,
  DEFAULT_APP_PLAY_STORE_URL,
  checkScopeMismatch,
} from "../content/dailyContentGenerator.js";
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  BACKGROUND_COVER_PATH,
  BACKGROUND_ZODIAC_PATH,
  BACKGROUND_CTA_PATH,
  FONT_REGULAR_PATH,
  FONT_BOLD_PATH,
  loadBackgroundImageBuffer,
} from "../render/designSystem.js";
import { ZODIAC_SVG_PATHS } from "../render/zodiacVectors.js";

export const QUALITY_GATE_STATUS = Object.freeze({
  PASS: "QUALITY_GATE_PASS",
  FAILED: "QUALITY_GATE_FAILED",
});

/**
 * Objective forbidden placeholder & meta-language patterns
 */
export const FORBIDDEN_PLACEHOLDER_PATTERNS = [
  /lorem\s+ipsum/i,
  /your\s+text\s+here/i,
  /insert\s+(?:text|sign|content|here)/i,
  /\[insert/i,
  /\[placeholder/i,
  /example\s+(?:text|headline|sign)/i,
  /\bplaceholder\b/i,
  /\b(sample|test)\s+insight\b/i,
];

export const FORBIDDEN_META_PATTERNS = [
  /as\s+an\s+ai\b/i,
  /here\s+is\s+(?:the|your)\b/i,
  /```(?:json)?/,
  /\{"topic"/,
  /\bslide\s+[1-5]\b/i,
  /\bcaption:\s*/i,
  /\bjson\s+output\b/i,
];

/**
 * Checks string for placeholder text.
 */
export function checkPlaceholderContent(text) {
  if (!text || typeof text !== "string") return null;
  for (const pattern of FORBIDDEN_PLACEHOLDER_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

/**
 * Checks string for model / meta language or JSON leakage.
 */
export function checkMetaLanguage(text) {
  if (!text || typeof text !== "string") return null;
  for (const pattern of FORBIDDEN_META_PATTERNS) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  if (text.includes("\uFFFD")) {
    return "Unicode replacement character ()";
  }
  return null;
}

/**
 * Calculates token-level Jaccard similarity between two strings.
 */
export function calculateTokenSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  const tokens1 = new Set(str1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  const tokens2 = new Set(str2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  const intersection = new Set([...tokens1].filter(t => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);
  return intersection.size / union.size;
}

/**
 * 1. AI CREATIVE OUTPUT VALIDATION
 * Validates raw AI JSON before canonical backend assembly.
 * @param {object} creative
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateAiCreative(creative) {
  const errors = [];
  const warnings = [];

  if (!creative || typeof creative !== "object") {
    return { valid: false, errors: ["Creative output must be a non-null object"], warnings: [] };
  }

  // --- Topic ---
  if (!creative.topic || typeof creative.topic !== "string" || creative.topic.trim().length < 5) {
    errors.push("Missing or too short 'topic' (< 5 chars)");
  } else {
    const topic = creative.topic.trim();
    if (topic.length > 120) {
      errors.push(`'topic' exceeds 120 characters (length: ${topic.length})`);
    }
    if (!/\b(?:3|three)\b/i.test(topic)) {
      errors.push(`'topic' must describe a 3-sign selection (e.g. '3 Zodiac Signs That...'): received "${topic}"`);
    }
    const topicMismatch = checkScopeMismatch(topic);
    if (topicMismatch) {
      errors.push(`'topic' contains forbidden scope-mismatch phrase: '${topicMismatch}'`);
    }
    const topicPlaceholder = checkPlaceholderContent(topic);
    if (topicPlaceholder) {
      errors.push(`'topic' contains placeholder text: '${topicPlaceholder}'`);
    }
    const topicMeta = checkMetaLanguage(topic);
    if (topicMeta) {
      errors.push(`'topic' contains forbidden meta/model language: '${topicMeta}'`);
    }
  }

  // --- Items (Spotlighted Signs) ---
  if (!Array.isArray(creative.items)) {
    errors.push("Missing 'items' array");
  } else {
    if (creative.items.length !== 3) {
      errors.push(`'items' count must be exactly 3, received ${creative.items.length}`);
    }

    const seenSigns = new Set();
    const seenHeadlines = new Set();
    const itemTexts = [];

    creative.items.forEach((item, idx) => {
      if (!item || typeof item !== "object") {
        errors.push(`Item at index ${idx} must be an object`);
        return;
      }

      // Sign check
      if (!item.sign || typeof item.sign !== "string" || item.sign.trim().length === 0) {
        errors.push(`Item at index ${idx} missing 'sign'`);
      } else {
        const normSign = item.sign.trim();
        const capitalized = normSign.charAt(0).toUpperCase() + normSign.slice(1).toLowerCase();
        if (!VALID_ZODIAC_SIGNS.has(capitalized)) {
          errors.push(`Item at index ${idx} has invalid zodiac sign: '${item.sign}'`);
        } else if (seenSigns.has(capitalized)) {
          errors.push(`Duplicate zodiac sign '${capitalized}' at index ${idx}`);
        } else {
          seenSigns.add(capitalized);
        }
      }

      // Headline check
      if (!item.headline || typeof item.headline !== "string" || item.headline.trim().length === 0) {
        errors.push(`Item at index ${idx} requires a non-empty 'headline'`);
      } else {
        const headline = item.headline.trim();
        if (headline.length > 45) {
          errors.push(`Item at index ${idx} headline exceeds 45 characters (length: ${headline.length})`);
        }
        if (item.sign && headline.toLowerCase() === item.sign.trim().toLowerCase()) {
          errors.push(`Item at index ${idx} headline must not equal sign name: '${headline}'`);
        }
        const lowerH = headline.toLowerCase();
        if (seenHeadlines.has(lowerH)) {
          errors.push(`Duplicate headline '${headline}' found at item index ${idx}`);
        } else {
          seenHeadlines.add(lowerH);
        }
        const hlPlaceholder = checkPlaceholderContent(headline);
        if (hlPlaceholder) {
          errors.push(`Item at index ${idx} headline contains placeholder text: '${hlPlaceholder}'`);
        }
        const hlMeta = checkMetaLanguage(headline);
        if (hlMeta) {
          errors.push(`Item at index ${idx} headline contains meta/model language: '${hlMeta}'`);
        }
      }

      // Text (Body) check
      if (!item.text || typeof item.text !== "string" || item.text.trim().length < 25) {
        errors.push(`Item at index ${idx} requires non-empty 'text' (>= 25 chars)`);
      } else {
        const text = item.text.trim();
        if (text.length > 280) {
          errors.push(`Item at index ${idx} text exceeds 280 characters (length: ${text.length})`);
        }
        if (text.includes("#")) {
          errors.push(`Item at index ${idx} text must not contain hashtags`);
        }
        const bodyMismatch = checkScopeMismatch(text);
        if (bodyMismatch) {
          errors.push(`Item at index ${idx} text contains forbidden scope-mismatch phrase: '${bodyMismatch}'`);
        }
        const bodyPlaceholder = checkPlaceholderContent(text);
        if (bodyPlaceholder) {
          errors.push(`Item at index ${idx} text contains placeholder text: '${bodyPlaceholder}'`);
        }
        const bodyMeta = checkMetaLanguage(text);
        if (bodyMeta) {
          errors.push(`Item at index ${idx} text contains meta/model language: '${bodyMeta}'`);
        }

        itemTexts.push(text);
      }
    });

    // Cross-item similarity check
    for (let i = 0; i < itemTexts.length; i++) {
      for (let j = i + 1; j < itemTexts.length; j++) {
        const sim = calculateTokenSimilarity(itemTexts[i], itemTexts[j]);
        if (sim > 0.75) {
          errors.push(`Item ${i + 1} and Item ${j + 1} have near-identical copy (similarity: ${(sim * 100).toFixed(0)}%)`);
        }
      }
    }
  }

  // --- Captions ---
  if (!creative.instagramCaption || typeof creative.instagramCaption !== "string" || creative.instagramCaption.trim().length === 0) {
    errors.push("Missing or empty 'instagramCaption'");
  } else {
    const igCap = creative.instagramCaption.trim();
    if (igCap.length > 1000) {
      errors.push(`'instagramCaption' exceeds 1000 characters (length: ${igCap.length})`);
    }
    const igMismatch = checkScopeMismatch(igCap);
    if (igMismatch) errors.push(`'instagramCaption' contains scope mismatch: '${igMismatch}'`);
    const igMeta = checkMetaLanguage(igCap);
    if (igMeta) errors.push(`'instagramCaption' contains meta language: '${igMeta}'`);

    const hashtags = (igCap.match(/#\w+/g) || []);
    if (hashtags.length > 15) {
      errors.push(`'instagramCaption' has too many hashtags (${hashtags.length} > 15)`);
    }
    const uniqueHashtags = new Set(hashtags.map(h => h.toLowerCase()));
    if (uniqueHashtags.size < hashtags.length) {
      errors.push("'instagramCaption' contains duplicate hashtags");
    }
  }

  if (!creative.facebookCaption || typeof creative.facebookCaption !== "string" || creative.facebookCaption.trim().length === 0) {
    errors.push("Missing or empty 'facebookCaption'");
  } else {
    const fbCap = creative.facebookCaption.trim();
    if (fbCap.length > 1500) {
      errors.push(`'facebookCaption' exceeds 1500 characters (length: ${fbCap.length})`);
    }
    const fbMismatch = checkScopeMismatch(fbCap);
    if (fbMismatch) errors.push(`'facebookCaption' contains scope mismatch: '${fbMismatch}'`);
    const fbMeta = checkMetaLanguage(fbCap);
    if (fbMeta) errors.push(`'facebookCaption' contains meta language: '${fbMeta}'`);
  }

  if (!creative.pinterestTitle || typeof creative.pinterestTitle !== "string" || creative.pinterestTitle.trim().length === 0) {
    errors.push("Missing or empty 'pinterestTitle'");
  } else {
    const pinTitle = creative.pinterestTitle.trim();
    if (pinTitle.length > 100) errors.push(`'pinterestTitle' exceeds 100 characters (length: ${pinTitle.length})`);
    const pinTMismatch = checkScopeMismatch(pinTitle);
    if (pinTMismatch) errors.push(`'pinterestTitle' contains scope mismatch: '${pinTMismatch}'`);
  }

  if (!creative.pinterestDescription || typeof creative.pinterestDescription !== "string" || creative.pinterestDescription.trim().length === 0) {
    errors.push("Missing or empty 'pinterestDescription'");
  } else {
    const pinDesc = creative.pinterestDescription.trim();
    if (pinDesc.length > 500) errors.push(`'pinterestDescription' exceeds 500 characters (length: ${pinDesc.length})`);
    const pinDMismatch = checkScopeMismatch(pinDesc);
    if (pinDMismatch) errors.push(`'pinterestDescription' contains scope mismatch: '${pinDMismatch}'`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 2. CANONICAL ASSEMBLY VALIDATION
 * Validates deterministic assembled package structure and boundaries.
 * @param {object} canonical
 * @param {object} [options={}]
 * @param {string} [options.expectedDate]
 * @param {string} [options.expectedCategory]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCanonicalAssembly(canonical, { expectedDate, expectedCategory } = {}) {
  const errors = [];

  if (!canonical || typeof canonical !== "object") {
    return { valid: false, errors: ["Canonical package must be a non-null object"] };
  }

  if (expectedDate) {
    if (canonical.publishDate !== expectedDate) {
      errors.push(`Canonical publishDate '${canonical.publishDate}' does not match expected '${expectedDate}'`);
    }
    if (canonical.contentId !== `social-${expectedDate}`) {
      errors.push(`Canonical contentId '${canonical.contentId}' does not match expected 'social-${expectedDate}'`);
    }
  }

  if (expectedCategory && canonical.category !== expectedCategory) {
    errors.push(`Canonical category '${canonical.category}' does not match expected '${expectedCategory}'`);
  }

  if (canonical.pinterestLink !== DEFAULT_APP_PLAY_STORE_URL) {
    errors.push(`Canonical pinterestLink must be official Google Play store link: received '${canonical.pinterestLink}'`);
  }

  if (!Array.isArray(canonical.slides) || canonical.slides.length !== 5) {
    errors.push(`Canonical package must have exactly 5 slides, received ${canonical.slides?.length}`);
  } else {
    // Slide 1: Cover
    const s1 = canonical.slides[0];
    if (!s1 || s1.type !== "title" || !s1.headline) {
      errors.push("Slide 1 must be type 'title' with non-empty headline");
    }

    // Slides 2-4: Feature Slides
    const seenSigns = new Set();
    for (let i = 1; i <= 3; i++) {
      const s = canonical.slides[i];
      if (!s || s.type !== "sign") {
        errors.push(`Slide ${i + 1} must have type 'sign'`);
      } else {
        if (!s.sign || !VALID_ZODIAC_SIGNS.has(s.sign)) {
          errors.push(`Slide ${i + 1} has invalid sign: '${s.sign}'`);
        } else if (seenSigns.has(s.sign)) {
          errors.push(`Slide ${i + 1} repeats sign: '${s.sign}'`);
        } else {
          seenSigns.add(s.sign);
        }

        if (!s.headline || s.headline.trim().length === 0) {
          errors.push(`Slide ${i + 1} requires a non-empty 'headline'`);
        } else if (s.headline.toLowerCase() === (s.sign || "").toLowerCase()) {
          errors.push(`Slide ${i + 1} headline must not equal sign name`);
        }

        if (!s.body || s.body.trim().length === 0) {
          errors.push(`Slide ${i + 1} requires a non-empty 'body'`);
        }
      }
    }

    // Slide 5: CTA
    const s5 = canonical.slides[4];
    if (!s5 || s5.type !== "cta" || !s5.headline || !s5.body) {
      errors.push("Slide 5 must be type 'cta' with deterministic headline and body");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 3. RENDER QUALITY GATE
 * Inspects every rendered PNG buffer before R2 upload or manifest approval.
 * @param {Array<object>} renderedSlides - Array of { buffer, slideNumber, key, mimeType }
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function validateRenderSet(renderedSlides) {
  const errors = [];

  // Check required master background files exist and decode
  const bgFiles = [
    { name: "cover-bg.png", path: BACKGROUND_COVER_PATH },
    { name: "zodiac-bg.png", path: BACKGROUND_ZODIAC_PATH },
    { name: "cta-bg.png", path: BACKGROUND_CTA_PATH },
  ];

  for (const bg of bgFiles) {
    if (!fs.existsSync(bg.path)) {
      errors.push(`Required master background asset missing: ${bg.name}`);
    } else {
      try {
        const bgBuf = await loadBackgroundImageBuffer(bg.path);
        const meta = await sharp(bgBuf).metadata();
        if (meta.width !== CANVAS_WIDTH || meta.height !== CANVAS_HEIGHT) {
          errors.push(`Master background ${bg.name} scaled dimensions (${meta.width}x${meta.height}) do not match 1080x1350`);
        }
      } catch (err) {
        errors.push(`Master background ${bg.name} failed to decode: ${err.message}`);
      }
    }
  }

  // Check bundled fonts exist
  if (!fs.existsSync(FONT_REGULAR_PATH)) {
    errors.push(`Bundled font missing: ${FONT_REGULAR_PATH}`);
  }
  if (!fs.existsSync(FONT_BOLD_PATH)) {
    errors.push(`Bundled font missing: ${FONT_BOLD_PATH}`);
  }

  // Verify all 12 Zodiac vector glyphs are registered
  const glyphCount = Object.keys(ZODIAC_SVG_PATHS).length;
  if (glyphCount !== 12) {
    errors.push(`Zodiac vector registry incomplete (${glyphCount}/12 signs registered)`);
  }

  if (!Array.isArray(renderedSlides) || renderedSlides.length !== 5) {
    errors.push(`Render set must contain exactly 5 slides, received ${renderedSlides?.length}`);
    return { valid: false, errors };
  }

  for (let i = 0; i < renderedSlides.length; i++) {
    const slide = renderedSlides[i];
    const expectedNum = i + 1;

    if (!slide || !Buffer.isBuffer(slide.buffer)) {
      errors.push(`Slide ${expectedNum} is not a valid Buffer`);
      continue;
    }

    if (slide.buffer.length < 50000) {
      errors.push(`Slide ${expectedNum} file size unexpectedly small (${slide.buffer.length} bytes < 50KB)`);
    }

    try {
      const meta = await sharp(slide.buffer).metadata();
      if (meta.format !== "png") {
        errors.push(`Slide ${expectedNum} format is '${meta.format}', expected 'png'`);
      }
      if (meta.width !== CANVAS_WIDTH || meta.height !== CANVAS_HEIGHT) {
        errors.push(`Slide ${expectedNum} dimensions ${meta.width}x${meta.height} do not match 1080x1350`);
      }

      // Pixel stats test to ensure slide is not blank or transparent
      const stats = await sharp(slide.buffer).stats();
      const isBlank = stats.channels.every(ch => ch.stdev < 5);
      if (isBlank) {
        errors.push(`Slide ${expectedNum} appears to be completely blank/flat`);
      }
    } catch (decodeErr) {
      errors.push(`Slide ${expectedNum} failed to decode with Sharp: ${decodeErr.message}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 4. MANIFEST QUALITY GATE
 * Validates the final publish manifest and ensures clean, concise alt-text formatting.
 * @param {object} manifest
 * @param {object} [options={}]
 * @param {string} [options.mediaBaseUrl]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validatePublishManifest(manifest, { mediaBaseUrl } = {}) {
  const errors = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be a non-null object"] };
  }

  if (!manifest.date || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.date)) {
    errors.push(`Invalid manifest date: '${manifest.date}'`);
  }
  if (!manifest.id || manifest.id !== `social-${manifest.date}`) {
    errors.push(`Invalid manifest id '${manifest.id}', expected 'social-${manifest.date}'`);
  }
  if (manifest.type !== "carousel") {
    errors.push(`Invalid manifest type '${manifest.type}', expected 'carousel'`);
  }

  if (!Array.isArray(manifest.media) || manifest.media.length !== 5) {
    errors.push(`Manifest media array must contain exactly 5 slides, received ${manifest.media?.length}`);
  } else {
    manifest.media.forEach((item, idx) => {
      if (!item.url || !/^https?:\/\//i.test(item.url)) {
        errors.push(`Media item ${idx + 1} has invalid url: '${item.url}'`);
      }
      if (mediaBaseUrl && !item.url.startsWith(mediaBaseUrl)) {
        errors.push(`Media item ${idx + 1} URL '${item.url}' does not start with mediaBaseUrl '${mediaBaseUrl}'`);
      }
      if (!item.altText || typeof item.altText !== "string" || item.altText.trim().length === 0) {
        errors.push(`Media item ${idx + 1} missing 'altText'`);
      } else {
        // Enforce concise alt text (never the full paragraph)
        if (item.altText.length > 120) {
          errors.push(`Media item ${idx + 1} altText exceeds 120 characters: '${item.altText}'`);
        }
        if (!item.altText.includes("AI Zodiac")) {
          errors.push(`Media item ${idx + 1} altText must include '| AI Zodiac' brand tag`);
        }
      }
    });
  }

  if (!manifest.captions || typeof manifest.captions !== "object") {
    errors.push("Missing 'captions' object");
  } else {
    if (!manifest.captions.instagram || typeof manifest.captions.instagram !== "string") {
      errors.push("Missing 'captions.instagram'");
    }
    if (!manifest.captions.facebook || typeof manifest.captions.facebook !== "string") {
      errors.push("Missing 'captions.facebook'");
    }
    if (!manifest.captions.pinterest || typeof manifest.captions.pinterest !== "object") {
      errors.push("Missing 'captions.pinterest' object");
    } else {
      if (!manifest.captions.pinterest.title) errors.push("Missing 'captions.pinterest.title'");
      if (!manifest.captions.pinterest.description) errors.push("Missing 'captions.pinterest.description'");
      if (manifest.captions.pinterest.link !== DEFAULT_APP_PLAY_STORE_URL) {
        errors.push(`Invalid 'captions.pinterest.link': '${manifest.captions.pinterest.link}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * AGGREGATE QUALITY GATE EVALUATION
 * Orchestrates creative, canonical, render, and manifest validations.
 * Returns single consolidated decision.
 *
 * @param {object} params
 * @param {object} [params.creative] - Raw AI creative JSON
 * @param {object} [params.canonical] - Assembled canonical social content
 * @param {Array<object>} [params.renderedSlides] - Rendered slide buffers
 * @param {object} [params.manifest] - Formatted manifest object
 * @param {string} [params.expectedDate]
 * @param {string} [params.expectedCategory]
 * @param {string} [params.mediaBaseUrl]
 * @returns {Promise<object>} - Consolidated Quality Gate result
 */
export async function evaluateQualityGate({
  creative = null,
  canonical = null,
  renderedSlides = null,
  manifest = null,
  expectedDate = null,
  expectedCategory = null,
  mediaBaseUrl = null,
} = {}) {
  const allErrors = [];
  const allWarnings = [];
  const checkResults = {};

  // 1. Creative Validation
  if (creative) {
    const creativeRes = validateAiCreative(creative);
    checkResults.creativeValidation = creativeRes;
    if (!creativeRes.valid) {
      allErrors.push(...creativeRes.errors.map(e => `[Creative] ${e}`));
    }
    if (creativeRes.warnings?.length) {
      allWarnings.push(...creativeRes.warnings.map(w => `[Creative] ${w}`));
    }
  }

  // 2. Canonical Assembly Validation
  if (canonical) {
    const canonicalRes = validateCanonicalAssembly(canonical, { expectedDate, expectedCategory });
    checkResults.canonicalValidation = canonicalRes;
    if (!canonicalRes.valid) {
      allErrors.push(...canonicalRes.errors.map(e => `[Canonical] ${e}`));
    }
  }

  // 3. Render Set Validation
  if (renderedSlides) {
    const renderRes = await validateRenderSet(renderedSlides);
    checkResults.renderValidation = renderRes;
    if (!renderRes.valid) {
      allErrors.push(...renderRes.errors.map(e => `[Render] ${e}`));
    }
  }

  // 4. Manifest Validation
  if (manifest) {
    const manifestRes = validatePublishManifest(manifest, { mediaBaseUrl });
    checkResults.manifestValidation = manifestRes;
    if (!manifestRes.valid) {
      allErrors.push(...manifestRes.errors.map(e => `[Manifest] ${e}`));
    }
  }

  const passed = allErrors.length === 0;
  const status = passed ? QUALITY_GATE_STATUS.PASS : QUALITY_GATE_STATUS.FAILED;

  return {
    passed,
    status,
    errors: allErrors,
    warnings: allWarnings,
    checks: checkResults,
  };
}
