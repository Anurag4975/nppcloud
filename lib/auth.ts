import { supabaseServerClient } from "./supabase-server-client";

/**
 * Every API route calls this first. Reads the session from the
 * HttpOnly cookie (set by /auth/callback after sign-in) rather than
 * requiring the browser to manually attach a Bearer token — this is
 * what lets OAuth, magic-link, and invite flows all share one auth
 * path with no client-side token plumbing.
 */
export async function getAuthedUser() {
  const supabase = supabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export function unauthorized() {
  return Response.json({ error: { code: "unauthorized", message: "Not signed in." } }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: { code: "forbidden", message: "Admin access required." } }, { status: 403 });
}

/**
 * Every admin API route calls this. Explicitly checks profiles.role via
 * the service-role client (not relying on RLS's is_admin() here, since
 * these routes intentionally read across all users — the check itself
 * is what gates that access).
 */
export async function requireAdmin() {
  const user = await getAuthedUser();
  if (!user) return { error: unauthorized() } as const;

  const { supabaseAdmin } = await import("./supabase-server");
  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") return { error: forbidden() } as const;
  return { user } as const;
}

