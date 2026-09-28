import { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDownloadUrl } from "@/lib/b2";

const ERROR_MESSAGES: Record<string, string> = {
  link_not_found: "This link doesn't exist.",
  link_revoked: "This link has been revoked by its owner.",
  link_expired: "This link has expired.",
  link_password_required: "Incorrect password.",
  link_download_limit_reached: "This link has reached its download limit.",
  link_bandwidth_limit_reached: "This link has reached its download limit.",
  file_not_found: "The file behind this link is no longer available.",
};

const bodySchema = z.object({ password: z.string().min(1).max(200) });

// Unauthenticated on purpose — same trust model as GET /s/[id]: anyone with
// the link (and now the password) can redeem it. No CSRF guard: there's no
// session/cookie being relied on here for authorization, only the link id
// + password in the body itself.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Password required.");

  const admin = supabaseAdmin();
  const { data: file, error } = await admin.rpc("redeem_share_link", {
    p_link_id: id,
    p_password: parsed.data.password,
  });

  if (error) {
    const message =
      ERROR_MESSAGES[error.message] ?? "This link is unavailable.";
    return Response.json({ error: message }, { status: 400 });
  }

  // Same RETURNS TABLE(...) array-vs-object gotcha as app/s/[id]/route.ts.
  // Unwrap before reading object_key/name or B2 will reject the presign.
  const row = Array.isArray(file) ? file[0] : file;
  if (!row) {
    const message = ERROR_MESSAGES.file_not_found;
    return Response.json({ error: message }, { status: 400 });
  }

  const url = await getDownloadUrl(row.object_key, row.name);
  return Response.json({ download_url: url });
}
