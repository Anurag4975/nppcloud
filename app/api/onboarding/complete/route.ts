import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  name: z.string().min(1).max(100),
  accepted_terms: z.literal(true),
  referral_code: z.string().trim().toUpperCase().optional().nullable(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }
  const { name, referral_code } = parsed.data;
  const admin = supabaseAdmin();

  // Referral code is optional; validate it but never let a bad code block onboarding
  if (referral_code) {
    const { data: code } = await admin
      .from("referral_codes")
      .select("code, owner_user_id")
      .eq("code", referral_code)
      .single();

    if (code && code.owner_user_id !== user.id) {
      await admin.from("referral_redemptions").insert({
        code: code.code,
        redeemed_by: user.id,
      });
    }
    // An unknown or self-referral code is silently ignored rather than
    // blocking the form — onboarding shouldn't fail over a typo.
  }

  const { error } = await admin
    .from("profiles")
    .update({
      name,
      accepted_terms_at: new Date().toISOString(),
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }

  return Response.json({ ok: true });
}
