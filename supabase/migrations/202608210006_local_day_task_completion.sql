-- Task completion must use the *user's* calendar day, not the database's UTC day.
--
-- `set_task_complete` previously derived its period from `current_date`, which is
-- the server's UTC date, while the client reads completions using the viewer's
-- local day. Those disagree for part of every day outside UTC (the first hour in
-- Lagos, the last seven in US Pacific), so a completion was written under one
-- period key and read under another — making a ticked task revert to undone.
--
-- The client now passes its local date; `current_date` remains the fallback so
-- older clients keep working.

create or replace function public.set_task_complete(
  task_id uuid,
  completed boolean,
  completion_note text default null,
  local_date date default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_task public.tasks;
  period date;
begin
  select * into selected_task from public.tasks where tasks.id = set_task_complete.task_id;
  if selected_task is null then
    raise exception 'Task not found';
  end if;
  if not public.is_space_member(selected_task.space_id) then
    raise exception 'Not a member of this space';
  end if;

  period := public.task_period_key(selected_task.routine, coalesce(local_date, current_date));

  if completed then
    insert into public.task_completions(task_id, space_id, user_id, period_key, note)
    values (selected_task.id, selected_task.space_id, auth.uid(), period, nullif(trim(completion_note), ''))
    on conflict (task_id, user_id, period_key)
    do update set note = excluded.note, completed_at = now();
  else
    delete from public.task_completions
    where task_completions.task_id = selected_task.id
      and user_id = auth.uid()
      and period_key = period;
  end if;
end;
$$;
