import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, getAuthedProfile } from "@/lib/auth";
import { unauthorized, badRequest, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function GET() {
  const ctx = await getAuthedProfile();
  if (!ctx) return unauthorized();
  const admin = supabaseAdmin();
  const [{ data: sub }, { data: usage }] = await Promise.all([
    admin.from("subscriptions").select("status, current_period_end, plan:plans(name, quota_bytes, price_npr)")
      .eq("user_id", ctx.user.id).eq("status", "active").single(),
    admin.from("usage").select("stored_bytes, uploaded_bytes, downloaded_bytes").eq("user_id", ctx.user.id).single(),
  ]);
  return Response.json({ profile: ctx.profile, subscription: sub ?? null, usage: usage ?? null });
}

export async function PATCH(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid request.");

  const admin = supabaseAdmin();
  const { error } = await admin.from("profiles").update({ name: parsed.data.name }).eq("id", user.id);
  if (error) return internalError();
  return Response.json({ ok: true });
}
