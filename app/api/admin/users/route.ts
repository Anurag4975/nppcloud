import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const search = req.nextUrl.searchParams.get("q")?.trim();
  const admin = supabaseAdmin();

  let query = admin
    .from("profiles")
    .select("id, email, name, role, created_at, last_active_at, subscriptions(status, plan:plans(name)), usage(stored_bytes)")
    .order("created_at", { ascending: false })
    .limit(50);

  if (search) {
    query = query.ilike("email", `%${search}%`);
  }

  const { data: users, error } = await query;

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }
  return Response.json({ users: users ?? [] });
}
