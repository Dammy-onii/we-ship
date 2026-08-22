-- Let either partner deliberately replace the automatically selected prompt
-- for their local day, but never rewrite a question after either answer exists.

create or replace function public.set_daily_question(question_prompt text, target_day date)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_space_id uuid;
  target_question_id uuid;
  clean_prompt text := trim(question_prompt);
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if clean_prompt is null or char_length(clean_prompt) < 5 or char_length(clean_prompt) > 240 then
    raise exception 'Question must be between 5 and 240 characters';
  end if;
  if target_day is null or target_day < current_date - 2 or target_day > current_date + 2 then
    raise exception 'Question day is outside the allowed local-day window';
  end if;

  select space_id into target_space_id
  from public.space_members
  where user_id = auth.uid();
  if target_space_id is null then raise exception 'Create or join a space first'; end if;

  perform pg_advisory_xact_lock(hashtextextended(target_space_id::text || ':question:' || target_day::text, 0));

  select id into target_question_id
  from public.questions
  where space_id = target_space_id and prompt_date = target_day
  for update;

  if target_question_id is not null and exists (
    select 1 from public.question_answers where question_id = target_question_id
  ) then
    raise exception 'Today''s question cannot be changed after someone answers';
  end if;

  insert into public.custom_question_prompts(space_id, created_by, prompt, used_on)
  values (target_space_id, auth.uid(), clean_prompt, target_day);

  if target_question_id is null then
    insert into public.questions(space_id, prompt_id, prompt, prompt_date)
    values (target_space_id, null, clean_prompt, target_day)
    returning id into target_question_id;
  else
    update public.questions
    set prompt_id = null, prompt = clean_prompt
    where id = target_question_id;
  end if;

  return target_question_id;
end;
$$;

revoke all on function public.set_daily_question(text, date) from public, anon;
grant execute on function public.set_daily_question(text, date) to authenticated;
