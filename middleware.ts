// app/middleware.ts (Vercel Edge-kompatibilis, rate limit megtartva)

import type { NextRequest } from "next/server";

// Egyszerű memóriában tárolt rate-limit tároló
const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

// LIMIT: 6 kérés / perc / IP
const MAX_REQUESTS = 6;
const WINDOW_MS = 60 * 1000; // 1 perc

export const config = {
  matcher: "/api/:path*", // minden /api végpontra
};

export default async function middleware(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (entry) {
    if (now - entry.timestamp < WINDOW_MS) {
      if (entry.count >= MAX_REQUESTS) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        entry.count++;
      }
    } else {
      // új időablak kezdődik
      rateLimitMap.set(ip, { count: 1, timestamp: now });
    }
  } else {
    // első kérés ettől az IP-től
    rateLimitMap.set(ip, { count: 1, timestamp: now });
  }

  return new Response(null, { status: 200 });
}
