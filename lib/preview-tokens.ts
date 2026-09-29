import { supabaseAdmin } from "./supabase-server";
import { randomUUID } from "crypto";

/** Issues a token and returns a same-origin /api/stream URL. B2 URL never leaves the server. */
export async function issueStreamToken(opts: {
  userId: string; fileId: string; ttlSeconds: number; download?: boolean;
}): Promise<string> {
  const token = randomUUID();
  await supabaseAdmin().from("preview_tokens").insert({
    user_id: opts.userId, file_id: opts.fileId, token,
    expires_at: new Date(Date.now() + opts.ttlSeconds * 1000),
  });
  return `/api/stream?token=${token}${opts.download ? "&download=1" : ""}`;
}