import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, notFound, rpcError, apiError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyObjectExists, deleteObject } from "@/lib/b2";

const bodySchema = z.object({ file_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;

  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");

  const admin = supabaseAdmin();
  const { data: file } = await admin
    .from("files")
    .select("*")
    .eq("id", parsed.data.file_id)
    .eq("user_id", user.id)
    .single();
  if (!file) return notFound("File not found.");

  // Idempotent: if already active, just return success (safe to retry).
  if (file.status === "active") return Response.json({ ok: true, file });

  const realSize = await verifyObjectExists(file.object_key);
  if (realSize === null) {
    return apiError("object_missing", "Upload not found in storage yet.", 409);
  }

  // reserve_upload reserved the *declared* size. Adjust stored by the delta
  // (real - declared) and count uploaded by real size. If real > declared
  // (client lied about size), stored grows; re-check quota and roll back if
  // it would exceed the plan.
  const declared = file.size_bytes ?? 0;
  const storedDelta = realSize - declared;

  await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: storedDelta,
    p_uploaded_delta: realSize,
    p_downloaded_delta: 0,
  });

  // Quota re-check after adjustment (defense against declared-size spoofing)
  const [{ data: usage }, { data: sub }] = await Promise.all([
    admin.from("usage").select("stored_bytes").eq("user_id", user.id).single(),
    admin.from("subscriptions").select("plan:plans(quota_bytes)").eq("user_id", user.id).eq("status", "active").single(),
  ]);
  const quota = (sub as any)?.plan?.quota_bytes ?? 0;
  if ((usage?.stored_bytes ?? 0) > quota) {
    // Roll back: delete B2 object, remove pending row, reclaim reserved space.
    await deleteObject(file.object_key);
    await admin.from("files").delete().eq("id", file.id);
    await admin.rpc("increment_usage", {
      p_user_id: user.id, p_stored_delta: -realSize, p_uploaded_delta: -realSize, p_downloaded_delta: 0,
    });
    return apiError("quota_exceeded", "Not enough storage space remaining.", 413);
  }

  const { data: updated } = await admin
    .from("files")
    .update({ status: "active", size_bytes: realSize })
    .eq("id", file.id)
    .select()
    .single();

  return Response.json({ ok: true, file: updated });
}
