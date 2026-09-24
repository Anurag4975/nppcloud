import { createClient } from "@supabase/supabase-js";

// Service-role client: server-only, never imported into client components.
// Used by API routes after we've already verified the caller's identity
// via their JWT (see getUserFromRequest in lib/auth.ts).
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
