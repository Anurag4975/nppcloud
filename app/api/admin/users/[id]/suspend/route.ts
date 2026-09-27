import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { badRequest, internalError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const { suspend, reason } = await req.json().catch(() => ({}));
  if (typeof suspend !== "boolean")
    return badRequest("suspend boolean required.");
  const admin = supabaseAdmin();
  const { id: userId } = await params;

  const patch = suspend
    ? {
        suspended_at: new Date().toISOString(),
        suspended_by: gate.user.id,
        suspended_reason: reason ?? null,
      }
    : { suspended_at: null, suspended_by: null, suspended_reason: null };

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) return internalError();

  // On suspend, also revoke all sessions (force-logout)
  if (suspend) {
    await admin.auth.admin.signOut(userId, { scope: "global" }).catch(() => {});
    await admin
      .from("devices")
      .delete()
      .eq("user_id", userId)
      .catch(() => {});
  }

  await admin
    .from("admin_audit_log")
    .insert({
      admin_id: gate.user.id,
      action: suspend ? "user.suspended" : "user.unsuspended",
      target_table: "profiles",
      target_id: userId,
      after: patch,
    })
    .catch(() => {});

  return Response.json({ ok: true });
}
