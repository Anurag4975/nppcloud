import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { internalError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

// GET /api/admin/users?q=<search>&status=active|suspended
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const admin = supabaseAdmin();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const status = searchParams.get("status");

  let query = admin
    .from("profiles")
    .select(`
      id, email, name, role, created_at, last_active_at, suspended_at,
      subscriptions:subscriptions!subscriptions_user_id_fkey(
        status,
        plan:plans!subscriptions_plan_id_fkey(name, price_npr)
      ),
      usage(stored_bytes)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  if (q) {
    query = query.or(`email.ilike.%${q}%,name.ilike.%${q}%`);
  }
  if (status === "active") {
    query = query.is("suspended_at", null);
  } else if (status === "suspended") {
    query = query.not("suspended_at", "is", null);
  }

  const { data, error } = await query;
  if (error) {
    console.error("admin/users list failed", error);
    return internalError();
  }

  const users = (data ?? []).map((u: any) => ({
    ...u,
    usage: Array.isArray(u.usage) ? (u.usage[0] ?? null) : (u.usage ?? null),
  }));

  return Response.json({ users });
}
