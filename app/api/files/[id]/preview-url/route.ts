import { NextRequest } from "next/server";
import { unauthorized, notFound } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { issueStreamToken } from "@/lib/preview-tokens";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const { data: file } = await supabaseAdmin()
    .from("files")
    .select("id, name, mime_type, size_bytes")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!file) return notFound("File not found.");

  const preview_url = await issueStreamToken({
    userId: user.id,
    fileId: id,
    ttlSeconds: 10800,
  }); // 3h
  return Response.json({
    preview_url,
    name: file.name,
    size_bytes: file.size_bytes,
    mime_type: file.mime_type,
  });
}
