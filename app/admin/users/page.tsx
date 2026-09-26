"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, Ban, ChevronRight } from "lucide-react";
import {
  Input,
  Badge,
  Avatar,
  Skeleton,
  cn,
  timeAgo,
  formatBytes,
} from "@/components/ui";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  last_active_at: string | null;
  suspended_at: string | null;
  subscriptions?:
    | { status: string; plan: { name: string; price_npr: number } | null }[]
    | null;
  usage?: { stored_bytes: number } | null;
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "suspended", label: "Suspended" },
] as const;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filter !== "all") params.set("status", filter);
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((j) => setUsers(j.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q, filter]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Users</h1>
        <div className="w-full max-w-xs">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Search email or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
      </div>

      <div className="mb-4 flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150",
              filter === f.id
                ? "bg-ink-900 text-white shadow-soft"
                : "text-ink-500 hover:bg-white hover:shadow-soft",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Storage</th>
                <th className="px-4 py-3 font-medium">Last active</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : users.map((u) => {
                    const sub = u.subscriptions?.[0];
                    const suspended = !!u.suspended_at;
                    return (
                      <tr
                        key={u.id}
                        className="transition-colors hover:bg-ink-50/60"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="flex items-center gap-2.5"
                          >
                            <Avatar name={u.name} email={u.email} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-medium text-ink-800">
                                {u.name ?? u.email}
                              </p>
                              <p className="truncate text-[11px] text-ink-400">
                                {u.email}
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">
                            {sub?.plan?.name ?? "Free"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-[13px] text-ink-600">
                          {formatBytes(u.usage?.stored_bytes ?? 0)}
                        </td>
                        <td className="px-4 py-3 text-[12px] text-ink-400">
                          {timeAgo(u.last_active_at)}
                        </td>
                        <td className="px-4 py-3">
                          {suspended ? (
                            <Badge variant="danger" className="gap-1">
                              <Ban className="h-3 w-3" /> Suspended
                            </Badge>
                          ) : (
                            <Badge variant="success">Active</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="inline-flex text-ink-300 transition-colors hover:text-ink-600"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-400">
            No users match.
          </p>
        )}
      </div>
    </div>
  );
}
