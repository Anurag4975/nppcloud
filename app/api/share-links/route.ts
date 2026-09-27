import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, notFound, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  file_id: z.string().uuid(),
  max_downloads: z.number().int().positive().max(10000).optional(),
  max_bytes_served: z.number().int().positive().max(1000 * 1024 * 1024 * 1024).optional(),
  expires_in_days: z.number().int().positive().max(365).optional(),
  password: z.string().min(1).max(200).optional(),
});

export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid share request.");

  const { file_id, max_downloads, max_bytes_served, expires_in_days, password } = parsed.data;
  const admin = supabaseAdmin();

  const { data: file } = await admin
    .from("files").select("id").eq("id", file_id).eq("user_id", user.id).eq("status", "active").single();
  if (!file) return notFound("File not found.");

  const expires_at = expires_in_days ? new Date(Date.now() + expires_in_days * 86400000).toISOString() : null;
  const { data: link, error } = await admin
    .from("share_links")
    .insert({
      file_id, created_by: user.id,
      max_downloads: max_downloads ?? 50,
      max_bytes_served: max_bytes_served ?? 5 * 1024 * 1024 * 1024,
      expires_at,
    })
    .select().single();
  if (error) return internalError();

  // Hashing happens inside Postgres (pgcrypto's crypt() + gen_salt('bf')) so
  // the plaintext password never needs a second round-trip or a separate
  // bcrypt dependency in the app layer.
  if (password) {
    const { error: pwError } = await admin.rpc("set_share_link_password", {
      p_link_id: link.id,
      p_user_id: user.id,
      p_password: password,
    });
    if (pwError) return internalError();
  }

  return Response.json({ link, share_url: `${req.nextUrl.origin}/s/${link.id}` });
}

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const admin = supabaseAdmin();
  const { data: links } = await admin
    .from("share_links")
    .select("*, file:files(name, size_bytes)")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false });
  return Response.json({ links: links ?? [] });
}
