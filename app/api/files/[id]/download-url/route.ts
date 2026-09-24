import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, rpcError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDownloadUrl } from "@/lib/b2";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();
  // reserve_download() atomically checks the download allowance
  // (uploaded_bytes * plan.download_multiplier) and increments the counter —
  // no read-then-check race, no client-trusted math.
  const { data, error } = await admin.rpc("reserve_download", {
    p_user_id: user.id,
    p_file_id: params.id,
  });
  if (error) return rpcError(error);

  const row = Array.isArray(data) ? data[0] : data;
  const url = await getDownloadUrl(row.object_key, row.name);
  return Response.json({ download_url: url });
}
