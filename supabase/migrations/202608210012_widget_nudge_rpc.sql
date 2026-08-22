-- Lets a widget button send a nudge without the app running.
--
-- A widget has no Supabase client and no notion of which Space the user is in,
-- so it posts a kind and nothing else; the server resolves the Space from the
-- caller. That also means a widget can never write into someone else's Space.

create or replace function public.send_widget_nudge(p_kind text default 'thinkingOfYou')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  caller_space uuid;
  chosen_kind text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  chosen_kind := coalesce(nullif(trim(p_kind), ''), 'thinkingOfYou');
  if chosen_kind not in ('thinkingOfYou', 'heart', 'hug', 'goodnight') then
    raise exception 'Unknown nudge';
  end if;

  select space_id into caller_space
  from public.space_members
  where user_id = auth.uid()
  limit 1;

  if caller_space is null then
    raise exception 'Join a shared space first';
  end if;

  -- Rate limited so a stuck widget button cannot spam a partner's notifications.
  if exists (
    select 1 from public.nudges
    where space_id = caller_space
      and from_user_id = auth.uid()
      and created_at > now() - interval '30 seconds'
  ) then
    return;
  end if;

  insert into public.nudges(space_id, from_user_id, kind)
  values (caller_space, auth.uid(), chosen_kind);
end;
$$;

revoke all on function public.send_widget_nudge(text) from anon;
grant execute on function public.send_widget_nudge(text) to authenticated;
