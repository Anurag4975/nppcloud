import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { badRequest } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/search?q=<term>
// Phase 4 (backend search): server-side ILIKE across the user's active files
// and folders, so the client doesn't have to page through everything to
// filter. pg_trgm GIN indexes (migration 0005) accelerate this when present.
export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 1) return badRequest("Missing search term.");
  const admin = supabaseAdmin();
  const like = `%${q}%`;
  const [{ data: files }, { data: folders }] = await Promise.all([
    admin.from("files")
      .select("*")
      .eq("user_id", user.id).eq("status", "active")
      .ilike("name", like)
      .order("updated_at", { ascending: false })
      .limit(100),
    admin.from("folders")
      .select("id, name, parent_id, status, created_at, updated_at")
      .eq("user_id", user.id).eq("status", "active")
      .ilike("name", like)
      .order("name", { ascending: true })
      .limit(50),
  ]);
  return Response.json(
    { files: files ?? [], folders: folders ?? [] },
    { headers: { "Cache-Control": "private, no-store, max-age=30" } },
  );
}
