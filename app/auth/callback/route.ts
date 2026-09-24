import { NextRequest, NextResponse } from "next/server";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";

// Supabase redirects here with ?code=... after Google OAuth, a magic-link
// click, or an admin invite. Exchanging the code sets the session cookie,
// then we route to /onboarding or /dashboard depending on whether this
// person has completed onboarding before.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", req.url));
  }

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarded_at")
    .eq("id", data.user.id)
    .single();

  const destination = profile?.onboarded_at ? "/dashboard" : "/onboarding";
  return NextResponse.redirect(new URL(destination, req.url));
}
