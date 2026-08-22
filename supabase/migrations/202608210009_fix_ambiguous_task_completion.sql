-- Fix: ticking a 2do reverted to undone a few seconds later.
--
-- ROOT CAUSE (reproduced against this project with a real signed-in account):
-- every call to `set_task_complete` failed with
--
--   42702: column reference "task_id" is ambiguous
--
-- The function declared a parameter named `task_id`, and its INSERT used
-- `on conflict (task_id, user_id, period_key)` — inside a PL/pgSQL body that
-- name resolves to both the parameter and `task_completions.task_id`, so
-- Postgres refuses to guess. The write therefore 400'd every single time.
--
-- The client updates optimistically and only reconciles on failure, which is
-- exactly why the checkbox appeared to work and then flipped back: the tick was
-- never persisted, and the next refresh told the truth.
--
-- Two further problems are fixed here:
--
--   1. `202608210006` added a 4-argument overload with `create or replace`.
--      A differing argument list makes a NEW function rather than replacing the
--      old one, so both signatures existed. Any 3-argument call returned
--      PostgREST `PGRST203` ("could not choose the best candidate function").
--      Both are dropped so exactly one remains.
--
--   2. Parameters are renamed with a `p_` prefix so no parameter can ever
--      collide with a column name in this table again.

drop function if exists public.set_task_complete(uuid, boolean, text);
drop function if exists public.set_task_complete(uuid, boolean, text, date);

create function public.set_task_complete(
  p_task_id uuid,
  p_completed boolean,
  p_note text default null,
  p_local_date date default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_task public.tasks%rowtype;
  period date;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select * into selected_task
  from public.tasks
  where public.tasks.id = p_task_id
    and public.tasks.archived_at is null;

  if selected_task.id is null then
    raise exception 'Task not found';
  end if;
  if not public.is_space_member(selected_task.space_id) then
    raise exception 'Not a member of this space';
  end if;

  -- The day must be the *user's* calendar day, not the server's UTC day: those
  -- disagree for part of every day outside UTC, and the client reads
  -- completions back using its own local day.
  period := public.task_period_key(
    selected_task.routine,
    coalesce(p_local_date, current_date)
  );

  if p_completed then
    insert into public.task_completions as c (task_id, space_id, user_id, period_key, note)
    values (selected_task.id, selected_task.space_id, auth.uid(), period, nullif(trim(p_note), ''))
    on conflict (task_id, user_id, period_key)
    do update set note = excluded.note, completed_at = now();
  else
    delete from public.task_completions c
    where c.task_id = selected_task.id
      and c.user_id = auth.uid()
      and c.period_key = period;
  end if;
end;
$$;

revoke all on function public.set_task_complete(uuid, boolean, text, date) from anon;
grant execute on function public.set_task_complete(uuid, boolean, text, date) to authenticated;
