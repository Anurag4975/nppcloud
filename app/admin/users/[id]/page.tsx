"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  KeyRound,
  LogOut,
  CreditCard,
  HardDrive,
  Monitor,
  Activity,
  FolderOpen,
  ShieldAlert,
  Calendar,
} from "lucide-react";
import {
  Card,
  Badge,
  Avatar,
  Button,
  Modal,
  Tabs,
  Progress,
  Skeleton,
  cn,
  formatBytes,
  timeAgo,
  useToast,
} from "@/components/ui";

type Detail = {
  profile: any;
  subscriptions: any[];
  usage: any | null;
  files: { items: any[]; count: number; total_bytes: number };
  payments: any[];
  devices: any[];
  activity: any[];
  share_links: any[];
  household: any | null;
};

const PAYMENT_BADGE: Record<string, string> = {
  completed: "success",
  succeeded: "success",
  paid: "success",
  pending: "warning",
  failed: "danger",
  error: "danger",
  declined: "danger",
};

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const userId = params.id as string;
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState("overview");
  const [plans, setPlans] = useState<any[]>([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantPlan, setGrantPlan] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/admin/users/${userId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    load();
    fetch("/api/plans")
      .then((r) => r.json())
      .then((j) => setPlans(j.plans ?? []))
      .catch(() => {});
  }, [load]);

  const act = async (key: string, path: string, body?: any, msg?: string) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!res.ok) throw new Error();
      toast({ title: msg ?? "Done.", variant: "success" });
      load();
    } catch {
      toast({ title: "Action failed.", variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const p = data.profile;
  const sub = data.subscriptions?.[0];
  const plan = sub?.plan;
  const quota = plan?.quota_bytes ?? 0;
  const stored = data.usage?.stored_bytes ?? 0;
  const pct = quota > 0 ? Math.min(100, (stored / quota) * 100) : 0;
  const suspended = !!p.suspended_at;

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "files", label: `Files (${data.files.count})` },
    { id: "payments", label: `Payments (${data.payments.length})` },
    { id: "devices", label: `Devices (${data.devices.length})` },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-400 transition-colors hover:text-ink-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All users
      </Link>

      {/* Header + actions */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name={p.name} email={p.email} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-ink-900">
                  {p.name ?? "Unnamed user"}
                </h1>
                {p.role === "admin" && <Badge variant="warning">Admin</Badge>}
                {suspended ? (
                  <Badge variant="danger" className="gap-1">
                    <Ban className="h-3 w-3" /> Suspended
                  </Badge>
                ) : (
                  <Badge variant="success">Active</Badge>
                )}
              </div>
              <p className="text-sm text-ink-500">{p.email}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">
                Joined {timeAgo(p.created_at)} · last seen{" "}
                {timeAgo(p.last_active_at)}
                {p.phone_verified_at && " · phone verified"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={suspended ? "primary" : "outline"}
              size="sm"
              loading={busy === "suspend"}
              onClick={() =>
                act(
                  "suspend",
                  "suspend",
                  {
                    suspend: !suspended,
                    reason: suspended ? undefined : "Suspended by admin",
                  },
                  suspended
                    ? "User unsuspended."
                    : "User suspended + logged out.",
                )
              }
            >
              {suspended ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Ban className="h-3.5 w-3.5" />
              )}
              {suspended ? "Unsuspend" : "Suspend"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGrantOpen(true)}
            >
              <KeyRound className="h-3.5 w-3.5" /> Grant plan
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={busy === "logout"}
              onClick={() =>
                act("logout", "force-logout", {}, "All sessions revoked.")
              }
            >
              <LogOut className="h-3.5 w-3.5" /> Force logout
            </Button>
          </div>
        </div>
        {suspended && p.suspended_reason && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            Reason: {p.suspended_reason}
          </p>
        )}
      </Card>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CreditCard className="h-4 w-4 text-ink-400" /> Subscription
            </h3>
            {sub ? (
              <div className="space-y-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-ink-500">Plan</span>
                  <span className="font-medium text-ink-800">
                    {plan?.name ?? "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Status</span>
                  <Badge
                    variant={sub.status === "active" ? "success" : "warning"}
                  >
                    {sub.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Started</span>
                  <span className="text-ink-700">
                    {timeAgo(sub.started_at)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Expires</span>
                  <span className="text-ink-700">
                    {sub.expires_at
                      ? new Date(sub.expires_at).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Provider</span>
                  <span className="text-ink-700">
                    {sub.payment_provider ?? "—"}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-400">No active subscription.</p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-900">
              <HardDrive className="h-4 w-4 text-ink-400" /> Storage
            </h3>
            <p className="text-2xl font-bold tracking-tight text-ink-900">
              {formatBytes(stored)}
            </p>
            <p className="text-[11px] text-ink-400">
              of {formatBytes(quota)} quota
            </p>
            <Progress
              value={pct}
              className="mt-3"
              variant={pct > 85 ? "danger" : "brand"}
            />
            <div className="mt-3 space-y-1.5 text-[12px] text-ink-500">
              <p>Uploaded: {formatBytes(data.usage?.uploaded_bytes ?? 0)}</p>
              <p>
                Downloaded: {formatBytes(data.usage?.downloaded_bytes ?? 0)}
              </p>
              <p>
                Files: {data.files.count} · Share links:{" "}
                {data.share_links.length}
              </p>
            </div>
          </Card>

          {data.household && (
            <Card className="p-5 sm:col-span-2">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-900">
                <FolderOpen className="h-4 w-4 text-ink-400" /> Household
              </h3>
              <p className="text-[13px] text-ink-600">
                Role:{" "}
                <span className="font-medium text-ink-800">
                  {data.household.role}
                </span>{" "}
                · Plan:{" "}
                <span className="font-medium text-ink-800">
                  {data.household.households?.plan?.name ?? "—"}
                </span>{" "}
                · Joined {timeAgo(data.household.joined_at)}
              </p>
            </Card>
          )}
        </div>
      )}

      {tab === "files" && (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-ink-100">
            {data.files.items.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-400">
                No files.
              </p>
            )}
            {data.files.items.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink-800">
                    {f.name}
                  </p>
                  <p className="text-[11px] text-ink-400">
                    {f.mime_type ?? "—"} · {timeAgo(f.created_at)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={f.status === "active" ? "success" : "secondary"}
                  >
                    {f.status}
                  </Badge>
                  <span className="text-[12px] text-ink-500">
                    {formatBytes(f.size_bytes)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "payments" && (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-ink-100">
            {data.payments.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-400">
                No payment events.
              </p>
            )}
            {data.payments.map((pay) => (
              <details key={pay.id} className="group px-5 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-ink-800 capitalize">
                      {pay.provider} · NPR {pay.amount?.toLocaleString() ?? "—"}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      {pay.provider_ref ?? "no ref"} · {timeAgo(pay.created_at)}
                    </p>
                  </div>
                  <Badge
                    variant={(PAYMENT_BADGE[pay.status] as any) ?? "secondary"}
                  >
                    {pay.status}
                  </Badge>
                </summary>
                <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-ink-900 p-3 text-[10px] leading-relaxed text-ink-200">
                  {JSON.stringify(pay.raw_payload ?? {}, null, 2)}
                </pre>
              </details>
            ))}
          </div>
        </Card>
      )}

      {tab === "devices" && (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-ink-100">
            {data.devices.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-400">
                No registered devices.
              </p>
            )}
            {data.devices.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
                    <Monitor className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[13px] font-medium capitalize text-ink-800">
                      {d.client_type}
                    </p>
                    <p className="text-[11px] text-ink-400">
                      Last seen {timeAgo(d.last_seen_at)}
                    </p>
                  </div>
                </div>
                <Calendar className="h-3.5 w-3.5 text-ink-300" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "activity" && (
        <Card className="overflow-hidden p-0">
          <div className="divide-y divide-ink-100">
            {data.activity.length === 0 && (
              <p className="px-5 py-10 text-center text-sm text-ink-400">
                No activity logged.
              </p>
            )}
            {data.activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Activity className="h-3 w-3" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink-800">
                    {a.event_type}
                  </p>
                  {a.metadata && (
                    <p className="mt-0.5 truncate text-[11px] text-ink-400">
                      {JSON.stringify(a.metadata)}
                    </p>
                  )}
                  <p className="text-[11px] text-ink-400">
                    {timeAgo(a.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Grant plan modal */}
      <Modal
        open={grantOpen}
        onClose={() => setGrantOpen(false)}
        title="Grant / extend subscription"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              Plan
            </label>
            <select
              value={grantPlan}
              onChange={(e) => setGrantPlan(e.target.value)}
              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            >
              <option value="">Select a plan…</option>
              {plans.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} · NPR {pl.price_npr}/mo
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink-600">
              Duration (days)
            </label>
            <input
              type="number"
              min={1}
              value={grantDays}
              onChange={(e) => setGrantDays(Number(e.target.value))}
              className="h-10 w-full rounded-xl border border-ink-200 bg-white px-3 text-sm focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
          </div>
          <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This replaces any active subscription and is logged to the admin
            audit trail.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setGrantOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              loading={busy === "grant"}
              disabled={!grantPlan}
              onClick={() => {
                setGrantOpen(false);
                act(
                  "grant",
                  "grant-plan",
                  { plan_id: grantPlan, days: grantDays },
                  "Plan granted.",
                );
              }}
            >
              Grant {grantDays} days
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
