import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { internalError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const admin = supabaseAdmin();
  const userId = params.id;

  const { error } = await admin.auth.admin.signOut(userId, { scope: "global" });
  await admin
    .from("devices")
    .delete()
    .eq("user_id", userId)
    .catch(() => {});
  if (error) return internalError();

  await admin
    .from("admin_audit_log")
    .insert({
      admin_id: gate.user.id,
      action: "user.force_logout",
      target_table: "profiles",
      target_id: userId,
    })
    .catch(() => {});

  return Response.json({ ok: true });
}
