// lib/social/contentManifest.js
import { MEDIA_TYPES } from "./types.js";

/**
 * Resolves a date object or string into a YYYY-MM-DD string in the specified timezone.
 * @param {Date|string} [inputDate=new Date()]
 * @param {string} [timeZone="UTC"]
 * @returns {string}
 */
export function getDateInTimeZone(inputDate = new Date(), timeZone = "UTC") {
  const dateObj = typeof inputDate === "string" ? new Date(inputDate) : inputDate;
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date provided: ${inputDate}`);
  }

  // Format using Intl.DateTimeFormat in the target timeZone
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(dateObj); // Returns YYYY-MM-DD
}

/**
 * Validates a URL string. Supports http/https or relative paths if baseUrl is configured.
 * @param {string} urlStr
 * @param {string} [baseUrl=""]
 * @returns {boolean}
 */
export function isValidMediaUrl(urlStr, baseUrl = "") {
  if (!urlStr || typeof urlStr !== "string") return false;
  const trimmed = urlStr.trim();

  // If already absolute HTTPS/HTTP
  if (/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(trimmed)) {
    return true;
  }

  // If relative path and baseUrl is provided and valid
  if (trimmed.startsWith("/") && baseUrl && /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(baseUrl)) {
    return true;
  }

  return false;
}

/**
 * Resolves full media URL against base URL.
 * @param {string} rawUrl
 * @param {string} [baseUrl=""]
 * @returns {string}
 */
export function resolveMediaUrl(rawUrl, baseUrl = "") {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (baseUrl) {
    const cleanBase = baseUrl.replace(/\/+$/, "");
    const cleanPath = trimmed.replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
  }

  return trimmed;
}

/**
 * Validates a social content manifest object.
 * @param {object} manifest
 * @param {object} [options={}]
 * @param {string} [options.mediaBaseUrl=""]
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateManifest(manifest, options = {}) {
  const errors = [];
  const baseUrl = options.mediaBaseUrl || "";

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest must be a non-null object"] };
  }

  // Date validation
  if (!manifest.date || typeof manifest.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.date)) {
    errors.push("Manifest requires a valid 'date' string in YYYY-MM-DD format");
  }

  // ID validation
  if (!manifest.id || typeof manifest.id !== "string" || manifest.id.trim().length === 0) {
    errors.push("Manifest requires a non-empty 'id' string");
  }

  // Type validation
  const validTypes = [MEDIA_TYPES.SINGLE_IMAGE, MEDIA_TYPES.CAROUSEL, MEDIA_TYPES.VIDEO, "video"];
  if (!manifest.type || !validTypes.includes(manifest.type)) {
    errors.push(`Manifest 'type' must be one of: ${validTypes.join(", ")}`);
  }

  const isVideo = manifest.type === MEDIA_TYPES.VIDEO || manifest.type === "video";

  // Media array validation
  if (!Array.isArray(manifest.media) || manifest.media.length === 0) {
    errors.push("Manifest requires a non-empty 'media' array");
  } else {
    if (manifest.type === MEDIA_TYPES.SINGLE_IMAGE && manifest.media.length !== 1) {
      errors.push(`'single_image' manifest must contain exactly 1 media item, received ${manifest.media.length}`);
    }

    if (manifest.type === MEDIA_TYPES.CAROUSEL && (manifest.media.length < 2 || manifest.media.length > 10)) {
      errors.push(`'carousel' manifest must contain between 2 and 10 media items, received ${manifest.media.length}`);
    }

    if (isVideo && manifest.media.length !== 1) {
      errors.push(`'video' manifest must contain exactly 1 media item, received ${manifest.media.length}`);
    }

    manifest.media.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        errors.push(`Media item at index ${index} must be an object`);
        return;
      }
      if (!isValidMediaUrl(item.url, baseUrl)) {
        errors.push(`Media item at index ${index} has an invalid URL: '${item.url}'`);
      }
    });
  }

  // Captions validation
  if (!manifest.captions || typeof manifest.captions !== "object") {
    errors.push("Manifest requires a 'captions' object with platform-specific copy");
  } else if (isVideo) {
    // Video Manifest Captions: validates YouTube and/or Pinterest and optional Meta
    const hasYouTubeTarget = !manifest.destinations || manifest.destinations.includes("youtube") || manifest.destinations.includes("youtube_lifemode");
    const hasPinterestTarget = !manifest.destinations || manifest.destinations.includes("pinterest") || manifest.destinations.includes("pinterest_secondary");

    if (hasYouTubeTarget && (manifest.captions.youtube || manifest.captions.youtube_lifemode)) {
      const yt = manifest.captions.youtube || manifest.captions.youtube_lifemode;
      if (typeof yt.title !== "string" || yt.title.trim().length === 0) {
        errors.push("YouTube caption requires a non-empty 'title'");
      } else if (yt.title.length > 100) {
        errors.push(`YouTube title exceeds 100 characters (length: ${yt.title.length})`);
      }
      if (typeof yt.description !== "string" || yt.description.trim().length === 0) {
        errors.push("YouTube caption requires a non-empty 'description'");
      } else if (yt.description.length > 5000) {
        errors.push(`YouTube description exceeds 5000 characters (length: ${yt.description.length})`);
      }
    } else if (hasYouTubeTarget && !manifest.captions.youtube && !manifest.captions.youtube_lifemode && !manifest.captions.facebook && !manifest.captions.instagram) {
      errors.push("Video manifest targeting YouTube requires 'captions.youtube'");
    }

    if (hasPinterestTarget && (manifest.captions.pinterest || manifest.captions.pinterest_secondary)) {
      const pin = manifest.captions.pinterest || manifest.captions.pinterest_secondary;
      if (typeof pin.title !== "string" || pin.title.trim().length === 0) {
        errors.push("Pinterest caption requires a non-empty 'title'");
      } else if (pin.title.length > 100) {
        errors.push(`Pinterest title exceeds 100 characters (length: ${pin.title.length})`);
      }
      if (typeof pin.description !== "string" || pin.description.trim().length === 0) {
        errors.push("Pinterest caption requires a non-empty 'description'");
      } else if (pin.description.length > 500) {
        errors.push(`Pinterest description exceeds 500 characters (length: ${pin.description.length})`);
      }
      if (typeof pin.link !== "string" || !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(pin.link.trim())) {
        errors.push(`Pinterest caption requires a valid HTTPS/HTTP 'link', received: '${pin.link}'`);
      }
    } else if (hasPinterestTarget && !manifest.captions.pinterest && !manifest.captions.pinterest_secondary) {
      errors.push("Video manifest targeting Pinterest requires 'captions.pinterest'");
    }
  } else {
    // Image / Carousel Manifest Captions
    if (typeof manifest.captions.instagram !== "string" || manifest.captions.instagram.trim().length === 0) {
      errors.push("Manifest requires a non-empty string for 'captions.instagram'");
    }

    if (typeof manifest.captions.facebook !== "string" || manifest.captions.facebook.trim().length === 0) {
      errors.push("Manifest requires a non-empty string for 'captions.facebook'");
    }

    if (!manifest.captions.pinterest || typeof manifest.captions.pinterest !== "object") {
      errors.push("Manifest requires a 'captions.pinterest' object");
    } else {
      const pin = manifest.captions.pinterest;
      if (typeof pin.title !== "string" || pin.title.trim().length === 0) {
        errors.push("Pinterest caption requires a non-empty 'title'");
      } else if (pin.title.length > 100) {
        errors.push(`Pinterest title exceeds 100 characters (length: ${pin.title.length})`);
      }

      if (typeof pin.description !== "string" || pin.description.trim().length === 0) {
        errors.push("Pinterest caption requires a non-empty 'description'");
      } else if (pin.description.length > 500) {
        errors.push(`Pinterest description exceeds 500 characters (length: ${pin.description.length})`);
      }

      if (typeof pin.link !== "string" || !/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(pin.link.trim())) {
        errors.push(`Pinterest caption requires a valid HTTPS/HTTP 'link', received: '${pin.link}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Normalizes manifest media URLs against the provided mediaBaseUrl.
 * @param {object} manifest
 * @param {string} [mediaBaseUrl=""]
 * @returns {object}
 */
export function normalizeManifest(manifest, mediaBaseUrl = "") {
  if (!manifest || !Array.isArray(manifest.media)) return manifest;

  return {
    ...manifest,
    media: manifest.media.map(item => ({
      ...item,
      url: resolveMediaUrl(item.url, mediaBaseUrl),
    })),
  };
}

import { getPromoVideoManifestForDate } from "./content/promoVideoRegistry.js";

/**
 * Resolves the scheduled manifest for a given date.
 * Supports custom manifest providers (in-memory registry, Redis, or local catalog)
 * and stream separation (e.g. "video" vs default carousel).
 * @param {string} dateStr - Target date (YYYY-MM-DD)
 * @param {object} [options={}]
 * @param {object} [options.redis] - Optional Redis instance
 * @param {Array<object>} [options.manifestRegistry] - In-memory manifest registry array
 * @param {string} [options.mediaBaseUrl=""]
 * @param {string} [options.stream=null] - Stream identifier (e.g. "video")
 * @returns {Promise<object|null>}
 */
export async function resolveManifestForDate(dateStr, options = {}) {
  const normDate = String(dateStr || "").trim();
  const baseUrl = options.mediaBaseUrl || "";
  const stream = options.stream || null;

  // 1. Check in-memory registry if passed
  if (Array.isArray(options.manifestRegistry)) {
    const found = options.manifestRegistry.find(m => m.date === normDate);
    if (found) {
      return normalizeManifest(found, baseUrl);
    }
  }

  // 2. Check Redis manifest key if Redis is available
  if (options.redis) {
    try {
      const redisKey = stream ? `aiz:social:manifest:${stream}:${normDate}` : `aiz:social:manifest:${normDate}`;
      const raw = await options.redis.get(redisKey);
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed) {
          return normalizeManifest(parsed, baseUrl);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Error fetching manifest from Redis for ${normDate} (stream: ${stream || "default"}):`, err.message);
    }
  }

  // 3. If stream is "video", look up from authoritative 30-day promo video catalog
  if (stream === "video") {
    const promoManifest = getPromoVideoManifestForDate(normDate, { mediaBaseUrl: baseUrl });
    if (promoManifest) {
      return promoManifest;
    }
  }

  return null;
}
