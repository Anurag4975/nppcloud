import { supabaseServerClient } from "./supabase-server-client";
import { unauthorized, forbidden } from "./errors";
import type { Profile } from "./types";

/**
 * Every API route calls this first. Reads the session from the HttpOnly cookie
 * (set by /auth/callback after sign-in) rather than requiring the browser to
 * manually attach a Bearer token — this is what lets OAuth, magic-link, and
 * invite flows all share one auth path with no client-side token plumbing.
 */
export async function getAuthedUser() {
  const supabase = await supabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** Authed user + their profile row (common pairing). Returns null if not authed. */
export async function getAuthedProfile(): Promise<{
  user: { id: string; email?: string };
  profile: Profile;
} | null> {
  const user = await getAuthedUser();
  if (!user) return null;
  const { supabaseAdmin } = await import("./supabase-server");
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return { user, profile: profile as Profile };
}

/** Every admin API route calls this. Explicit role check via service role (these routes read across users). */
export async function requireAdmin() {
  const user = await getAuthedUser();
  if (!user) return { error: unauthorized() } as const;
  const { supabaseAdmin } = await import("./supabase-server");
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin")
    return { error: forbidden("Admin access required.") } as const;
  return { user } as const;
}

export { unauthorized, forbidden };
