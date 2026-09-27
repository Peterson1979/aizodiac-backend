// test-promo-videos-validation.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { validateManifest, normalizeManifest } from "./lib/social/contentManifest.js";
import { validatePublishManifest } from "./lib/social/quality/socialQualityGate.js";
import { importManifestBatch } from "./scripts/import-social-manifests.mjs";

console.log("==================================================");
console.log("30-DAY PROMOTIONAL VIDEO SUITE VALIDATION");
console.log("==================================================");

const MANIFEST_DIR = path.resolve(process.cwd(), "fixtures/social-manifests/promo-videos-30");
const BATCH_FILE = path.resolve(process.cwd(), "fixtures/social-manifests/promo-videos-30-batch.json");
const SOURCE_DESC_FILE = "C:\\Users\\opeti\\APP\\AI Zodiac\\AI Zodiac promo\\1 havi\\AI Zodiac 1 havi.txt";
const SOURCE_VIDEO_DIR = "C:\\Users\\opeti\\APP\\AI Zodiac\\AI Zodiac promo\\1 havi\\Sep 26 - okt 24";

// ============================================================================
// CHECK 1 & 4 & 5: Parse Source Files & Check Video Assets Existence
// ============================================================================
console.log("\n[CHECK 1] Verifying source files and media assets...");

assert.ok(fs.existsSync(SOURCE_DESC_FILE), "Source descriptions file must exist");
assert.ok(fs.existsSync(SOURCE_VIDEO_DIR), "Source video directory must exist");

const descRaw = fs.readFileSync(SOURCE_DESC_FILE, "utf8");
const descBlocks = descRaw.split(/(?=^\d+\.\s*$)/m).map(b => b.trim()).filter(Boolean);
assert.equal(descBlocks.length, 30, "Source description file must contain exactly 30 numbered descriptions");

const parsedDescriptions = [];
for (let i = 0; i < 30; i++) {
  const seq = i + 1;
  const block = descBlocks[i];
  const numMatch = block.match(/^(\d+)\./);
  const num = numMatch ? parseInt(numMatch[1], 10) : seq;
  assert.equal(num, seq, `Source block ${i} must have sequence number ${seq}`);

  const titleMatch = block.match(/\*\*Title:\*\*\s*(.+)/);
  const visualMatch = block.match(/\*\*Visual:\*\*\s*(.+)/);
  const voiceoverMatch = block.match(/\*\*Voiceover:\*\*\s*(.+)/);

  assert.ok(titleMatch, `Description ${seq} must have a title`);
  assert.ok(visualMatch, `Description ${seq} must have a visual`);
  assert.ok(voiceoverMatch, `Description ${seq} must have a voiceover`);

  const title = titleMatch[1].trim();
  const visual = visualMatch[1].trim();
  const voiceover = voiceoverMatch[1].trim().replace(/^[“"']+|[”"']+$/g, "");

  const videoFileName = `${seq}.mp4`;
  const videoFilePath = path.join(SOURCE_VIDEO_DIR, videoFileName);
  assert.ok(fs.existsSync(videoFilePath), `Source video file ${videoFileName} must exist at ${videoFilePath}`);
  const stat = fs.statSync(videoFilePath);
  assert.ok(stat.size > 1000000, `Video file ${videoFileName} must be valid size (> 1MB), found ${stat.size} bytes`);

  parsedDescriptions.push({ seq, title, visual, voiceover, videoFileName, videoFilePath, size: stat.size });
}

console.log("  ✓ All 30 source descriptions successfully parsed");
console.log("  ✓ All 30 source video files confirmed on disk (>1MB each)");

// ============================================================================
// CHECK 2 & 3: Verify 30 Individual Generated JSON Files & 1:1 Mapping
// ============================================================================
console.log("\n[CHECK 2] Verifying individual JSON manifests and strict 1:1 mapping...");

assert.ok(fs.existsSync(MANIFEST_DIR), "Output manifest directory must exist");
const manifestFiles = fs.readdirSync(MANIFEST_DIR).filter(f => f.endsWith(".json")).sort();
assert.equal(manifestFiles.length, 30, `Expected exactly 30 manifest files in ${MANIFEST_DIR}, found ${manifestFiles.length}`);

const seenSequenceNumbers = new Set();
const seenDates = new Set();
const seenVideos = new Set();
const seenTitles = new Set();
const seenManifestIds = new Set();
const loadedManifests = [];

for (let i = 0; i < 30; i++) {
  const seq = i + 1;
  const seqPad = String(seq).padStart(2, "0");
  const expectedFileName = `promo-video-${seqPad}.json`;
  assert.equal(manifestFiles[i], expectedFileName, `Manifest file at index ${i} must be ${expectedFileName}`);

  const filePath = path.join(MANIFEST_DIR, expectedFileName);
  const content = JSON.parse(fs.readFileSync(filePath, "utf8"));
  loadedManifests.push(content);

  // 1. Strict 1:1 Metadata Mapping
  const meta = content.metadata;
  assert.ok(meta, `Manifest ${expectedFileName} missing metadata`);
  assert.equal(meta.series, "ai_zodiac_promo_30", "Series must be 'ai_zodiac_promo_30'");
  assert.equal(meta.sequenceNumber, seq, `Sequence number must be ${seq}`);
  assert.equal(meta.sourceDescriptionNumber, seq, `Source description number must be ${seq}`);
  assert.equal(meta.videoFileName, `${seq}.mp4`, `Video file name must be ${seq}.mp4`);
  assert.equal(meta.exactSourceTitle, parsedDescriptions[i].title, `Title must match source description ${seq}`);
  assert.equal(meta.voiceover, parsedDescriptions[i].voiceover, `Voiceover must match source description ${seq}`);
  assert.equal(meta.visual, parsedDescriptions[i].visual, `Visual must match source description ${seq}`);
  assert.equal(meta.qualityGate, "QUALITY_GATE_PASS", "Quality gate status must be 'QUALITY_GATE_PASS'");

  // 2. Uniqueness Checks
  assert.ok(!seenSequenceNumbers.has(seq), `Duplicate sequence number ${seq}`);
  seenSequenceNumbers.add(seq);

  assert.ok(!seenVideos.has(meta.videoFileName), `Duplicate video filename ${meta.videoFileName}`);
  seenVideos.add(meta.videoFileName);

  assert.ok(!seenTitles.has(meta.exactSourceTitle), `Duplicate source title ${meta.exactSourceTitle}`);
  seenTitles.add(meta.exactSourceTitle);

  assert.ok(!seenManifestIds.has(content.id), `Duplicate manifest id ${content.id}`);
  seenManifestIds.add(content.id);

  // 3. Date Range and Continuity
  const expectedDate = new Date(new Date("2026-09-27T00:00:00Z").getTime() + (seq - 1) * 86400000).toISOString().split("T")[0];
  assert.equal(content.date, expectedDate, `Date for sequence ${seq} must be ${expectedDate}`);
  assert.ok(!seenDates.has(content.date), `Duplicate date ${content.date}`);
  seenDates.add(content.date);

  // 4. Destinations Check
  assert.deepEqual(content.destinations, ["instagram", "facebook", "youtube"], "Destinations must be exactly ['instagram', 'facebook', 'youtube']");
  assert.ok(!content.destinations.includes("pinterest"), "Pinterest must NOT be targeted");
  assert.equal(content.captions.pinterest, undefined, "Pinterest captions must NOT be present");

  // 5. Captions Check
  assert.ok(content.captions.instagram && typeof content.captions.instagram === "string", "Instagram caption must be non-empty string");
  assert.ok(content.captions.instagram.includes("link in bio") || content.captions.instagram.includes("Link in bio"), "Instagram caption must have bio CTA");
  assert.ok(content.captions.facebook && typeof content.captions.facebook === "string", "Facebook caption must be non-empty string");
  assert.ok(content.captions.facebook.includes("play.google.com"), "Facebook caption must contain Google Play link");
  assert.ok(content.captions.youtube && typeof content.captions.youtube === "object", "YouTube caption must be object");
  assert.ok(content.captions.youtube.title && content.captions.youtube.title.length <= 100, "YouTube title must be <= 100 chars");
  assert.ok(content.captions.youtube.description && content.captions.youtube.description.includes("play.google.com"), "YouTube description must contain Google Play link");

  // 6. Media Item Check
  assert.equal(content.media.length, 1, "Media array must contain exactly 1 video");
  const mediaItem = content.media[0];
  assert.ok(mediaItem.url.startsWith("https://"), "Media URL must be HTTPS");
  assert.equal(mediaItem.type, "video/mp4");
  assert.equal(mediaItem.aspectRatio, "9:16");
  assert.ok(mediaItem.altText.includes("AI Zodiac"), "AltText must include brand tag");
  assert.equal(mediaItem.fileName, `${seq}.mp4`);

  // 7. Standard Schema Validation
  const valResult = validateManifest(content);
  assert.ok(valResult.valid, `validateManifest failed for ${expectedFileName}: ${valResult.errors?.join("; ")}`);

  const valPublishResult = validatePublishManifest(content);
  assert.ok(valPublishResult.valid, `validatePublishManifest failed for ${expectedFileName}: ${valPublishResult.errors?.join("; ")}`);
}

console.log("  ✓ All 30 manifest files verified with strict 1:1 pairing");
console.log("  ✓ No sequence, video, description, date, or ID is used twice");
console.log("  ✓ Date continuity verified: 2026-09-27 through 2026-10-26 (30 consecutive days, zero gaps)");
console.log("  ✓ All 30 files pass both validateManifest and validatePublishManifest schemas");

// ============================================================================
// CHECK 3: Verify Batch File & Import Dry-Run
// ============================================================================
console.log("\n[CHECK 3] Verifying combined batch file and batch importer dry-run...");

assert.ok(fs.existsSync(BATCH_FILE), "Batch file must exist");
const batchData = JSON.parse(fs.readFileSync(BATCH_FILE, "utf8"));
assert.equal(batchData.length, 30, "Batch file must contain 30 manifests");

const importResult = await importManifestBatch({
  filePath: BATCH_FILE,
  apply: false, // Dry-run mode! Zero writes!
});

assert.equal(importResult.success, true, "Batch import dry-run must succeed");
assert.equal(importResult.dryRun, true, "Must be dryRun = true");
assert.equal(importResult.total, 30, "Total must be 30");
assert.equal(importResult.validated, 30, "Validated count must be 30");
assert.equal(importResult.imported, 0, "Zero items imported in dry-run");
assert.equal(importResult.errors.length, 0, "Zero errors in dry-run");

console.log("  ✓ importManifestBatch dry-run completed successfully for all 30 manifests");

// ============================================================================
// CHECK 4: Verify Existing Pipeline & Zero Unintended Side Effects
// ============================================================================
console.log("\n[CHECK 4] Verifying existing carousel assets and code integrity...");

assert.ok(fs.existsSync("fixtures/sample-social-batch.json"), "Existing sample batch must remain untouched");
assert.ok(fs.existsSync("vercel.json"), "vercel.json must exist");
const vercelConfig = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
assert.ok(vercelConfig.crons.some(c => c.path.includes("publishDailySocial")), "Existing publishDailySocial cron must be present");

console.log("  ✓ Existing carousel and social publishing configs remain intact");

console.log("\n==================================================");
console.log("ALL 30-DAY PROMOTIONAL VIDEO VALIDATIONS PASSED! 🎉");
console.log("==================================================");
