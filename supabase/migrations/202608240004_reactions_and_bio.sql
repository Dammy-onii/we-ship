-- Reactions on friend-board posts, and a public bio on every profile.

-- ---------------------------------------------------------------- bio

alter table public.profiles
  add column if not exists bio text;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 200);

-- ---------------------------------------------------------- reactions

/**
 * One reaction per person per post.
 *
 * The primary key is (post_id, user_id) rather than a surrogate id, which makes
 * "change my reaction" an upsert and "react twice" impossible. Someone who taps
 * love and then laugh has laughed; they have not done both.
 *
 * These rows are as ephemeral as the posts they hang off — the cascade clears
 * them when the two-day purge removes a post. The durable record lives in
 * `profile_reaction_totals` below.
 */
create table if not exists public.post_reactions (
  post_id uuid not null references public.friend_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('love', 'laugh', 'sad', 'angry', 'dislike')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reactions_post_idx on public.post_reactions(post_id);

alter table public.post_reactions enable row level security;

/*
 * Readable exactly when the post is readable.
 *
 * Mirroring the post's visibility rather than inventing a second rule: a
 * reaction is a fact about a post, so anyone who cannot see the post must not
 * be able to count its reactions. The `friend_posts` select policy already
 * enforces friendship and the two-day lifetime, so referencing it inherits both.
 */
drop policy if exists post_reactions_read on public.post_reactions;
create policy post_reactions_read on public.post_reactions for select
  using (exists (select 1 from public.friend_posts p where p.id = post_id));

-- Writes go through the RPCs below, which also keep the totals honest.
drop policy if exists post_reactions_write_own on public.post_reactions;
drop policy if exists post_reactions_update_own on public.post_reactions;
drop policy if exists post_reactions_delete_own on public.post_reactions;

-- ------------------------------------------------------- durable totals

/**
 * Lifetime reactions received, per person per kind.
 *
 * Kept apart from `post_reactions` on purpose. Posts are deleted after two
 * days and take their reactions with them, so totalling the live table would
 * report almost nothing and would fall to zero every couple of days. The post
 * is ephemeral; the fact that people responded to it is not.
 *
 * Maintained only by the two functions below — never by a trigger on
 * `post_reactions`, because a trigger cannot tell "the author's post expired"
 * apart from "someone took their reaction back", and only the second should
 * ever reduce the total.
 */
create table if not exists public.profile_reaction_totals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('love', 'laugh', 'sad', 'angry', 'dislike')),
  total bigint not null default 0 check (total >= 0),
  primary key (user_id, kind)
);

alter table public.profile_reaction_totals enable row level security;

-- Yours alone. Another person's totals are not readable at any offset.
drop policy if exists profile_reaction_totals_read_own on public.profile_reaction_totals;
create policy profile_reaction_totals_read_own on public.profile_reaction_totals for select
  using (user_id = auth.uid());

/**
 * Set (or change) your reaction to a post.
 *
 * SECURITY DEFINER so it can adjust the author's totals, which the author alone
 * may read. It still checks the caller may see the post first, so this cannot
 * be used to react to something you were never shown.
 */
create or replace function public.set_post_reaction(p_post_id uuid, p_kind text)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  author uuid;
  previous text;
begin
  if p_kind not in ('love', 'laugh', 'sad', 'angry', 'dislike') then
    raise exception 'Unknown reaction %', p_kind;
  end if;

  -- Runs as the definer, so visibility is checked explicitly rather than left
  -- to the policy that would otherwise have applied.
  select p.author_id into author
  from public.friend_posts p
  where p.id = p_post_id
    and p.created_at > now() - public.friend_post_ttl()
    and (p.author_id = auth.uid() or public.is_friend(p.author_id));

  if author is null then
    raise exception 'That post is not available.';
  end if;

  select r.kind into previous
  from public.post_reactions r
  where r.post_id = p_post_id and r.user_id = auth.uid();

  if previous is not distinct from p_kind then
    return;
  end if;

  insert into public.post_reactions (post_id, user_id, kind)
  values (p_post_id, auth.uid(), p_kind)
  on conflict (post_id, user_id) do update set kind = excluded.kind, created_at = now();

  if previous is not null then
    update public.profile_reaction_totals
    set total = greatest(total - 1, 0)
    where user_id = author and kind = previous;
  end if;

  insert into public.profile_reaction_totals (user_id, kind, total)
  values (author, p_kind, 1)
  on conflict (user_id, kind) do update set total = public.profile_reaction_totals.total + 1;
end $$;

/** Take your reaction back. */
create or replace function public.clear_post_reaction(p_post_id uuid)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  author uuid;
  previous text;
begin
  select p.author_id into author from public.friend_posts p where p.id = p_post_id;
  if author is null then
    return;
  end if;

  delete from public.post_reactions
  where post_id = p_post_id and user_id = auth.uid()
  returning kind into previous;

  if previous is not null then
    update public.profile_reaction_totals
    set total = greatest(total - 1, 0)
    where user_id = author and kind = previous;
  end if;
end $$;

revoke all on function public.set_post_reaction(uuid, text) from public, anon;
revoke all on function public.clear_post_reaction(uuid) from public, anon;
grant execute on function public.set_post_reaction(uuid, text) to authenticated;
grant execute on function public.clear_post_reaction(uuid) to authenticated;

-- ------------------------------------------------------------ profile

/**
 * A profile as another person may see it.
 *
 * Extends the friend lookup with the bio, and no longer requires friendship:
 * name, avatar and bio are what someone needs in order to decide whether to
 * send a request. Posts are deliberately not here — those stay behind the
 * `friend_posts` policy, which is friends-only.
 */
-- Dropped first: `create or replace` cannot change a function's return type,
-- and this one gains a `bio` column.
drop function if exists public.get_friend_profile(uuid);

create function public.get_friend_profile(target uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  gender text,
  bio text,
  paired boolean,
  friends_since timestamptz
)
language sql
stable
security definer set search_path = public, pg_temp
as $$
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    p.gender,
    p.bio,
    exists (
      -- Paired means sharing a space with someone else, not merely having one.
      select 1
      from public.space_members mine
      join public.space_members theirs
        on theirs.space_id = mine.space_id and theirs.user_id <> mine.user_id
      where mine.user_id = p.id
    ),
    (
      select f.responded_at
      from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = p.id)
          or (f.addressee_id = auth.uid() and f.requester_id = p.id))
      limit 1
    )
  from public.profiles p
  where p.id = target;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
