import { NextRequest } from "next/server";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("share_links")
    .update({ revoked: true })
    .eq("id", params.id)
    .eq("created_by", user.id);

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }
  return Response.json({ ok: true });
}
