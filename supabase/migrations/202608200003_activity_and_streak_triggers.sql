create or replace function public.record_space_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare target_space_id uuid;
begin
  target_space_id := new.space_id;
  insert into public.streaks(space_id, count, last_active_date, grace_left)
  values (target_space_id, 1, current_date, 1)
  on conflict (space_id) do update set
    count = case
      when streaks.last_active_date = current_date then streaks.count
      when streaks.last_active_date >= current_date - 2 then streaks.count + 1
      else 1
    end,
    last_active_date = current_date,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.task_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.created_by, 'task_created', 'task', new.id, 'A new 2do was added', new.label, '/todo');
  return new;
end; $$;

create or replace function public.task_completed_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare task_label text;
begin
  select label into task_label from public.tasks where id = new.task_id;
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.user_id, 'task_completed', 'task', new.task_id, 'A 2do was completed', task_label, '/todo');
  return new;
end; $$;

create or replace function public.goodie_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.author_id, 'goodie_created', 'goodie', new.id, 'A new Goodie arrived', coalesce(new.body, 'Your partner sent ' || new.kind), '/goodies');
  return new;
end; $$;

create or replace function public.memory_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.created_by, 'memory_created', 'memory', new.id, 'A memory was added', new.title, '/memories');
  return new;
end; $$;

create or replace function public.timeline_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.created_by, 'calendar_created', 'timeline_event', new.id, 'A shared event was added', new.title, '/memories');
  return new;
end; $$;

create or replace function public.answer_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.user_id, 'question_answered', 'question', new.question_id, 'Today’s question was answered', 'Your answers may be ready to reveal.', '/play/question');
  return new;
end; $$;

create or replace function public.nudge_created_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.from_user_id, 'nudge_created', 'nudge', new.id, 'Your partner is thinking of you', null, '/notifications');
  return new;
end; $$;

create or replace function public.game_move_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity_events(space_id, actor_id, kind, entity_type, entity_id, title, body, route)
  values (new.space_id, new.user_id, 'game_move', 'game_session', new.session_id, 'Your partner made a move', 'It may be your turn.', '/play');
  return new;
end; $$;

create trigger tasks_activity after insert on public.tasks for each row execute function public.task_created_activity();
create trigger task_completions_activity after insert on public.task_completions for each row execute function public.task_completed_activity();
create trigger goodies_activity after insert on public.goodies for each row execute function public.goodie_created_activity();
create trigger memories_activity after insert on public.memories for each row execute function public.memory_created_activity();
create trigger timeline_activity after insert on public.timeline_events for each row execute function public.timeline_created_activity();
create trigger answers_activity after insert on public.question_answers for each row execute function public.answer_created_activity();
create trigger nudges_activity after insert on public.nudges for each row execute function public.nudge_created_activity();
create trigger game_moves_activity after insert on public.game_moves for each row execute function public.game_move_activity();

create trigger task_completions_streak after insert on public.task_completions for each row execute function public.record_space_activity();
create trigger goodies_streak after insert on public.goodies for each row execute function public.record_space_activity();
create trigger answers_streak after insert on public.question_answers for each row execute function public.record_space_activity();
create trigger notes_streak after insert on public.notes for each row execute function public.record_space_activity();
create trigger game_moves_streak after insert on public.game_moves for each row execute function public.record_space_activity();
