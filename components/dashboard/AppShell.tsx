"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ToastProvider, UsageBar, formatBytes, DropdownMenu } from "@/components/ui/core";
import { CloudIcon, HomeIcon, ShareIcon, TrashIcon, SettingsIcon, UserIcon, LogoutIcon, MoreIcon } from "@/components/ui/icons";
import type { UsageResponse } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "My Files", icon: HomeIcon },
  { href: "/shared", label: "Shared links", icon: ShareIcon },
  { href: "/trash", label: "Trash", icon: TrashIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [profile, setProfile] = useState<{ name: string | null; email: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/usage").then((r) => r.json()).then(setUsage).catch(() => {});
    fetch("/api/account").then((r) => r.ok ? r.json() : null).then((j) => j && setProfile(j.profile)).catch(() => {});
  }, []);

  const used = usage?.usage?.stored_bytes ?? 0;
  const total = usage?.plan?.quota_bytes ?? 0;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-slate-50">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white px-3 py-5 md:flex">
          <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
            <CloudIcon className="text-slate-900" width={22} height={22} />
            <span className="text-base font-bold text-slate-900">MyCloud</span>
          </Link>
          <nav className="flex flex-1 flex-col gap-0.5">
            {NAV.map((n) => {
              const active = pathname === n.href || (n.href === "/dashboard" && pathname.startsWith("/dashboard/"));
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${active ? "bg-slate-100 font-medium text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
                >
                  <Icon width={17} height={17} /> {n.label}
                </Link>
              );
            })}
            {profile?.role === "admin" && (
              <Link href="/admin" className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-600 hover:bg-slate-50">
                <SettingsIcon width={17} height={17} /> Admin
              </Link>
            )}
          </nav>
          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <p className="mb-1.5 text-xs font-medium text-slate-600">
              {formatBytes(used)} of {formatBytes(total)}
            </p>
            <UsageBar used={used} total={total} />
            <p className="mt-1.5 text-[11px] text-slate-400">{usage?.plan?.name ?? "Free"} plan</p>
          </div>
        </aside>

        {/* Main */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3 md:hidden">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
              <CloudIcon width={20} height={20} /> MyCloud
            </Link>
            <MobileNav />
          </header>
          <header className="hidden items-center justify-end border-b border-slate-200 bg-white px-6 py-2.5 md:flex">
            <DropdownMenu
              trigger={<MoreIcon width={18} height={18} />}
              items={[
                { label: "Sign out", danger: true, onClick: () => (document.getElementById("signout-form") as HTMLFormElement | null)?.requestSubmit() },
              ]}
            />
            <form id="signout-form" action="/api/auth/signout" method="POST" className="hidden">
              <button type="submit">sign out</button>
            </form>
            <div className="ml-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {(profile?.name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
              </span>
              <div className="leading-tight">
                <p className="max-w-[180px] truncate text-xs font-medium text-slate-800">{profile?.name ?? profile?.email}</p>
                <p className="max-w-[180px] truncate text-[11px] text-slate-400">{profile?.email}</p>
              </div>
            </div>
          </header>
          <main className="flex-1 px-5 py-6 md:px-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function MobileNav() {
  return (
    <nav className="flex gap-1 text-xs">
      {NAV.map((n) => {
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className="rounded p-1.5 text-slate-500 hover:bg-slate-100" aria-label={n.label}>
            <Icon width={18} height={18} />
          </Link>
        );
      })}
    </nav>
  );
}
