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
  const { data, error } = await admin
    .from("folders")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error || !data) {
    return Response.json({ error: { code: "not_found", message: "Folder not found." } }, { status: 404 });
  }
  return Response.json({ folder: data });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();

  // Note: this is a hard delete of the folder row. Files inside cascade-delete
  // at the DB level (folders.id ON DELETE CASCADE on files.parent_id) — for a
  // real trash-aware delete, files should be moved to status='trashed' first.
  // Flagging as a known gap to close before this ships to real users.
  const { error } = await admin.from("folders").delete().eq("id", params.id).eq("user_id", user.id);

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }
  return Response.json({ ok: true });
}
