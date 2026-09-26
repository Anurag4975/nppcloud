"use client";
import { useEffect, useState } from "react";
import { Users, HardDrive, Wallet, PieChart } from "lucide-react";
import { Card, Skeleton, cn } from "@/components/ui";

type Overview = {
  total_users: number;
  total_stored_bytes: number;
  mrr_npr: number;
  plan_counts: Record<string, number>;
};

const STATS = [
  { key: "users", label: "Total users", icon: Users, tint: "text-sky-600", bg: "bg-sky-50" },
  { key: "storage", label: "Storage used", icon: HardDrive, tint: "text-brand-600", bg: "bg-brand-50" },
  { key: "mrr", label: "MRR", icon: Wallet, tint: "text-amber-600", bg: "bg-amber-50" },
] as const;

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((res) => res.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const values: Record<(typeof STATS)[number]["key"], string> = {
    users: data?.total_users.toLocaleString() ?? "—",
    storage: data ? `${(data.total_stored_bytes / 1e9).toFixed(2)} GB` : "—",
    mrr: data ? `NPR ${data.mrr_npr.toLocaleString()}` : "—",
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-6 text-xl font-bold tracking-tight text-ink-900">Overview</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="p-4 animate-slide-up" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3">
                <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", s.bg)}>
                  <Icon className={cn("h-5 w-5", s.tint)} />
                </span>
                <div>
                  {data ? (
                    <p className="text-xl font-bold tracking-tight text-ink-900">{values[s.key]}</p>
                  ) : (
                    <Skeleton className="h-6 w-16" />
                  )}
                  <p className="text-[11px] text-ink-500">{s.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-2">
          <PieChart className="h-4 w-4 text-ink-400" />
          <h2 className="text-sm font-semibold text-ink-900">Users by plan</h2>
        </div>
        {!data ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {Object.entries(data.plan_counts).map(([name, count]) => (
              <li key={name} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-ink-700">{name}</span>
                <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-600">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
