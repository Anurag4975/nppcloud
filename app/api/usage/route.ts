import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();

  // .maybeSingle() instead of .single(): a missing/expired subscription row
  // is an expected state (e.g. between plan_change or after expiry), not an
  // error — .single() throws on 0 rows, which silently dropped the plan and
  // left the UI unable to show a total ("of 0 Bytes").
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan:plans!subscriptions_plan_id_fkey(name, quota_bytes, download_multiplier)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let plan = (sub as any)?.plan ?? null;

  // No active subscription row for this user — fall back to the Free plan
  // so the quota total is never just missing. Every account should always
  // have *some* quota it's measured against.
  if (!plan) {
    const { data: freePlan } = await admin
      .from("plans")
      .select("name, quota_bytes, download_multiplier")
      .eq("is_active", true)
      .eq("is_household", false)
      .order("price_npr", { ascending: true })
      .limit(1)
      .maybeSingle();
    plan = freePlan ?? null;
  }

  const { data: usage } = await admin
    .from("usage")
    .select("stored_bytes, uploaded_bytes, downloaded_bytes")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({ plan, usage: usage ?? null });
}
