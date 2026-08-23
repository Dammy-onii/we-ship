-- Friend profile detail
--
-- The friend list previously offered a native action sheet carrying only a name
-- and a handle. Opening a friend now opens a page, which needs a little more
-- than the friend graph's narrow projection: whether they are paired with
-- someone, how they describe their gender, and when the two of you connected.
--
-- Exposed through a SECURITY DEFINER function rather than widened RLS: profile
-- RLS deliberately hides most columns from anyone who is not you, and pairing
-- lives in `space_members`, which a friend has no business selecting directly.

create or replace function public.get_friend_profile(target uuid)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  gender text,
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
    exists (
      -- Paired means sharing a space with someone else, not merely having one.
      select 1
      from public.space_members mine
      join public.space_members theirs
        on theirs.space_id = mine.space_id and theirs.user_id <> mine.user_id
      where mine.user_id = p.id
    ) as paired,
    f.created_at as friends_since
  from public.profiles p
  join public.friendships f
    on f.status = 'accepted'
   and (
     (f.requester_id = auth.uid() and f.addressee_id = p.id)
     or (f.addressee_id = auth.uid() and f.requester_id = p.id)
   )
  where p.id = target;
$$;

revoke all on function public.get_friend_profile(uuid) from public, anon;
grant execute on function public.get_friend_profile(uuid) to authenticated;
