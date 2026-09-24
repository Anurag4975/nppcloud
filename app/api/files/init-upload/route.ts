import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, internalError, rpcError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getUploadUrl, objectKeyFor } from "@/lib/b2";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(5 * 1024 * 1024 * 1024), // hard cap, server-enforced
  mime_type: z.string().max(255).optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;

  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid upload request.");

  const { name, size, mime_type, parent_id } = parsed.data;
  const admin = supabaseAdmin();

  // Active storage provider (multi-provider failover: flip one DB row to switch)
  const { data: provider } = await admin.from("storage_providers").select("id").eq("is_active", true).single();
  if (!provider) return internalError();

  const fileId = crypto.randomUUID();
  const objectKey = objectKeyFor(user.id, fileId);

  // reserve_upload() does everything atomically in one locked transaction:
  // household vs personal quota, phone-verification gate, max file size,
  // remaining quota, parent-folder ownership, pending row insert, and space
  // reservation — all server-side, no client-trusted math.
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
  if (error) return rpcError(error);

  const uploadUrl = await getUploadUrl(objectKey, mime_type ?? "application/octet-stream");
  return Response.json({ file_id: (file as any)?.id ?? fileId, upload_url: uploadUrl, object_key: objectKey });
}
