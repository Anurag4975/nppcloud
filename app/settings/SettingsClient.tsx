"use client";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, Input, UsageBar, formatBytes } from "@/components/ui/core";
import type { Profile, Subscription, UsageRow } from "@/lib/types";

export default function SettingsClient() {
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageRow | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<{ profile: Profile; subscription: Subscription | null; usage: UsageRow | null }>("/api/account")
      .then((r) => { setProfile(r.profile); setSub(r.subscription); setUsage(r.usage); setName(r.profile.name ?? ""); })
      .catch(() => {});
  }, []);

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    try { await api.patch("/api/account", { name: name.trim() }); toast("Profile updated"); }
    catch (e) { toast((e as ApiError).message, "error"); }
    setSaving(false);
  }

  const plan = (sub as any)?.plan;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-lg font-bold text-slate-900">Settings</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Profile</h2>
        <label className="mb-1 block text-xs text-slate-500">Display name</label>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={saveName} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Email: {profile?.email}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Plan &amp; usage</h2>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-600">{plan?.name ?? "Free"} plan</span>
          <span className="text-slate-500">{formatBytes(usage?.stored_bytes ?? 0)} / {formatBytes(plan?.quota_bytes ?? 0)}</span>
        </div>
        <UsageBar used={usage?.stored_bytes ?? 0} total={plan?.quota_bytes ?? 0} />
        <p className="mt-3 text-xs text-slate-400">
          Downloaded {formatBytes(usage?.downloaded_bytes ?? 0)} of {formatBytes((usage?.uploaded_bytes ?? 0) * (plan?.download_multiplier ?? 2))} allowance this period.
          Paid plans coming soon — pay with eSewa, Khalti, or Fonepay.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Sign out</h2>
        <form action="/api/auth/signout" method="POST">
          <Button variant="secondary" type="submit">Sign out of this device</Button>
        </form>
      </section>
    </div>
  );
}
