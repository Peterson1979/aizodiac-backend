// api/astro.js
import { processAstroRequest, redis } from "./generateAstroContent.js";

/**
 * Legacy compatibility endpoint (Web Fetch / Edge API style).
 * Delegates to canonical processAstroRequest to prevent code duplication.
 */
export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  const rawIp = request.headers.get("x-forwarded-for") || "unknown";
  const ip = String(rawIp).split(",")[0].trim();

  try {
    const body = await request.json();
    const result = await processAstroRequest({
      body,
      ip,
      redisClient: redis,
    });

    const headers = {
      "Content-Type": "application/json",
      ...(result.headers || {}),
    };

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers,
    });
  } catch (error) {
    console.error("Error in astro.js adapter:", error.message || error);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}