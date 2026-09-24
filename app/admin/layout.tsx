import { redirect } from "next/navigation";
import Link from "next/link";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", data.user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl gap-8 px-6 py-8">
      <nav className="w-40 shrink-0 text-sm">
        <p className="mb-4 font-bold text-slate-800">Admin</p>
        <ul className="flex flex-col gap-1 text-slate-500">
          <li><Link href="/admin" className="block rounded px-2 py-1 hover:bg-slate-100">Overview</Link></li>
          <li><Link href="/admin/users" className="block rounded px-2 py-1 hover:bg-slate-100">Users</Link></li>
        </ul>
        <Link href="/dashboard" className="mt-6 block text-xs text-slate-400 hover:underline">← Back to app</Link>
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
