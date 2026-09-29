import { NextRequest } from "next/server";
import { unauthorized, notFound } from "@/lib/errors";
import { getAuthedUser } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getInlineUrl } from "@/lib/b2";

// Preview URL — intentionally does NOT call reserve_download(), so streaming
// / viewing a file does NOT count against the user's download allowance.
// Only the explicit Download button calls reserve_download. B2 egress still
// applies (mitigate later with Cloudflare + Bandwidth Alliance).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const { id } = await params;

  const admin = supabaseAdmin();
  const { data: file } = await admin
    .from("files")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (!file) return notFound("File not found.");

  // Inline (not attachment) + 1h TTL so long videos/PPTs don't expire mid-view.
  const url = await getInlineUrl(file.object_key, file.mime_type ?? undefined);

  return Response.json({
    preview_url: url,
    name: file.name,
    size_bytes: file.size_bytes,
    mime_type: file.mime_type,
  });
}
