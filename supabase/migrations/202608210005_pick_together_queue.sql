-- Pair-authored prompts for future Pick Together rounds. A queued prompt is
-- consumed atomically only when a new round is created; active/completed
-- rounds keep the exact question and options they started with.

create table public.choice_game_prompts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  game_id text not null default 'tonight-pick' references public.game_catalog(id),
  question text not null check (char_length(trim(question)) between 5 and 180),
  options jsonb not null check (
    jsonb_typeof(options) = 'array'
    and jsonb_array_length(options) between 2 and 5
  ),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index choice_game_prompt_queue_idx
  on public.choice_game_prompts(space_id, game_id, used_at, created_at);

alter table public.choice_game_prompts enable row level security;

create policy choice_game_prompts_read_pair on public.choice_game_prompts
for select using (public.is_space_member(space_id));

create policy choice_game_prompts_insert_actor on public.choice_game_prompts
for insert with check (
  public.is_space_member(space_id)
  and created_by = auth.uid()
  and game_id = 'tonight-pick'
  and used_at is null
);

create policy choice_game_prompts_delete_actor on public.choice_game_prompts
for delete using (created_by = auth.uid() and used_at is null);

grant select, insert, delete on public.choice_game_prompts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'choice_game_prompts'
  ) then
    alter publication supabase_realtime add table public.choice_game_prompts;
  end if;
end $$;

create or replace function private.default_choice_options()
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select '[
    {"id":"call","label":"Voice call"},
    {"id":"watch","label":"Watch together"},
    {"id":"questions","label":"Question round"}
  ]'::jsonb;
$$;

create or replace function private.create_choice_game_session(
  target_space_id uuid,
  target_game_id text,
  creator_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  selected_prompt_id uuid;
  selected_question text;
  selected_options jsonb;
  selected_session_id uuid;
begin
  select id, question, options
  into selected_prompt_id, selected_question, selected_options
  from public.choice_game_prompts
  where space_id = target_space_id
    and game_id = target_game_id
    and used_at is null
  order by created_at
  for update skip locked
  limit 1;

  if selected_prompt_id is not null then
    update public.choice_game_prompts set used_at = now() where id = selected_prompt_id;
  else
    selected_question := 'What should we do tonight?';
    selected_options := private.default_choice_options();
  end if;

  insert into public.game_sessions(space_id, game_id, created_by, status, state)
  values (
    target_space_id,
    target_game_id,
    creator_id,
    'waiting',
    jsonb_build_object(
      'promptId', selected_prompt_id,
      'question', selected_question,
      'options', selected_options
    )
  )
  returning id into selected_session_id;

  return selected_session_id;
end;
$$;

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
    selected_session_id := private.create_choice_game_session(target_space_id, target_game_id, auth.uid());
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
    selected_session_id := private.create_choice_game_session(target_space_id, target_game_id, auth.uid());
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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
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
    'question', coalesce(game_state ->> 'question', 'What should we do tonight?'),
    'options', coalesce(game_state -> 'options', private.default_choice_options()),
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
  target_state jsonb;
  available_options jsonb;
  submitted_count integer;
  revealed jsonb;
  had_choice boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select space_id, state into target_space_id, target_state
  from public.game_sessions
  where id = target_session_id and status in ('waiting', 'active')
  for update;
  if target_space_id is null or not public.is_space_member(target_space_id) then
    raise exception 'Active game not found';
  end if;

  available_options := coalesce(target_state -> 'options', private.default_choice_options());
  if not exists (
    select 1 from jsonb_array_elements(available_options) option
    where option ->> 'id' = choice_id
      and char_length(trim(option ->> 'label')) between 1 and 80
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
    set status = 'complete',
        state = coalesce(state, '{}'::jsonb) || jsonb_build_object('revealed', revealed),
        completed_at = now()
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

revoke all on function private.default_choice_options() from public, anon, authenticated;
revoke all on function private.create_choice_game_session(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.get_or_create_choice_game(text) from public, anon;
revoke all on function public.start_choice_game_round(text) from public, anon;
revoke all on function public.get_choice_game_state(uuid) from public, anon;
revoke all on function public.submit_choice_game(uuid, text) from public, anon;
grant execute on function public.get_or_create_choice_game(text) to authenticated;
grant execute on function public.start_choice_game_round(text) to authenticated;
grant execute on function public.get_choice_game_state(uuid) to authenticated;
grant execute on function public.submit_choice_game(uuid, text) to authenticated;
