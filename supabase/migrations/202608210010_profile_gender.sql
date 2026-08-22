-- Gender is collected at sign-up. Optional by design: the column is nullable
-- and 'prefer_not_to_say' is a first-class choice, so nobody is forced to
-- answer and existing profiles stay valid.

alter table public.profiles
  add column if not exists gender text;

alter table public.profiles
  drop constraint if exists profiles_gender_check;
alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('woman', 'man', 'non_binary', 'prefer_not_to_say'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_name text;
  chosen_gender text;
begin
  chosen_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1),
    'Weship member'
  );
  chosen_gender := nullif(new.raw_user_meta_data ->> 'gender', '');
  if chosen_gender is not null
     and chosen_gender not in ('woman', 'man', 'non_binary', 'prefer_not_to_say') then
    chosen_gender := null;
  end if;

  insert into public.profiles(id, display_name, username, gender)
  values (
    new.id,
    chosen_name,
    public.suggest_username(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), chosen_name)),
    chosen_gender
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
