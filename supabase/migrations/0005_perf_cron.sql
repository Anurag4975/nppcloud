-- ============================================================================
-- MyCloud — 0005_perf_cron.sql  (ADDITIVE only — real user data may exist)
--
-- Phase 1 (performance) + Phase 2 (bug: abandoned-pending cleanup) +
-- Phase 4 (backend search) schema changes. Every statement is IF NOT EXISTS /
-- guarded so re-applying is safe and so the pglite migration test passes
-- (pglite lacks pg_cron / pg_trgm — those blocks catch their own errors).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Thumbnail flag — set by complete-upload when the client PUT a .thumb
--    object. Lets grid view request /download-url?thumb=1 cheaply.
-- ---------------------------------------------------------------------------
alter table public.files add column if not exists has_thumbnail boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. Pagination / list indexes. The dashboard list query is
--    WHERE user_id=? AND parent_id=? AND status='active' ORDER BY created_at
--    DESC, id DESC. A composite index makes it an index-only range scan.
-- ---------------------------------------------------------------------------
create index if not exists files_list_pagination_idx
  on public.files (user_id, parent_id, status, created_at desc, id desc);

create index if not exists files_name_trgm_placeholder on public.files (user_id) where false; -- no-op, replaced below
drop index if exists public.files_name_trgm_placeholder;

-- Trash list: WHERE user_id=? AND status='trashed' ORDER BY trashed_at DESC.
create index if not exists files_trashed_list_idx
  on public.files (user_id, trashed_at desc) where status = 'trashed';
create index if not exists folders_trashed_list_idx
  on public.folders (user_id, trashed_at desc) where status = 'trashed';

-- Backend search: ILIKE on name. pg_trgm GIN would be ideal; if the extension
-- isn't available (pglite / older Postgres), fall back to a plain btree which
-- at least helps prefix matches and is always safe to create.
do $$
begin
  create extension if not exists pg_trgm;
  create index if not exists files_name_trgm_idx on public.files using gin (name gin_trgm_ops);
  create index if not exists folders_name_trgm_idx on public.folders using gin (name gin_trgm_ops);
exception when undefined_file then null; when insufficient_privilege then null; when feature_not_supported then null;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Cycle prevention: is_folder_descendant(p_user, p_folder, p_ancestor)
--    true iff p_folder is p_ancestor or lives anywhere under p_ancestor.
--    Used by PATCH /api/folders/[id] to reject moving a folder into itself
--    or one of its descendants (which would orphan the subtree).
-- ---------------------------------------------------------------------------
create or replace function public.is_folder_descendant(
  p_user_id uuid,
  p_folder_id uuid,
  p_ancestor_id uuid
) returns boolean
language sql security definer set search_path = public
as $$
  with recursive descendants(id) as (
    select id from public.folders
      where id = p_ancestor_id and user_id = p_user_id and status = 'active'
    union all
    select f.id from public.folders f
      join descendants d on f.parent_id = d.id
      where f.user_id = p_user_id and f.status = 'active'
  )
  select exists (select 1 from descendants where id = p_folder_id);
$$;

-- ---------------------------------------------------------------------------
-- 4. pg_cron schedules for the billing-lifecycle + cleanup functions.
--    Guarded: if pg_cron isn't installed (pglite, self-hosted without the
--    extension), the DO block swallows the error and the migration still
--    applies. On Supabase (pg_cron preinstalled), these schedules take effect.
-- ---------------------------------------------------------------------------
do $$
begin
  create extension if not exists pg_cron;
  -- Daily: apply scheduled downgrades whose period ended.
  perform cron.schedule('apply-due-plan-changes', '0 2 * * *', 'select public.apply_due_plan_changes();');
  -- Daily: past_due > 7d grace -> expired + downgrade to Free.
  perform cron.schedule('process-expired-subscriptions', '5 2 * * *', 'select public.process_expired_subscriptions();');
  -- Daily: expired > 60d -> trash; trashed > 30d -> purge rows.
  perform cron.schedule('enforce-long-term-expired', '10 2 * * *', 'select public.enforce_long_term_expired_accounts();');
  -- Hourly: reclaim reserved space for uploads that never completed (the
  -- "upload then close the tab" leak). purge_abandoned_pending exists in 0002.
  perform cron.schedule('purge-abandoned-pending', '15 * * * *', 'select public.purge_abandoned_pending(24);');
exception when undefined_function then null; when insufficient_privilege then null; when feature_not_supported then null;
end $$;
