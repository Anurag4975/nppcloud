import { getAuthedUser } from "@/lib/auth";
import { unauthorized } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

// Lists trashed files and folders. Trash counts toward quota — space is only
// reclaimed on permanent purge.
export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const admin = supabaseAdmin();
  const [{ data: files }, { data: folders }] = await Promise.all([
    admin.from("files").select("*").eq("user_id", user.id).eq("status", "trashed").order("trashed_at", { ascending: false }),
    admin.from("folders").select("*").eq("user_id", user.id).not("trashed_at", "is", null).order("trashed_at", { ascending: false }),
  ]);
  return Response.json({ files: files ?? [], folders: folders ?? [] });
}
