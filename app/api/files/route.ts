import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parentId = req.nextUrl.searchParams.get("parent_id"); // null/omitted = root
  const starred = req.nextUrl.searchParams.get("starred") === "1";
  const all = req.nextUrl.searchParams.get("all") === "1";
  const admin = supabaseAdmin();

  // Folder tree for MoveToPicker — every folder, no parent filter, no files.
  // Returned before the normal query paths so it can't be shadowed.
  if (all) {
    const { data: folders } = await admin
      .from("folders")
      .select("*")
      .eq("user_id", user.id)
      .is("trashed_at", null);
    return Response.json({ folders: folders ?? [], files: [] });
  }

  let folderQuery = admin
    .from("folders")
    .select("*")
    .eq("user_id", user.id)
    .is("trashed_at", null);
  let fileQuery = admin
    .from("files")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (starred) {
    // Starred view: across ALL folders, ignore parent_id.
    folderQuery = folderQuery.eq("starred", true);
    fileQuery = fileQuery.eq("starred", true);
  } else {
    folderQuery = parentId
      ? folderQuery.eq("parent_id", parentId)
      : folderQuery.is("parent_id", null);
    fileQuery = parentId
      ? fileQuery.eq("parent_id", parentId)
      : fileQuery.is("parent_id", null);
  }

  const [{ data: folders }, { data: files }] = await Promise.all([
    folderQuery,
    fileQuery,
  ]);

  return Response.json({ folders: folders ?? [], files: files ?? [] });
}
