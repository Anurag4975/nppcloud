import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  file_id: z.string().uuid(),
  max_downloads: z.number().int().positive().max(10000).optional(),
  expires_in_days: z.number().int().positive().max(365).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }
  const { file_id, max_downloads, expires_in_days } = parsed.data;

  const admin = supabaseAdmin();

  // Confirm the file belongs to this user before letting them share it
  const { data: file } = await admin
    .from("files")
    .select("id")
    .eq("id", file_id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!file) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }

  const expires_at = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  const { data: link, error } = await admin
    .from("share_links")
    .insert({
      file_id,
      created_by: user.id,
      max_downloads: max_downloads ?? 50,
      expires_at,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return Response.json({ link, share_url: `${req.nextUrl.origin}/s/${link.id}` });
}

export async function GET(req: NextRequest) {
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
