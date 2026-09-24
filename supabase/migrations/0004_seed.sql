-- ============================================================================
-- MyCloud — 0004_seed.sql
-- Idempotent seed data. Run after 0001–0003.
-- Paid plans exist in the catalog but show "coming soon" in the UI until
-- Phase 5 (eSewa/Khalti/Fonepay) is wired up.
-- ============================================================================

-- Plans ---------------------------------------------------------------------
-- Cast the first operand to bigint so the whole multiplication chain stays
-- bigint (int4 would overflow at 2 TB before the final ::bigint is reached).
insert into public.plans
  (name, description, quota_bytes, price_npr, billing_interval, download_multiplier,
   max_file_size_bytes, requires_phone_verification, is_household, max_members, is_active, sort_order)
values
  ('Free',    '15 GB — forever.',               15::bigint*1024*1024*1024,    0,   'month', 2, 1::bigint*1024*1024*1024,  false, false, 1, true, 0),
  ('Starter', '100 GB — for phone backups.',    100::bigint*1024*1024*1024,  149,  'month', 3, 2::bigint*1024*1024*1024,  false, false, 1, true, 1),
  ('Pro',     '1 TB — for creators.',           1::bigint*1024*1024*1024*1024, 499, 'month', 5, 5::bigint*1024*1024*1024, false, false, 1, true, 2),
  ('Family',  '2 TB pooled — up to 6 members.', 2::bigint*1024*1024*1024*1024, 799, 'month', 5, 5::bigint*1024*1024*1024, false, true,  6, true, 3)
on conflict (name) do nothing;

-- Storage provider: Backblaze B2 active by default. Flip is_active to another
-- row to fail over to R2 / IDrive e2 with zero code change.
insert into public.storage_providers (name, provider_type, is_active, bucket, endpoint, region)
values ('Backblaze B2 (default)', 'b2', true, 'mycloud-prod', 'https://s3.us-west-002.backblazeb2.com', 'us-west-002')
on conflict do nothing;

-- Ensure exactly one active provider (the partial unique index enforces it;
-- if seed ran twice with different names, deactivate extras).
update public.storage_providers set is_active = false
  where is_active and id <> (select id from public.storage_providers where is_active limit 1);
