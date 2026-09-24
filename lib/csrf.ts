// CSRF protection for cookie-authenticated mutating requests.
// Our auth lives in HttpOnly cookies (@supabase/ssr), so any state-changing
// route (POST/PATCH/DELETE) must verify the request came from our own origin.
// Browsers always send the Origin header on fetch() with credentials, so a
// cross-site forged form submission carries the attacker's origin — which we
// reject here. GET/HEAD are safe (no state change) and exempt.
import type { NextRequest } from "next/server";
import { forbidden } from "./errors";

function expectedOrigin(req: NextRequest): string {
  // NEXT_PUBLIC_SITE_URL is the canonical origin in production; fall back to
  // the request's own host (safe in dev / single-tenant deployments).
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? req.nextUrl.host;
  return `${proto}://${host}`;
}

/** Returns a 403 Response if the request is cross-origin, else null. Call on every mutating route. */
export function csrfGuard(req: NextRequest): Response | null {
  const origin = req.headers.get("origin");
  const expected = expectedOrigin(req);
  if (origin) {
    if (origin !== expected) return forbidden("Cross-origin request rejected.");
    return null;
  }
  // Origin header absent (some older clients): fall back to Referer.
  const referer = req.headers.get("referer");
  if (referer && !referer.startsWith(expected + "/") && referer !== expected) {
    return forbidden("Cross-origin request rejected.");
  }
  return null;
}
