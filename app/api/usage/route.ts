import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan:plans(name, quota_bytes, download_multiplier)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const { data: usage } = await admin
    .from("usage")
    .select("stored_bytes, uploaded_bytes, downloaded_bytes")
    .eq("user_id", user.id)
    .single();

  return Response.json({ plan: (sub as any)?.plan ?? null, usage: usage ?? null });
}
