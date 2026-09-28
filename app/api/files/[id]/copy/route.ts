import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import {
  badRequest,
  notFound,
  apiError,
  rpcError,
  internalError,
} from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";
import { copyObject, objectKeyFor } from "@/lib/b2";

const bodySchema = z.object({
  parent_id: z.string().uuid().nullable().optional(), // default: same folder
  name: z.string().min(1).max(255).optional(), // default: "Copy of <name>"
});

// Duplicate a file: server-side B2 copy (no re-upload), new DB row, quota
// checked the same way as an upload. Folders are not duplicated here (would
// need recursive copy — out of scope for this batch).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid copy request.");

  const admin = supabaseAdmin();

  const { data: src } = await admin
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!src) return notFound("File not found.");

  // Quota check — same gate as upload: stored + size <= plan quota.
  const [{ data: usage }, { data: sub }] = await Promise.all([
    admin
      .from("usage")
      .select("stored_bytes")
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("subscriptions")
      .select("plan:plans!subscriptions_plan_id_fkey(quota_bytes)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const quota = (sub as any)?.plan?.quota_bytes ?? 0;
  const stored = usage?.stored_bytes ?? 0;
  if (quota > 0 && stored + src.size_bytes > quota) {
    return apiError(
      "quota_exceeded",
      "Not enough storage space to duplicate this file.",
      413,
    );
  }

  const newId = crypto.randomUUID();
  const destKey = objectKeyFor(user.id, newId);
  const destName = parsed.data.name ?? `Copy of ${src.name}`;
  const destParent = parsed.data.parent_id ?? src.parent_id;

  try {
    await copyObject(src.object_key, destKey);
  } catch {
    return internalError();
  }

  const { data: file, error: insertErr } = await admin
    .from("files")
    .insert({
      id: newId,
      user_id: user.id,
      name: destName,
      size_bytes: src.size_bytes,
      mime_type: src.mime_type,
      parent_id: destParent,
      object_key: destKey,
      storage_provider_id: src.storage_provider_id,
      status: "active",
    })
    .select()
    .single();
  if (insertErr || !file) {
    // Roll back the B2 copy so we don't leak storage.
    const { deleteObject } = await import("@/lib/b2");
    await deleteObject(destKey);
    return internalError();
  }

  // Count the copy against stored + uploaded, same as a fresh upload.
  const { error: incErr } = await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: src.size_bytes,
    p_uploaded_delta: src.size_bytes,
    p_downloaded_delta: 0,
  });
  if (incErr) return rpcError(incErr);

  return Response.json({ ok: true, file });
}
