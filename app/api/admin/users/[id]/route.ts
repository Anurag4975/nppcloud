import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { notFound, internalError } from "@/lib/errors";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;
  const admin = supabaseAdmin();
  const { id: userId } = await params;

  const [
    profileRes, subRes, usageRes, filesRes, paymentsRes,
    devicesRes, activityRes, sharesRes, householdRes,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("subscriptions").select("*, plan:plans!subscriptions_plan_id_fkey(*)")
      .eq("user_id", userId).order("started_at", { ascending: false }).limit(3),
    admin.from("usage").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("files").select("id, name, size_bytes, mime_type, status, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
    admin.from("payment_events").select("*")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    admin.from("devices").select("*")
      .eq("user_id", userId).order("last_seen_at", { ascending: false }),
    admin.from("activity_log").select("event_type, metadata, created_at")
      .eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    admin.from("share_links").select("id, file_id, revoked, download_count, bytes_served, created_at")
      .eq("created_by", userId).order("created_at", { ascending: false }).limit(10),
    admin.from("household_members")
      .select("household_id, role, joined_at, households(owner_id, plan:plans(name))")
      .eq("user_id", userId).maybeSingle(),
  ]);

  if (!profileRes.data) return notFound("User not found.");

  const failed = [
    ["profile", profileRes.error], ["subscriptions", subRes.error],
    ["usage", usageRes.error], ["files", filesRes.error],
    ["payments", paymentsRes.error], ["devices", devicesRes.error],
    ["activity", activityRes.error], ["share_links", sharesRes.error],
    ["household", householdRes.error],
  ].filter(([, err]) => err);

  if (failed.length > 0) {
    console.error("admin/users/[id] query failures", { userId, failed });
    return internalError();
  }

  const fileCount = filesRes.data?.length ?? 0;
  const totalFileBytes = (filesRes.data ?? []).reduce((s, f) => s + (f.size_bytes ?? 0), 0);

  return Response.json({
    profile: profileRes.data,
    subscriptions: subRes.data ?? [],
    usage: usageRes.data ?? null,
    files: { items: filesRes.data ?? [], count: fileCount, total_bytes: totalFileBytes },
    payments: paymentsRes.data ?? [],
    devices: devicesRes.data ?? [],
    activity: activityRes.data ?? [],
    share_links: sharesRes.data ?? [],
    household: householdRes.data ?? null,
  });
}
