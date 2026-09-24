# MyCloud — Project Handoff / Continuation Prompt

Paste this entire document as context when starting a new AI session to continue this project. It contains the full business context, architecture decisions, current database schema, verified bug fixes, and next steps.

---

## 1. What this project is

**MyCloud** is a consumer cloud storage platform for Nepal (like Google Drive/iCloud, but paying via local wallets — eSewa, Khalti, Fonepay — instead of requiring a foreign "Dollar Card," which most Nepalese users can't get). Target users: Android phone owners hitting Google Photos' 15GB free limit, students, content creators, and people needing a digital document vault.

The project has **two clients sharing one backend**:
1. **Web app** (building now) — Next.js, the focus of current work
2. **Windows desktop client** (designed, not yet built) — a virtual drive (`MyCloud (N:)`) using Rust + Dokany, so files appear local in Explorer but live in the cloud

Both clients (and a future mobile app) call the **same Supabase database and Backblaze B2 bucket** — this is a hard architectural rule. Nothing web-specific should leak into the shared backend; anything backend-related (schema, business logic, quota rules) must work identically for all future clients.

## 2. Confirmed tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Auth | Supabase Auth — **Google OAuth is the primary sign-in method** (decided, not yet implemented) |
| Database | Supabase Postgres + Row-Level Security |
| Object storage | Backblaze B2 (S3-compatible), with a multi-provider failover design (can switch to IDrive e2 / Cloudflare R2 by flipping one DB row) |
| CDN | Cloudflare, planned for public share-link downloads (not yet implemented) — caches repeat downloads at the edge so a viral link doesn't repeatedly hit B2 egress cost |
| Payments | eSewa, Khalti, Fonepay (Phase 5, not yet built) |
| Hosting | Vercel (frontend), API routes are Next.js API routes (not a separate Node service — decided to keep it simple) |

## 3. Core architectural decisions (all deliberate, don't relitigate without reason)

- **File identity is decoupled from filename.** Every file has a permanent `object_key` (`users/<user_id>/objects/<file_id>`) independent of its display name — rename/move is a pure database operation, never touches B2.
- **All uploads/downloads use short-lived presigned URLs** issued by the API, going **directly** browser-to-B2 — the app server never proxies file bytes, so bandwidth cost doesn't scale API server load.
- **Quota and download-allowance enforcement is 100% server-side**, inside a single atomic Postgres function (`reserve_upload`), never trusted to the client.
- **Race-condition-safe**: `reserve_upload` uses `SELECT ... FOR UPDATE` to lock the relevant usage/household row before checking quota, preventing two simultaneous uploads from both passing the check (verified with a real concurrent test).
- **Download rule**: users can download at most `download_multiplier` (default 2×) times what they've uploaded — configurable per plan, enforced server-side.
- **Share links have their own bandwidth budget**, separate from the owner's personal quota (`max_downloads`, `max_bytes_served`) — protects against a link going viral and draining the B2 bill. Meant to be served through Cloudflare CDN caching (not yet built).
- **Households (family plans)**: separate private file spaces per member (NOT a shared visible drive — this was a deliberate choice, matching Google One/Apple Family, for privacy and simplicity), but one pooled storage quota. `files`/`folders` stay per-user; only the quota check looks at the household's pooled totals when a user belongs to one.
- **Plan changes**: upgrades apply immediately; downgrades are scheduled for the end of the current billing period (never punish a user mid-cycle for their own choice).
- **Missed payments**: `active` → `past_due` (grace period, full access continues) → `expired` (auto-downgraded to Free, but data is never deleted) → after ~60 more days still over the Free quota and unpaid → files move to trash → purged ~30 days later. Total ~90 days from missed payment to actual data loss, matching industry norms (OneDrive-style).
- **Multi-account abuse defense**: phone verification (`phone_verified_at`) is built into the schema but **OFF by default** (`plans.requires_phone_verification = false`) to avoid SMS API costs before they're justified. Toggle per-plan later once real abuse shows up in usage data — no code change needed, just one `UPDATE plans SET requires_phone_verification = true`.
- **Trash/soft-delete**: deleted files aren't removed instantly (`status = 'trashed'`), giving a recovery window before permanent purge.

## 4. Two real bugs already found and fixed (do not reintroduce)

1. **`SECURITY DEFINER` functions need `set search_path = public` explicitly.** Without it, Supabase's internal auth service (which has a different/empty search_path) can't resolve unqualified table names when the signup trigger fires, causing "Database error creating new user." All 9 functions in the current schema have this fix applied and verified.
2. **`change_plan()` must match `status in ('active','past_due')`, not just `'active'`.** The auto-downgrade-after-nonpayment flow (`process_expired_subscriptions`) calls `change_plan` on `past_due` rows, and needs a `p_immediate boolean` flag so system-forced downgrades apply instantly while user-requested downgrades still wait for period end.

Both were caught by actually installing Postgres locally and reproducing the exact failure condition (including simulating Supabase's low-privilege auth-service role with an empty search_path) — this testing approach is worth repeating for any new function added later, rather than assuming correctness.

## 5. Current database state — VERIFIED LIVE as of last check

A Supabase project exists and has been confirmed (via direct introspection queries) to have:
- All 17 tables: `profiles`, `plans`, `subscriptions`, `households`, `household_members`, `folders`, `files`, `usage`, `share_links`, `devices`, `payment_events`, `activity_log`, `referral_codes`, `referral_redemptions`, `storage_providers`, `admin_audit_log`, `notifications`
- All 9 functions present with `search_path=public` correctly set: `handle_new_user`, `change_plan`, `apply_due_plan_changes`, `process_expired_subscriptions`, `enforce_long_term_expired_accounts`, `reserve_upload`, `increment_usage`, `is_admin`
- All 15 RLS policies active
- `profiles` has: `id, email, name, role, accepted_terms_at, onboarded_at, phone, phone_verified_at, last_active_at, created_at`
- `plans` has: `..., requires_phone_verification (default false)`
- One admin user exists (`role = 'admin'`) via manual `UPDATE profiles SET role = 'admin' WHERE email = '...'`
- **End-to-end tested and confirmed working**: signup trigger creates profile+usage+Free subscription correctly; `reserve_upload` successfully creates a file record with phone verification correctly bypassed (toggle off by default)

**The full, current, correct schema SQL is available and was last pasted in full in this conversation — if starting fresh, ask the user to paste it back, or reconstruct from the column/function/policy list above.**

## 6. What's already scaffolded in code (Next.js project, not yet fully matching current schema)

An initial Next.js project was built and **verified to type-check and build successfully** with:
- `lib/supabase-server.ts`, `lib/supabase-browser.ts`, `lib/auth.ts` (JWT verification helper), `lib/b2.ts` (presigned URL helpers)
- API routes: `POST /api/files/init-upload`, `POST /api/files/complete-upload`, `GET /api/files/[id]/download-url`, `GET/PATCH/DELETE /api/files/[id]`, `GET /api/files`, `GET /api/usage`
- Pages: `/login` (email magic-link, needs to become Google OAuth), `/dashboard` (basic file browser + upload UI)
- `app/page.tsx` was rebuilt as an auth-callback handler (consumes Supabase's `#access_token=...` redirect fragment) — **this works for magic links but was designed before Google OAuth was decided on; needs revisiting**

**Important**: this code was written against an *earlier* version of the schema — it does NOT yet reflect: share links, households, admin role checks, the `reserve_upload`/`increment_usage` RPC-based flow (it may still have inline quota-check logic that should be replaced with calls to `reserve_upload`), phone verification, or onboarding. **The API routes need to be rewritten to match the current schema before continuing**, particularly `init-upload` should now just call the `reserve_upload()` Postgres function instead of doing manual quota checks in TypeScript.

## 7. Immediate next steps (in order)

1. **Rewrite the API routes** to match the current schema — especially replace manual quota-check logic in `init-upload` with a call to `reserve_upload()`, and add share-link and folder endpoints that don't exist yet.
2. **Set up Google OAuth** — Google Cloud Console OAuth client, then Supabase Authentication → Providers → Google.
3. **Build `/auth/callback`** properly, handling OAuth, magic-link, and invite redirect types in one place.
4. **Build `/onboarding`** — collects name, ToS acceptance, optional referral code, shows plan cards (paid plans = "coming soon" until Phase 5 payments exist). Gate `/dashboard` behind `profiles.onboarded_at is not null`.
5. Continue through the phases already scoped: real folder navigation UI, share link creation/redemption UI, admin dashboard (metrics scoped in full in this conversation — total users, revenue, storage cost-vs-revenue, DAU/WAU/MAU, plan editing, etc.), then payments (Phase 5).

## 8. Working style established in this project (please continue it)

- **Test before handing off SQL** — don't just write a migration and assume it's correct; actually run it (a local Postgres instance was used throughout this project specifically to catch bugs before the user ran anything in production).
- **Diff against what's actually live** before writing new migrations, rather than assuming — the user has run partial patches at various points, and reality has drifted from any single file more than once. Ask for an introspection query result before prescribing changes to an existing project.
- **Explain reasoning, not just output** — the user wants to understand *why*, not just receive working code, and has been actively pushing back on things that weren't fully thought through (e.g., SMS cost concerns, multi-account abuse, mid-cycle plan changes) — keep treating those pushes as valid engineering review, not friction.
- Prefer additive, backward-compatible schema changes (`ALTER TABLE ADD COLUMN IF NOT EXISTS`) over dropping/recreating, since real user data may exist.
