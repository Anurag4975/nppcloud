-- ============================================================================
-- MyCloud — 0001_init.sql
-- Tables, indexes, and the set_updated_at trigger.
--
-- Design notes (deliberate, see HANDOFF.md):
--   * files.object_key is permanent and filename-independent. Rename/move
--     never touches object storage.
--   * files.status: 'pending' (reserved, bytes not yet confirmed in B2),
--     'active', 'trashed'. Delete is a soft delete -> 'trashed'. Trash
--     counts toward quota (industry standard); space is reclaimed only on
--     permanent purge. This prevents delete-to-free-space-then-restore abuse.
--   * folders are also soft-deletable (status 'trashed') so a folder delete
--     is recoverable and never orphans B2 objects or silently drops quota.
--   * A user belongs to at most one household (unique on household_members.user_id).
--   * storage_providers: at most one row is_active=true (partial unique index).
--     Flipping which provider is active is how multi-provider failover works.
-- ============================================================================

-- gen_random_uuid() is built into pg14+ (Supabase runs pg15+). Fallback for
-- older/embedded Postgres where the function or pgcrypto extension is missing.
do $$
begin
  perform gen_random_uuid();
exception when undefined_function then
  create function public.gen_random_uuid() returns uuid
    language sql as $fn$ select md5(random()::text || clock_timestamp()::text)::uuid $fn$;
end
$$;

-- ---------------------------------------------------------------------------
-- Enums as check constraints (portable, no ALTER TYPE needed to extend)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- storage_providers (defined first — files references it)
-- ---------------------------------------------------------------------------
create table if not exists public.storage_providers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  provider_type text not null check (provider_type in ('b2','r2','idrive','other')),
  is_active     boolean not null default false,
  bucket        text,
  endpoint      text,
  region        text,
  created_at    timestamptz not null default now()
);
-- At most one active provider at a time.
create unique index if not exists one_active_provider
  on public.storage_providers ((is_active)) where is_active = true;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users, created by handle_new_user trigger)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  email               text not null unique,
  name                text,
  role                text not null default 'user' check (role in ('user','admin')),
  accepted_terms_at   timestamptz,
  onboarded_at        timestamptz,
  phone               text,
  phone_verified_at   timestamptz,
  last_active_at      timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table if not exists public.plans (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null unique,
  description                 text,
  quota_bytes                 bigint not null default 0 check (quota_bytes >= 0),
  price_npr                   numeric not null default 0 check (price_npr >= 0),
  billing_interval            text not null default 'month' check (billing_interval in ('month','year')),
  download_multiplier         numeric not null default 2 check (download_multiplier >= 0),
  max_file_size_bytes         bigint not null default (1::bigint*1024*1024*1024) check (max_file_size_bytes > 0),
  requires_phone_verification boolean not null default false,
  is_household                boolean not null default false,
  max_members                 int not null default 1 check (max_members >= 1),
  is_active                   boolean not null default true,
  sort_order                  int not null default 0,
  created_at                  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions (at most one active/past_due per user)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  plan_id                uuid not null references public.plans (id),
  status                 text not null default 'active'
                           check (status in ('active','past_due','expired','canceled')),
  current_period_start   timestamptz not null default now(),
  current_period_end     timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end   boolean not null default false,
  scheduled_plan_id      uuid references public.plans (id), -- downgrade waiting for period end
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create unique index if not exists one_active_subscription_per_user
  on public.subscriptions (user_id) where status in ('active','past_due');
create index if not exists subscriptions_status_period_idx
  on public.subscriptions (status, current_period_end);

-- ---------------------------------------------------------------------------
-- households + members
-- ---------------------------------------------------------------------------
create table if not exists public.households (
  id                  uuid primary key default gen_random_uuid(),
  name                text,
  owner_user_id       uuid not null references public.profiles (id) on delete cascade,
  quota_override_bytes bigint, -- optional pooled-quota override
  created_at          timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null unique references public.profiles (id) on delete cascade, -- at most one household
  role         text not null default 'member' check (role in ('owner','member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------------------
-- folders (self-referential tree, soft-deletable)
-- ---------------------------------------------------------------------------
create table if not exists public.folders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  name       text not null,
  parent_id  uuid references public.folders (id) on delete set null,
  status     text not null default 'active' check (status in ('active','trashed')),
  trashed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists folders_user_parent_status_idx
  on public.folders (user_id, parent_id, status);
create index if not exists folders_trashed_idx on public.folders (status) where status = 'trashed';

-- ---------------------------------------------------------------------------
-- files
-- ---------------------------------------------------------------------------
create table if not exists public.files (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  name                text not null,
  size_bytes          bigint not null default 0 check (size_bytes >= 0),
  mime_type           text,
  parent_id           uuid references public.folders (id) on delete set null,
  object_key          text not null unique,
  storage_provider_id uuid references public.storage_providers (id),
  status              text not null default 'pending'
                        check (status in ('pending','active','trashed')),
  checksum            text,
  trashed_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists files_user_parent_status_idx
  on public.files (user_id, parent_id, status);
create index if not exists files_status_idx on public.files (status);
create index if not exists files_pending_created_idx
  on public.files (created_at) where status = 'pending';

-- ---------------------------------------------------------------------------
-- usage (1:1 with user)
-- stored_bytes    = bytes currently occupying quota (active + trashed + pending reserved)
-- uploaded_bytes  = bytes successfully uploaded (basis for download allowance)
-- downloaded_bytes= bytes downloaded in current period (allowance = uploaded * multiplier)
-- ---------------------------------------------------------------------------
create table if not exists public.usage (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  stored_bytes     bigint not null default 0 check (stored_bytes >= 0),
  uploaded_bytes   bigint not null default 0 check (uploaded_bytes >= 0),
  downloaded_bytes bigint not null default 0 check (downloaded_bytes >= 0),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- share_links (own bandwidth budget, separate from owner's quota)
-- ---------------------------------------------------------------------------
create table if not exists public.share_links (
  id               uuid primary key default gen_random_uuid(), -- also the public token (UUIDv4 unguessable)
  file_id          uuid not null references public.files (id) on delete cascade,
  created_by       uuid not null references public.profiles (id) on delete cascade,
  max_downloads    int not null default 50 check (max_downloads > 0),
  downloads_count  int not null default 0 check (downloads_count >= 0),
  max_bytes_served bigint not null default (5::bigint*1024*1024*1024) check (max_bytes_served > 0),
  bytes_served     bigint not null default 0 check (bytes_served >= 0),
  expires_at       timestamptz,
  revoked          boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists share_links_created_by_idx on public.share_links (created_by);

-- ---------------------------------------------------------------------------
-- devices (app-level client registry; Supabase auth.sessions handles web sessions)
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  name           text,
  user_agent     text,
  last_ip        inet,
  last_active_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists devices_user_idx on public.devices (user_id);

-- ---------------------------------------------------------------------------
-- payment_events (Phase 5)
-- ---------------------------------------------------------------------------
create table if not exists public.payment_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id),
  gateway         text not null check (gateway in ('esewa','khalti','fonepay','other')),
  gateway_ref     text,
  amount_npr      numeric not null check (amount_npr >= 0),
  status          text not null default 'pending',
  payload         jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists payment_events_user_idx on public.payment_events (user_id);

-- ---------------------------------------------------------------------------
-- activity_log
-- ---------------------------------------------------------------------------
create table if not exists public.activity_log (
  id         bigserial primary key,
  user_id    uuid references public.profiles (id) on delete set null,
  action     text not null,
  metadata   jsonb,
  ip         inet,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_user_created_idx on public.activity_log (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- referrals
-- ---------------------------------------------------------------------------
create table if not exists public.referral_codes (
  code         text primary key,
  owner_user_id uuid not null references public.profiles (id) on delete cascade,
  reward_bytes bigint not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists public.referral_redemptions (
  id          uuid primary key default gen_random_uuid(),
  code        text not null references public.referral_codes (code) on delete cascade,
  redeemed_by uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (code, redeemed_by) -- one redemption per code per user
);

-- ---------------------------------------------------------------------------
-- admin_audit_log
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id             bigserial primary key,
  admin_user_id  uuid not null references public.profiles (id) on delete cascade,
  action         text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  metadata       jsonb,
  ip             inet,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_read_idx on public.notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- set_updated_at trigger (applied to tables with updated_at in 0001)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_folders_updated_at on public.folders;
create trigger trg_folders_updated_at before update on public.folders
  for each row execute function public.set_updated_at();

drop trigger if exists trg_files_updated_at on public.files;
create trigger trg_files_updated_at before update on public.files
  for each row execute function public.set_updated_at();

drop trigger if exists trg_usage_updated_at on public.usage;
create trigger trg_usage_updated_at before update on public.usage
  for each row execute function public.set_updated_at();
