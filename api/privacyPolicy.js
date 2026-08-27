// api/privacyPolicy.js
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

export const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Privacy Policy for the AI Zodiac mobile application by Forray Gyöngyi.">
  <title>AI Zodiac Privacy Policy</title>
  <style>
    :root {
      --bg-color: #0f111a;
      --card-bg: #181b28;
      --text-color: #e2e8f0;
      --heading-color: #f8fafc;
      --muted-color: #94a3b8;
      --accent-color: #7c3aed;
      --accent-light: #a78bfa;
      --border-color: #2e344e;
      --line-height: 1.7;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg-color: #f8fafc;
        --card-bg: #ffffff;
        --text-color: #334155;
        --heading-color: #0f172a;
        --muted-color: #64748b;
        --accent-color: #6d28d9;
        --accent-light: #7c3aed;
        --border-color: #e2e8f0;
      }
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: var(--line-height);
      padding: 2rem 1rem;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 2.5rem 2rem;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }

    header {
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 1.5rem;
      margin-bottom: 2rem;
    }

    h1 {
      font-size: 2rem;
      color: var(--heading-color);
      margin-bottom: 0.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .meta-info {
      color: var(--muted-color);
      font-size: 0.95rem;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .meta-info span {
      display: inline-block;
    }

    h2 {
      font-size: 1.35rem;
      color: var(--heading-color);
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      font-weight: 600;
      border-left: 3px solid var(--accent-light);
      padding-left: 0.75rem;
    }

    p {
      margin-bottom: 1rem;
      color: var(--text-color);
    }

    ul {
      margin-left: 1.5rem;
      margin-bottom: 1.25rem;
    }

    li {
      margin-bottom: 0.5rem;
    }

    strong {
      color: var(--heading-color);
    }

    footer {
      border-top: 1px solid var(--border-color);
      padding-top: 1.5rem;
      margin-top: 2.5rem;
      font-size: 0.9rem;
      color: var(--muted-color);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>AI Zodiac Privacy Policy</h1>
      <div class="meta-info">
        <span><strong>Application:</strong> AI Zodiac</span>
        <span><strong>Developer:</strong> Forray Gyöngyi</span>
        <span><strong>Last updated:</strong> August 27, 2026</span>
      </div>
    </header>

    <main>
      <section>
        <h2>1. Introduction</h2>
        <p>
          This Privacy Policy describes how the <strong>AI Zodiac</strong> mobile application and its associated backend services ("we", "our", or "the app"), developed by <strong>Forray Gyöngyi</strong>, collect, process, and safeguard information when you use our mobile application.
        </p>
        <p>
          We are committed to user privacy, transparency, and data minimization. We design AI Zodiac so that astrological calculations and personalized horoscope insights can be generated without collecting unnecessary personal data.
        </p>
      </section>

      <section>
        <h2>2. Information the App May Process</h2>
        <p>Depending on the features you choose to use within the AI Zodiac mobile application, the app may process the following categories of information:</p>
        <ul>
          <li><strong>Astrological & Birth Inputs:</strong> Birth date, birth time, and approximate birth location/coordinates provided by you to calculate natal charts, planetary transits, ascendants, element balances, and Chinese zodiac alignments.</li>
          <li><strong>Astrology Queries:</strong> Questions or topics you submit to interactive astrological features (such as general transit interpretations or horoscope questions).</li>
          <li><strong>Language & Preferences:</strong> Your preferred language and app settings to deliver content in your selected language.</li>
        </ul>
      </section>

      <section>
        <h2>3. How Information Is Processed</h2>
        <p>The information processed by AI Zodiac is used solely for the following purposes:</p>
        <ul>
          <li>To compute factual astrological and astronomical values (such as life path numbers, lunar positions, rising signs, and element distributions).</li>
          <li>To generate daily, weekly, monthly, and yearly horoscope interpretations.</li>
          <li>To respond to your interactive astrology inquiries within the app.</li>
          <li>To operate and maintain app performance and prevent service abuse.</li>
        </ul>
      </section>

      <section>
        <h2>4. AI-Generated Content Processing</h2>
        <p>
          AI Zodiac utilizes artificial intelligence models alongside deterministic astrological calculation engines to generate personalized horoscope readings.
        </p>
        <p>
          When queries are sent to backend AI inference providers for content generation, prompts contain only non-personally identifiable astrological parameters (such as the target zodiac sign, date, and transit configurations). We do not include names, contact details, device identifiers, or persistent profile IDs in generation prompts.
        </p>
      </section>

      <section>
        <h2>5. Technical & Service Data</h2>
        <p>To ensure backend security, reliability, and cost protection, our backend infrastructure processes minimal technical service data:</p>
        <ul>
          <li><strong>Abuse Prevention & Rate Limiting:</strong> Client IP addresses may be hashed using SHA-256 (storing only truncated cryptographic hashes) to prevent automated denial-of-service or quota abuse. Raw IP addresses are not permanently stored.</li>
          <li><strong>Temporary Caching:</strong> Calculated horoscopes and non-PII astrological outputs are cached temporarily in secure in-memory storage (Upstash Redis) to provide fast response times and reduce redundant processing.</li>
          <li><strong>Aggregated Telemetry:</strong> Non-personally identifiable request counts and token usage totals are recorded in aggregate for system monitoring.</li>
        </ul>
      </section>

      <section>
        <h2>6. Third-Party Service Providers</h2>
        <p>AI Zodiac relies on reputable cloud infrastructure providers strictly to host backend services and perform AI inference:</p>
        <ul>
          <li><strong>Cloud Hosting & Edge Functions:</strong> Vercel (for serverless execution and static content delivery).</li>
          <li><strong>Caching & Rate Limiting:</strong> Upstash Redis (for ephemeral caching and rate-limiting).</li>
          <li><strong>AI Model Inference:</strong> Google Gemini API and Groq API (for processing non-PII astrological interpretation prompts).</li>
        </ul>
        <p>
          We do not sell, rent, or trade your data to third parties. We do not use third-party advertising networks, data brokers, or behavioral analytics SDKs.
        </p>
      </section>

      <section>
        <h2>7. Data Retention</h2>
        <p>
          AI Zodiac operates on a stateless, data-minimized model:
        </p>
        <ul>
          <li>Birth details entered in the mobile application are stored locally on your device and are not saved to a persistent user account database on our servers.</li>
          <li>Backend calculation cache entries expire automatically based on predefined time-to-live (TTL) settings.</li>
          <li>Temporary rate-limiting records expire automatically within 1 hour.</li>
        </ul>
      </section>

      <section>
        <h2>8. Data Security</h2>
        <p>
          All network communications between the AI Zodiac mobile application and the backend API use secure HTTPS encryption (Transport Layer Security / TLS). We enforce fail-closed security controls and minimize server-side data retention to protect against unauthorized access.
        </p>
      </section>

      <section>
        <h2>9. User Rights & Data Control</h2>
        <p>
          You maintain full control over your data within the AI Zodiac mobile application:
        </p>
        <ul>
          <li>You can update, modify, or delete your birth details at any time directly within the app settings.</li>
          <li>You can clear all locally stored data by clearing the app storage in your device settings or by uninstalling the application.</li>
        </ul>
      </section>

      <section>
        <h2>10. Children's Privacy</h2>
        <p>
          AI Zodiac is not directed to children under the age of 13 (or under 16 in applicable jurisdictions). We do not knowingly collect or solicit personal information from children. If you believe a child has provided us with personal information, please contact us so that we can take appropriate steps.
        </p>
      </section>

      <section>
        <h2>11. Cookies & Tracking</h2>
        <p>
          This Privacy Policy webpage and the AI Zodiac backend services do not use cookies, tracking pixels, or third-party web analytics tools.
        </p>
      </section>

      <section>
        <h2>12. Changes to This Privacy Policy</h2>
        <p>
          We may update this Privacy Policy periodically to reflect changes in our practices or applicable legal requirements. When updates occur, the "Last updated" date at the top of this policy will be revised.
        </p>
      </section>

      <section>
        <h2>13. Contact Information</h2>
        <p>
          If you have any questions, inquiries, or requests regarding this Privacy Policy or data handling in AI Zodiac, you may contact the developer, <strong>Forray Gyöngyi</strong>, through the official AI Zodiac app listing and developer support channels.
        </p>
      </section>
    </main>

    <footer>
      <p>&copy; 2026 AI Zodiac &bull; Developed by Forray Gyöngyi &bull; All rights reserved.</p>
    </footer>
  </div>
</body>
</html>`;

/**
 * Public Privacy Policy serverless endpoint for AI Zodiac.
 * Accessible publicly without authentication.
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method === "HEAD") {
    return res.status(200).end();
  }

  return res.status(200).send(PRIVACY_POLICY_HTML);
}
