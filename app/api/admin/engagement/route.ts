import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const admin = supabaseAdmin();

  // 1. Active/inactive buckets — uses profiles.last_active_at
  const [
    totalUsers,
    active7d,
    active30d,
    active90d,
    inactive7d,
    inactive30d,
    inactive90d,
  ] = await Promise.all([
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", iso(7 * DAY)),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", iso(30 * DAY)),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("last_active_at", iso(90 * DAY)),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lt("last_active_at", iso(7 * DAY))
      .not("last_active_at", "is", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lt("last_active_at", iso(30 * DAY))
      .not("last_active_at", "is", null),
    admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .lt("last_active_at", iso(90 * DAY))
      .not("last_active_at", "is", null),
  ]);

  const total = totalUsers.count ?? 0;
  const pct = (n: number) => (total > 0 ? +((n / total) * 100).toFixed(1) : 0);

  // 2. Churn: cancelled vs expired over last 30 days
  const [cancelled30d, expired30d, activeSubs] = await Promise.all([
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("cancelled_at", iso(30 * DAY)),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .gte("expired_at", iso(30 * DAY))
      .neq("status", "active"),
    admin
      .from("subscriptions")
      .select("user_id", { count: "exact", head: true })
      .in("status", ["active", "past_due"]),
  ]);

  const churnTotal = (cancelled30d.count ?? 0) + (expired30d.count ?? 0);
  const churnRate =
    activeSubs.count && activeSubs.count > 0
      ? +((churnTotal / activeSubs.count) * 100).toFixed(2)
      : 0;

  // 3. Free → Paid conversion: users who went free → paid ever
  const { data: signups } = await admin
    .from("profiles")
    .select("id, created_at")
    .gte("created_at", iso(90 * DAY))
    .order("created_at", { ascending: true });

  const userIds = (signups ?? []).map((u) => u.id);
  const { data: converted } = await admin
    .from("subscriptions")
    .select("user_id, started_at")
    .in("user_id", userIds)
    .neq("status", "canceled")
    .neq("payment_provider", "admin_manual");

  const convertedIds = new Set((converted ?? []).map((s) => s.user_id));
  const convertedCount = convertedIds.size;
  const conversionRate =
    signups && signups.length > 0
      ? +((convertedCount / signups.length) * 100).toFixed(2)
      : 0;

  // 4. Cohort retention — monthly cohorts, active at 0/30/60/90 days
  const cohorts: Record<string, { total: number; active: number }> = {};
  for (const u of signups ?? []) {
    const month = new Date(u.created_at).toISOString().slice(0, 7);
    if (!cohorts[month]) cohorts[month] = { total: 0, active: 0 };
    cohorts[month].total++;
    // Active if last_active_at within 30 days of now
    const isActive =
      u.last_active_at &&
      new Date(u.last_active_at).getTime() > Date.now() - 30 * DAY;
    if (isActive) cohorts[month].active++;
  }

  const cohortRetention = Object.entries(cohorts)
    .map(([month, d]) => ({
      month,
      total: d.total,
      active: d.active,
      rate: d.total > 0 ? +((d.active / d.total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  return Response.json({
    buckets: {
      total,
      active_7d: active7d.count ?? 0,
      active_7d_pct: pct(active7d.count ?? 0),
      active_30d: active30d.count ?? 0,
      active_30d_pct: pct(active30d.count ?? 0),
      active_90d: active90d.count ?? 0,
      active_90d_pct: pct(active90d.count ?? 0),
      inactive_7d: inactive7d.count ?? 0,
      inactive_7d_pct: pct(inactive7d.count ?? 0),
      inactive_30d: inactive30d.count ?? 0,
      inactive_30d_pct: pct(inactive30d.count ?? 0),
      inactive_90d: inactive90d.count ?? 0,
      inactive_90d_pct: pct(inactive90d.count ?? 0),
    },
    churn: {
      cancelled_30d: cancelled30d.count ?? 0,
      expired_30d: expired30d.count ?? 0,
      total_churned: churnTotal,
      churn_rate_pct: churnRate,
    },
    conversion: {
      signups_period: signups?.length ?? 0,
      converted: convertedCount,
      rate_pct: conversionRate,
    },
    cohort_retention: cohortRetention,
  });
}
