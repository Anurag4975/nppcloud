import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, rpcError, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";
import { deleteObject } from "@/lib/b2";

function kindOf(req: NextRequest): "file" | "folder" {
  return req.nextUrl.searchParams.get("kind") === "folder" ? "folder" : "file";
}

// Restore from trash -> active (quota unchanged — it was counted all along).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const admin = supabaseAdmin();
  const kind = kindOf(req);
  const { error } = kind === "folder"
    ? await admin.rpc("restore_folder_recursive", { p_user_id: user.id, p_folder_id: id })
    : await admin.rpc("restore_file", { p_user_id: user.id, p_file_id: id });
  if (error) return rpcError(error);
  return Response.json({ ok: true });
}

// Permanent purge: deletes the row, reclaims quota, and removes the B2 object.
// Irreversible — UI must confirm.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const admin = supabaseAdmin();
  const kind = kindOf(req);

  if (kind === "folder") {
    const { error } = await admin.from("folders").delete().eq("id", id).eq("user_id", user.id).eq("status", "trashed");
    if (error) return internalError();
    return Response.json({ ok: true });
  }

  const { data: objectKey, error } = await admin.rpc("purge_file_permanent", {
    p_user_id: user.id, p_file_id: id,
  });
  if (error) return rpcError(error);
  if (objectKey) await deleteObject(objectKey as string);
  return Response.json({ ok: true });
}
