import { NextRequest, NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";

const SAFE_NEXT_PATHS = [
  "/dashboard",
  "/onboarding",
  "/reset-password",
  "/settings",
];

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const next = req.nextUrl.searchParams.get("next");

    if (!code) {
      return NextResponse.redirect(
        new URL("/login?error=missing_code", req.url),
      );
    }

    const supabase = await supabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.user) {
      console.error("[auth/callback] exchangeCodeForSession failed:", error);
      return NextResponse.redirect(
        new URL("/login?error=auth_failed", req.url),
      );
    }

    // Profile lookup is best-effort. If the admin client is misconfigured,
    // we still want to send the user somewhere instead of 500-ing.
    let onboarded = false;
    try {
      const admin = supabaseAdmin();
      const { data: profile } = await admin
        .from("profiles")
        .select("onboarded_at")
        .eq("id", data.user.id)
        .single();
      onboarded = Boolean(profile?.onboarded_at);
    } catch (profileErr) {
      console.error("[auth/callback] profile lookup failed:", profileErr);
    }

    let destination = onboarded ? "/dashboard" : "/onboarding";
    if (
      next &&
      SAFE_NEXT_PATHS.some((p) => next === p || next.startsWith(p + "/"))
    ) {
      destination = next;
    }

    return NextResponse.redirect(new URL(destination, req.url));
  } catch (err) {
    console.error("[auth/callback] unexpected error:", err);
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }
}
