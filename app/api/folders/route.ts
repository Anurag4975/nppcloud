import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_body", message: parsed.error.message } }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: folder, error } = await admin
    .from("folders")
    .insert({ user_id: user.id, name: parsed.data.name, parent_id: parsed.data.parent_id ?? null })
    .select()
    .single();

  if (error) {
    return Response.json({ error: { code: "db_error", message: error.message } }, { status: 500 });
  }
  return Response.json({ folder });
}
