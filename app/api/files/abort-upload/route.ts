import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, rpcError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({ file_id: z.string().uuid() });

// Called when a client-side upload fails/aborts before complete-upload ever
// runs. Releases the quota reserve_upload took and deletes the pending row
// immediately, instead of waiting for the abandoned-pending sweep.
export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;

  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");

  const admin = supabaseAdmin();
  const { error } = await admin.rpc("abort_pending_upload", {
    p_user_id: user.id,
    p_file_id: parsed.data.file_id,
  });
  if (error) return rpcError(error);

  return Response.json({ ok: true });
}
