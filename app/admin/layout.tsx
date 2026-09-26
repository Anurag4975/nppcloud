import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  TrendingUp,
  ArrowLeft,
} from "lucide-react";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/engagement", label: "Engagement", icon: TrendingUp },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="flex min-h-screen bg-ink-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col bg-ink-950 px-4 py-5 lg:flex">
        <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-glow">
            <ShieldCheck className="h-5 w-5 text-white" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">
            Admin
          </span>
        </Link>
        <nav className="flex flex-col gap-0.5">
          {ADMIN_NAV.map((n) => {
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors duration-150",
                  "text-ink-400 hover:bg-white/5 hover:text-ink-200",
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/dashboard"
          className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-ink-400 transition-colors hover:bg-white/5 hover:text-ink-200"
        >
          <ArrowLeft className="h-4 w-4" /> Back to app
        </Link>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-56">
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
