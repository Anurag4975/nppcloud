import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import { AppShell } from "@/components/dashboard/AppShell";

// Every page under this route group (dashboard, shared, trash, settings)
// used to import AppShell itself, so navigating between them fully
// unmounted and remounted the sidebar — replaying its "sliding active pill"
// mount animation (which starts at {top:0, height:0}) on every nav. Mounting
// AppShell once, here, keeps the sidebar alive across those routes. This is
// a route *group* — the parenthesized folder name doesn't appear in the
// URL, so /dashboard, /shared, /trash, /settings are unchanged.
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarded_at")
    .eq("id", data.user.id)
    .single();
  if (!profile?.onboarded_at) redirect("/onboarding");

  return <AppShell>{children}</AppShell>;
}
