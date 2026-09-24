import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parentId = req.nextUrl.searchParams.get("parent_id"); // null/omitted = root
  const admin = supabaseAdmin();

  let folderQuery = admin.from("folders").select("*").eq("user_id", user.id);
  let fileQuery = admin.from("files").select("*").eq("user_id", user.id).eq("status", "active");

  folderQuery = parentId ? folderQuery.eq("parent_id", parentId) : folderQuery.is("parent_id", null);
  fileQuery = parentId ? fileQuery.eq("parent_id", parentId) : fileQuery.is("parent_id", null);

  const [{ data: folders }, { data: files }] = await Promise.all([folderQuery, fileQuery]);

  return Response.json({ folders: folders ?? [], files: files ?? [] });
}
