import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDownloadUrl } from "@/lib/b2";

const ERROR_MESSAGES: Record<string, string> = {
  link_not_found: "This link doesn't exist.",
  link_revoked: "This link has been revoked by its owner.",
  link_expired: "This link has expired.",
  link_download_limit_reached: "This link has reached its download limit.",
  link_bandwidth_limit_reached: "This link has reached its download limit.",
  file_not_found: "The file behind this link is no longer available.",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = supabaseAdmin();

  // Atomic, race-condition-safe: checks revoked/expired/max_downloads/
  // max_bytes_served/password and increments counters in one locked
  // transaction. This budget is the link's own — separate from and never
  // touching the file owner's personal upload/download quota.
  const { data: file, error } = await admin.rpc("redeem_share_link", {
    p_link_id: id,
  });

  if (error) {
    if (error.message === "link_password_required") {
      // Password-gated link, no (or wrong) password on this request — send
      // to the unlock form instead of the generic error page. That page
      // POSTs the password to /api/s/[id]/redeem, which calls this same RPC
      // with p_password set.
      return NextResponse.redirect(new URL(`/s/${id}/unlock`, req.url));
    }
    const message =
      ERROR_MESSAGES[error.message] ?? "This link is unavailable.";
    return NextResponse.redirect(
      new URL(`/s-error?message=${encodeURIComponent(message)}`, req.url),
    );
  }

  // redeem_share_link is RETURNS TABLE(...), so PostgREST hands back an
  // array of rows even for a single-row result. Unwrap before reading
  // fields, otherwise file.object_key is undefined and B2 throws
  // "No value provided for input HTTP label: Key".
  const row = Array.isArray(file) ? file[0] : file;
  if (!row) {
    const message = ERROR_MESSAGES.file_not_found;
    return NextResponse.redirect(
      new URL(`/s-error?message=${encodeURIComponent(message)}`, req.url),
    );
  }

  const url = await getDownloadUrl(row.object_key, row.name);
  return NextResponse.redirect(url);
}
