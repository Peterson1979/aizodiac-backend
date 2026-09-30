#!/usr/bin/env node
/**
 * scripts/test-threads-live.mjs
 *
 * Guarded One-Shot Live Test Script for AI Zodiac Threads Integration.
 *
 * SAFETY GUARDS:
 * 1. Requires explicit environment flag: THREADS_LIVE_TEST=true
 * 2. Requires environment variables: THREADS_USER_ID, THREADS_ACCESS_TOKEN
 * 3. Targets Threads ONLY. NEVER touches Instagram, Facebook, Pinterest, or YouTube.
 * 4. Safe read-only inspection by default. Real publication requires explicit --execute flag.
 * 5. Redacts all tokens and secrets from output.
 *
 * USAGE:
 *   # 1. Health-check & Profile inspection (Read-only, Zero writes)
 *   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --check
 *
 *   # 2. Carousel Dry-Run (Reaches media URLs, validates manifest, Zero writes)
 *   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --type=carousel --dry-run
 *
 *   # 3. Video Dry-Run (Validates video manifest and public URL, Zero writes)
 *   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --type=video --dry-run
 *
 *   # 4. Guarded Live Carousel Publication (Requires explicit --execute)
 *   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --type=carousel --execute
 *
 *   # 5. Guarded Live Video Publication (Requires explicit --execute)
 *   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --type=video --execute
 */

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { Redis } from "@upstash/redis";
import { getSocialConfig, redactSecrets, validateSocialConfig } from "../lib/social/config.js";
import { DESTINATIONS, MEDIA_TYPES, PUBLISH_STATUS } from "../lib/social/types.js";
import { ThreadsAdapter } from "../lib/social/adapters/threadsAdapter.js";
import { formatThreadsCaption, THREADS_MAX_CHARACTERS } from "../lib/social/content/destinations.js";
import { getPromoVideoManifestForDate, isPromoVideoCampaignDate } from "../lib/social/content/promoVideoRegistry.js";
import { getDateInTimeZone, resolveManifestForDate } from "../lib/social/contentManifest.js";

// Helper to safely load local environment files without overriding existing env vars
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=");
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim().replace(/^["'](.*)["']$/, "$1");
          if (key && !process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
}

// Load env files
loadEnvFile(path.resolve(process.cwd(), ".env.production.local"));
loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

function getRedisClient() {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

async function main() {
  console.log("=================================================================");
  console.log("AI ZODIAC — GUARDED THREADS INTEGRATION LIVE TEST");
  console.log("=================================================================\n");

  // Guard 1: Enforce explicit THREADS_LIVE_TEST=true flag
  if (process.env.THREADS_LIVE_TEST !== "true") {
    console.error("❌ BLOCKED BY SAFETY GUARD:");
    console.error("   Live test requires explicit environment variable:");
    console.error("   THREADS_LIVE_TEST=true\n");
    console.error("   Example: THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --check\n");
    process.exit(1);
  }

  // Load and validate configuration
  const config = getSocialConfig();
  const validation = validateSocialConfig(config, [DESTINATIONS.THREADS]);

  if (!validation.valid) {
    console.error("❌ CONFIGURATION INCOMPLETE:");
    for (const err of validation.errors) {
      console.error(`   - ${err}`);
    }
    console.error("\nRequired environment variables:");
    console.error("   THREADS_USER_ID=<threads_user_id>");
    console.error("   THREADS_ACCESS_TOKEN=<threads_access_token>");
    console.error("   THREADS_API_VERSION=v1.0 (optional, default v1.0)\n");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const isCheckOnly = args.includes("--check");
  const isDryRun = args.includes("--dry-run") || !args.includes("--execute");
  const isExecute = args.includes("--execute");
  const mediaTypeArg = args.find(a => a.startsWith("--type="))?.split("=")[1] || "carousel";

  const sanitizedUserId = config.threadsUserId.slice(0, 4) + "***" + config.threadsUserId.slice(-2);
  console.log(`🔒 Authenticated User ID: ${sanitizedUserId}`);
  console.log(`📡 API Version:          ${config.threadsApiVersion || "v1.0"}`);
  console.log(`🎯 Target Platform:       Threads ONLY (Meta Graph API)`);
  console.log(`🛡️ Execution Mode:        ${isExecute ? "⚠️ LIVE WRITE (--execute)" : "🛡️ READ-ONLY / DRY RUN"}`);
  console.log(`📦 Media Format:          ${mediaTypeArg.toUpperCase()}\n`);

  const adapter = new ThreadsAdapter();

  // Mode 1: Profile & Credentials Health-Check
  if (isCheckOnly) {
    console.log("--- [1/1] Diagnostic Token & Profile Health-Check ---");
    try {
      const apiVersion = config.threadsApiVersion || "v1.0";
      const profileUrl = `https://graph.threads.net/${apiVersion}/me?fields=id,username,threads_profile_picture_url&access_token=${encodeURIComponent(config.threadsAccessToken)}`;
      const res = await fetch(profileUrl);
      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("❌ Threads API returned error during profile check:");
        console.error(JSON.stringify(redactSecrets(data), null, 2));
        process.exit(1);
      }

      console.log("✅ Threads Profile Verified Successfully!");
      console.log(`   Username:        @${data.username || "unknown"}`);
      console.log(`   Account ID:      ${data.id || config.threadsUserId}`);
      console.log(`   Profile Pic:     ${data.threads_profile_picture_url ? "Available" : "Not set"}`);
      console.log("\nZero write calls committed. Test completed cleanly.");
      return;
    } catch (err) {
      console.error("❌ Network or fetch failure during health check:", redactSecrets(err.message));
      process.exit(1);
    }
  }

  // Mode 2 & 3: Carousel / Video Manifest Construction & Validation
  let testManifest = null;
  const targetDate = getDateInTimeZone(new Date(), config.timeZone);
  const redis = getRedisClient();

  if (mediaTypeArg === "video") {
    // Determine campaign date for promo video
    const promoDate = isPromoVideoCampaignDate(targetDate) ? targetDate : "2026-09-30";
    const promoManifest = getPromoVideoManifestForDate(promoDate);
    assert.ok(promoManifest, `Promo video manifest for ${promoDate} must resolve`);

    const rawCaption = promoManifest.captions?.threads || promoManifest.captions?.instagram || "✨ Discover your complete astrological blueprint with AI Zodiac.";
    const videoCaption = formatThreadsCaption({
      baseCaption: rawCaption,
      websiteUrl: promoManifest.destinationUrl || "https://aizodiac.life/",
    });

    testManifest = {
      date: promoDate,
      id: promoManifest.id,
      type: MEDIA_TYPES.VIDEO,
      media: promoManifest.media,
      destinationUrl: promoManifest.destinationUrl,
      captions: {
        threads: videoCaption,
      },
      metadata: promoManifest.metadata,
    };
  } else {
    // Carousel Manifest from active AI Zodiac pipeline (Redis manifest or recent approved package)
    let carouselManifest = redis ? await resolveManifestForDate(targetDate, { redis }) : null;
    if (!carouselManifest && redis) {
      // Check yesterday or recent date if today is before preparation time
      carouselManifest = await resolveManifestForDate("2026-09-29", { redis });
    }

    if (!carouselManifest) {
      // Fallback to sample carousel from R2
      carouselManifest = {
        date: "2026-09-29",
        id: "social-2026-09-29",
        type: MEDIA_TYPES.CAROUSEL,
        media: [
          { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/29/slide-01.png", altText: "Feature Spotlight: Personal Astrology Calendar | AI Zodiac" },
          { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/29/slide-02.png", altText: "Core functionality — Track Your Cosmic Calendar | AI Zodiac" },
          { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/29/slide-03.png", altText: "Practical benefit — Plan With Confidence | AI Zodiac" },
          { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/29/slide-04.png", altText: "Astrological insight — Unlock Cosmic Patterns | AI Zodiac" },
          { url: "https://pub-4169b32ebff84de78189ef9a010baa5c.r2.dev/social/2026/09/29/slide-05.png", altText: "Discover more with AI Zodiac | AI Zodiac" },
        ],
        captions: {
          instagram: "Discover how the Personal Astrology Calendar keeps your days in sync with the cosmos! From lunar cycles to retrograde alerts, it’s your daily guide to living astrologically. Ready to plan your week the star‑smart way?\n\nExplore more with AI Zodiac — link in bio.\n\n#astrology #zodiac #horoscope #aizodiac",
        },
        metadata: {
          category: "feature_spotlight",
          topic: "Feature Spotlight: Personal Astrology Calendar",
        },
      };
    }

    const rawCaption = carouselManifest.captions?.threads || carouselManifest.captions?.instagram || "✨ Cosmic energy & daily astrological clarity | AI Zodiac\n\n#astrology #aizodiac #zodiac #horoscope";
    const carouselCaption = formatThreadsCaption({
      baseCaption: rawCaption,
      websiteUrl: "https://aizodiac.life/",
    });

    testManifest = {
      date: carouselManifest.date,
      id: carouselManifest.id,
      type: MEDIA_TYPES.CAROUSEL,
      media: carouselManifest.media,
      captions: {
        threads: carouselCaption,
      },
      metadata: carouselManifest.metadata,
    };
  }

  console.log("--- Manifest Prepared for Threads Target ---");
  console.log(`  Date:           ${testManifest.date}`);
  console.log(`  Content ID:     ${testManifest.id}`);
  console.log(`  Type:           ${testManifest.type.toUpperCase()}`);
  console.log(`  Media Count:    ${testManifest.media.length} items`);
  console.log(`  Caption Length: ${testManifest.captions.threads.length} / ${THREADS_MAX_CHARACTERS} chars`);
  console.log(`  Caption Preview:\n"""\n${testManifest.captions.threads}\n"""\n`);

  // Verify caption length <= 500
  assert.ok(
    testManifest.captions.threads.length <= THREADS_MAX_CHARACTERS,
    `Threads caption length (${testManifest.captions.threads.length}) must be <= ${THREADS_MAX_CHARACTERS}`
  );

  // Validate public media reachability for all items
  console.log("--- Validating Media Asset Accessibility (HEAD check) ---");
  for (let i = 0; i < testManifest.media.length; i++) {
    const item = testManifest.media[i];
    const headRes = await fetch(item.url, { method: "HEAD" });
    const isOk = headRes.ok || headRes.status === 200;
    console.log(`  [${i + 1}/${testManifest.media.length}] ${item.url}`);
    console.log(`      Status: ${headRes.status} | Content-Type: ${headRes.headers.get("content-type")} | Content-Length: ${headRes.headers.get("content-length")} bytes`);
    assert.ok(isOk, `Media asset ${item.url} must return HTTP 200 (received ${headRes.status})`);
  }
  console.log("  ✓ All media assets verified publicly accessible with HTTP 200\n");

  if (!isExecute) {
    console.log("=================================================================");
    console.log("🛡️ DRY RUN COMPLETE: Manifest & media accessibility verified.");
    console.log("   Zero write calls committed to Threads or any other platform.");
    console.log("   To perform an actual publication, re-run with --execute flag:\n");
    console.log(`   THREADS_LIVE_TEST=true node scripts/test-threads-live.mjs --type=${mediaTypeArg} --execute\n`);
    console.log("=================================================================\n");
    return;
  }

  // Guard 2: Explicit live publication with confirmation
  console.log("⚠️ PROCEEDING WITH LIVE THREADS PUBLICATION...");
  try {
    const publishResult = await adapter.publish({
      manifest: testManifest,
      config,
    });

    console.log("\n=================================================================");
    if (publishResult.success && publishResult.status === PUBLISH_STATUS.PUBLISHED) {
      console.log("🎉 LIVE THREADS PUBLICATION SUCCEEDED!");
      console.log(`   Post ID:      ${publishResult.postId}`);
      console.log(`   Container ID: ${publishResult.containerId || "N/A"}`);
      console.log(`   Published At: ${publishResult.publishedAt}`);

      // Attempt to retrieve official permalink from Threads Graph API
      try {
        const apiVersion = config.threadsApiVersion || "v1.0";
        const metaRes = await fetch(`https://graph.threads.net/${apiVersion}/${encodeURIComponent(publishResult.postId)}?fields=id,permalink&access_token=${encodeURIComponent(config.threadsAccessToken)}`);
        const metaData = await metaRes.json();
        if (metaData && metaData.permalink) {
          console.log(`   Permalink:    ${metaData.permalink}`);
        } else {
          console.log(`   Permalink:    https://www.threads.net/@aizodiacapp`);
        }
      } catch {
        console.log(`   Permalink:    https://www.threads.net/@aizodiacapp`);
      }
    } else {
      console.error("❌ LIVE THREADS PUBLICATION FAILED:");
      console.error(JSON.stringify(redactSecrets(publishResult), null, 2));
      process.exit(1);
    }
    console.log("=================================================================\n");
  } catch (err) {
    console.error("❌ Unhandled exception during live Threads publication:", redactSecrets(err.message));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Fatal error in Threads live test script:", redactSecrets(err.message));
  process.exit(1);
});
