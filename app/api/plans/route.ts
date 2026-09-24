import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  const admin = supabaseAdmin();
  const { data: plans } = await admin
    .from("plans")
    .select("id, name, quota_bytes, price_npr, is_household")
    .eq("is_household", false)
    .order("price_npr", { ascending: true });

  return Response.json({ plans: plans ?? [] });
}
