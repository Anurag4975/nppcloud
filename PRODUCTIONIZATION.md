# MyCloud — Productionization Pass (Phases 1–3)

This document explains every change made to bring the scaffold to production
quality. Nothing in the hard-constraint list was broken: one shared backend,
permanent `object_key`, direct browser↔B2 presigned uploads, server-side quota
enforcement, additive-only migrations, soft-delete trash that counts toward
quota.

## Phase 1 — Performance (fixed first, because "it's laggy")

### 1. Pagination + virtualization-friendly rendering
- `GET /api/files` is now cursor-paginated (`?cursor=<iso>:<uuid>`, default
  limit 200, max 500). Cursor is on `(created_at, id)` so it is stable even
  when files are added/removed between pages. Response includes `next_cursor`.
- Client uses `useSWRInfinite` with an `IntersectionObserver` sentinel for
  infinite scroll + a "Load more" fallback. A folder with 10k files no longer
  downloads or renders everything at once.
- Every row carries `contain: layout paint style` (`.contain-row`) so the
  browser can layout/paint each row independently — the CSS-contain
  virtualization strategy allowed by the spec.

### 2. Caching (SWR + stale-while-revalidate)
- Added `swr` (runtime dep). File list, search results, and usage all go
  through SWR, so folder navigation renders instantly from cache while
  revalidating in the background. Usage refreshes every 30s.
- Read-only API routes return `Cache-Control: private, no-store` (authenticated
  data must not hit a shared CDN); the SWR layer owns stale-while-revalidate.

### 3. Upload concurrency + isolated progress
- Old code uploaded sequentially in a for-loop. New `runWithConcurrency` pool
  in `lib/upload.ts` runs **3 uploads in parallel** with a shared queue.
- Each upload row is a `React.memo`'d `UploadJobItem` — progress ticks re-render
  only the one job, not the whole list.
- Uploads are abortable (XHR `abort()`); cancel button on in-flight jobs.
  Abandoned pending rows are reclaimed by `purge_abandoned_pending` (now
  scheduled hourly via pg_cron in migration 0005).

### 4. Bundle hygiene
- `@aws-sdk/client-s3` verified server-only (consistency test asserts it never
  appears in any `.tsx`). `next.config.js` marks it
  `serverComponentsExternalPackages` and wires `@next/bundle-analyzer`
  (`npm run analyze`).
- Admin pages render inside the shared AppShell instead of a separate layout.

### 5. Optimistic UI + skeletons
- New folder, rename, and trash are all optimistic with rollback on error.
- Trash shows an **Undo toast** (6s window) that restores the item.
- `SkeletonRows` replace spinners while the list loads.

### 6. Thumbnails (grid view)
- On upload, images get a client-side canvas-resized JPEG thumbnail (≤320px)
  PUT directly to B2 at `<object_key>.thumb` via a second presigned URL
  (`init-upload` returns `thumb_upload_url`). `complete-upload` sets
  `has_thumbnail`. Grid view fetches the tiny thumb (`?thumb=1`, does **not**
  count against download allowance) instead of full-res originals.

### 7. Database indexes (migration 0005, additive)
- `files(user_id, parent_id, status, created_at desc, id desc)` composite for
  the paginated list query.
- Partial indexes on trashed files/folders for the trash page.
- `pg_trgm` GIN indexes on `name` (guarded — falls back gracefully where the
  extension is unavailable, e.g. pglite).

## Phase 2 — Bug-fix pass + E2E smoke suite

### Playwright smoke suite (new)
- `playwright.config.ts` + `tests/e2e/smoke.spec.ts`: 12 tests covering the
  full journey (login → onboarding → dashboard → upload → download
  double-click race → share → revoke → trash+undo → restore → purge → logout
  → public share-error page → settings). Run with `npm run test:e2e` (requires
  `npx playwright install` + a test Supabase/B2 instance).

### Bugs fixed / verified
- **Abandoned-pending leak**: `purge_abandoned_pending` now scheduled hourly
  via pg_cron (0005). Was previously never scheduled.
- **Move cycle**: `PATCH /api/folders/[id]` rejects moving a folder into
  itself or any descendant via new `is_folder_descendant()` RPC (recursive
  CTE, SECURITY DEFINER, `search_path=public`).
- **Download double-click race**: download button is disabled while in flight,
  so a rapid double-click can't burn the download allowance twice. (The
  server-side `reserve_download` counter is already atomic; this is UI defense.)
- **Admin pages** now wrapped in `AppShell` — toasts, sidebar, theme toggle,
  consistent styling.
- **`/s/[id]` public route**: verified GET-only, CSRF-exempt by design
  (consistency test enforces).
- **XSS audit**: `dangerouslySetInnerHTML` exists in exactly one sanctioned
  place — `app/layout.tsx` theme bootstrap, a static string with no user input.
  Consistency test enforces no other instance.
- **TypeScript strict**: `noUnusedLocals` + `noUnusedParameters` enabled in
  `tsconfig.json`; full strict pass.
- **Onboarding**: referral self-referral silently ignored server-side —
  confirmed it does not block the form; empty name guarded by Zod + `required`.

### Security headers tightened
- HSTS added in production. CSP drops `unsafe-eval` in production builds (kept
  only for Next.js dev/HMR). `object-src 'none'`, `media-src` added.

## Phase 3 — UI/UX polish + dark mode

### Design system
- Semantic color tokens (`--bg`, `--surface`, `--surface-2/3`, `--border`,
  `--border-strong`, `--text`, `--text-muted`, `--text-faint`, `--primary`,
  `--accent`, `--danger`, `--success`, `--warning`) defined as RGB channels in
  `globals.css`. Tailwind maps them in `tailwind.config.ts` so opacity
  modifiers work. No hardcoded `slate-*` in components.
- Radius/spacing/font scales extended. Skeleton shimmer, fade/scale/slide
  animations, `prefers-reduced-motion` respected globally.

### Dark mode
- `darkMode: 'class'`. Inline render-blocking bootstrap script in `layout.tsx`
  sets the class before first paint (no FOUC). `ThemeProvider` + `ThemeToggle`
  in the UI kit; persisted to `localStorage`, falls back to system preference
  and follows system changes until the user explicitly picks.

### File list
- Fixed-column grid: `[checkbox | name flex-1 | size 5rem | modified 7rem | actions 6rem]`
  with a sortable header (name/size/modified, both directions). Text and sizes
  align in columns.
- List + grid view toggle. Grid uses thumbnails. Breadcrumb with chevrons.
- Multi-select with checkboxes + shift+click range; bulk trash.
- Inline file preview modal (image/PDF/video/audio/text via presigned URL) —
  Phase 4 feature #1 delivered early because it was cheap and high-value.

### Feedback + a11y
- Toast on every action; undo toast for trash; skeleton loading; styled empty
  states; focus-visible rings everywhere; modals are focus-trapped + ESC +
  scroll-lock; ARIA labels on icon buttons; `role="status"` on toasts; mobile
  bottom nav with ≥56px touch targets.

### Rebuilt pages
- Onboarding, login, forgot/reset password, s-error, settings, trash, shared,
  and admin all rebuilt/retouched with the UI kit and semantic tokens.

## Definition of done status
- `npm test` (migrations + security/consistency): green (28 + 13 assertions).
- `npm run build`: strict TS, noUnusedLocals — verified green.
- Playwright suite: written; requires a test infra instance to execute.
- Schema changes: additive only, tested against pglite (migration test applies
  all migrations dynamically now).
- No architecture constraint broken.

## Not done (deliberately deferred — see original prompt Phases 4–6)
- Payments (eSewa/Khalti/Fonepay), households UI, notifications bell, devices
  list, admin plan CRUD/impersonate/charts, rate limiting, Sentry, Lighthouse
  CI, bundle-size budget. These are explicitly later phases.
- B2 lifecycle rules + Cloudflare CDN in front of `/s/[id]` are infra config,
  not code.
- `react-window` true windowing: pagination + CSS contain was sufficient per
  the spec's "react-window **or** CSS contain" clause.
