# MyCloud Web

Consumer cloud storage for Nepal — Google Drive/iCloud experience, paid via eSewa/Khalti/Fonepay (no dollar card needed). Next.js web client sharing one Supabase Postgres + Backblaze B2 backend with the future Windows (Rust+Dokany) and mobile clients.

## Quick start

```bash
cp .env.example .env.local   # fill in Supabase + B2 values
npm install
npm run dev                  # http://localhost:3000
npm test                     # migration + security tests (embedded Postgres, no external DB needed)
npm run build                # production build
```

## 1. Database setup (Supabase)

Run the migrations in `supabase/migrations/` in order (SQL Editor, or `supabase db push`):

1. `0001_init.sql` — 17 tables, indexes, updated-at triggers
2. `0002_rpc.sql` — all business-logic functions (quota, downloads, share links, billing lifecycle, trash)
3. `0003_rls.sql` — Row-Level Security on every table
4. `0004_seed.sql` — Free/Starter/Pro/Family plans + active B2 storage provider

Every `SECURITY DEFINER` function sets `search_path = public` (the signup-trigger bug). `change_plan()` matches `status in ('active','past_due')` and takes a `p_immediate` flag (the auto-downgrade bug). Both fixed bugs are guarded by `npm test`.

## 2. Backblaze B2

Private bucket, scoped application key. CORS rule allowing `s3_put`/`s3_get`/`s3_head` from your origin. Uploads/downloads go browser↔B2 directly via 15-minute presigned URLs — the app server never proxies bytes.

## Architecture (the non-negotiables)

- **File identity ≠ filename.** Permanent `object_key = users/<uid>/objects/<file_id>`. Rename/move is a pure DB op.
- **Quota is 100% server-side.** `reserve_upload()` locks the subscription/household row, checks phone-verification gate, max file size, household-pooled vs personal quota, parent-folder ownership, inserts a `pending` row, and reserves the space — atomically. `complete-upload` adjusts stored bytes by (real − declared), counts uploaded bytes, and re-checks quota (rolls back + deletes the B2 object if a client lied about size). Abandoned `pending` uploads are reclaimed by `purge_abandoned_pending()`.
- **Download allowance** (`uploaded_bytes × plan.download_multiplier`) enforced atomically by `reserve_download()` — no read-then-check race.
- **Share links** have their own budget (`max_downloads`, `max_bytes_served`), redeemed atomically by `redeem_share_link()` — a viral link can't drain the owner's quota or the B2 bill.
- **Trash, not delete.** Delete moves files/folders (recursively) to `status='trashed'`; trash counts toward quota (industry standard). Space is reclaimed only on permanent purge, which also deletes the B2 object.
- **Plan changes:** upgrades immediate, user downgrades scheduled to period end, system-forced downgrades (nonpayment) immediate. Missed-payment lifecycle: active → past_due (7-day grace, full access) → expired (Free) → trash after ~60 days → purge after ~30 more.
- **Households:** private per-member file spaces, pooled storage quota only.
- **Phone verification** off by default; toggle per plan with one `UPDATE plans` — no code change.

## Security

- Cookie-based auth (HttpOnly, `@supabase/ssr`) + **CSRF origin guard** on every mutating route (`lib/csrf.ts`).
- All inputs Zod-validated; SQL only via parameterized Supabase client (no injection surface).
- Sanitized error responses (`lib/errors.ts`) — raw DB errors never reach the client. RPC exception codes map to stable HTTP statuses/messages.
- RLS on every public table (defense in depth; API routes use the service role intentionally).
- Security headers in `next.config.js` (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- `npm test` includes a static check that every mutating route uses csrfGuard and no route leaks `error.message`.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/files/init-upload` | reserve_upload RPC → presigned PUT URL |
| POST | `/api/files/complete-upload` | verify B2 object → activate, adjust usage |
| GET | `/api/files?parent_id=` | list folder (active only) |
| PATCH/DELETE | `/api/files/[id]` | rename/move (validates parent ownership) / soft-delete |
| GET | `/api/files/[id]/download-url` | reserve_download RPC → presigned GET URL |
| POST/PATCH/DELETE | `/api/folders`, `/api/folders/[id]` | create/rename-move/recursive-soft-delete |
| GET | `/api/trash` | trashed items |
| PATCH/DELETE | `/api/trash/[id]?kind=file\|folder` | restore / permanent purge (deletes B2 object) |
| POST/GET/PATCH/DELETE | `/api/share-links`, `/api/share-links/[id]` | create/list/update/revoke |
| GET | `/s/[id]` | public share redemption → redirect to presigned URL |
| GET/PATCH | `/api/account` | profile read/update |
| POST | `/api/auth/signout` | server-side sign-out (clears HttpOnly cookie) |
| GET | `/api/usage`, `/api/plans`, `/api/onboarding/complete` | usage, plan catalog, onboarding |
| GET | `/api/admin/overview`, `/api/admin/users` | admin (role-gated) |

## Pages

`/login` (Google OAuth + magic link), `/forgot-password`, `/reset-password`, `/onboarding`, `/dashboard` (file browser, drag-drop multi-upload with progress, search, sort, share, rename, trash), `/shared` (link management), `/trash` (restore/purge), `/settings` (profile, plan, usage, sign out), `/admin` (overview, users).

## Tests

- `tests/migrations.test.mjs` — runs all 4 migrations against embedded Postgres (pglite) and exercises every RPC end-to-end: signup trigger, quota race, download allowance, share-link budget, trash/restore/purge, recursive folder trash, plan-change semantics, abandoned-pending purge. **28 assertions, all passing.**
- `tests/consistency.test.mjs` — static security checks: all SECURITY DEFINER functions set search_path, change_plan matches both statuses, every RPC exception code has an HTTP mapping, every mutating route uses csrfGuard, no raw error.message leaks.

## What's next (Phase 5+)

eSewa/Khalti/Fonepay webhooks → `payment_events` + `change_plan`; Cloudflare CDN in front of `/s/[id]`; `pg_cron` schedule for the billing lifecycle functions; Windows Rust client (same `init-upload`/`complete-upload` contract).
