-- One-off cleanup: drop the answered daily-question history built up in testing.
--
-- Written as a migration because `supabase db push` is the only way the CLI
-- sends SQL to the remote database — there is no `db execute`.
--
-- Safe to replay and safe on a fresh database: it resolves the space through
-- one account, so anywhere that account does not exist it matches nothing.
--
-- Today's question is kept so the app has something to show. `question_answers`
-- goes with it via `on delete cascade`. Streaks are stored rather than derived
-- from answers, so the streak count is unaffected.

do $$
declare
  target_space uuid;
  removed integer;
begin
  select m.space_id
  into target_space
  from public.space_members m
  join auth.users u on u.id = m.user_id
  where lower(u.email) = lower('damilolaoni15@gmail.com')
  limit 1;

  if target_space is null then
    raise exception 'No space found for that account — nothing was changed.';
  end if;

  delete from public.questions
  where space_id = target_space
    and prompt_date < current_date;
  get diagnostics removed = row_count;

  update public.custom_question_prompts
  set used_on = null
  where space_id = target_space
    and used_on is not null;

  raise notice 'Cleared % answered question(s).', removed;
end $$;
