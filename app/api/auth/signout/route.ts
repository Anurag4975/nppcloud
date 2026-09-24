import { NextRequest, NextResponse } from "next/server";
import { csrfGuard } from "@/lib/csrf";
import { supabaseServerClient } from "@/lib/supabase-server-client";

// Server-side sign-out: clears the HttpOnly session cookie properly (client-side
// signOut can't write cookies in a Server Component context). Redirects to /login.
export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const supabase = supabaseServerClient();
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
}
