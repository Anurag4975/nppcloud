import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";
import { getDownloadUrl } from "@/lib/b2";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();

  const { data: file } = await admin
    .from("files")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!file) {
    return Response.json({ error: { code: "not_found", message: "File not found." } }, { status: 404 });
  }

  // Enforce: downloaded_bytes <= uploaded_bytes * download_multiplier (business rule)
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan:plans(download_multiplier)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const { data: usage } = await admin
    .from("usage")
    .select("uploaded_bytes, downloaded_bytes")
    .eq("user_id", user.id)
    .single();

  const multiplier = (sub as any)?.plan?.download_multiplier ?? 2;
  const allowance = (usage?.uploaded_bytes ?? 0) * multiplier;
  const alreadyDownloaded = usage?.downloaded_bytes ?? 0;

  if (alreadyDownloaded + file.size_bytes > allowance) {
    return Response.json(
      { error: { code: "download_limit_exceeded", message: "Download allowance exceeded for this billing period." } },
      { status: 403 }
    );
  }

  const url = await getDownloadUrl(file.object_key, file.name);

  // Record the download against usage now (server-enforced, not client-reported)
  await admin.rpc("increment_usage", {
    p_user_id: user.id,
    p_stored_delta: 0,
    p_uploaded_delta: 0,
    p_downloaded_delta: file.size_bytes,
  });

  return Response.json({ download_url: url });
}
