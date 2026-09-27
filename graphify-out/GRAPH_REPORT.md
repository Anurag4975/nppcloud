# Graph Report - mycloud-web (2026-09-27)

## Corpus Check

- cluster-only mode — file stats not available

## Summary

- 544 nodes · 1396 edges · 45 communities (21 shown, 24 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `eb5cb7f8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- supabaseAdmin
- icons.tsx
- package.json
- 0001_init.sql
- index.ts
- 0002_rpc.sql
- consistency.test.mjs
- formatBytes
- types.ts
- supabaseServerClient
- react
- compilerOptions
- cn
- DashboardClient.tsx
- login/page.tsx
- AppShell.tsx
- FileRow.tsx
- DashboardClient
- constants.ts
- 0005_perf_cron.sql
- app/layout.tsx
- next-env.d.ts
- next.config.js
- ref_playwright_test
- public.activity_log
- public.admin_audit_log
- public.devices
- public.household_members
- public.households
- public.notifications
- public.payment_events
- public.referral_codes
- public.referral_redemptions
- public.storage_providers
- public.files
- public.folders
- public.plans
- public.profiles
- public.share_links
- public.subscriptions
- public.usage

## God Nodes (most connected - your core abstractions)

1. `cn()` - 71 edges
2. `supabaseAdmin()` - 67 edges
3. `unauthorized()` - 40 edges
4. `next` - 40 edges
5. `getAuthedUser()` - 39 edges
6. `react` - 33 edges
7. `csrfGuard()` - 29 edges
8. `internalError()` - 29 edges
9. `badRequest()` - 27 edges
10. `formatBytes()` - 24 edges

## Surprising Connections (you probably didn't know these)

- `MobileNav()` --calls--> `cn()` [EXTRACTED]
  components/dashboard/AppShell.tsx → lib/utils.ts
- `SidebarNav()` --calls--> `cn()` [EXTRACTED]
  components/dashboard/AppShell.tsx → lib/utils.ts
- `UserMenu()` --calls--> `cn()` [EXTRACTED]
  components/dashboard/AppShell.tsx → lib/utils.ts
- `GET()` --calls--> `supabaseAdmin()` [EXTRACTED]
  app/api/plans/route.ts → lib/supabase-server.ts
- `POST()` --calls--> `csrfGuard()` [EXTRACTED]
  app/api/auth/signout/route.ts → lib/csrf.ts

## Import Cycles

- None detected.

## Communities (45 total, 24 thin omitted)

### Community 0 - "supabaseAdmin"

Cohesion: 0.10
Nodes (69): GET(), PATCH(), patchSchema, GET(), iso(), count(), GET(), iso() (+61 more)

### Community 1 - "icons.tsx"

Cohesion: 0.07
Nodes (31): UploadJobItem, UploadJobItemBase(), ButtonProps, formatBytes(), Toast, ToastCtx, AlertIcon(), base() (+23 more)

### Community 2 - "package.json"

Cohesion: 0.05
Nodes (40): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, lucide-react, next, react, react-dom, @supabase/ssr (+32 more)

### Community 3 - "0001_init.sql"

Cohesion: 0.10
Nodes (36): auth.users, public.set_updated_at, activity_log_user_created_idx, devices_user_idx, files_pending_created_idx, files_status_idx, files_user_parent_status_idx, folders_trashed_idx (+28 more)

### Community 4 - "index.ts"

Cohesion: 0.13
Nodes (18): Avatar(), AVATAR_GRADIENTS, AvatarProps, hashString(), DropdownItem, DropdownMenu(), DropdownMenuProps, EmptyStateProps (+10 more)

### Community 5 - "0002_rpc.sql"

Cohesion: 0.11
Nodes (22): public.handle_new_user, on_auth_user_created, public.change_plan(), public.enforce_long_term_expired_accounts(), public.handle_new_user(), public.is_admin(), public.process_expired_subscriptions(), public.purge_abandoned_pending() (+14 more)

### Community 6 - "consistency.test.mjs"

Cohesion: 0.08
Nodes (20): @electric-sql/pglite, ref_node_fs, ref_node_path, constants, definerFuncs, leaked, mappedCodes, missingSearchPath (+12 more)

### Community 7 - "formatBytes"

Cohesion: 0.13
Nodes (17): AdminOverviewPage(), Overview, STATS, AdminUserDetailPage(), Detail, PAYMENT_BADGE, AdminUsersPage(), FILTERS (+9 more)

### Community 8 - "types.ts"

Cohesion: 0.14
Nodes (16): TrashClient(), EmptyState(), useToast(), api, ApiError, request(), ApiErrorBody, FileStatus (+8 more)

### Community 9 - "supabaseServerClient"

Cohesion: 0.19
Nodes (12): ADMIN_NAV, AdminLayout(), POST(), GET(), SAFE_NEXT_PATHS, DashboardPage(), Home(), SettingsPage() (+4 more)

### Community 10 - "react"

Cohesion: 0.18
Nodes (13): formatGB(), OnboardingPage(), Plan, Button, ButtonProps, Size, sizes, Variant (+5 more)

### Community 11 - "compilerOptions"

Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 12 - "cn"

Cohesion: 0.22
Nodes (13): EngagementData, EngagementPage(), SECTIONS, SettingsClient(), Card, CardContent, CardDescription, CardFooter (+5 more)

### Community 13 - "DashboardClient.tsx"

Cohesion: 0.17
Nodes (12): Crumb, cards, StatCards(), StatCardsProps, SORT_OPTIONS, SortKey, Toolbar(), ToolbarProps (+4 more)

### Community 14 - "login/page.tsx"

Cohesion: 0.19
Nodes (11): ForgotPasswordPage(), submit(), FEATURES, LoginPage(), handleEmailSubmit(), handleGoogle(), ResetPasswordPage(), submit() (+3 more)

### Community 15 - "AppShell.tsx"

Cohesion: 0.15
Nodes (11): MobileNav(), NAV, Profile, SidebarNav(), UserMenu(), ICONS, Toast, ToastCtx (+3 more)

### Community 16 - "FileRow.tsx"

Cohesion: 0.27
Nodes (8): FileGridCard, FileGridCardProps, FileListItemProps, FileTypeIcon(), FolderGlyph(), MIME_STYLES, FileRow, FolderRow

### Community 17 - "DashboardClient"

Cohesion: 0.22
Nodes (3): DashboardClient(), uploadFiles(), putWithProgress()

### Community 18 - "constants.ts"

Cohesion: 0.25
Nodes (7): DEFAULT_SHARE_MAX_DOWNLOADS, FILE_STATUSES, FOLDER_STATUSES, MAX_UPLOAD_NAME_LENGTH, PRESIGN_TTL_SECONDS, RPC_ERROR_MESSAGE, RPC_ERROR_STATUS

### Community 19 - "0005_perf_cron.sql"

Cohesion: 0.36
Nodes (7): files_list_pagination_idx, files_name_trgm_placeholder, files_trashed_list_idx, folders_trashed_list_idx, public.is_folder_descendant(), public.files, public.folders

### Community 21 - "next-env.d.ts"

Cohesion: 0.50
Nodes (3): next_dev_types_root_params_d, next_dev_types_routes_d, NOTE: This file should not be edited

## Knowledge Gaps

- **136 isolated node(s):** `ButtonProps`, `Toast`, `P`, `Plan`, `Size` (+131 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 205 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `icons.tsx`, `package.json`, `index.ts`, `formatBytes`, `types.ts`, `cn`, `DashboardClient.tsx`, `login/page.tsx`, `AppShell.tsx`, `FileRow.tsx`, `app/layout.tsx`?**
  _High betweenness centrality (0.182) - this node is a cross-community bridge._
- **Why does `next` connect `supabaseAdmin` to `package.json`, `formatBytes`, `supabaseServerClient`, `react`, `login/page.tsx`, `AppShell.tsx`, `s-error/page.tsx`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `@electric-sql/pglite` connect `consistency.test.mjs` to `package.json`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `ButtonProps`, `Toast`, `P` to the rest of the system?**
  _136 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `supabaseAdmin` be split into smaller, more focused modules?**
  _Cohesion score 0.09783294761203451 - nodes in this community are weakly interconnected._
- **Should `icons.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06826241134751773 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  \_Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected.\_gemini
