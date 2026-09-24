-- ============================================================================
-- MyCloud — 0003_rls.sql
-- Row-Level Security on every public table. The API routes use the service
-- role (bypasses RLS), so these are defense-in-depth: even if a key leaks or
-- a client queries Supabase directly, a user can never touch another user's
-- rows. Writes to usage/subscriptions go only through SECURITY DEFINER RPCs.
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.plans               enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.folders             enable row level security;
alter table public.files               enable row level security;
alter table public.usage               enable row level security;
alter table public.share_links         enable row level security;
alter table public.devices             enable row level security;
alter table public.payment_events      enable row level security;
alter table public.activity_log        enable row level security;
alter table public.referral_codes      enable row level security;
alter table public.referral_redemptions enable row level security;
alter table public.storage_providers   enable row level security;
alter table public.admin_audit_log     enable row level security;
alter table public.notifications       enable row level security;

-- Drop existing policies with these names so the migration is idempotent.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','plans','subscriptions','households','household_members',
    'folders','files','usage','share_links','devices','payment_events',
    'activity_log','referral_codes','referral_redemptions','storage_providers',
    'admin_audit_log','notifications'
  ] loop
    execute format('drop policy if exists "%s_select" on public.%I;', t, t);
    execute format('drop policy if exists "%s_insert" on public.%I;', t, t);
    execute format('drop policy if exists "%s_update" on public.%I;', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I;', t, t);
  end loop;
end $$;

-- profiles: read/update own; admins read all. (Insert via handle_new_user trigger.)
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- plans: readable by any signed-in user (public catalog).
create policy plans_select on public.plans for select to authenticated using (true);

-- subscriptions: read own (admins all). Writes via change_plan RPC only.
create policy subscriptions_select on public.subscriptions for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- households: readable by members.
create policy households_select on public.households for select
  using (exists (select 1 from public.household_members hm
                 where hm.household_id = id and hm.user_id = auth.uid())
         or public.is_admin(auth.uid()));

-- household_members: read own membership.
create policy household_members_select on public.household_members for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- folders: full CRUD on own rows.
create policy folders_select on public.folders for select using (user_id = auth.uid());
create policy folders_insert on public.folders for insert with check (user_id = auth.uid());
create policy folders_update on public.folders for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy folders_delete on public.folders for delete using (user_id = auth.uid());

-- files: full CRUD on own rows.
create policy files_select on public.files for select using (user_id = auth.uid());
create policy files_insert on public.files for insert with check (user_id = auth.uid());
create policy files_update on public.files for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy files_delete on public.files for delete using (user_id = auth.uid());

-- usage: read own. Writes only via increment_usage/reserve_upload RPCs (no update policy).
create policy usage_select on public.usage for select using (user_id = auth.uid());

-- share_links: manage own. Public redemption goes through redeem_share_link RPC (anon granted).
create policy share_links_select on public.share_links for select using (created_by = auth.uid());
create policy share_links_insert on public.share_links for insert with check (created_by = auth.uid());
create policy share_links_update on public.share_links for update using (created_by = auth.uid()) with check (created_by = auth.uid());

-- devices: own.
create policy devices_select on public.devices for select using (user_id = auth.uid());
create policy devices_insert on public.devices for insert with check (user_id = auth.uid());
create policy devices_update on public.devices for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete on public.devices for delete using (user_id = auth.uid());

-- payment_events: read own (admins all).
create policy payment_events_select on public.payment_events for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- activity_log: read own.
create policy activity_log_select on public.activity_log for select
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

-- referral_codes: readable by authenticated (onboarding lookup).
create policy referral_codes_select on public.referral_codes for select to authenticated using (true);

-- referral_redemptions: read own.
create policy referral_redemptions_select on public.referral_redemptions for select
  using (redeemed_by = auth.uid() or public.is_admin(auth.uid()));

-- storage_providers: readable by authenticated (API picks the active one).
create policy storage_providers_select on public.storage_providers for select to authenticated using (true);

-- admin_audit_log: admins only.
create policy admin_audit_log_select on public.admin_audit_log for select
  using (public.is_admin(auth.uid()));
create policy admin_audit_log_insert on public.admin_audit_log for insert
  with check (public.is_admin(auth.uid()));

-- notifications: read/update own (mark read).
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
