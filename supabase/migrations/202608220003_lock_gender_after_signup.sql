-- Gender is chosen at registration and is not editable afterwards.
--
-- Enforced here rather than only in the account screen: `profiles` is writable
-- by its owner through PostgREST, so a UI-only rule is not a rule at all.
-- Clearing it back to null stays allowed — that is a withdrawal of information,
-- not a change of it, and the app never offers it either way.

create or replace function public.freeze_profile_gender()
returns trigger
language plpgsql
as $$
begin
  if old.gender is not null and new.gender is distinct from old.gender then
    raise exception 'Gender cannot be changed after registration'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_freeze_gender on public.profiles;
create trigger profiles_freeze_gender
before update of gender on public.profiles
for each row execute function public.freeze_profile_gender();
