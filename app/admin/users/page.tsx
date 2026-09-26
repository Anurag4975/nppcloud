"use client";
import { useEffect, useState } from "react";
import { Search, ShieldCheck } from "lucide-react";
import { Input, Badge, Avatar, Skeleton, cn } from "@/components/ui";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
  subscriptions: { status: string; plan: { name: string } | null }[];
  usage: { stored_bytes: number }[];
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    setLoading(true);
    fetch(`/api/admin/users${params}`)
      .then((res) => res.json())
      .then((json) => setUsers(json.users ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Users</h1>
        <div className="w-full max-w-xs">
          <Input
            icon={<Search className="h-4 w-4" />}
            placeholder="Search by email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-9 text-[13px]"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Storage</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                : users.map((u) => (
                    <tr key={u.id} className="transition-colors hover:bg-ink-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} email={u.email} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium text-ink-800">
                              {u.name ?? u.email}
                            </p>
                            <p className="truncate text-[11px] text-ink-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{u.subscriptions?.[0]?.plan?.name ?? "Free"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-ink-600">
                        {((u.usage?.[0]?.stored_bytes ?? 0) / 1e9).toFixed(2)} GB
                      </td>
                      <td className="px-4 py-3">
                        {u.role === "admin" ? (
                          <Badge variant="warning" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> Admin
                          </Badge>
                        ) : (
                          <span className="text-[13px] text-ink-500">User</span>
                        )}
                      </td>
                      <td className={cn("px-4 py-3 text-[12px] text-ink-400")}>
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-400">No users found.</p>
        )}
      </div>
    </div>
  );
}
