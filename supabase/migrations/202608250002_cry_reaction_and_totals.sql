-- Two fixes: a sixth reaction (😭), and lifetime totals that actually count.

-- ------------------------------------------------------- sixth kind

-- 'cry' joins the set everywhere the five were checked.
alter table public.post_reactions drop constraint if exists post_reactions_kind_check;
alter table public.post_reactions add constraint post_reactions_kind_check
  check (kind in ('love', 'laugh', 'sad', 'angry', 'cry', 'dislike'));

alter table public.profile_reaction_totals drop constraint if exists profile_reaction_totals_kind_check;
alter table public.profile_reaction_totals add constraint profile_reaction_totals_kind_check
  check (kind in ('love', 'laugh', 'sad', 'angry', 'cry', 'dislike'));

-- ------------------------------------------------ lifetime totals

/**
 * Your lifetime reaction totals.
 *
 * Reads `profile_reaction_totals`, the durable table maintained by
 * `set_post_reaction` — NOT the live `post_reactions`, which is purged with its
 * posts after two days. The previous version counted the live table and so
 * reported zero once posts aged out (and, it turned out, showed nothing even
 * while posts were fresh). Yours alone: it takes no argument and filters on
 * `auth.uid()`, so no one can total another person up.
 */
create or replace function public.my_reaction_totals()
returns table (kind text, total bigint)
language sql
stable
security definer set search_path = public, pg_temp
as $$
  select t.kind, t.total
  from public.profile_reaction_totals t
  where t.user_id = auth.uid() and t.total > 0;
$$;

revoke all on function public.my_reaction_totals() from public, anon;
grant execute on function public.my_reaction_totals() to authenticated;

-- set_post_reaction gains the 'cry' branch in its validation and emoji map.
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
  if p_kind not in ('love', 'laugh', 'sad', 'angry', 'cry', 'dislike') then
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

  if author = auth.uid() then
    return;
  end if;

  emoji := case p_kind
    when 'love' then '❤️'
    when 'laugh' then '😂'
    when 'sad' then '😢'
    when 'angry' then '😠'
    when 'cry' then '😭'
    when 'dislike' then '👎'
  end;

  select coalesce(display_name, username, 'Someone')
  into reactor_name
  from public.profiles where id = auth.uid();

  insert into public.personal_notifications (user_id, kind, actor_id, source_id, title, body, route)
  values (
    author, 'post_reaction', auth.uid(), p_post_id,
    reactor_name || ' reacted to your post',
    emoji || '  on the friend board',
    'weship://friend-spotlight?item=' || p_post_id
  )
  on conflict (user_id, kind, source_id) where source_id is not null do update
    set actor_id = excluded.actor_id, title = excluded.title, body = excluded.body,
        route = excluded.route, read_at = null, created_at = now();
end $$;

revoke all on function public.set_post_reaction(uuid, text) from public, anon;
grant execute on function public.set_post_reaction(uuid, text) to authenticated;

-- Backfill: rebuild totals from any reactions that exist now, so the fix shows
-- immediately rather than only counting reactions made from here on.
insert into public.profile_reaction_totals (user_id, kind, total)
select p.author_id, r.kind, count(*)
from public.post_reactions r
join public.friend_posts p on p.id = r.post_id
group by p.author_id, r.kind
on conflict (user_id, kind) do update set total = excluded.total;
