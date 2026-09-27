import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { badRequest, internalError, notFound } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { plan_id, days = 30 } = await req.json().catch(() => ({}));
  if (!plan_id) return badRequest("plan_id required.");
  const admin = supabaseAdmin();
  const { id: userId } = await params;

  const { data: plan } = await admin
    .from("plans")
    .select("id, name")
    .eq("id", plan_id)
    .single();
  if (!plan) return notFound("Plan not found.");

  // Expire any active subscription, then grant a fresh one.
  const now = new Date();
  const expires = new Date(now.getTime() + days * 86400000);
  await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancelled_at: now.toISOString(),
      cancelled_by: "admin",
    })
    .eq("user_id", userId)
    .in("status", ["active", "past_due"]);
  const { error } = await admin.from("subscriptions").insert({
    user_id: userId,
    plan_id,
    status: "active",
    started_at: now.toISOString(),
    expires_at: expires.toISOString(),
    payment_provider: "admin_manual",
  });
  if (error) return internalError();

  await admin
    .from("admin_audit_log")
    .insert({
      admin_id: gate.user.id,
      action: "plan.granted",
      target_table: "subscriptions",
      target_id: userId,
      after: { plan_id, plan_name: plan.name, days },
    })
    .catch(() => {});

  return Response.json({
    ok: true,
    plan_name: plan.name,
    expires_at: expires.toISOString(),
  });
}
