import { NextRequest, NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";

// Supabase redirects here with ?code=... after Google OAuth, a magic-link
// click, a password-reset email, or an admin invite. Exchanging the code sets
// the session cookie. An optional ?next=/path overrides the destination
// (e.g. /reset-password after a recovery email).
const SAFE_NEXT_PATHS = ["/dashboard", "/onboarding", "/reset-password", "/settings"];

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("onboarded_at").eq("id", data.user.id).single();

  let destination = profile?.onboarded_at ? "/dashboard" : "/onboarding";
  if (next && SAFE_NEXT_PATHS.includes(next)) destination = next;

  return NextResponse.redirect(new URL(destination, req.url));
}
