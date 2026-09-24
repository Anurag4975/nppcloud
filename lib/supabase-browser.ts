import { createBrowserClient } from "@supabase/ssr";

// Browser client: respects RLS, used for auth (login/signup/session)
// and any direct reads the UI wants to do (file lists, usage widget).
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
