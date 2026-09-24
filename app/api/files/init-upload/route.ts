import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getUploadUrl, objectKeyFor } from "@/lib/b2";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mime_type: z.string().optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

// Maps the Postgres exceptions raised inside reserve_upload() to HTTP responses.
const ERROR_STATUS: Record<string, number> = {
  no_active_plan: 403,
  phone_not_verified: 403,
  file_too_large: 413,
  quota_exceeded: 403,
};

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }
  const { name, size, mime_type, parent_id } = parsed.data;

  const admin = supabaseAdmin();

  // Active storage provider (multi-provider failover — new uploads
  // always go wherever is currently marked active)
  const { data: provider } = await admin
    .from("storage_providers")
    .select("id")
    .eq("is_active", true)
    .single();

  if (!provider) {
    return Response.json({ error: { code: "no_storage_provider", message: "No active storage provider configured." } }, { status: 500 });
  }

  const fileId = crypto.randomUUID();
  const objectKey = objectKeyFor(user.id, fileId);

  // reserve_upload() does everything atomically in one locked transaction:
  // resolves household vs. personal quota, checks phone-verification
  // requirement, checks max file size and remaining quota, creates the
  // pending file row, and reserves the space — all server-side, no
  // client-trusted math. See supabase/migrations for the function body.
  const { data: file, error } = await admin.rpc("reserve_upload", {
    p_user_id: user.id,
    p_name: name,
    p_size: size,
    p_mime_type: mime_type ?? null,
    p_parent_id: parent_id ?? null,
    p_object_key: objectKey,
    p_storage_provider_id: provider.id,
    p_file_id: fileId,
  });

  if (error) {
    const code = error.message as string; // Postgres RAISE EXCEPTION message
    const status = ERROR_STATUS[code] ?? 500;
    return Response.json({ error: { code, message: code } }, { status });
  }

  const uploadUrl = await getUploadUrl(objectKey, mime_type ?? "application/octet-stream");

  return Response.json({ file_id: file.id, upload_url: uploadUrl, object_key: objectKey });
}

