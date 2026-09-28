import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import {
  unauthorized,
  badRequest,
  notFound,
  internalError,
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

  const { data: file, error: fileError } = await admin
    .from("files")
    .select("*")
    .eq("id", parsed.data.file_id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (fileError) {
    console.error("complete-upload: file lookup failed", fileError);
    return internalError();
  }
  if (!file) return notFound("File not found.");

  // Idempotent: already active => success (safe to retry).
  if (file.status === "active") return Response.json({ ok: true, file });

  const realSize = await verifyObjectExists(file.object_key);
  if (realSize === null) {
    return apiError("object_missing", "Upload not found in storage yet.", 409);
  }

  // One atomic, locked transaction: size delta, quota (household or personal),
  // max file size, pending -> active, and rollback if over the limit.
  const { data: result, error } = await admin.rpc("complete_upload", {
    p_user_id: user.id,
    p_file_id: file.id,
    p_real_size: realSize,
  });
  if (error) return rpcError(error);

  const r = result as {
    ok: boolean;
    code?: string;
    object_key?: string;
    already_active?: boolean;
    file?: unknown;
  };

  if (!r.ok) {
    // The DB already released the reservation; remove the orphaned B2 object.
    if (r.object_key) await deleteObject(r.object_key).catch(() => {});

    switch (r.code) {
      case "quota_exceeded":
        return apiError(
          "quota_exceeded",
          "Not enough storage space remaining.",
          413,
        );
      case "file_too_large":
        return apiError(
          "file_too_large",
          "File exceeds your plan's maximum file size.",
          413,
        );
      case "not_found":
        return notFound("File not found.");
      default:
        console.error("complete-upload: unexpected result", r);
        return internalError();
    }
  }

  if (r.already_active) {
    const { data: current } = await admin
      .from("files")
      .select("*")
      .eq("id", file.id)
      .single();
    return Response.json({ ok: true, file: current });
  }

  return Response.json({ ok: true, file: r.file });
}
