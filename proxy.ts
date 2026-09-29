import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function buildCsp(nonce: string, isDev: boolean) {
  return [
    "default-src 'self'",
    "img-src 'self' data: blob: https://*.backblazeb2.com https://s3.*.backblazeb2.com",
    "media-src 'self' https://*.backblazeb2.com https://s3.*.backblazeb2.com",
    "style-src 'self' 'unsafe-inline'", // Tailwind + Next inject inline styles
    // 'strict-dynamic' lets Next's bootstrapped scripts load further chunks
    // without each one needing its own nonce. 'unsafe-eval' is dev-only
    // (React's eval-based error stacks); production drops it.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "connect-src 'self' https://*.supabase.co https://*.backblazeb2.com https://s3.*.backblazeb2.com",
    "frame-src 'self' https://view.officeapps.live.com https://*.backblazeb2.com https://s3.*.backblazeb2.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export async function proxy(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isDev);

  // Forward the nonce to Server Components via a request header, so any
  // inline <script> you write yourself can read it via `headers()` and set
  // nonce={nonce}. Next's own framework scripts get it automatically.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          response = NextResponse.next({
            request: { headers: requestHeaders },
          });
          response.headers.set("Content-Security-Policy", csp);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Keeps the session token fresh.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
