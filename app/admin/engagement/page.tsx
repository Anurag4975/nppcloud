"use client";
import { useEffect, useState } from "react";
import {
  Users,
  Target,
  UserCheck,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import { Card, Badge, Skeleton, Progress, cn } from "@/components/ui";

type EngagementData = {
  buckets: {
    total: number;
    active_7d: number;
    active_7d_pct: number;
    active_30d: number;
    active_30d_pct: number;
    active_90d: number;
    active_90d_pct: number;
    inactive_7d: number;
    inactive_7d_pct: number;
    inactive_30d: number;
    inactive_30d_pct: number;
    inactive_90d: number;
    inactive_90d_pct: number;
  };
  churn: {
    cancelled_30d: number;
    expired_30d: number;
    total_churned: number;
    churn_rate_pct: number;
  };
  conversion: { signups_period: number; converted: number; rate_pct: number };
  cohort_retention: {
    month: string;
    total: number;
    active: number;
    rate: number;
  }[];
};

export default function EngagementPage() {
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/engagement")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data)
    return <p className="text-center text-ink-500">Failed to load data.</p>;

  const { buckets, churn, conversion, cohort_retention } = data;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">
          Engagement & Retention
        </h1>
        <p className="mt-0.5 text-xs text-ink-500">
          Active users, churn, conversion, and cohort retention.
        </p>
      </div>

      {/* Quick stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Users",
            value: buckets.total.toLocaleString(),
            icon: Users,
            tint: "text-sky-600",
            bg: "bg-sky-50",
          },
          {
            label: "7d Active",
            value: `${buckets.active_7d_pct}%`,
            sub: buckets.active_7d.toLocaleString(),
            icon: UserCheck,
            tint: "text-brand-600",
            bg: "bg-brand-50",
          },
          {
            label: "Churn Rate",
            value: `${churn.churn_rate_pct}%`,
            sub: `${churn.total_churned} lost`,
            icon: TrendingDown,
            tint: churn.churn_rate_pct > 5 ? "text-red-600" : "text-amber-600",
            bg: churn.churn_rate_pct > 5 ? "bg-red-50" : "bg-amber-50",
          },
          {
            label: "Free → Paid",
            value: `${conversion.rate_pct}%`,
            sub: `${conversion.converted}/${conversion.signups_period}`,
            icon: Target,
            tint: "text-violet-600",
            bg: "bg-violet-50",
          },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              className="p-4 animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl",
                  s.bg,
                )}
              >
                <Icon className={cn("h-5 w-5", s.tint)} />
              </span>
              <p className="mt-3 text-xl font-bold tracking-tight text-ink-900">
                {s.value}
              </p>
              <p className="text-xs text-ink-500">{s.label}</p>
              {s.sub && (
                <p className="mt-0.5 text-[10px] text-ink-400">{s.sub}</p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Active vs Inactive */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">
          Active vs Inactive Buckets
        </h2>
        <div className="space-y-4">
          {[
            {
              label: "Last 7 Days",
              active: buckets.active_7d,
              pct: buckets.active_7d_pct,
              inactive: buckets.inactive_7d,
            },
            {
              label: "Last 30 Days",
              active: buckets.active_30d,
              pct: buckets.active_30d_pct,
              inactive: buckets.inactive_30d,
            },
            {
              label: "Last 90 Days",
              active: buckets.active_90d,
              pct: buckets.active_90d_pct,
              inactive: buckets.inactive_90d,
            },
          ].map((row) => (
            <div key={row.label} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium text-ink-700">{row.label}</span>
                <span className="text-ink-500">
                  {row.active.toLocaleString()} active ·{" "}
                  {row.inactive.toLocaleString()} inactive
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400 transition-all duration-500 ease-out-expo"
                  style={{ width: `${row.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Churn + Conversion row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Churn — Last 30 Days
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center rounded-xl bg-ink-50 px-3 py-2.5">
              <span className="text-xs text-ink-600">Cancelled by user</span>
              <Badge variant="secondary">{churn.cancelled_30d}</Badge>
            </div>
            <div className="flex justify-between items-center rounded-xl bg-ink-50 px-3 py-2.5">
              <span className="text-xs text-ink-600">
                Expired / non-renewal
              </span>
              <Badge variant="secondary">{churn.expired_30d}</Badge>
            </div>
            <div className="flex justify-between items-center rounded-xl bg-ink-50 px-3 py-2.5 font-medium">
              <span className="text-xs text-ink-700">Total churned</span>
              <Badge variant={churn.churn_rate_pct > 5 ? "danger" : "warning"}>
                {churn.total_churned} · {churn.churn_rate_pct}%
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-900">
            Free → Paid Conversion
          </h2>
          <p className="text-2xl font-bold text-ink-900">
            {conversion.rate_pct}%
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {conversion.converted} of {conversion.signups_period} signups over
            last 90 days converted to paid plans
          </p>
          <Progress
            value={conversion.rate_pct}
            className="mt-3"
            variant="brand"
          />
        </Card>
      </div>

      {/* Cohort Retention */}
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-ink-900">
          Cohort Retention — Last 6 Months
        </h2>
        <p className="mb-3 text-[11px] text-ink-500">
          Users active in the last 30 days, grouped by signup month
        </p>
        <div className="space-y-3">
          {cohort_retention.length === 0 ? (
            <p className="text-sm text-ink-400">Not enough data yet.</p>
          ) : (
            cohort_retention.map((c) => (
              <div key={c.month} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-medium text-ink-700">{c.month}</span>
                  <span className="text-ink-500">
                    {c.active}/{c.total} active · {c.rate}%
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-400 transition-all duration-500 ease-out-expo"
                    style={{ width: `${Math.max(c.rate, 2)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
