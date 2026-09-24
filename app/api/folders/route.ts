import { NextRequest } from "next/server";
import { z } from "zod";
import { getAuthedUser } from "@/lib/auth";
import { unauthorized, badRequest, internalError } from "@/lib/errors";
import { csrfGuard } from "@/lib/csrf";
import { supabaseAdmin } from "@/lib/supabase-server";

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  parent_id: z.string().uuid().nullable().optional(),
});

export async function POST(req: NextRequest) {
  const csrf = csrfGuard(req);
  if (csrf) return csrf;
  const user = await getAuthedUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Invalid folder name.");

  const admin = supabaseAdmin();

  if (parsed.data.parent_id) {
    const { data: parent } = await admin
      .from("folders").select("id").eq("id", parsed.data.parent_id)
      .eq("user_id", user.id).eq("status", "active").single();
    if (!parent) return badRequest("Parent folder doesn't exist or isn't yours.");
  }

  const { data: folder, error } = await admin
    .from("folders")
    .insert({ user_id: user.id, name: parsed.data.name, parent_id: parsed.data.parent_id ?? null })
    .select().single();
  if (error) return internalError();
  return Response.json({ folder });
}
