import { NextRequest } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, rpcError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";
import { issueStreamToken } from "@/lib/preview-tokens";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();
  const { id } = await params;
  const { data, error } = await supabaseAdmin().rpc("reserve_download", {
    p_user_id: user.id,
    p_file_id: id,
  });
  if (error) return rpcError(error);

  const download_url = await issueStreamToken({
    userId: user.id,
    fileId: id,
    ttlSeconds: 60,
    download: true,
  });
  return Response.json({ download_url });
}
