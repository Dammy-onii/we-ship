-- Notify the author when someone reacts to their friend post.
--
-- Personal notifications carry their own push: an insert fires the
-- `personal_notifications_push` trigger, which posts to `dispatch-push`. So a
-- reaction only writes the row — delivery is handled.

-- Extend the kind list (migration 013's set) with the reaction kind.
alter table public.personal_notifications drop constraint if exists personal_notifications_kind_check;
alter table public.personal_notifications add constraint personal_notifications_kind_check check (kind in (
  'contact_joined', 'friend_request', 'friend_accepted', 'friend_declined',
  'friend_withdrawn', 'friend_removed', 'friend_post', 'post_reaction'
));

/*
 * Uniqueness is on (user_id, kind, source_id) via the partial index added in
 * migration 013, so `source_id` is the post. That means one reaction
 * notification per post: as more people react, it updates in place to the most
 * recent reactor and returns to unread, rather than spamming a row per tap.
 */
create or replace function public.set_post_reaction(p_post_id uuid, p_kind text)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  author uuid;
  previous text;
  reactor_name text;
  emoji text;
begin
  if p_kind not in ('love', 'laugh', 'sad', 'angry', 'dislike') then
    raise exception 'Unknown reaction %', p_kind;
  end if;

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

  -- Never notify yourself about your own reaction.
  if author = auth.uid() then
    return;
  end if;

  emoji := case p_kind
    when 'love' then '❤️'
    when 'laugh' then '😂'
    when 'sad' then '😢'
    when 'angry' then '😠'
    when 'dislike' then '👎'
  end;

  select coalesce(display_name, username, 'Someone')
  into reactor_name
  from public.profiles where id = auth.uid();

  insert into public.personal_notifications (user_id, kind, actor_id, source_id, title, body, route)
  values (
    author,
    'post_reaction',
    auth.uid(),
    p_post_id,
    reactor_name || ' reacted to your post',
    emoji || '  on the friend board',
    'weship://friend-spotlight?item=' || p_post_id
  )
  on conflict (user_id, kind, source_id) where source_id is not null do update
    set actor_id = excluded.actor_id,
        title = excluded.title,
        body = excluded.body,
        route = excluded.route,
        read_at = null,
        created_at = now();
end $$;

revoke all on function public.set_post_reaction(uuid, text) from public, anon;
grant execute on function public.set_post_reaction(uuid, text) to authenticated;
