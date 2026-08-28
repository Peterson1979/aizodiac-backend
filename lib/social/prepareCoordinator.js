// lib/social/prepareCoordinator.js
import { MEDIA_TYPES } from "./types.js";
import { getSocialConfig, redactSecrets } from "./config.js";
import {
  acquireDistributedLock,
  releaseDistributedLock,
  getManifestKey,
} from "./stateHelper.js";
import {
  getDateInTimeZone,
  validateManifest,
  resolveManifestForDate,
} from "./contentManifest.js";
import {
  getPrepareState,
  updatePrepareStage,
  PREPARE_STAGES,
  getPrepareLockKey,
} from "./prepareStateHelper.js";
import { generateDailySocialContent, DEFAULT_APP_PLAY_STORE_URL, ensureFacebookGooglePlayLink } from "./content/dailyContentGenerator.js";
import { recordTopicUsage } from "./content/contentHistory.js";
import { renderCarouselSlides } from "./render/carouselRenderer.js";
import { uploadCarouselSlides, getR2Config } from "./storage/r2Storage.js";

import { evaluateQualityGate, QUALITY_GATE_STATUS } from "./quality/socialQualityGate.js";

/**
 * Main coordinator for automated daily social content preparation.
 * Orchestrates:
 * Check Manual Manifest -> AI Structured Content -> Carousel Rendering -> Cloudflare R2 Upload -> Quality Gate -> Redis Manifest
 *
 * @param {object} params
 * @param {object} [params.redis=null] - Upstash Redis client instance
 * @param {string} [params.targetDate=null] - Target date (YYYY-MM-DD)
 * @param {object} [params.configOverrides={}] - Configuration overrides
 * @param {object} [params.r2ConfigOverrides={}] - R2 config overrides
 * @param {boolean} [params.dryRun=false] - If true, performs zero R2 and zero Redis manifest writes
 * @param {boolean} [params.forceRegenerate=false] - Force regeneration even if state exists
 * @param {Function} [params.generateFn=null] - Mock generator for testing
 * @param {object} [params.s3Client=null] - Mock S3 client for testing
 * @returns {Promise<object>} - Preparation result object
 */
export async function executeDailyPreparation({
  redis = null,
  targetDate = null,
  configOverrides = {},
  r2ConfigOverrides = {},
  dryRun = false,
  forceRegenerate = false,
  generateFn = null,
  s3Client = null,
} = {}) {
  const config = getSocialConfig(configOverrides);
  const r2Config = getR2Config(r2ConfigOverrides);

  // 1. Resolve Target Date in Configured TimeZone
  const publishDate = targetDate || getDateInTimeZone(new Date(), config.timeZone);

  // ==========================================================================
  // STEP 1: CONTENT SOURCE PRIORITY - Check for Manually Approved Manifest
  // ==========================================================================
  const existingManifest = await resolveManifestForDate(publishDate, {
    redis,
    mediaBaseUrl: r2Config.publicBaseUrl,
  });

  if (existingManifest && !forceRegenerate) {
    return {
      success: true,
      status: "EXISTING_MANIFEST_FOUND",
      message: `Manually approved or pre-existing manifest found for date ${publishDate}. AI generation skipped.`,
      publishDate,
      manifestId: existingManifest.id,
      manifest: existingManifest,
      source: "manual_override",
      dryRun,
    };
  }

  // ==========================================================================
  // STEP 2: Acquire Distributed Lock for Preparation
  // ==========================================================================
  let lockOwnerId = null;
  const lockKey = getPrepareLockKey(publishDate);

  if (redis && !dryRun) {
    const lockRes = await acquireDistributedLock(redis, publishDate, {
      ttlSeconds: 600, // 10 minutes lock for generation/rendering/upload
      lockOwnerId: null,
    });

    if (!lockRes.acquired) {
      return {
        success: false,
        status: "LOCK_CONTENTION",
        message: `Could not acquire preparation lock for ${publishDate}: ${lockRes.reason}`,
        publishDate,
        dryRun,
      };
    }
    lockOwnerId = lockRes.lockOwnerId;
  }

  try {
    // Read previous preparation state for idempotency / resumption
    let prepState = await getPrepareState(redis, publishDate);

    // ==========================================================================
    // STEP 3: AI Structured Content Generation (or Resumed)
    // ==========================================================================
    let generatedContent = prepState?.generatedContent;

    if (!generatedContent || forceRegenerate) {
      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.PENDING, { incrementAttempt: true });
      }

      try {
        generatedContent = await generateDailySocialContent({
          publishDate,
          redis,
          timeZone: config.timeZone,
          maxAttempts: 3,
          generateFn,
        });
      } catch (genErr) {
        if (redis && !dryRun) {
          await updatePrepareStage(redis, publishDate, PREPARE_STAGES.QUALITY_GATE_FAILED, {
            error: genErr.message,
            failureReasons: genErr.errors || [genErr.message],
          });
        }
        throw genErr;
      }

      // Record topic in 120-day history in Redis
      if (redis && !dryRun) {
        await recordTopicUsage(redis, {
          topic: generatedContent.topic,
          category: generatedContent.category,
          publishDate,
          contentId: generatedContent.contentId,
        });

        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.CONTENT_GENERATED, {
          contentId: generatedContent.contentId,
          topic: generatedContent.topic,
          category: generatedContent.category,
          generatedContent,
          generatedAt: new Date().toISOString(),
        });
      }
    }

    // ==========================================================================
    // STEP 4: Server-Side Carousel Rendering (SVG -> PNG via Sharp)
    // ==========================================================================
    let renderedSlides;
    try {
      renderedSlides = await renderCarouselSlides(generatedContent);

      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.RENDERED);
      }
    } catch (renderErr) {
      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.QUALITY_GATE_FAILED, { error: renderErr.message });
      }
      throw renderErr;
    }

    // ==========================================================================
    // STEP 5: Cloudflare R2 Upload
    // ==========================================================================
    let uploadedMedia;
    try {
      uploadedMedia = await uploadCarouselSlides({
        slides: renderedSlides,
        r2Config,
        s3Client,
        dryRun,
        overwriteExisting: false,
      });

      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.UPLOADED, {
          uploadedMedia: uploadedMedia.map(m => ({
            url: m.url,
            key: m.key,
            altText: m.altText,
            slideNumber: m.slideNumber,
          })),
        });
      }
    } catch (uploadErr) {
      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.QUALITY_GATE_FAILED, { error: uploadErr.message });
      }
      throw uploadErr;
    }

    // ==========================================================================
    // STEP 6: Manifest Creation & Formatted Concise Alt-Text
    // ==========================================================================
    const manifestMedia = uploadedMedia.map(item => {
      let altText = `${generatedContent.topic} | AI Zodiac`;
      const slideIdx = item.slideNumber - 1;
      const slide = generatedContent.slides?.[slideIdx];
      if (slide) {
        if (slide.type === "title") {
          altText = `${generatedContent.topic} | AI Zodiac`;
        } else if (slide.type === "sign") {
          altText = `${slide.sign} — ${slide.headline} | AI Zodiac`;
        } else if (slide.type === "cta") {
          altText = "Discover more with AI Zodiac | AI Zodiac";
        }
      }

      return {
        url: item.url,
        altText,
      };
    });

    const manifest = {
      date: publishDate,
      id: generatedContent.contentId || `social-${publishDate}`,
      type: MEDIA_TYPES.CAROUSEL,
      media: manifestMedia,
      captions: {
        instagram: generatedContent.instagramCaption,
        facebook: ensureFacebookGooglePlayLink(generatedContent.facebookCaption),
        pinterest: {
          title: generatedContent.pinterestTitle,
          description: generatedContent.pinterestDescription,
          link: generatedContent.pinterestLink || DEFAULT_APP_PLAY_STORE_URL,
        },
      },
      metadata: {
        category: generatedContent.category,
        topic: generatedContent.topic,
        contentId: generatedContent.contentId,
        slideCount: manifestMedia.length,
        qualityGate: QUALITY_GATE_STATUS.PASS,
        generatedAt: new Date().toISOString(),
      },
    };

    // ==========================================================================
    // STEP 7: Comprehensive Production Social Quality Gate Evaluation
    // ==========================================================================
    const qualityGate = await evaluateQualityGate({
      canonical: generatedContent,
      renderedSlides,
      manifest,
      expectedDate: publishDate,
      expectedCategory: generatedContent.category,
      mediaBaseUrl: r2Config.publicBaseUrl,
    });

    if (!qualityGate.passed) {
      const gateErr = new Error(`Production Quality Gate Failed for ${publishDate}: ${qualityGate.errors.join("; ")}`);
      gateErr.errors = qualityGate.errors;

      if (redis && !dryRun) {
        await updatePrepareStage(redis, publishDate, PREPARE_STAGES.QUALITY_GATE_FAILED, {
          error: gateErr.message,
          failureReasons: qualityGate.errors,
          qualityGate,
        });
      }
      throw gateErr;
    }

    // Save manifest to Redis at aiz:social:manifest:<date> (unless dry-run)
    if (redis && !dryRun) {
      const manifestKey = getManifestKey(publishDate);
      await redis.set(manifestKey, JSON.stringify(manifest), { ex: 90 * 86400 });

      await updatePrepareStage(redis, publishDate, PREPARE_STAGES.QUALITY_GATE_PASS, {
        manifestId: manifest.id,
        manifest,
        qualityGate,
      });
    }

    return {
      success: true,
      status: QUALITY_GATE_STATUS.PASS,
      publishDate,
      contentId: manifest.id,
      category: generatedContent.category,
      topic: generatedContent.topic,
      slideCount: manifestMedia.length,
      manifest,
      qualityGate,
      dryRun,
      message: dryRun
        ? "Dry-run preparation and Quality Gate passed. Zero writes committed."
        : "Daily social content package passed Quality Gate and manifest saved to Redis.",
    };

  } finally {
    // Release distributed lock if acquired
    if (redis && lockOwnerId) {
      await releaseDistributedLock(redis, publishDate, lockOwnerId);
    }
  }
}
