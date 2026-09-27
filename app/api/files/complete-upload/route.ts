import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import {
  unauthorized,
  badRequest,
  notFound,
  rpcError,
  apiError,
} from "@/lib/errors";
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

  const { error: incError } = await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: storedDelta,
    p_uploaded_delta: realSize,
    p_downloaded_delta: 0,
  });
  if (incError) return rpcError(incError);

  // Quota re-check after adjustment (defense against declared-size spoofing).
  //
  // IMPORTANT: `plan:plans(quota_bytes)` is ambiguous — `subscriptions` has
  // two FKs into `plans` (plan_id AND scheduled_plan_id/pending_plan_id for
  // the "downgrade scheduled at period end" feature). Without specifying
  // which FK to embed through, PostgREST returns a *query error*, not a
  // missing row. That error was previously being silently swallowed here
  // (only `data` was read, never `error`), so `sub` came back null, `quota`
  // silently defaulted to 0, and EVERY upload — regardless of real usage —
  // failed the `stored_bytes > quota` check and got rolled back as
  // "quota_exceeded". Naming the FK explicitly fixes the query; checking
  // `error` means this class of bug can't hide silently again.
  //
  // Confirm the real constraint name on your live DB first:
  //   SELECT conname FROM pg_constraint
  //   WHERE conrelid = 'public.subscriptions'::regclass AND contype = 'f';
  // and swap it in below if it differs from subscriptions_plan_id_fkey.
  const [{ data: usage, error: usageError }, { data: sub, error: subError }] =
    await Promise.all([
      admin
        .from("usage")
        .select("stored_bytes")
        .eq("user_id", user.id)
        .single(),
      admin
        .from("subscriptions")
        .select("plan:plans!subscriptions_plan_id_fkey(quota_bytes)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single(),
    ]);

  if (usageError || subError) {
    // Don't silently default quota to 0 — that's what caused this bug.
    // Log server-side for diagnosis; never leak raw DB errors to the client.
    console.error("complete-upload quota re-check failed", {
      usageError,
      subError,
      userId: user.id,
    });
  }

  const quota = (sub as any)?.plan?.quota_bytes ?? 0;
  if ((usage?.stored_bytes ?? 0) > quota) {
    // Roll back: delete B2 object, remove pending row, reclaim reserved space.
    await deleteObject(file.object_key);
    await admin.from("files").delete().eq("id", file.id);
    await admin.rpc("increment_usage", {
      p_user_id: user.id,
      p_stored_delta: -realSize,
      p_uploaded_delta: -realSize,
      p_downloaded_delta: 0,
    });
    return apiError(
      "quota_exceeded",
      "Not enough storage space remaining.",
      413,
    );
  }

  const { data: updated } = await admin
    .from("files")
    .update({ status: "active", size_bytes: realSize })
    .eq("id", file.id)
    .select()
    .single();

  return Response.json({ ok: true, file: updated });
}
