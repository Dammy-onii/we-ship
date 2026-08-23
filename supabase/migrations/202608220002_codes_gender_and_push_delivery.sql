-- Six-character invite codes, the current gender values, and push that is
-- actually delivered.

-- ---------------------------------------------------------------------------
-- 1. Invite codes: six characters, from an unambiguous alphabet.
-- ---------------------------------------------------------------------------
--
-- They were eight hex characters, which is both longer than anyone wants to
-- read aloud and full of pairs that look alike in the app's typeface. Six
-- characters from a 32-symbol alphabet is a little over a billion combinations,
-- and invites are single-use and expiring, so guessing is not the threat.
-- `I`, `O`, `0` and `1` are excluded because they are the ones people mistype.

create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for _ in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_pair_space(space_name text default 'Our space')
returns table(space_id uuid, invite_code text)
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare new_space_id uuid; new_code text;
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
  loop
    new_code := public.generate_invite_code();
    begin
      insert into public.space_invites(space_id, code, created_by)
      values (new_space_id, new_code, auth.uid());
      exit;
    exception when unique_violation then continue;
    end;
  end loop;
  insert into public.questions(space_id, prompt_id, prompt, prompt_date)
  select new_space_id, id, prompt, current_date
  from public.question_prompts where active order by created_at limit 1;
  return query select new_space_id, new_code;
end;
$$;

-- Codes already issued stay valid: `join_pair_space` matches on the stored
-- value and never on its length, so nobody mid-invite is stranded.

-- ---------------------------------------------------------------------------
-- 2. Gender: male / female / prefer not to say.
-- ---------------------------------------------------------------------------

-- Order matters: the old constraint still forbids 'male' and 'female', so the
-- rows cannot be migrated until it is gone. Dropping first, rewriting, then
-- adding the new one is the only sequence that does not fail on existing data.
alter table public.profiles drop constraint if exists profiles_gender_check;

update public.profiles set gender = case gender
  when 'woman' then 'female'
  when 'man' then 'male'
  when 'non_binary' then 'prefer_not_to_say'
  else gender
end
where gender in ('woman', 'man', 'non_binary');

alter table public.profiles
  add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female', 'prefer_not_to_say'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public, private
as $$
declare
  chosen_name text;
  chosen_gender text;
  chosen_hash text;
begin
  chosen_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    split_part(new.email, '@', 1),
    'Weship member'
  );
  chosen_gender := nullif(new.raw_user_meta_data ->> 'gender', '');
  if chosen_gender is not null
     and chosen_gender not in ('male', 'female', 'prefer_not_to_say') then
    chosen_gender := null;
  end if;
  chosen_hash := private.contact_hash(new.email);

  insert into public.profiles(id, display_name, username, gender, identity_hash)
  values (
    new.id,
    chosen_name,
    public.suggest_username(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), chosen_name)),
    chosen_gender,
    chosen_hash
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Push delivery.
-- ---------------------------------------------------------------------------
--
-- The `dispatch-push` Edge Function has always worked; nothing ever called it.
-- It was designed to be driven by a Database Webhook configured by hand in the
-- dashboard, and that step was never done — so every notification existed in
-- the database and never reached a phone.
--
-- Calling it from a trigger instead means push delivery ships with the schema
-- and cannot be lost by someone recreating the project.

-- pg_net lands in `net` on some Supabase projects and `extensions` on others
-- depending on when the project was created, so nothing here hard-codes it.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  -- Already installed, or not permitted here. Both are survivable: the
  -- dispatcher below checks for the function before using it.
  null;
end;
$$;

create table if not exists private.app_settings (
  key text primary key,
  value text not null
);
revoke all on table private.app_settings from anon, authenticated;

/*
 * Self-configuring, on purpose.
 *
 * The shared secret is generated here rather than copied by hand from an Edge
 * Function secret into a SQL console: that hand-off is a step someone has to
 * remember, and forgetting it is exactly how push delivery came to be wired up
 * but silently dead. `dispatch-push` reads the expected value back out of this
 * table with its service-role client, so the two can never disagree.
 *
 * `on conflict do nothing` means re-running this migration never rotates a
 * working secret out from under a deployed function.
 */
insert into private.app_settings (key, value)
values ('push_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- The project's public URL — the same value the app ships as
-- EXPO_PUBLIC_SUPABASE_URL, not a secret. Change this row when deploying the
-- schema to a different Supabase project.
insert into private.app_settings (key, value)
values ('push_endpoint', 'https://bccrjivgkkdarolwfrct.supabase.co/functions/v1/dispatch-push')
on conflict (key) do nothing;

/**
 * Hands the shared secret to `dispatch-push`.
 *
 * PostgREST only serves schemas it has been configured to expose, and `private`
 * deliberately is not one of them, so the Edge Function cannot select from the
 * table directly. Executable by `service_role` alone — never by anon or by a
 * signed-in user.
 */
create or replace function public.push_dispatch_secret()
returns text
language sql
stable
security definer set search_path = private, public
as $$ select value from private.app_settings where key = 'push_secret' $$;

revoke all on function public.push_dispatch_secret() from public, anon, authenticated;
grant execute on function public.push_dispatch_secret() to service_role;

/**
 * Posts one notification row to `dispatch-push`.
 *
 * Deliberately swallows everything: this runs inside the transaction that
 * created the notification, and a push that cannot be sent must never roll back
 * the thing that the user actually did.
 */
create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer set search_path = public, private, extensions
as $$
declare
  endpoint text;
  secret text;
  net_schema text;
begin
  select value into endpoint from private.app_settings where key = 'push_endpoint';
  select value into secret from private.app_settings where key = 'push_secret';
  -- Unconfigured is a valid state: local development and self-hosted copies
  -- have no Edge Function to call.
  if endpoint is null or secret is null then return new; end if;

  select n.nspname into net_schema
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.proname = 'http_post'
  order by case n.nspname when 'net' then 0 when 'extensions' then 1 else 2 end
  limit 1;
  if net_schema is null then return new; end if;

  execute format(
    'select %I.http_post(url := $1, headers := $2, body := $3, timeout_milliseconds := $4)',
    net_schema
  )
  using
    endpoint,
    jsonb_build_object('Content-Type', 'application/json', 'x-weship-secret', secret),
    jsonb_build_object('record', to_jsonb(new)),
    4000;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists personal_notifications_push on public.personal_notifications;
create trigger personal_notifications_push
after insert on public.personal_notifications
for each row execute function public.dispatch_push_notification();

drop trigger if exists activity_events_push on public.activity_events;
create trigger activity_events_push
after insert on public.activity_events
for each row execute function public.dispatch_push_notification();

revoke all on function public.dispatch_push_notification() from anon, authenticated;
revoke all on function public.generate_invite_code() from anon, authenticated;
