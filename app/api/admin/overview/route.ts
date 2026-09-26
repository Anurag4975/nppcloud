import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const DAY = 86_400_000;
const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

// Count helper — never throws, returns 0 on failure so the dashboard never breaks.
async function count(q: any): Promise<number> {
  try {
    const { count } = await q;
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const admin = supabaseAdmin();

  const [
    totalUsers,
    signupsToday,
    signupsWeek,
    signupsMonth,
    dau,
    wau,
    mau,
    failedPaymentsToday,
    activeShareLinks,
    suspendedUsers,
  ] = await Promise.all([
    count(admin.from("profiles").select("*", { count: "exact", head: true })),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso(DAY)),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso(7 * DAY)),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso(30 * DAY)),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", iso(DAY)),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", iso(7 * DAY)),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .gte("last_active_at", iso(30 * DAY)),
    ),
    count(
      admin
        .from("payment_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", iso(DAY))
        .or("status.ilike.%fail%,status.ilike.%error%,status.ilike.%decline%"),
    ),
    count(
      admin
        .from("share_links")
        .select("*", { count: "exact", head: true })
        .eq("revoked", false),
    ),
    count(
      admin
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .not("suspended_at", "is", null),
    ),
  ]);

  // Storage + MRR + plan distribution + near-quota (small fetches, joined in JS)
  const [{ data: usageRows }, { data: activeSubs }, { data: recentSignups }] =
    await Promise.all([
      admin.from("usage").select("user_id, stored_bytes"),
      admin
        .from("subscriptions")
        .select("user_id, status, plan:plans(name, price_npr, quota_bytes)")
        .in("status", ["active", "past_due"]),
      admin
        .from("profiles")
        .select("created_at")
        .gte("created_at", iso(14 * DAY)),
    ]);

  const totalStoredBytes = (usageRows ?? []).reduce(
    (s, r) => s + (r.stored_bytes ?? 0),
    0,
  );
  const mrr = (activeSubs ?? []).reduce(
    (s: number, x: any) => s + (x.plan?.price_npr ?? 0),
    0,
  );

  const planCounts: Record<string, number> = {};
  for (const s of activeSubs ?? []) {
    const name = (s as any).plan?.name ?? "Unknown";
    planCounts[name] = (planCounts[name] ?? 0) + 1;
  }

  // Users near quota (>85%) — join usage to active sub quota by user_id
  const quotaByUser = new Map<string, number>();
  for (const s of activeSubs ?? []) {
    const q = (s as any).plan?.quota_bytes;
    if (q) quotaByUser.set((s as any).user_id, q);
  }
  let nearQuotaCount = 0;
  const topStorage: { email?: string; stored_bytes: number; pct: number }[] =
    [];
  for (const u of usageRows ?? []) {
    const quota = quotaByUser.get(u.user_id);
    if (!quota) continue;
    const pct = u.stored_bytes / quota;
    if (pct > 0.85) nearQuotaCount++;
    topStorage.push({ stored_bytes: u.stored_bytes, pct });
  }
  topStorage.sort((a, b) => b.stored_bytes - a.stored_bytes);

  // Signups trend — last 14 days bucketed
  const trend: { date: string; count: number }[] = [];
  const buckets = new Map<string, number>();
  for (const r of recentSignups ?? []) {
    const d = new Date(r.created_at).toISOString().slice(0, 10);
    buckets.set(d, (buckets.get(d) ?? 0) + 1);
  }
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    trend.push({ date: d, count: buckets.get(d) ?? 0 });
  }

  return Response.json({
    total_users: totalUsers,
    total_stored_bytes: totalStoredBytes,
    mrr_npr: mrr,
    plan_counts: planCounts,
    signups: {
      today: signupsToday,
      week: signupsWeek,
      month: signupsMonth,
      trend,
    },
    active_users: { dau, wau, mau },
    health: {
      failed_payments_today: failedPaymentsToday,
      users_near_quota: nearQuotaCount,
      active_share_links: activeShareLinks,
      suspended_users: suspendedUsers,
    },
    top_storage: topStorage.slice(0, 5),
  });
}
