import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server-client";
import { supabaseAdmin } from "@/lib/supabase-server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = supabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) redirect("/login");

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("onboarded_at")
    .eq("id", data.user.id)
    .single();

  if (!profile?.onboarded_at) redirect("/onboarding");

  return <DashboardClient />;
}
