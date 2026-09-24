import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyObjectExists } from "@/lib/b2";

const bodySchema = z.object({ file_id: z.string().uuid() });

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: file } = await admin
    .from("files")
    .select("*")
    .eq("id", parsed.data.file_id)
    .eq("user_id", user.id)
    .single();

  if (!file) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }

  // Idempotent: if already active, just return success (safe to retry).
  if (file.status === "active") {
    return Response.json({ ok: true, file });
  }

  const realSize = await verifyObjectExists(file.object_key);
  if (realSize === null) {
    return Response.json({ error: { code: "object_missing", message: "Upload not found in storage yet." } }, { status: 409 });
  }

  const { data: updated } = await admin
    .from("files")
    .update({ status: "active", size_bytes: realSize, updated_at: new Date().toISOString() })
    .eq("id", file.id)
    .select()
    .single();

  // Update usage transactionally via RPC to avoid read-modify-write races
  await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: realSize,
    p_uploaded_delta: realSize,
    p_downloaded_delta: 0,
  });

  return Response.json({ ok: true, file: updated });
}
