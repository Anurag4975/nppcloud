import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const patchSchema = z.object({
  max_downloads: z.number().int().positive().max(10000).optional(),
  expires_in_days: z.number().int().positive().max(365).nullable().optional(),
  revoked: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");

  const admin = supabaseAdmin();
  const update: Record<string, unknown> = {};
  if (parsed.data.max_downloads !== undefined) update.max_downloads = parsed.data.max_downloads;
  if (parsed.data.revoked !== undefined) update.revoked = parsed.data.revoked;
  if (parsed.data.expires_in_days !== undefined) {
    update.expires_at = parsed.data.expires_in_days
      ? new Date(Date.now() + parsed.data.expires_in_days * 86400000).toISOString()
      : null;
  }

  const { error } = await admin
    .from("share_links")
    .update(update)
    .eq("id", params.id).eq("created_by", user.id);
  if (error) return internalError();
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("share_links")
    .update({ revoked: true })
    .eq("id", params.id).eq("created_by", user.id);
  if (error) return internalError();
  return Response.json({ ok: true });
}
