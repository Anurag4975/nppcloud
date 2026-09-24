# MyCloud Web — Phase 0/1/3 Scaffold

This is a working start on the plan in `MyCloud_Web_System_Design_Plan.docx`:
schema + RLS (Phase 0), auth (Phase 1), and real upload/download against
Backblaze B2 (Phase 3), wired together. Quota checks and download-allowance
enforcement (Phase 4) are already included since they live in the same
upload/download code path.

## 1. Create a new Supabase project

Use a **new** project (not your existing deployed one) so this app's schema
stays isolated. In the Supabase dashboard:

1. New project → note the **Project URL** and the **anon public key** and
   **service_role key** (Settings → API).
2. Go to SQL Editor → paste and run `supabase/migrations/0001_init.sql`,
   then `supabase/migrations/0002_usage_rpc.sql`.
3. Authentication → Providers → make sure **Email** is enabled (magic link /
   OTP is used here — no password to manage).
4. Authentication → URL Configuration → add `http://localhost:3000/**` and
   your eventual production domain to Redirect URLs.

## 2. Create a B2 bucket for this project

1. In Backblaze, create a **private** bucket, e.g. `mycloud-prod` (or
   `mycloud-dev` for local testing).
2. Create an **Application Key** scoped to only that bucket (don't reuse a
   master key). Note the `keyID`, `applicationKey`, and the S3-compatible
   endpoint shown for your bucket's region.
3. **CORS**: the browser uploads directly to B2 via presigned URLs, so the
   bucket needs a CORS rule allowing `PUT`/`GET` from `http://localhost:3000`
   (and your prod domain later). Backblaze → Bucket Settings → CORS Rules:

   ```json
   [
     {
       "corsRuleName": "mycloud-web",
       "allowedOrigins": ["http://localhost:3000"],
       "allowedOperations": ["s3_put", "s3_get", "s3_head"],
       "allowedHeaders": ["*"],
       "maxAgeSeconds": 3600
     }
   ]
   ```

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the Supabase and B2 values from steps 1–2.

## 4. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` → redirects to `/login` → enter your email →
click the magic link → lands on `/dashboard`, where you can upload and
download a real file against your B2 bucket.

## What's already done vs. what's next

| Done | Not yet (per the phase plan) |
|---|---|
| Schema + RLS (Phase 0) | Payment gateway integration (Phase 5) |
| Email magic-link auth (Phase 1) | Rate limiting, monitoring, E2E/load tests (Phase 6) |
| File browser backed by real DB rows (Phase 2) | Folder navigation UI (API already supports `parent_id`) |
| Real upload/download via B2 presigned URLs (Phase 3) | Scheduled cleanup job for abandoned/deleted files |
| Quota + download-allowance enforcement (Phase 4) | Production deploy to Vercel + custom domain (Phase 7) |

## Why this structure matters for Windows/Mobile later

Nothing here is web-specific except the React pages. The schema, the
`object_key` convention (`users/<user_id>/objects/<file_id>`), and the
upload/download contract (`init-upload` → PUT to B2 → `complete-upload`) are
exactly what the Windows Rust client and future Flutter app will call too —
so a user who signs up here today needs zero migration when those ship.
