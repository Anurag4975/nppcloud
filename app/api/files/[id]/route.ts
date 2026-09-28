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
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");

  const admin = supabaseAdmin();

  // Move validation: target folder must exist and belong to this user.
  if (parsed.data.parent_id) {
    const { data: parent } = await admin
      .from("folders")
      .select("id")
      .eq("id", parsed.data.parent_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    if (!parent)
      return badRequest("Target folder doesn't exist or isn't yours.");
  }

  // Rename/move = database operation only. The B2 object key never changes.
  const { data, error } = await admin
    .from("files")
    .update({ ...parsed.data })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .select()
    .single();
  if (error || !data) return notFound("File not found.");
  return Response.json({ file: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const { id } = await params;

  const admin = supabaseAdmin();
  // Soft delete -> trash. Quota is NOT reclaimed (trash counts toward storage,
  // industry standard); space is freed only on permanent purge.
  const { error } = await admin.rpc("trash_file", {
    p_user_id: user.id,
    p_file_id: id,
  });
  if (error) return rpcError(error);
  return Response.json({ ok: true });
}
