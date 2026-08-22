-- Repair the shared Pick Together round lifecycle and add a pair-scoped
-- question queue. Both features are driven by authenticated RPCs so clients
-- never choose another Space/user ID.

create table if not exists public.custom_question_prompts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  prompt text not null check (char_length(trim(prompt)) between 5 and 240),
  used_on date,
  created_at timestamptz not null default now()
);

create index if not exists custom_question_queue_idx
  on public.custom_question_prompts(space_id, used_on, created_at);

alter table public.custom_question_prompts enable row level security;

create policy custom_questions_read_pair on public.custom_question_prompts
for select using (public.is_space_member(space_id));

create policy custom_questions_insert_actor on public.custom_question_prompts
for insert with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
  and used_on is null
);

create policy custom_questions_delete_actor on public.custom_question_prompts
for delete using (created_by = auth.uid() and used_on is null);

grant select, insert, delete on public.custom_question_prompts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'custom_question_prompts'
  ) then
    alter publication supabase_realtime add table public.custom_question_prompts;
  end if;
end $$;

create or replace function public.ensure_daily_question(target_day date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_space_id uuid;
  existing_question_id uuid;
  queued_prompt_id uuid;
  selected_prompt_id uuid;
  selected_prompt text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if target_day is null or target_day < current_date - 2 or target_day > current_date + 2 then
    raise exception 'Question day is outside the allowed local-day window';
  end if;

  select space_id into target_space_id
  from public.space_members
  where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;

  perform pg_advisory_xact_lock(hashtextextended(target_space_id::text || ':question:' || target_day::text, 0));

  select id into existing_question_id
  from public.questions
  where space_id = target_space_id and prompt_date = target_day;
  if existing_question_id is not null then return existing_question_id; end if;

  select id, prompt into queued_prompt_id, selected_prompt
  from public.custom_question_prompts
  where space_id = target_space_id and used_on is null
  order by created_at
  for update skip locked
  limit 1;

  if queued_prompt_id is not null then
    update public.custom_question_prompts
    set used_on = target_day
    where id = queued_prompt_id;
  else
    select qp.id, qp.prompt into selected_prompt_id, selected_prompt
    from public.question_prompts qp
    where qp.active
    order by (
      select max(q.prompt_date)
      from public.questions q
      where q.space_id = target_space_id and q.prompt_id = qp.id
    ) asc nulls first, qp.created_at
    limit 1;
  end if;

  if selected_prompt is null then raise exception 'No active question prompts are available'; end if;

  insert into public.questions(space_id, prompt_id, prompt, prompt_date)
  values (target_space_id, selected_prompt_id, selected_prompt, target_day)
  returning id into existing_question_id;
  return existing_question_id;
end;
$$;

revoke all on function public.ensure_daily_question(date) from public, anon;
grant execute on function public.ensure_daily_question(date) to authenticated;

update public.game_catalog
set config = '{"mode":"simultaneous-choice","options":["call","watch","questions"]}'::jsonb
where id = 'tonight-pick';

create or replace function public.get_or_create_choice_game(target_game_id text)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_space_id uuid;
  selected_session_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select space_id into target_space_id from public.space_members where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;
  if not exists (select 1 from public.game_catalog where id = target_game_id and active) then
    raise exception 'Game is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_space_id::text || ':game:' || target_game_id, 0));

  select id into selected_session_id
  from public.game_sessions
  where space_id = target_space_id
    and game_id = target_game_id
    and status in ('waiting', 'active')
  order by created_at desc
  limit 1;

  if selected_session_id is null then
    select id into selected_session_id
    from public.game_sessions
    where space_id = target_space_id
      and game_id = target_game_id
      and status = 'complete'
    order by completed_at desc nulls last, created_at desc
    limit 1;
  end if;

  if selected_session_id is null then
    insert into public.game_sessions(space_id, game_id, created_by, status)
    values (target_space_id, target_game_id, auth.uid(), 'waiting')
    returning id into selected_session_id;
  end if;
  return selected_session_id;
end;
$$;

create or replace function public.start_choice_game_round(target_game_id text)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_space_id uuid;
  selected_session_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select space_id into target_space_id from public.space_members where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;
  if not exists (select 1 from public.game_catalog where id = target_game_id and active) then
    raise exception 'Game is unavailable';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_space_id::text || ':game:' || target_game_id, 0));
  select id into selected_session_id
  from public.game_sessions
  where space_id = target_space_id
    and game_id = target_game_id
    and status in ('waiting', 'active')
  order by created_at desc
  limit 1;

  if selected_session_id is null then
    insert into public.game_sessions(space_id, game_id, created_by, status)
    values (target_space_id, target_game_id, auth.uid(), 'waiting')
    returning id into selected_session_id;
  end if;
  return selected_session_id;
end;
$$;

create or replace function public.get_choice_game_state(target_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_space_id uuid;
  session_status text;
  submitted_count integer;
  mine jsonb;
  game_state jsonb;
begin
  select space_id, status, state into target_space_id, session_status, game_state
  from public.game_sessions where id = target_session_id;
  if target_space_id is null or not public.is_space_member(target_space_id) then
    raise exception 'Game not found';
  end if;

  select count(*) into submitted_count
  from private.game_choices where session_id = target_session_id;
  select choice into mine
  from private.game_choices
  where session_id = target_session_id and user_id = auth.uid()
  limit 1;

  return jsonb_build_object(
    'sessionId', target_session_id,
    'status', session_status,
    'submittedCount', submitted_count,
    'myChoice', mine ->> 'id',
    'revealed', case when session_status = 'complete' then game_state -> 'revealed' else null end
  );
end;
$$;

create or replace function public.submit_choice_game(target_session_id uuid, choice_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  target_space_id uuid;
  target_game_id text;
  submitted_count integer;
  revealed jsonb;
  had_choice boolean;
begin
  select space_id, game_id into target_space_id, target_game_id
  from public.game_sessions
  where id = target_session_id and status in ('waiting', 'active')
  for update;
  if target_space_id is null or not public.is_space_member(target_space_id) then
    raise exception 'Active game not found';
  end if;
  if not exists (
    select 1
    from public.game_catalog gc,
      jsonb_array_elements_text(coalesce(gc.config -> 'options', '[]'::jsonb)) as options(option_id)
    where gc.id = target_game_id and options.option_id = choice_id
  ) then
    raise exception 'That choice is not available';
  end if;

  select exists (
    select 1 from private.game_choices
    where session_id = target_session_id and user_id = auth.uid()
  ) into had_choice;

  insert into private.game_choices(session_id, user_id, choice)
  values (target_session_id, auth.uid(), jsonb_build_object('id', choice_id))
  on conflict (session_id, user_id) do update
  set choice = excluded.choice, submitted_at = now();

  select count(*) into submitted_count
  from private.game_choices where session_id = target_session_id;
  if submitted_count >= 2 then
    select jsonb_object_agg(user_id::text, choice ->> 'id') into revealed
    from private.game_choices where session_id = target_session_id;
    update public.game_sessions
    set status = 'complete', state = jsonb_build_object('revealed', revealed), completed_at = now()
    where id = target_session_id;
  else
    update public.game_sessions set status = 'active' where id = target_session_id;
  end if;

  if not had_choice then
    insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
    values (
      target_space_id,
      auth.uid(),
      'game_choice',
      'game_session',
      target_session_id,
      'Your partner made a private pick',
      'Make your choice to reveal both answers.',
      '/play'
    );
  end if;
  return public.get_choice_game_state(target_session_id);
end;
$$;

-- Security-definer RPCs must not inherit PostgreSQL's default PUBLIC execute
-- privilege. Only signed-in app users can enter the pair-scoped functions.
revoke all on function public.get_or_create_choice_game(text) from public, anon;
revoke all on function public.start_choice_game_round(text) from public, anon;
revoke all on function public.get_choice_game_state(uuid) from public, anon;
revoke all on function public.submit_choice_game(uuid, text) from public, anon;
grant execute on function public.get_or_create_choice_game(text) to authenticated;
grant execute on function public.start_choice_game_round(text) to authenticated;
grant execute on function public.get_choice_game_state(uuid) to authenticated;
grant execute on function public.submit_choice_game(uuid, text) to authenticated;
