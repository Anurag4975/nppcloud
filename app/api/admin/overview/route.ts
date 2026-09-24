import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const admin = supabaseAdmin();

  const [{ count: totalUsers }, { data: usageRows }, { data: subs }] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("usage").select("stored_bytes"),
    admin.from("subscriptions").select("status, plan:plans(name, price_npr)").eq("status", "active"),
  ]);

  const totalStoredBytes = (usageRows ?? []).reduce((sum, r) => sum + (r.stored_bytes ?? 0), 0);
  const mrr = (subs ?? []).reduce((sum: number, s: any) => sum + (s.plan?.price_npr ?? 0), 0);

  const planCounts: Record<string, number> = {};
  for (const s of subs ?? []) {
    const name = (s as any).plan?.name ?? "Unknown";
    planCounts[name] = (planCounts[name] ?? 0) + 1;
  }

  return Response.json({
    total_users: totalUsers ?? 0,
    total_stored_bytes: totalStoredBytes,
    mrr_npr: mrr,
    plan_counts: planCounts,
  });
}
