"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const params = q ? `?q=${encodeURIComponent(q)}` : "";
    fetch(`/api/admin/users${params}`)
      .then((res) => res.json())
      .then((json) => setUsers(json.users ?? []));
  }, [q]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-slate-800">Users</h1>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by email…"
        className="mb-4 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
            <th className="py-2">Email</th>
            <th className="py-2">Plan</th>
            <th className="py-2">Used</th>
            <th className="py-2">Role</th>
            <th className="py-2">Joined</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b border-slate-100">
              <td className="py-2">{u.email}</td>
              <td className="py-2">{u.subscriptions?.[0]?.plan?.name ?? "—"}</td>
              <td className="py-2">{((u.usage?.[0]?.stored_bytes ?? 0) / 1e9).toFixed(2)} GB</td>
              <td className="py-2">{u.role}</td>
              <td className="py-2 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
