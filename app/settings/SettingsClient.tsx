"use client";
import { useEffect, useState } from "react";
import { User, CreditCard, ShieldCheck, LogOut, HardDrive, Download } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast, Button, Input, Label, Card, CardHeader, CardTitle, CardDescription, CardContent, Progress, Avatar, cn, formatBytes } from "@/components/ui";
import type { Profile, Subscription, UsageRow } from "@/lib/types";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "plan", label: "Plan & Usage", icon: CreditCard },
  { id: "security", label: "Security", icon: ShieldCheck },
] as const;

export default function SettingsClient() {
  const toast = useToast();
  const [active, setActive] = useState<(typeof SECTIONS)[number]["id"]>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageRow | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<{ profile: Profile; subscription: Subscription | null; usage: UsageRow | null }>("/api/account")
      .then((r) => {
        setProfile(r.profile);
        setSub(r.subscription);
        setUsage(r.usage);
        setName(r.profile.name ?? "");
      })
      .catch(() => {});
  }, []);

  async function saveName() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.patch("/api/account", { name: name.trim() });
      toast("Profile updated");
    } catch (e) {
      toast((e as ApiError).message, "error");
    }
    setSaving(false);
  }

  const plan = (sub as any)?.plan;
  const used = usage?.stored_bytes ?? 0;
  const quota = plan?.quota_bytes ?? 0;
  const downloaded = usage?.downloaded_bytes ?? 0;
  const downloadAllowance = (usage?.uploaded_bytes ?? 0) * (plan?.download_multiplier ?? 2);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-5 text-xl font-bold tracking-tight text-ink-900">Settings</h1>

      <div className="flex flex-col gap-6 sm:flex-row">
        {/* Section nav */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto sm:w-44 sm:flex-col sm:overflow-visible">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all duration-150",
                  isActive
                    ? "bg-ink-900 text-white shadow-soft"
                    : "text-ink-500 hover:bg-white hover:text-ink-800 hover:shadow-soft"
                )}
              >
                <Icon className="h-4 w-4" />
                {s.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {active === "profile" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Profile</CardTitle>
                <CardDescription>Update your personal information.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar name={profile?.name} email={profile?.email} size="lg" />
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{profile?.name ?? "User"}</p>
                    <p className="text-xs text-ink-500">{profile?.email}</p>
                  </div>
                </div>
                <div>
                  <Label htmlFor="display-name">Display name</Label>
                  <div className="flex gap-2">
                    <Input
                      id="display-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1"
                    />
                    <Button onClick={saveName} loading={saving} disabled={!name.trim()}>
                      Save
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {active === "plan" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Plan &amp; usage</CardTitle>
                <CardDescription>Your current plan and storage consumption.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <HardDrive className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{plan?.name ?? "Free"} plan</p>
                      <p className="text-[11px] text-ink-500">{formatBytes(quota)} storage</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-ink-500">
                    {formatBytes(used)} / {formatBytes(quota)}
                  </span>
                </div>
                <Progress value={quota > 0 ? (used / quota) * 100 : 0} className="h-2" />

                <div className="flex items-center gap-3 rounded-xl border border-ink-100 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                    <Download className="h-4 w-4" />
                  </span>
                  <div className="flex-1">
                    <p className="text-xs font-medium text-ink-700">Download allowance</p>
                    <p className="text-[11px] text-ink-400">
                      {formatBytes(downloaded)} of {formatBytes(downloadAllowance)} this period
                    </p>
                  </div>
                </div>

                <p className="text-[11px] leading-relaxed text-ink-400">
                  Paid plans coming soon — pay with eSewa, Khalti, or Fonepay.
                </p>
              </CardContent>
            </Card>
          )}

          {active === "security" && (
            <Card className="animate-fade-in">
              <CardHeader>
                <CardTitle>Security</CardTitle>
                <CardDescription>Manage your account sessions.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action="/api/auth/signout" method="POST">
                  <Button variant="outline" type="submit" className="w-full sm:w-auto">
                    <LogOut className="h-4 w-4" /> Sign out of this device
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
