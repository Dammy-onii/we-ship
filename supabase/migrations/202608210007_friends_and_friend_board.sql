-- Friends: a second, independent connection graph alongside the pair Space.
--
-- Deliberately separate from `spaces`/`space_members`. A user has at most one
-- Space (see `one_active_space_per_user`) but may have many friends, and
-- friendship must work for users who have not paired at all. Nothing here
-- touches pairing.

-- ---------------------------------------------------------------------------
-- 1. Usernames — the handle people are searched by.
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists username text;

-- Case-insensitive uniqueness without requiring the citext extension.
create unique index if not exists profiles_username_unique
  on public.profiles(lower(username))
  where username is not null;

alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_.]{3,24}$');

/**
 * A free username derived from `preferred`.
 *
 * Strips anything outside the allowed alphabet, pads short stems, then appends
 * a counter until the name is unused. Used by backfill and by signup.
 */
create or replace function public.suggest_username(preferred text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  stem text;
  candidate text;
  suffix integer := 0;
begin
  stem := lower(regexp_replace(coalesce(preferred, ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(stem) < 3 then stem := stem || 'friend'; end if;
  stem := left(stem, 20);
  candidate := stem;
  while exists (select 1 from public.profiles where lower(username) = candidate) loop
    suffix := suffix + 1;
    candidate := left(stem, 20) || suffix::text;
  end loop;
  return candidate;
end;
$$;

-- Backfill one at a time so `suggest_username` sees each row it just claimed.
do $$
declare row_id uuid; row_name text;
begin
  for row_id, row_name in
    select id, display_name from public.profiles where username is null order by created_at
  loop
    update public.profiles set username = public.suggest_username(row_name) where id = row_id;
  end loop;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1),
    'Weship member'
  );
  insert into public.profiles(id, display_name, username)
  values (
    new.id,
    chosen_name,
    public.suggest_username(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), chosen_name))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

/** Claims a username for the signed-in user, or fails with a readable reason. */
create or replace function public.set_username(new_username text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  normalized text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  normalized := lower(trim(coalesce(new_username, '')));
  if normalized !~ '^[a-z0-9_.]{3,24}$' then
    raise exception 'Usernames are 3-24 characters, using letters, numbers, dots or underscores';
  end if;
  if exists (
    select 1 from public.profiles where lower(username) = normalized and id <> auth.uid()
  ) then
    raise exception 'That username is taken';
  end if;
  update public.profiles set username = normalized where id = auth.uid();
  return normalized;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. The friendship graph.
-- ---------------------------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendship_not_self check (requester_id <> addressee_id)
);

-- One row per pair regardless of who asked first, so a crossing request cannot
-- create two competing edges.
create unique index if not exists friendships_pair_unique
  on public.friendships(least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create index if not exists friendships_addressee_idx
  on public.friendships(addressee_id, status);
create index if not exists friendships_requester_idx
  on public.friendships(requester_id, status);

/**
 * True when an accepted friendship exists between the caller and `target_user_id`.
 *
 * SECURITY DEFINER so it can be used inside the `friend_posts` and `profiles`
 * policies without those policies recursing back through `friendships` RLS.
 */
create or replace function public.is_friend(target_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = auth.uid() and addressee_id = target_user_id)
        or (addressee_id = auth.uid() and requester_id = target_user_id))
  );
$$;

/** Accepted *or* pending — enough of a link to be allowed to see a profile. */
create or replace function public.has_friend_link(target_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where (requester_id = auth.uid() and addressee_id = target_user_id)
       or (addressee_id = auth.uid() and requester_id = target_user_id)
  );
$$;

alter table public.friendships enable row level security;

drop policy if exists friendships_read_own on public.friendships;
create policy friendships_read_own on public.friendships for select
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- You may only ever create a request in your own name.
drop policy if exists friendships_insert_self on public.friendships;
create policy friendships_insert_self on public.friendships for insert
  with check (requester_id = auth.uid() and addressee_id <> auth.uid());

-- Accepting goes through `accept_friend_request` rather than a table UPDATE
-- policy: a bare policy would also let the addressee rewrite `requester_id`
-- and forge who asked. No UPDATE policy is defined, so direct updates fail.
create or replace function public.accept_friend_request(request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.friendships
  set status = 'accepted', responded_at = now()
  where id = request_id and addressee_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'That friend request is no longer waiting for you';
  end if;
end;
$$;

revoke all on function public.accept_friend_request(uuid) from anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

-- Either side may withdraw, decline, or unfriend.
drop policy if exists friendships_delete_either on public.friendships;
create policy friendships_delete_either on public.friendships for delete
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Profiles were readable only by a Space partner. Friends — and people whose
-- request is still pending, whose profile you need in order to decide — must be
-- readable too. Replaces `profiles_read_pair`.
drop policy if exists profiles_read_pair on public.profiles;
drop policy if exists profiles_read_connected on public.profiles;
create policy profiles_read_connected on public.profiles for select
  using (public.shares_space_with(id) or public.has_friend_link(id));

-- ---------------------------------------------------------------------------
-- 3. The friend board.
-- ---------------------------------------------------------------------------

create table if not exists public.friend_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('photo', 'voice', 'note')),
  body text,
  storage_path text,
  mime_type text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create index if not exists friend_posts_author_recent_idx
  on public.friend_posts(author_id, created_at desc);

alter table public.friend_posts enable row level security;

drop policy if exists friend_posts_read_friends on public.friend_posts;
create policy friend_posts_read_friends on public.friend_posts for select
  using (author_id = auth.uid() or public.is_friend(author_id));

drop policy if exists friend_posts_insert_author on public.friend_posts;
create policy friend_posts_insert_author on public.friend_posts for insert
  with check (author_id = auth.uid());

drop policy if exists friend_posts_delete_author on public.friend_posts;
create policy friend_posts_delete_author on public.friend_posts for delete
  using (author_id = auth.uid());

-- Friend-board media is a *view* surface, so it stores a compact preview in
-- Supabase rather than routing through the Drive pipeline (which is
-- space-scoped and would not resolve for a friend).
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('friend-media', 'friend-media', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'audio/m4a', 'audio/mp4', 'audio/aac'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path shape is `<author_id>/<uuid>.<ext>` — the first segment is the owner.
drop policy if exists friend_media_read on storage.objects;
create policy friend_media_read on storage.objects for select using (
  bucket_id = 'friend-media'
  and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.is_friend(public.storage_space_id(name))
  )
);
drop policy if exists friend_media_insert on storage.objects;
create policy friend_media_insert on storage.objects for insert with check (
  bucket_id = 'friend-media' and split_part(name, '/', 1) = auth.uid()::text
);
drop policy if exists friend_media_delete on storage.objects;
create policy friend_media_delete on storage.objects for delete using (
  bucket_id = 'friend-media' and split_part(name, '/', 1) = auth.uid()::text
);

-- ---------------------------------------------------------------------------
-- 4. Search.
-- ---------------------------------------------------------------------------

/**
 * Finds people by username or display name.
 *
 * SECURITY DEFINER on purpose: `profiles` RLS only exposes people you are
 * already connected to, but search must reach strangers. It therefore returns
 * a deliberately narrow projection — never email, timezone, or space.
 */
create or replace function public.search_people(query text, result_limit integer default 20)
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
  from public.profiles p
  left join public.friendships f
    on (f.requester_id = auth.uid() and f.addressee_id = p.id)
    or (f.addressee_id = auth.uid() and f.requester_id = p.id)
  where auth.uid() is not null
    and p.id <> auth.uid()
    and char_length(trim(coalesce(query, ''))) >= 2
    and (
      lower(p.username) like lower(trim(query)) || '%'
      or lower(p.display_name) like '%' || lower(trim(query)) || '%'
    )
  order by
    (lower(p.username) = lower(trim(query))) desc,
    (lower(p.username) like lower(trim(query)) || '%') desc,
    p.display_name
  limit least(greatest(coalesce(result_limit, 20), 1), 50);
$$;

revoke all on function public.search_people(text, integer) from anon;
grant execute on function public.search_people(text, integer) to authenticated;
revoke all on function public.set_username(text) from anon;
grant execute on function public.set_username(text) to authenticated;
revoke all on function public.suggest_username(text) from anon, authenticated;
