-- ============================================================================
-- MyCloud — 0002_rpc.sql
-- All server-side business logic. Every function is SECURITY DEFINER with
-- SET search_path = public (the #1 fixed bug — without it Supabase's auth
-- service, which has an empty search_path, can't resolve table names).
--
-- Quota/download enforcement is never trusted to the client: reserve_upload,
-- reserve_download, and redeem_share_link all take row locks and raise
-- exceptions atomically. Error strings are stable codes (mapped to HTTP
-- statuses in the API layer) — never raw internal details.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- is_admin — helper used by RLS policies
-- ---------------------------------------------------------------------------
create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = p_user_id and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- handle_new_user — fires on auth.users insert. Creates profile + usage row +
-- Free subscription idempotently. (Free plan is seeded in 0004_seed.sql.)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_free_plan_id uuid;
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;

  insert into public.usage (user_id) values (new.id)
  on conflict (user_id) do nothing;

  select id into v_free_plan_id from public.plans
    where is_active and not is_household and price_npr = 0
    order by sort_order limit 1;

  if v_free_plan_id is not null then
    insert into public.subscriptions (user_id, plan_id, status)
    select new.id, v_free_plan_id, 'active'
    where not exists (
      select 1 from public.subscriptions
      where user_id = new.id and status in ('active','past_due')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- increment_usage — atomic counter update. GREATEST(...,0) guards against
-- negative counters from buggy callers.
-- ---------------------------------------------------------------------------
create or replace function public.increment_usage(
  p_user_id uuid,
  p_stored_delta bigint,
  p_uploaded_delta bigint,
  p_downloaded_delta bigint
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.usage set
    stored_bytes     = greatest(stored_bytes     + coalesce(p_stored_delta,0),     0),
    uploaded_bytes   = greatest(uploaded_bytes   + coalesce(p_uploaded_delta,0),   0),
    downloaded_bytes = greatest(downloaded_bytes + coalesce(p_downloaded_delta,0), 0)
  where user_id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_upload — atomic quota check + pending file insert + space reserve.
-- Locks the subscription row (and household row when applicable) so two
-- concurrent uploads can't both pass. stored_bytes is incremented HERE
-- (reservation); complete-upload later adjusts by (realSize - reserved) and
-- increments uploaded_bytes. Abandoned pending rows are reclaimed by
-- purge_abandoned_pending().
--
-- Raises: no_active_plan, phone_not_verified, file_too_large,
--         quota_exceeded, invalid_parent
-- ---------------------------------------------------------------------------
create or replace function public.reserve_upload(
  p_user_id uuid,
  p_name text,
  p_size bigint,
  p_mime_type text,
  p_parent_id uuid,
  p_object_key text,
  p_storage_provider_id uuid,
  p_file_id uuid
) returns public.files
language plpgsql security definer set search_path = public
as $$
declare
  v_sub          public.subscriptions%rowtype;
  v_plan         public.plans%rowtype;
  v_profile      public.profiles%rowtype;
  v_household_id uuid;
  v_owner_id     uuid;
  v_used         bigint;
  v_quota        bigint;
  v_parent_ok    boolean;
  rec            public.files%rowtype;
begin
  -- 1. Active subscription + plan (locked — serializes concurrent quota checks)
  select s.* into v_sub from public.subscriptions s
    where s.user_id = p_user_id and s.status in ('active','past_due')
    for update of s;
  if not found then
    raise exception 'no_active_plan' using errcode = 'P0001';
  end if;

  select * into v_plan from public.plans where id = v_sub.plan_id;
  if not found then
    raise exception 'no_active_plan' using errcode = 'P0001';
  end if;

  -- 2. Phone-verification gate (off by default — toggle per plan, no code change)
  select * into v_profile from public.profiles where id = p_user_id;
  if v_plan.requires_phone_verification and v_profile.phone_verified_at is null then
    raise exception 'phone_not_verified' using errcode = 'P0001';
  end if;

  -- 3. Max file size
  if p_size > v_plan.max_file_size_bytes then
    raise exception 'file_too_large' using errcode = 'P0001';
  end if;

  -- 4. Quota: household-pooled if member, else personal.
  select hm.household_id, h.owner_user_id into v_household_id, v_owner_id
    from public.household_members hm join public.households h on h.id = hm.household_id
    where hm.user_id = p_user_id;

  if v_household_id is not null then
    perform 1 from public.households where id = v_household_id for update;
    select coalesce(sum(u.stored_bytes), 0) into v_used
      from public.household_members hm join public.usage u on u.user_id = hm.user_id
      where hm.household_id = v_household_id;
    v_quota := coalesce(
      (select quota_override_bytes from public.households where id = v_household_id),
      (select p.quota_bytes from public.subscriptions s join public.plans p on p.id = s.plan_id
         where s.user_id = v_owner_id and s.status in ('active','past_due') limit 1),
      v_plan.quota_bytes
    );
  else
    select stored_bytes into v_used from public.usage where user_id = p_user_id for update;
    v_quota := v_plan.quota_bytes;
  end if;

  if v_used + p_size > v_quota then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;

  -- 5. Validate parent folder ownership (prevents orphaning files in another
  --    user's folder — a data-integrity bug, not just a UX issue).
  if p_parent_id is not null then
    select exists (
      select 1 from public.folders
      where id = p_parent_id and user_id = p_user_id and status = 'active'
    ) into v_parent_ok;
    if not v_parent_ok then
      raise exception 'invalid_parent' using errcode = 'P0001';
    end if;
  end if;

  -- 6. Insert pending file + reserve the space.
  insert into public.files
    (id, user_id, name, size_bytes, mime_type, parent_id, object_key, storage_provider_id, status)
  values
    (p_file_id, p_user_id, p_name, p_size, p_mime_type, p_parent_id, p_object_key, p_storage_provider_id, 'pending')
  returning * into rec;

  update public.usage set stored_bytes = stored_bytes + p_size where user_id = p_user_id;

  return rec;
end;
$$;

-- ---------------------------------------------------------------------------
-- reserve_download — atomic download-allowance check + counter increment.
-- Replaces the old read-then-check race (two concurrent downloads both pass).
-- Raises: file_not_found, download_limit_exceeded
-- ---------------------------------------------------------------------------
create or replace function public.reserve_download(p_user_id uuid, p_file_id uuid)
returns table (object_key text, name text, size_bytes bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_file       public.files%rowtype;
  v_multiplier numeric;
  v_usage      public.usage%rowtype;
begin
  select * into v_usage from public.usage where user_id = p_user_id for update;
  if not found then
    raise exception 'file_not_found' using errcode = 'P0001';
  end if;

  select * into v_file from public.files
    where id = p_file_id and user_id = p_user_id and status = 'active';
  if not found then
    raise exception 'file_not_found' using errcode = 'P0001';
  end if;

  select coalesce(p.download_multiplier, 2) into v_multiplier
    from public.subscriptions s join public.plans p on p.id = s.plan_id
    where s.user_id = p_user_id and s.status in ('active','past_due') limit 1;

  if v_usage.downloaded_bytes + v_file.size_bytes > v_usage.uploaded_bytes * v_multiplier then
    raise exception 'download_limit_exceeded' using errcode = 'P0001';
  end if;

  update public.usage set downloaded_bytes = downloaded_bytes + v_file.size_bytes
    where user_id = p_user_id;

  return query select v_file.object_key, v_file.name, v_file.size_bytes;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_share_link — atomic share-link redemption. The link's budget
-- (max_downloads / max_bytes_served) is entirely separate from the owner's
-- personal quota. Raises: link_not_found, link_revoked, link_expired,
-- link_download_limit_reached, link_bandwidth_limit_reached, file_not_found
-- ---------------------------------------------------------------------------
create or replace function public.redeem_share_link(p_link_id uuid)
returns table (object_key text, name text, size_bytes bigint)
language plpgsql security definer set search_path = public
as $$
declare
  v_link public.share_links%rowtype;
  v_file public.files%rowtype;
begin
  select * into v_link from public.share_links where id = p_link_id for update;
  if not found then
    raise exception 'link_not_found' using errcode = 'P0001';
  end if;
  if v_link.revoked then
    raise exception 'link_revoked' using errcode = 'P0001';
  end if;
  if v_link.expires_at is not null and v_link.expires_at < now() then
    raise exception 'link_expired' using errcode = 'P0001';
  end if;

  select * into v_file from public.files where id = v_link.file_id and status = 'active';
  if not found then
    raise exception 'file_not_found' using errcode = 'P0001';
  end if;

  if v_link.downloads_count >= v_link.max_downloads then
    raise exception 'link_download_limit_reached' using errcode = 'P0001';
  end if;
  if v_link.bytes_served + v_file.size_bytes > v_link.max_bytes_served then
    raise exception 'link_bandwidth_limit_reached' using errcode = 'P0001';
  end if;

  update public.share_links
    set downloads_count = downloads_count + 1,
        bytes_served    = bytes_served + v_file.size_bytes
    where id = v_link.id;

  return query select v_file.object_key, v_file.name, v_file.size_bytes;
end;
$$;

-- ---------------------------------------------------------------------------
-- change_plan — upgrades apply immediately; user-initiated downgrades are
-- scheduled for period end. System-forced downgrades (p_immediate=true, from
-- the nonpayment flow) apply instantly. Matches status in ('active','past_due')
-- — the #2 fixed bug (matching only 'active' broke auto-downgrade).
-- ---------------------------------------------------------------------------
create or replace function public.change_plan(
  p_user_id uuid,
  p_plan_id uuid,
  p_immediate boolean default false
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_sub        public.subscriptions%rowtype;
  v_old_price  numeric;
  v_new_price  numeric;
begin
  select * into v_sub from public.subscriptions
    where user_id = p_user_id and status in ('active','past_due') for update;
  if not found then return; end if;

  select price_npr into v_old_price from public.plans where id = v_sub.plan_id;
  select price_npr into v_new_price from public.plans where id = p_plan_id;

  if p_immediate then
    -- System-forced (e.g. nonpayment downgrade): reset billing period now.
    update public.subscriptions set
      plan_id = p_plan_id, scheduled_plan_id = null,
      cancel_at_period_end = false, status = 'active',
      current_period_start = now(), current_period_end = now() + interval '30 days'
    where id = v_sub.id;
  elsif v_new_price > v_old_price then
    -- Upgrade: apply now, keep current period end.
    update public.subscriptions set
      plan_id = p_plan_id, scheduled_plan_id = null, cancel_at_period_end = false
    where id = v_sub.id;
  else
    -- User-initiated downgrade: wait for period end.
    update public.subscriptions set
      scheduled_plan_id = p_plan_id, cancel_at_period_end = true
    where id = v_sub.id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- apply_due_plan_changes — cron: apply scheduled downgrades whose period ended.
-- ---------------------------------------------------------------------------
create or replace function public.apply_due_plan_changes()
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.subscriptions s set
    plan_id = s.scheduled_plan_id,
    scheduled_plan_id = null,
    cancel_at_period_end = false,
    status = 'active',
    current_period_start = now(),
    current_period_end = now() + interval '30 days'
  where s.cancel_at_period_end
    and s.scheduled_plan_id is not null
    and s.current_period_end <= now()
    and s.status = 'active';
end;
$$;

-- ---------------------------------------------------------------------------
-- process_expired_subscriptions — cron: past_due beyond 7-day grace -> expired
-- + immediate downgrade to Free. Data is never deleted here.
-- ---------------------------------------------------------------------------
create or replace function public.process_expired_subscriptions()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_free_id uuid;
begin
  select id into v_free_id from public.plans
    where is_active and not is_household and price_npr = 0 limit 1;

  update public.subscriptions set status = 'expired'
    where status = 'past_due' and current_period_end < now() - interval '7 days';

  if v_free_id is not null then
    update public.subscriptions set
      plan_id = v_free_id, scheduled_plan_id = null, cancel_at_period_end = false,
      status = 'expired', current_period_start = now(), current_period_end = now() + interval '30 days'
    where status = 'expired' and plan_id <> v_free_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- enforce_long_term_expired_accounts — cron (simplified):
--   expired > 60 days and still over Free quota -> files move to trash
--   trashed > 30 days -> rows purged (B2 objects cleaned by separate job/lifecycle)
-- Total ~90 days from missed payment to data loss (OneDrive-style).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_long_term_expired_accounts()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_free_quota bigint;
begin
  select quota_bytes into v_free_quota from public.plans
    where is_active and not is_household and price_npr = 0 limit 1;

  update public.files f set status = 'trashed', trashed_at = now()
    from public.subscriptions s join public.usage u on u.user_id = s.user_id
    where s.status = 'expired'
      and s.current_period_end < now() - interval '60 days'
      and u.stored_bytes > coalesce(v_free_quota, 0)
      and f.user_id = s.user_id
      and f.status = 'active';

  update public.folders f set status = 'trashed', trashed_at = now()
    from public.subscriptions s
    where s.status = 'expired'
      and s.current_period_end < now() - interval '60 days'
      and f.user_id = s.user_id
      and f.status = 'active';

  delete from public.files where status = 'trashed' and trashed_at < now() - interval '30 days';
  delete from public.folders where status = 'trashed' and trashed_at < now() - interval '30 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- purge_abandoned_pending — cron: reclaim reserved space for uploads that
-- never completed (client crashed, tab closed, etc.). Default 24h window.
-- ---------------------------------------------------------------------------
create or replace function public.purge_abandoned_pending(p_older_than_hours int default 24)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_cutoff timestamptz := now() - (p_older_than_hours::text || ' hours')::interval;
begin
  update public.usage u set stored_bytes = greatest(u.stored_bytes - pending.sz, 0)
    from (
      select user_id, sum(size_bytes) as sz
      from public.files where status = 'pending' and created_at < v_cutoff group by user_id
    ) pending
    where u.user_id = pending.user_id;

  delete from public.files where status = 'pending' and created_at < v_cutoff;
end;
$$;

-- ---------------------------------------------------------------------------
-- Trash / restore / purge helpers. Trash does NOT reclaim quota (trash counts
-- toward storage, industry standard) — only permanent purge does.
-- ---------------------------------------------------------------------------
create or replace function public.trash_file(p_user_id uuid, p_file_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.files set status = 'trashed', trashed_at = now()
    where id = p_file_id and user_id = p_user_id and status = 'active';
end;
$$;

create or replace function public.restore_file(p_user_id uuid, p_file_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.files set status = 'active', trashed_at = null
    where id = p_file_id and user_id = p_user_id and status = 'trashed';
end;
$$;

create or replace function public.trash_folder_recursive(p_user_id uuid, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.folders where id = p_folder_id and user_id = p_user_id) then
    return;
  end if;

  with recursive tree as (
    select id from public.folders where id = p_folder_id
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id where f.user_id = p_user_id
  )
  update public.folders set status = 'trashed', trashed_at = now()
    where id in (select id from tree) and user_id = p_user_id;

  with recursive tree as (
    select id from public.folders where id = p_folder_id
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id where f.user_id = p_user_id
  )
  update public.files set status = 'trashed', trashed_at = now()
    where parent_id in (select id from tree) and user_id = p_user_id and status = 'active';
end;
$$;

create or replace function public.restore_folder_recursive(p_user_id uuid, p_folder_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.folders where id = p_folder_id and user_id = p_user_id) then
    return;
  end if;

  with recursive tree as (
    select id from public.folders where id = p_folder_id
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id where f.user_id = p_user_id
  )
  update public.folders set status = 'active', trashed_at = null
    where id in (select id from tree) and user_id = p_user_id;

  with recursive tree as (
    select id from public.folders where id = p_folder_id
    union all
    select f.id from public.folders f join tree t on f.parent_id = t.id where f.user_id = p_user_id
  )
  update public.files set status = 'active', trashed_at = null
    where parent_id in (select id from tree) and user_id = p_user_id and status = 'trashed';
end;
$$;

-- Permanent purge: deletes the row, reclaims quota, returns object_key so the
-- API can delete the B2 object. Returns null if nothing to purge.
create or replace function public.purge_file_permanent(p_user_id uuid, p_file_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_key  text;
  v_size bigint;
begin
  select object_key, size_bytes into v_key, v_size
    from public.files where id = p_file_id and user_id = p_user_id and status = 'trashed';
  if not found then return null; end if;

  delete from public.files where id = p_file_id;
  update public.usage set stored_bytes = greatest(stored_bytes - v_size, 0) where user_id = p_user_id;
  return v_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: user-facing RPCs callable by authenticated users (service-role
-- bypasses RLS/grants anyway; these matter only if called from the client).
-- Conditional so the migration runs on bare Postgres without the
-- authenticated/anon roles (Supabase always has them).
-- ---------------------------------------------------------------------------
do $$
declare
  r text;
  fns text[] := array[
    'public.is_admin(uuid)',
    'public.increment_usage(uuid,bigint,bigint,bigint)',
    'public.reserve_upload(uuid,text,bigint,text,uuid,text,uuid,uuid)',
    'public.reserve_download(uuid,uuid)',
    'public.redeem_share_link(uuid)',
    'public.trash_file(uuid,uuid)',
    'public.restore_file(uuid,uuid)',
    'public.trash_folder_recursive(uuid,uuid)',
    'public.restore_folder_recursive(uuid,uuid)',
    'public.purge_file_permanent(uuid,uuid)'
  ];
begin
  foreach r in array fns loop
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('grant execute on function %s to authenticated;', r);
    end if;
    if r = 'public.redeem_share_link(uuid)' and exists (select 1 from pg_roles where rolname = 'anon') then
      execute 'grant execute on function public.redeem_share_link(uuid) to anon;';
    end if;
  end loop;
end
$$;
