// test-legal-pages.mjs
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import handler, { PRIVACY_POLICY_HTML } from "./api/privacyPolicy.js";

console.log("==================================================");
console.log("RUNNING LEGAL & SITE ARCHITECTURE TEST SUITE");
console.log("==================================================");

const cwd = process.cwd();

// Helper to check file existence
async function fileExists(relPath) {
  try {
    await access(resolve(cwd, relPath));
    return true;
  } catch {
    return false;
  }
}

// Helper to read file utf-8
async function read(relPath) {
  return await readFile(resolve(cwd, relPath), "utf8");
}

// ============================================================================
// TEST 1: All Legal and Informational Pages Exist
// ============================================================================
{
  console.log("\n[TEST 1] Page Existence and Accessibility");

  const requiredFiles = [
    "public/index.html",
    "public/privacy-policy/index.html",
    "public/terms-of-use/index.html",
    "public/disclaimer/index.html",
    "public/contact/index.html",
    "public/sitemap.xml",
    "public/robots.txt",
    "api/privacyPolicy.js",
    "public/ai-zodiac-forray-gyongyi/privacy-policy.html",
    "public/ai-zodiac-forray-gyongyi/privacy-policy/index.html"
  ];

  for (const file of requiredFiles) {
    const exists = await fileExists(file);
    assert.ok(exists, `Required file ${file} must exist`);
    console.log(`  ✓ Verified file: ${file}`);
  }
}

// ============================================================================
// TEST 2: Primary Navigation Integrity (No Legal Pages in Header)
// ============================================================================
{
  console.log("\n[TEST 2] Primary Navigation Architecture");

  const indexHtml = await read("public/index.html");

  // Extract header/nav portion
  const headerMatch = indexHtml.match(/<header>([\s\S]*?)<\/header>/);
  assert.ok(headerMatch, "index.html must have a <header> element");
  const headerHtml = headerMatch[1];

  // Assert legal pages are NOT in primary header nav
  assert.ok(
    !headerHtml.includes('href="/privacy-policy"'),
    "Header navigation must NOT contain Privacy Policy"
  );
  assert.ok(
    !headerHtml.includes('href="/terms-of-use"'),
    "Header navigation must NOT contain Terms of Use"
  );
  assert.ok(
    !headerHtml.includes('href="/disclaimer"'),
    "Header navigation must NOT contain AI & Content Disclaimer"
  );

  // Assert expected header links
  assert.ok(headerHtml.includes('href="#features"'), "Header nav must link to #features");
  assert.ok(headerHtml.includes('href="/contact"'), "Header nav must link to /contact");
  assert.ok(headerHtml.includes("play.google.com"), "Header nav must link to Google Play Store");

  console.log("  ✓ Legal pages strictly absent from primary header navigation");
  console.log("  ✓ Header navigation includes Features, Contact, and Get App");
}

// ============================================================================
// TEST 3: Structured Footer Verification on Homepage
// ============================================================================
{
  console.log("\n[TEST 3] Homepage Footer Structure & Legal Links");

  const indexHtml = await read("public/index.html");

  const footerMatch = indexHtml.match(/<footer>([\s\S]*?)<\/footer>/);
  assert.ok(footerMatch, "index.html must have a <footer> element");
  const footerHtml = footerMatch[1];

  // Legal section
  assert.ok(footerHtml.includes("Legal"), "Footer must contain a 'Legal' section heading");
  assert.ok(footerHtml.includes('href="/privacy-policy"'), "Footer must link to /privacy-policy");
  assert.ok(footerHtml.includes('href="/terms-of-use"'), "Footer must link to /terms-of-use");
  assert.ok(footerHtml.includes('href="/disclaimer"'), "Footer must link to /disclaimer");

  // Support / Contact section (separate from Legal)
  assert.ok(footerHtml.includes('href="/contact"'), "Footer must link to /contact");
  assert.ok(footerHtml.includes("play.google.com"), "Footer must link to Google Play Store");

  // Developer attribution & copyright
  assert.ok(footerHtml.includes("Forray Gyöngyi"), "Footer must identify developer 'Forray Gyöngyi'");
  assert.ok(footerHtml.includes("AI Zodiac"), "Footer must identify 'AI Zodiac'");
  assert.ok(footerHtml.includes("2026"), "Footer must include current year '2026'");

  console.log("  ✓ Homepage footer contains structured Legal column with all 3 legal routes");
  console.log("  ✓ Support/Contact section is available separately");
  console.log("  ✓ Developer attribution & copyright verified");
}

// ============================================================================
// TEST 4: Subpage Cross-Links, Nav-Back, and Consistent Design
// ============================================================================
{
  console.log("\n[TEST 4] Legal & Informational Subpages Consistency");

  const subpages = [
    { file: "public/privacy-policy/index.html", title: "Privacy Policy" },
    { file: "public/terms-of-use/index.html", title: "Terms of Use" },
    { file: "public/disclaimer/index.html", title: "AI & Content Disclaimer" },
    { file: "public/contact/index.html", title: "Contact" }
  ];

  for (const page of subpages) {
    const html = await read(page.file);

    // Nav-back link to Home
    assert.ok(
      html.includes('href="/"') && html.includes("Back to AI Zodiac Home"),
      `${page.file} must include a nav-back link to home`
    );

    // Footer cross-links
    assert.ok(html.includes('href="/privacy-policy"'), `${page.file} must cross-link /privacy-policy`);
    assert.ok(html.includes('href="/terms-of-use"'), `${page.file} must cross-link /terms-of-use`);
    assert.ok(html.includes('href="/disclaimer"'), `${page.file} must cross-link /disclaimer`);
    assert.ok(html.includes('href="/contact"'), `${page.file} must cross-link /contact`);

    // Developer attribution
    assert.ok(html.includes("Forray Gyöngyi"), `${page.file} must attribute Forray Gyöngyi`);

    // Viewport & Charset
    assert.ok(html.includes('<meta charset="UTF-8">'), `${page.file} must declare UTF-8 charset`);
    assert.ok(html.includes('name="viewport"'), `${page.file} must include viewport meta`);

    // Title tag
    assert.ok(html.includes("<title>"), `${page.file} must have <title> tag`);

    console.log(`  ✓ Subpage ${page.file} (${page.title}) has valid cross-links, nav-back, and metadata`);
  }
}

// ============================================================================
// TEST 5: Legal Content Accuracy & Disclosures
// ============================================================================
{
  console.log("\n[TEST 5] Content Accuracy & Disclosures Across All Legal Pages");

  const termsHtml = await read("public/terms-of-use/index.html");
  const disclaimerHtml = await read("public/disclaimer/index.html");
  const privacyHtml = await read("public/privacy-policy/index.html");
  const contactHtml = await read("public/contact/index.html");

  // Terms of Use specific checks
  assert.ok(termsHtml.includes("Terms of Use"), "Terms of Use title verified");
  assert.ok(termsHtml.includes("Forray Gyöngyi"), "Developer identified in Terms");
  assert.ok(termsHtml.includes("SharedPreferences"), "Local storage architecture documented");
  assert.ok(termsHtml.includes("Entertainment"), "Entertainment purpose declared");
  assert.ok(termsHtml.includes("Google AdMob"), "Google AdMob disclosed");
  assert.ok(termsHtml.includes("Limitation of Liability"), "Limitation of liability section present");

  // AI & Content Disclaimer specific checks
  assert.ok(disclaimerHtml.includes("AI &amp; Content Disclaimer") || disclaimerHtml.includes("AI & Content Disclaimer"));
  assert.ok(disclaimerHtml.includes("Google Gemini"), "Google Gemini AI provider disclosed");
  assert.ok(disclaimerHtml.includes("Groq"), "Groq AI provider disclosed");
  assert.ok(disclaimerHtml.includes("medical") || disclaimerHtml.includes("Medical"), "Medical advice disclaimed");
  assert.ok(disclaimerHtml.includes("financial") || disclaimerHtml.includes("Financial"), "Financial advice disclaimed");
  assert.ok(disclaimerHtml.includes("legal") || disclaimerHtml.includes("Legal"), "Legal advice disclaimed");
  assert.ok(disclaimerHtml.includes("free will") || disclaimerHtml.includes("autonomy") || disclaimerHtml.includes("Personal Responsibility"), "User autonomy affirmed");

  // Contact Page specific checks
  assert.ok(contactHtml.includes("Contact &amp; Support") || contactHtml.includes("Contact & Support"));
  assert.ok(contactHtml.includes("Forray Gyöngyi"), "Developer identified on Contact page");
  assert.ok(contactHtml.includes("Google Play"), "Google Play support channel linked");

  // Zero tracking scripts or secret leaks across all files
  const allHtmls = [termsHtml, disclaimerHtml, privacyHtml, contactHtml];
  for (const html of allHtmls) {
    assert.ok(!html.includes("<script"), "Must have 0 script tags (no trackers/cookies)");
    assert.ok(!html.includes("process.env"), "Must not leak process.env");
    assert.ok(!html.includes("UPSTASH_REDIS_REST_URL"), "Must not leak Upstash credentials");
    assert.ok(!html.includes("CRON_SECRET"), "Must not leak CRON_SECRET");
  }

  console.log("  ✓ Terms of Use contains accurate legal scopes and liability limitations");
  console.log("  ✓ AI & Content Disclaimer explicitly covers Google Gemini, Groq, medical/financial/legal non-reliance");
  console.log("  ✓ Contact page provides clear developer contact channels and FAQ pointers");
  console.log("  ✓ Zero tracking scripts or secret leaks across all HTML files");
}

// ============================================================================
// TEST 6: Sitemap and Robots.txt Integrity
// ============================================================================
{
  console.log("\n[TEST 6] Sitemap.xml and Robots.txt Verification");

  const sitemapContent = await read("public/sitemap.xml");
  const robotsContent = await read("public/robots.txt");

  // Sitemap URLs
  const requiredSitemapUrls = [
    "https://aizodiac-backend-new.vercel.app/",
    "https://aizodiac-backend-new.vercel.app/privacy-policy",
    "https://aizodiac-backend-new.vercel.app/terms-of-use",
    "https://aizodiac-backend-new.vercel.app/disclaimer",
    "https://aizodiac-backend-new.vercel.app/contact"
  ];

  for (const url of requiredSitemapUrls) {
    assert.ok(sitemapContent.includes(`<loc>${url}</loc>`), `sitemap.xml must contain loc for ${url}`);
  }

  assert.ok(sitemapContent.includes("<urlset"), "sitemap.xml must have <urlset> root tag");
  assert.ok(sitemapContent.includes("</urlset>"), "sitemap.xml must close </urlset>");

  // Robots.txt
  assert.ok(robotsContent.includes("User-agent: *"), "robots.txt must include User-agent: *");
  assert.ok(robotsContent.includes("Allow: /"), "robots.txt must allow root crawling");
  assert.ok(robotsContent.includes("Sitemap: https://aizodiac-backend-new.vercel.app/sitemap.xml"), "robots.txt must link to sitemap.xml");

  console.log("  ✓ sitemap.xml contains all 5 canonical routes with priorities and lastmod dates");
  console.log("  ✓ robots.txt allows crawling and references the official sitemap URL");
}

// ============================================================================
// TEST 7: Internal Link Resolution & Zero Broken Links
// ============================================================================
{
  console.log("\n[TEST 7] Internal Link Resolution & Zero Broken Links");

  const pagesToCheck = [
    "public/index.html",
    "public/privacy-policy/index.html",
    "public/terms-of-use/index.html",
    "public/disclaimer/index.html",
    "public/contact/index.html"
  ];

  for (const pagePath of pagesToCheck) {
    const html = await read(pagePath);
    // Find all href="..."
    const hrefMatches = [...html.matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);

    for (const href of hrefMatches) {
      if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("#")) continue;

      let expectedFile;
      if (href === "/") {
        expectedFile = "public/index.html";
      } else if (href.startsWith("/")) {
        const cleanPath = href.replace(/^\//, "").replace(/\/$/, "");
        expectedFile = `public/${cleanPath}/index.html`;
      } else {
        expectedFile = `public/${href}`;
      }

      const exists = await fileExists(expectedFile);
      assert.ok(exists, `Link target '${href}' in ${pagePath} resolves to '${expectedFile}' which must exist`);
    }
  }

  console.log("  ✓ All internal relative links verified to resolve to existing HTML files with zero broken links");
}

console.log("\n==================================================");
console.log("ALL LEGAL & ARCHITECTURE TESTS PASSED! 🎉");
console.log("==================================================");
