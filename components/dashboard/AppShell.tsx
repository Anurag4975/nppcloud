"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Cloud,
  Home,
  Share2,
  Trash2,
  Settings,
  ShieldCheck,
  LogOut,
  ChevronDown,
  Upload,
} from "lucide-react";
import { ToastProvider, Progress, Avatar, DropdownMenu, cn, formatBytes } from "@/components/ui";
import type { UsageResponse } from "@/lib/types";

const NAV = [
  { href: "/dashboard", label: "My Files", icon: Home },
  { href: "/shared", label: "Shared", icon: Share2 },
  { href: "/trash", label: "Trash", icon: Trash2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface Profile {
  name: string | null;
  email: string;
  role: string;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const reloadUsage = () => {
      fetch("/api/usage")
        .then((r) => r.json())
        .then(setUsage)
        .catch(() => {});
    };
    reloadUsage();

    const onUsage = () => reloadUsage();
    const onVis = () => {
      if (!document.hidden) reloadUsage();
    };
    window.addEventListener("nppcloud:usage-changed", onUsage);
    document.addEventListener("visibilitychange", onVis);

    fetch("/api/account")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setProfile(j.profile))
      .catch(() => {});

    return () => {
      window.removeEventListener("nppcloud:usage-changed", onUsage);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const used = usage?.usage?.stored_bytes ?? 0;
  const total = usage?.plan?.quota_bytes ?? 0;
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-ink-50">
        {/* ── Desktop sidebar (dark) ─────────────────────────────── */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink-950 lg:flex">
          <div className="flex flex-1 flex-col px-4 py-5">
            <Link href="/dashboard" className="group mb-7 flex items-center gap-2.5 px-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-glow transition-transform duration-200 group-hover:scale-105">
                <Cloud className="h-5 w-5 text-white" strokeWidth={2.2} />
              </span>
              <span className="text-[15px] font-bold tracking-tight text-white">NPP Cloud</span>
            </Link>

            <SidebarNav pathname={pathname} isAdmin={profile?.role === "admin"} />

            {/* Usage card */}
            <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">
                  Storage
                </span>
                <span className="text-[11px] font-semibold text-ink-300">
                  {Math.round(pct)}%
                </span>
              </div>
              <Progress
                value={pct}
                className="h-2 bg-white/10"
                barClassName="bg-gradient-to-r from-brand-400 to-brand-500"
              />
              <p className="mt-2.5 text-[11px] leading-relaxed text-ink-400">
                <span className="font-medium text-ink-200">{formatBytes(used)}</span> of{" "}
                {formatBytes(total)} used
                <br />
                {usage?.plan?.name ?? "Free"} plan
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main column ────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Top bar */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200/70 bg-white/80 px-4 backdrop-blur-md sm:px-6">
            <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600">
                <Cloud className="h-4 w-4 text-white" />
              </span>
              <span className="text-sm font-bold text-ink-900">NPP Cloud</span>
            </Link>

            {/* The dashboard's own Toolbar already has a real, working search
                box (id="global-search-input") wired to the current folder's
                contents. This header used to have a second, purely
                decorative search button whose only job was to focus that
                same input — two search boxes for one search. Removed. */}

            <button
              type="button"
              onClick={() => {
                // The header has no file input of its own — the real one
                // lives inside DashboardClient, which mounts on /dashboard.
                // Broadcast an event it listens for instead of duplicating
                // upload logic here or linking to a page that does nothing
                // when you're already on it.
                window.dispatchEvent(new CustomEvent("nppcloud:trigger-upload"));
              }}
              className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl bg-ink-900 px-3.5 text-xs font-medium text-white shadow-soft transition-all duration-150 hover:bg-ink-800 hover:shadow-card active:scale-[0.98]"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* User menu */}
            <UserMenu profile={profile} />
          </header>

          {/* Page content — bottom padding for mobile nav */}
          <main className="flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">{children}</main>

          {/* Mobile bottom nav */}
          <MobileNav pathname={pathname} />
        </div>
      </div>

      {/* Hidden signout form — submitted by menu items */}
      <form id="signout-form" action="/api/auth/signout" method="POST" className="hidden">
        <button type="submit">sign out</button>
      </form>
    </ToastProvider>
  );
}

/* ── Sidebar nav with sliding active indicator ─────────────────────── */
function SidebarNav({ pathname, isAdmin }: { pathname: string; isAdmin: boolean }) {
  const items = isAdmin
    ? [...NAV, { href: "/admin", label: "Admin", icon: ShieldCheck }]
    : NAV;
  const activeIndex = items.findIndex(
    (n) => pathname === n.href || (n.href === "/dashboard" && pathname.startsWith("/dashboard"))
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ top: 0, height: 0 });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || activeIndex < 0) return;
    const btn = container.children[activeIndex] as HTMLElement | undefined;
    if (!btn) return;
    setPill({ top: btn.offsetTop, height: btn.offsetHeight });
  }, [activeIndex, items.length]);

  return (
    <nav ref={containerRef} className="relative flex flex-col gap-0.5">
      <span
        aria-hidden
        className="absolute left-0 right-0 rounded-xl bg-white/[0.08] ring-1 ring-inset ring-white/10 transition-all duration-300 ease-out-expo"
        style={{ top: pill.top, height: pill.height, transitionProperty: "top, height" }}
      />
      {items.map((n) => {
        const active =
          pathname === n.href || (n.href === "/dashboard" && pathname.startsWith("/dashboard"));
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative z-10 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
              active ? "text-white" : "text-ink-400 hover:text-ink-200"
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* ── User dropdown menu ────────────────────────────────────────────── */
function UserMenu({ profile }: { profile: Profile | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 rounded-xl p-1 pr-2 transition-all duration-150",
          "hover:bg-ink-100 active:scale-[0.98]",
          open && "bg-ink-100"
        )}
        aria-label="Account menu"
      >
        <Avatar name={profile?.name} email={profile?.email} size="sm" />
        <ChevronDown
          className={cn(
            "hidden h-3.5 w-3.5 text-ink-400 transition-transform duration-200 sm:block",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-64 origin-top-right animate-slide-down overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-pop">
            <div className="border-b border-ink-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-ink-900">
                {profile?.name ?? "User"}
              </p>
              <p className="truncate text-xs text-ink-500">{profile?.email}</p>
            </div>
            <div className="p-1.5">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-ink-700 transition-colors hover:bg-ink-100"
              >
                <Settings className="h-4 w-4 text-ink-400" /> Settings
              </Link>
              <button
                onClick={() => {
                  setOpen(false);
                  (document.getElementById("signout-form") as HTMLFormElement | null)?.requestSubmit();
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Mobile bottom navigation ──────────────────────────────────────── */
function MobileNav({ pathname }: { pathname: string }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-ink-200/80 bg-white/90 px-2 py-1.5 backdrop-blur-md lg:hidden">
      {NAV.map((n) => {
        const active =
          pathname === n.href || (n.href === "/dashboard" && pathname.startsWith("/dashboard"));
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors duration-150",
              active ? "text-brand-600" : "text-ink-400"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
            {n.label}
            {active && (
              <span className="absolute -top-1.5 h-1 w-8 rounded-full bg-brand-500" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
