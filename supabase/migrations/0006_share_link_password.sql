-- ============================================================================
-- 0006_share_link_password.sql
--
-- Share links were fully public: anyone with the link's unguessable UUID
-- could download the file, with no way for the creator to add a password.
-- This adds an optional bcrypt password on share_links (pgcrypto's crypt()),
-- a helper to set/clear it, and password enforcement inside the existing
-- redeem_share_link() RPC so the check happens in the same atomic,
-- row-locked transaction as the download-limit/bandwidth checks — never a
-- separate read-then-check step the app layer could get out of sync with.
-- ============================================================================

create extension if not exists pgcrypto;

alter table public.share_links
  add column if not exists password_hash text;

-- ---------------------------------------------------------------------------
-- set_share_link_password — hash + store (or clear) a share link's password.
-- Called by the app layer right after creating a link, or when the owner
-- edits an existing link. Ownership-checked: only the creator (or admin)
-- may set it.
-- ---------------------------------------------------------------------------
create or replace function public.set_share_link_password(
  p_link_id uuid,
  p_user_id uuid,
  p_password text -- pass null / empty string to remove password protection
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.share_links
  set password_hash = case
    when p_password is null or p_password = '' then null
    else crypt(p_password, gen_salt('bf'))
  end
  where id = p_link_id
    and (created_by = p_user_id or public.is_admin(p_user_id));

  if not found then
    raise exception 'link_not_found' using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- redeem_share_link — now password-aware. New errors:
--   link_password_required  — link has a password and none/wrong* was given
--   link_password_incorrect — a password was given but didn't match
-- (*we return link_password_required for both "none given" and "wrong
--  given" so the endpoint can't be used to test whether SOME password was
--  submitted vs which one; the app layer maps both to "show/refresh the
--  password form".)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_share_link(
  p_link_id uuid,
  p_password text default null
)
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

  if v_link.password_hash is not null then
    if p_password is null or crypt(p_password, v_link.password_hash) <> v_link.password_hash then
      raise exception 'link_password_required' using errcode = 'P0001';
    end if;
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
