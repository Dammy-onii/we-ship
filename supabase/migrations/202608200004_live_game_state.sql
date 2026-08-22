insert into public.game_catalog(id, name, description, config) values
  ('tonight-pick', 'Pick together', 'Privately choose what to do tonight, then reveal when both answer.', '{"mode":"simultaneous-choice"}')
on conflict (id) do update set name = excluded.name, description = excluded.description, config = excluded.config;

create table private.game_choices (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice jsonb not null,
  submitted_at timestamptz not null default now(),
  primary key (session_id, user_id)
);
revoke all on private.game_choices from anon, authenticated;

drop policy if exists game_sessions_insert on public.game_sessions;
drop policy if exists game_sessions_update on public.game_sessions;
drop policy if exists game_sessions_delete on public.game_sessions;
drop policy if exists game_moves_insert on public.game_moves;
drop policy if exists game_moves_update on public.game_moves;
drop policy if exists game_moves_delete on public.game_moves;

create or replace function public.get_or_create_choice_game(target_game_id text)
returns uuid
language plpgsql
security definer set search_path = public, private
as $$
declare target_space_id uuid; active_session_id uuid;
begin
  select space_id into target_space_id from public.space_members where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;
  select id into active_session_id from public.game_sessions
  where space_id = target_space_id and game_id = target_game_id and status in ('waiting', 'active')
  order by created_at desc limit 1;
  if active_session_id is null then
    insert into public.game_sessions(space_id, game_id, created_by, status)
    values (target_space_id, target_game_id, auth.uid(), 'waiting') returning id into active_session_id;
  end if;
  return active_session_id;
end;
$$;

create or replace function public.get_choice_game_state(target_session_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public, private
as $$
declare target_space_id uuid; submitted_count integer; mine jsonb; game_state jsonb;
begin
  select space_id, state into target_space_id, game_state from public.game_sessions where id = target_session_id;
  if target_space_id is null or not public.is_space_member(target_space_id) then raise exception 'Game not found'; end if;
  select count(*) into submitted_count from private.game_choices where session_id = target_session_id;
  select choice into mine from private.game_choices
  where session_id = target_session_id and user_id = auth.uid() limit 1;
  return jsonb_build_object(
    'sessionId', target_session_id,
    'submittedCount', submitted_count,
    'myChoice', mine ->> 'id',
    'revealed', case when submitted_count >= 2 then game_state -> 'revealed' else null end
  );
end;
$$;

create or replace function public.submit_choice_game(target_session_id uuid, choice_id text)
returns jsonb
language plpgsql
security definer set search_path = public, private
as $$
declare target_space_id uuid; submitted_count integer; revealed jsonb;
begin
  select space_id into target_space_id from public.game_sessions where id = target_session_id and status in ('waiting', 'active');
  if target_space_id is null or not public.is_space_member(target_space_id) then raise exception 'Active game not found'; end if;
  insert into private.game_choices(session_id, user_id, choice)
  values (target_session_id, auth.uid(), jsonb_build_object('id', choice_id))
  on conflict (session_id, user_id) do update set choice = excluded.choice, submitted_at = now();

  select count(*) into submitted_count from private.game_choices where session_id = target_session_id;
  if submitted_count >= 2 then
    select jsonb_object_agg(user_id::text, choice ->> 'id') into revealed
    from private.game_choices where session_id = target_session_id;
    update public.game_sessions set status = 'complete', state = jsonb_build_object('revealed', revealed), completed_at = now() where id = target_session_id;
  else
    update public.game_sessions set status = 'active' where id = target_session_id;
  end if;
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (target_space_id, auth.uid(), 'game_choice', 'game_session', target_session_id, 'Your partner made a private pick', 'Make your choice to reveal both answers.', '/play');
  return public.get_choice_game_state(target_session_id);
end;
$$;

create or replace function public.start_turn_game(target_game_id text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare target_space_id uuid; new_session_id uuid;
begin
  select space_id into target_space_id from public.space_members where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;
  insert into public.game_sessions(space_id, game_id, created_by, status, current_turn_user_id)
  values (target_space_id, target_game_id, auth.uid(), 'active', auth.uid()) returning id into new_session_id;
  return new_session_id;
end;
$$;

create or replace function public.submit_turn_game_move(target_session_id uuid, target_move jsonb)
returns public.game_sessions
language plpgsql
security definer set search_path = public
as $$
declare selected_session public.game_sessions%rowtype; next_user_id uuid; next_move_number integer;
begin
  select * into selected_session from public.game_sessions where id = target_session_id for update;
  if selected_session.id is null or not public.is_space_member(selected_session.space_id) then raise exception 'Game not found'; end if;
  if selected_session.status <> 'active' or selected_session.current_turn_user_id <> auth.uid() then raise exception 'It is not your turn'; end if;
  select coalesce(max(move_number), 0) + 1 into next_move_number from public.game_moves where session_id = target_session_id;
  insert into public.game_moves(session_id, space_id, user_id, move_number, move)
  values (target_session_id, selected_session.space_id, auth.uid(), next_move_number, target_move);
  select user_id into next_user_id from public.space_members where space_id = selected_session.space_id and user_id <> auth.uid() limit 1;
  update public.game_sessions set current_turn_user_id = coalesce(next_user_id, auth.uid()) where id = target_session_id returning * into selected_session;
  return selected_session;
end;
$$;

grant execute on function public.get_or_create_choice_game(text) to authenticated;
grant execute on function public.get_choice_game_state(uuid) to authenticated;
grant execute on function public.submit_choice_game(uuid, text) to authenticated;
grant execute on function public.start_turn_game(text) to authenticated;
grant execute on function public.submit_turn_game_move(uuid, jsonb) to authenticated;
