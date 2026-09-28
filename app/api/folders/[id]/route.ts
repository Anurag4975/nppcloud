import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, notFound, rpcError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");
  const admin = supabaseAdmin();
  if (parsed.data.parent_id) {
    const { data: parent } = await admin
      .from("folders")
      .select("id")
      .eq("id", parsed.data.parent_id)
      .eq("user_id", user.id)
      .is("trashed_at", null)
      .single();
    if (!parent)
      return badRequest("Target folder doesn't exist or isn't yours.");
  }
  const { data, error } = await admin
    .from("folders")
    .update({ ...parsed.data })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("trashed_at", null)
    .select()
    .single();
  if (error || !data) return notFound("Folder not found.");
  return Response.json({ folder: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const admin = supabaseAdmin();
  // Recursive soft delete: folder + all subfolders + files move to trash.
  // Recoverable; quota not reclaimed until purge. B2 objects untouched.
  const { error } = await admin.rpc("trash_folder_recursive", {
    p_user_id: user.id,
    p_folder_id: id,
  });
  if (error) return rpcError(error);
  return Response.json({ ok: true });
}
