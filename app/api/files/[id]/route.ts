import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }

  const admin = supabaseAdmin();
  // Rename/move = database operation only. The B2 object key never changes.
  const { data, error } = await admin
    .from("files")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }
  return Response.json({ file: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();

  const { data: file } = await admin.from("files").select("size_bytes").eq("id", params.id).eq("user_id", user.id).single();
  if (!file) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }

  // Soft delete — the B2 object is cleaned up later by a scheduled job (Phase 6),
  // so a mistaken delete is recoverable and we never block on a slow B2 call here.
  await admin.from("files").update({ status: "deleted" }).eq("id", params.id);
  await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: -file.size_bytes,
    p_uploaded_delta: 0,
    p_downloaded_delta: 0,
  });

  return Response.json({ ok: true });
}
