import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { badRequest, notFound, rpcError, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  kind: z.enum(["file", "folder"]),
  id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(), // null = move to root
});

// Move a file or folder. Files move via direct parent_id update (no cycle
// risk). Folders go through move_folder() — cycle-safe (cannot move a folder
// into itself or any descendant) and ownership-checked. Raises
// cannot_move_into_own_descendant / folder_not_found / target_folder_not_found.
export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid move request.");
  const { kind, id, parent_id } = parsed.data;

  const admin = supabaseAdmin();

  if (parent_id) {
    // Target must exist, belong to user, not be trashed. (folders have no
    // status column — use trashed_at is null.)
    const { data: target } = await admin
      .from("folders")
      .select("id")
      .eq("id", parent_id)
      .eq("user_id", user.id)
      .is("trashed_at", null)
      .maybeSingle();
    if (!target) return notFound("Destination folder not found.");
  }

  if (kind === "file") {
    const { error } = await admin
      .from("files")
      .update({ parent_id, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) return internalError();
  } else {
    const { error } = await admin.rpc("move_folder", {
      p_user_id: user.id,
      p_folder_id: id,
      p_new_parent_id: parent_id,
    });
    if (error) return rpcError(error);
  }

  return Response.json({ ok: true });
}
