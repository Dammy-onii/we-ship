-- Supabase installs pgcrypto in the `extensions` schema. The original pairing
-- RPC pinned its search path to `public`, so unqualified gen_random_bytes()
-- failed and rolled the whole space-creation transaction back.

create or replace function public.create_pair_space(space_name text default 'Our space')
returns table(space_id uuid, invite_code text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_space_id uuid;
  new_code text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'You already belong to a space';
  end if;

  insert into public.spaces(name, created_by)
  values (coalesce(nullif(trim(space_name), ''), 'Our space'), auth.uid())
  returning id into new_space_id;

  insert into public.space_members(space_id, user_id, role)
  values (new_space_id, auth.uid(), 'owner');
  insert into public.streaks(space_id) values (new_space_id);
  insert into public.widget_preferences(user_id, space_id) values (auth.uid(), new_space_id);

  loop
    new_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
    begin
      insert into public.space_invites(space_id, code, created_by)
      values (new_space_id, new_code, auth.uid());
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  insert into public.questions(space_id, prompt_id, prompt, prompt_date)
  select new_space_id, id, prompt, current_date
  from public.question_prompts where active order by created_at limit 1;

  return query select new_space_id, new_code;
end;
$$;

revoke all on function public.create_pair_space(text) from public, anon;
grant execute on function public.create_pair_space(text) to authenticated;

-- The adjacent pairing RPC is also security-definer; tighten its inherited
-- execute privilege while this pairing path is being repaired.
revoke all on function public.join_pair_space(text) from public, anon;
grant execute on function public.join_pair_space(text) to authenticated;
