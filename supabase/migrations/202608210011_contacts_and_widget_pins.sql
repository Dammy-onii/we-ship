-- Contact matching, personal notifications, and partner-pinned widget content.
--
-- Parameters are `p_`-prefixed throughout. A parameter sharing a name with a
-- column silently breaks PL/pgSQL DML with `42702: column reference is
-- ambiguous` — that defect shipped once already in `set_task_complete`.

-- ---------------------------------------------------------------------------
-- 1. Contact matching, without ever storing a contact list.
-- ---------------------------------------------------------------------------
--
-- Both sides hash with the same app-wide salt: the device hashes the emails and
-- phone numbers in its address book, the server derives each user's own hash
-- from their *verified* auth email. Only hashes ever leave the device, and the
-- server never sees a raw contact.
--
-- Deriving the identity hash server-side (rather than trusting the client to
-- upload it) is what stops someone claiming another person's identity hash and
-- harvesting whoever has them in their contacts.

-- Public, not secret. It stops a stolen `contact_hashes` table from being
-- checked against a generic precomputed rainbow table; it is not a substitute
-- for the fact that an email is low-entropy and remains brute-forceable by
-- anyone who has this file. Documented rather than pretended otherwise.
create or replace function private.contact_salt()
returns text language sql immutable as $$ select 'weship.contact.v1' $$;

create or replace function private.contact_hash(p_identifier text)
returns text
language sql
immutable
as $$
  select case
    when coalesce(trim(p_identifier), '') = '' then null
    -- Builtin `sha256(bytea)` rather than pgcrypto's `digest`: Supabase
    -- installs pgcrypto into the `extensions` schema, so `digest` is not
    -- resolvable from an unqualified immutable function.
    else encode(
      sha256(convert_to(lower(trim(p_identifier)) || private.contact_salt(), 'UTF8')),
      'hex'
    )
  end;
$$;

alter table public.profiles
  add column if not exists identity_hash text;

create index if not exists profiles_identity_hash_idx
  on public.profiles(identity_hash)
  where identity_hash is not null;

-- Hashes of identifiers found in the caller's address book.
create table if not exists public.contact_hashes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  hash text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, hash)
);

create index if not exists contact_hashes_hash_idx on public.contact_hashes(hash);

alter table public.contact_hashes enable row level security;

-- Your uploaded hashes are yours alone. Matching happens inside a security
-- definer RPC, so no policy needs to expose anyone else's rows.
drop policy if exists contact_hashes_self on public.contact_hashes;
create policy contact_hashes_self on public.contact_hashes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. Personal notifications (no Space involved).
-- ---------------------------------------------------------------------------
--
-- `activity_events.space_id` is NOT NULL and its RLS is `is_space_member`, so
-- it cannot carry "someone in your contacts joined" or a friend request —
-- neither belongs to a Space, and a null space_id would make the row invisible.

create table if not exists public.personal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('contact_joined', 'friend_request', 'friend_accepted')),
  actor_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  route text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, kind, actor_id)
);

create index if not exists personal_notifications_inbox_idx
  on public.personal_notifications(user_id, created_at desc);

alter table public.personal_notifications enable row level security;

drop policy if exists personal_notifications_self on public.personal_notifications;
create policy personal_notifications_self on public.personal_notifications for select
  using (user_id = auth.uid());

drop policy if exists personal_notifications_self_update on public.personal_notifications;
create policy personal_notifications_self_update on public.personal_notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists personal_notifications_self_delete on public.personal_notifications;
create policy personal_notifications_self_delete on public.personal_notifications for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Seed the identity hash, and tell contacts when someone joins.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, private
as $$
declare
  chosen_name text;
  chosen_gender text;
  chosen_hash text;
begin
  chosen_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1),
    'Weship member'
  );
  chosen_gender := nullif(new.raw_user_meta_data ->> 'gender', '');
  if chosen_gender is not null
     and chosen_gender not in ('woman', 'man', 'non_binary', 'prefer_not_to_say') then
    chosen_gender := null;
  end if;
  chosen_hash := private.contact_hash(new.email);

  insert into public.profiles(id, display_name, username, gender, identity_hash)
  values (
    new.id,
    chosen_name,
    public.suggest_username(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), chosen_name)),
    chosen_gender,
    chosen_hash
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill existing accounts.
update public.profiles p
set identity_hash = private.contact_hash(u.email)
from auth.users u
where u.id = p.id and p.identity_hash is null;

/**
 * Notifies everyone who already had this person in their contacts.
 *
 * Fires on the profile row rather than on `auth.users` so it runs after the
 * identity hash exists.
 */
create or replace function public.notify_contacts_of_join()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.identity_hash is null then return new; end if;

  insert into public.personal_notifications(user_id, kind, actor_id, title, body, route)
  select
    c.user_id,
    'contact_joined',
    new.id,
    new.display_name || ' just joined Weship',
    'They are in your contacts. Send a friend request to see their board.',
    '/friends'
  from public.contact_hashes c
  where c.hash = new.identity_hash
    and c.user_id <> new.id
  on conflict (user_id, kind, actor_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_notify_contacts on public.profiles;
create trigger profiles_notify_contacts
after insert on public.profiles
for each row execute function public.notify_contacts_of_join();

-- ---------------------------------------------------------------------------
-- 4. Contact RPCs.
-- ---------------------------------------------------------------------------

/** Replaces the caller's uploaded contact hashes with `p_hashes`. */
create or replace function public.sync_contact_hashes(p_hashes text[])
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  saved integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  delete from public.contact_hashes where user_id = auth.uid();

  insert into public.contact_hashes(user_id, hash)
  select auth.uid(), h
  from unnest(coalesce(p_hashes, array[]::text[])) as h
  where h ~ '^[0-9a-f]{64}$'
  on conflict do nothing;

  get diagnostics saved = row_count;
  return saved;
end;
$$;

/** People already on Weship whose identifier appears in the caller's contacts. */
create or replace function public.find_contacts_on_weship()
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  friend_status text
)
language sql
stable
security definer set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    case
      when f.id is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requester_id = auth.uid() then 'outgoing'
      else 'incoming'
    end as friend_status
  from public.contact_hashes c
  join public.profiles p on p.identity_hash = c.hash
  left join public.friendships f
    on (f.requester_id = auth.uid() and f.addressee_id = p.id)
    or (f.addressee_id = auth.uid() and f.requester_id = p.id)
  where c.user_id = auth.uid()
    and p.id <> auth.uid()
  order by p.display_name;
$$;

-- ---------------------------------------------------------------------------
-- 5. Partner-pinned widget content.
-- ---------------------------------------------------------------------------

create table if not exists public.widget_pins (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('photo', 'note')),
  body text,
  preview_path text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

-- One live pin per person, so a partner replaces rather than stacks.
create unique index if not exists widget_pins_one_per_target
  on public.widget_pins(space_id, target_user_id);

alter table public.widget_pins enable row level security;

drop policy if exists widget_pins_read_pair on public.widget_pins;
create policy widget_pins_read_pair on public.widget_pins for select
  using (public.is_space_member(space_id));

drop policy if exists widget_pins_write_actor on public.widget_pins;
create policy widget_pins_write_actor on public.widget_pins for all
  using (pinned_by = auth.uid() and public.is_space_member(space_id))
  with check (pinned_by = auth.uid() and public.is_space_member(space_id));

revoke all on function public.sync_contact_hashes(text[]) from anon;
grant execute on function public.sync_contact_hashes(text[]) to authenticated;
revoke all on function public.find_contacts_on_weship() from anon;
grant execute on function public.find_contacts_on_weship() to authenticated;
revoke all on function private.contact_hash(text) from anon, authenticated;
revoke all on function private.contact_salt() from anon, authenticated;
