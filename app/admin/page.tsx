"use client";

import { useEffect, useState } from "react";

type Overview = {
  total_users: number;
  total_stored_bytes: number;
  mrr_npr: number;
  plan_counts: Record<string, number>;
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    fetch("/api/admin/overview").then((res) => res.json()).then(setData);
  }, []);

  if (!data) return <p className="text-sm text-slate-400">Loading…</p>;

  const stats = [
    { label: "Total users", value: data.total_users.toLocaleString() },
    { label: "Total storage used", value: `${(data.total_stored_bytes / 1e9).toFixed(2)} GB` },
    { label: "MRR", value: `NPR ${data.mrr_npr.toLocaleString()}` },
  ];

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-slate-800">Overview</h1>
      <div className="mb-8 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-md border border-slate-200 p-4">
            <p className="text-xs text-slate-400">{s.label}</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-slate-700">Users by plan</h2>
      <ul className="rounded-md border border-slate-200 text-sm">
        {Object.entries(data.plan_counts).map(([name, count]) => (
          <li key={name} className="flex justify-between border-b border-slate-100 px-3 py-2 last:border-0">
            <span>{name}</span>
            <span className="text-slate-500">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
