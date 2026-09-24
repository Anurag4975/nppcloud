import { redirect } from "next/navigation";
import { supabaseServerClient } from "@/lib/supabase-server-client";

export default async function Home() {
  const supabase = supabaseServerClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/dashboard" : "/login");
}
