"use client";
import { useEffect, useState } from "react";
import {
  Users,
  HardDrive,
  Wallet,
  Share2,
  Activity,
  AlertTriangle,
  UserX,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Card, Badge, Skeleton, cn, formatBytes } from "@/components/ui";

type Overview = {
  total_users: number;
  total_stored_bytes: number;
  mrr_npr: number;
  plan_counts: Record<string, number>;
  signups: {
    today: number;
    week: number;
    month: number;
    trend: { date: string; count: number }[];
  };
  active_users: { dau: number; wau: number; mau: number };
  health: {
    failed_payments_today: number;
    users_near_quota: number;
    active_share_links: number;
    suspended_users: number;
  };
  top_storage: { stored_bytes: number; pct: number }[];
};

const STATS = [
  {
    key: "users",
    label: "Total users",
    icon: Users,
    tint: "text-sky-600",
    bg: "bg-sky-50",
  },
  {
    key: "storage",
    label: "Storage used",
    icon: HardDrive,
    tint: "text-brand-600",
    bg: "bg-brand-50",
  },
  {
    key: "mrr",
    label: "MRR (NPR)",
    icon: Wallet,
    tint: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "shares",
    label: "Active share links",
    icon: Share2,
    tint: "text-violet-600",
    bg: "bg-violet-50",
  },
] as const;

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  // ── Defensive reads ────────────────────────────────────────────────────
  // The API response shape has been changing; we don't want a single missing
  // numeric field to blow up the whole page. Every field is read with a
  // fallback and coerced to the expected type.
  const totalUsers = Number(data.total_users ?? 0);
  const totalStored = Number(data.total_stored_bytes ?? 0);
  const mrrNpr = Number(data.mrr_npr ?? 0);
  const activeShares = Number(
    data.health?.active_share_links ?? (data as any).active_share_links ?? 0,
  );

  const signups = data.signups ?? {
    today: 0,
    week: 0,
    month: 0,
    trend: [] as { date: string; count: number }[],
  };
  const trend = Array.isArray(signups.trend) ? signups.trend : [];

  const activeUsers = data.active_users ?? { dau: 0, wau: 0, mau: 0 };
  const health = data.health ?? {
    failed_payments_today: 0,
    users_near_quota: 0,
    active_share_links: 0,
    suspended_users: 0,
  };
  const planCounts = data.plan_counts ?? {};

  const values: Record<(typeof STATS)[number]["key"], string> = {
    users: totalUsers.toLocaleString(),
    storage: formatBytes(totalStored),
    mrr: `₹${mrrNpr.toLocaleString()}`,
    shares: activeShares.toLocaleString(),
  };
  const maxTrend = Math.max(1, ...trend.map((t) => Number(t?.count ?? 0)));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">
          Overview
        </h1>
        <p className="mt-0.5 text-xs text-ink-500">
          Platform health at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.key}
              className="p-4 animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  s.bg,
                )}
              >
                <Icon className={cn("h-4.5 w-4.5", s.tint)} />
              </span>
              <p className="mt-3 text-xl font-bold tracking-tight text-ink-900">
                {values[s.key]}
              </p>
              <p className="text-[11px] text-ink-500">{s.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Active users + signups */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-ink-400" />
              <h2 className="text-sm font-semibold text-ink-900">
                Signups — last 14 days
              </h2>
            </div>
            <Badge variant="secondary">+{signups.week} this week</Badge>
          </div>
          <div className="flex h-36 items-end gap-1.5">
            {trend.length === 0 ? (
              <div className="flex w-full items-center justify-center text-xs text-ink-400">
                No signup data yet.
              </div>
            ) : (
              trend.map((t) => {
                const count = Number(t?.count ?? 0);
                const date = typeof t?.date === "string" ? t.date : "";
                return (
                  <div
                    key={date || Math.random().toString(36).slice(2)}
                    className="group relative flex flex-1 flex-col items-center justify-end"
                  >
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 transition-all duration-300 ease-out-expo hover:from-brand-700 hover:to-brand-500"
                      style={{
                        height: `${(count / maxTrend) * 100}%`,
                        minHeight: count > 0 ? "4px" : "2px",
                        opacity: count > 0 ? 1 : 0.2,
                      }}
                    />
                    <span className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {count} on {date.slice(5)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-ink-400">
            <span>{trend[0]?.date?.slice(5) ?? "—"}</span>
            <span>Today</span>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink-400" />
            <h2 className="text-sm font-semibold text-ink-900">Active users</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                label: "DAU",
                value: Number(activeUsers.dau ?? 0),
                icon: UserCheck,
                tint: "text-brand-600",
              },
              {
                label: "WAU",
                value: Number(activeUsers.wau ?? 0),
                icon: UserCheck,
                tint: "text-sky-600",
              },
              {
                label: "MAU",
                value: Number(activeUsers.mau ?? 0),
                icon: UserCheck,
                tint: "text-violet-600",
              },
            ].map((r) => {
              const Icon = r.icon;
              return (
                <div
                  key={r.label}
                  className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-xs font-medium text-ink-600">
                    <Icon className={cn("h-3.5 w-3.5", r.tint)} /> {r.label}
                  </span>
                  <span className="text-sm font-bold text-ink-900">
                    {r.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-ink-100 pt-3">
            <p className="text-[11px] text-ink-400">
              Signups today:{" "}
              <span className="font-semibold text-ink-700">
                {Number(signups.today ?? 0)}
              </span>{" "}
              · this month:{" "}
              <span className="font-semibold text-ink-700">
                {Number(signups.month ?? 0)}
              </span>
            </p>
          </div>
        </Card>
      </div>

      {/* Health signals + plan distribution */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Health signals
          </h2>
          <div className="space-y-2.5">
            {[
              {
                label: "Failed payments today",
                value: Number(health.failed_payments_today ?? 0),
                icon: AlertTriangle,
                warn: Number(health.failed_payments_today ?? 0) > 0,
              },
              {
                label: "Users near quota (>85%)",
                value: Number(health.users_near_quota ?? 0),
                icon: HardDrive,
                warn: Number(health.users_near_quota ?? 0) > 0,
              },
              {
                label: "Suspended users",
                value: Number(health.suspended_users ?? 0),
                icon: UserX,
                warn: Number(health.suspended_users ?? 0) > 0,
              },
              {
                label: "Active share links",
                value: Number(health.active_share_links ?? 0),
                icon: Share2,
                warn: false,
              },
            ].map((h) => {
              const Icon = h.icon;
              return (
                <div
                  key={h.label}
                  className="flex items-center justify-between rounded-xl border border-ink-100 px-3 py-2.5"
                >
                  <span className="flex items-center gap-2 text-xs text-ink-600">
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5",
                        h.warn ? "text-amber-500" : "text-ink-400",
                      )}
                    />
                    {h.label}
                  </span>
                  <Badge variant={h.warn ? "warning" : "secondary"}>
                    {h.value}
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Users by plan
          </h2>
          <ul className="divide-y divide-ink-100">
            {Object.keys(planCounts).length === 0 ? (
              <li className="py-2.5 text-xs text-ink-400">No plan data yet.</li>
            ) : (
              Object.entries(planCounts).map(([name, count]) => (
                <li
                  key={name}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="font-medium text-ink-700">{name}</span>
                  <Badge variant="secondary">{Number(count ?? 0)}</Badge>
                </li>
              ))
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
