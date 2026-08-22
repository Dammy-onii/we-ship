-- Defect-register closure: server-side invariants and friend activity.
-- Client validation remains useful UX, but every privacy and correctness rule
-- in this migration is enforced at the database boundary as well.

-- ---------------------------------------------------------------------------
-- Media dimensions (G-9 / A-2)
-- ---------------------------------------------------------------------------

alter table public.goodies add column if not exists width integer;
alter table public.goodies add column if not exists height integer;
alter table public.memory_media add column if not exists width integer;
alter table public.memory_media add column if not exists height integer;
alter table public.friend_posts add column if not exists width integer;
alter table public.friend_posts add column if not exists height integer;
alter table public.goodies add column if not exists reminder_sent_at timestamptz;
alter table public.goodies add column if not exists reminder_claimed_at timestamptz;

create or replace function public.claim_due_reminders(p_limit integer default 100)
returns table(reminder_id uuid, space_id uuid, author_id uuid, body text, reminder_at timestamptz)
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with due as (
    select g.id from public.goodies g
    where g.kind = 'reminder'
      and g.reminder_at <= now()
      and g.reminder_sent_at is null
      and (g.reminder_claimed_at is null or g.reminder_claimed_at < now() - interval '5 minutes')
    order by g.reminder_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 100), 1), 100)
  )
  update public.goodies g set reminder_claimed_at = now()
  from due where g.id = due.id
  returning g.id, g.space_id, g.author_id, g.body, g.reminder_at;
end;
$$;
revoke all on function public.claim_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_due_reminders(integer) to service_role;

create or replace function public.private_get_provider_tokens_for_revocation(
  target_user_id uuid,
  target_provider text
)
returns table(access_cipher text, refresh_cipher text)
language plpgsql
security definer set search_path = public, private, pg_temp
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  select t.encrypted_access_token, t.encrypted_refresh_token
  from public.provider_connections c
  join private.provider_tokens t on t.connection_id = c.id
  where c.user_id = target_user_id and c.provider = target_provider;
end;
$$;
revoke all on function public.private_get_provider_tokens_for_revocation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.private_get_provider_tokens_for_revocation(uuid, text)
  to service_role;

alter table public.goodies drop constraint if exists goodies_dimensions_positive;
alter table public.goodies add constraint goodies_dimensions_positive
  check ((width is null and height is null) or (width > 0 and height > 0));
alter table public.memory_media drop constraint if exists memory_media_dimensions_positive;
alter table public.memory_media add constraint memory_media_dimensions_positive
  check ((width is null and height is null) or (width > 0 and height > 0));
alter table public.friend_posts drop constraint if exists friend_posts_dimensions_positive;
alter table public.friend_posts add constraint friend_posts_dimensions_positive
  check ((width is null and height is null) or (width > 0 and height > 0));

-- ---------------------------------------------------------------------------
-- Friend graph privacy and literal search (B-1 / B-2)
-- ---------------------------------------------------------------------------

drop policy if exists profiles_read_connected on public.profiles;
create policy profiles_read_connected on public.profiles for select
  using (id = auth.uid() or public.shares_space_with(id) or public.is_friend(id));

-- A pending request gets only the narrow graph RPC projection, but that
-- projection intentionally includes its avatar. Keep the object readable
-- without reopening the full profile row (notably timezone).
drop policy if exists avatar_read_pair on storage.objects;
drop policy if exists avatar_read_connected on storage.objects;
create policy avatar_read_connected on storage.objects for select using (
  bucket_id = 'avatars' and (
    split_part(name, '/', 1) = auth.uid()::text
    or public.shares_space_with(split_part(name, '/', 1)::uuid)
    or public.has_friend_link(split_part(name, '/', 1)::uuid)
  )
);

create or replace function public.search_people(query text, result_limit integer default 20)
returns table (
  id uuid,
  display_name text,
  username text,
  avatar_path text,
  friend_status text
)
language sql
stable
security definer set search_path = public, pg_temp
as $$
  with input as (select lower(trim(coalesce(query, ''))) as term)
  select
    p.id,
    p.display_name,
    p.username,
    p.avatar_path,
    case
      when f.id is null then 'none'
      when f.status = 'accepted' then 'friends'
      when f.requester_id = auth.uid() then 'outgoing'
      else 'incoming'
    end
  from public.profiles p
  cross join input i
  left join public.friendships f
    on (f.requester_id = auth.uid() and f.addressee_id = p.id)
    or (f.addressee_id = auth.uid() and f.requester_id = p.id)
  where auth.uid() is not null
    and p.id <> auth.uid()
    and char_length(i.term) >= 2
    -- position/left make '%' and '_' ordinary characters, not LIKE wildcards.
    and (left(lower(p.username), char_length(i.term)) = i.term
      or position(i.term in lower(p.display_name)) > 0)
  order by
    (lower(p.username) = i.term) desc,
    (left(lower(p.username), char_length(i.term)) = i.term) desc,
    p.display_name
  limit least(greatest(coalesce(result_limit, 20), 1), 50);
$$;

create or replace function public.get_friend_graph()
returns table (
  friendship_id uuid,
  status text,
  created_at timestamptz,
  requester_id uuid,
  addressee_id uuid,
  other_id uuid,
  other_display_name text,
  other_username text,
  other_avatar_path text
)
language sql
stable
security definer set search_path = public, pg_temp
as $$
  select
    f.id, f.status, f.created_at, f.requester_id, f.addressee_id,
    p.id, p.display_name, p.username, p.avatar_path
  from public.friendships f
  join public.profiles p on p.id = case
    when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.requester_id = auth.uid() or f.addressee_id = auth.uid()
  order by f.created_at desc;
$$;

revoke all on function public.get_friend_graph() from public, anon;
grant execute on function public.get_friend_graph() to authenticated;

-- ---------------------------------------------------------------------------
-- Personal friend activity, including actionable requests (G-4 / G-5 / G-7)
-- ---------------------------------------------------------------------------

alter table public.personal_notifications
  drop constraint if exists personal_notifications_kind_check;
alter table public.personal_notifications
  add constraint personal_notifications_kind_check check (kind in (
    'contact_joined', 'friend_request', 'friend_accepted', 'friend_declined',
    'friend_withdrawn', 'friend_removed', 'friend_post'
  ));
alter table public.personal_notifications
  drop constraint if exists personal_notifications_user_id_kind_actor_id_key;
alter table public.personal_notifications add column if not exists source_id uuid;
alter table public.personal_notifications add column if not exists action_data jsonb not null default '{}'::jsonb;
create unique index if not exists personal_notifications_source_unique
  on public.personal_notifications(user_id, kind, source_id)
  where source_id is not null;

create or replace function public.notify_friendship_activity()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  actor uuid;
  recipient uuid;
  event_kind text;
  event_title text;
  actor_name text;
  event_source uuid;
begin
  if tg_op = 'INSERT' then
    actor := new.requester_id;
    recipient := new.addressee_id;
    event_kind := 'friend_request';
    event_title := 'New friend request';
    event_source := new.id;
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    actor := new.addressee_id;
    recipient := new.requester_id;
    event_kind := 'friend_accepted';
    event_title := 'Friend request accepted';
    event_source := new.id;
  elsif tg_op = 'DELETE' then
    actor := auth.uid();
    event_source := old.id;
    if old.status = 'accepted' then
      recipient := case when actor = old.requester_id then old.addressee_id else old.requester_id end;
      event_kind := 'friend_removed';
      event_title := 'Friend connection ended';
    elsif actor = old.requester_id then
      recipient := old.addressee_id;
      event_kind := 'friend_withdrawn';
      event_title := 'Friend request withdrawn';
    else
      recipient := old.requester_id;
      event_kind := 'friend_declined';
      event_title := 'Friend request declined';
    end if;
  else
    return new;
  end if;

  select display_name into actor_name from public.profiles where id = actor;
  insert into public.personal_notifications(
    user_id, kind, actor_id, source_id, title, body, route, action_data
  ) values (
    recipient, event_kind, actor, event_source, event_title,
    coalesce(actor_name, 'Someone') || case event_kind
      when 'friend_request' then ' wants to connect with you.'
      when 'friend_accepted' then ' accepted your friend request.'
      when 'friend_declined' then ' declined your friend request.'
      when 'friend_withdrawn' then ' withdrew their friend request.'
      else ' is no longer connected with you.' end,
    '/friends',
    case when event_kind = 'friend_request'
      then jsonb_build_object('requestId', new.id)
      else '{}'::jsonb end
  ) on conflict do nothing;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists friendships_personal_activity on public.friendships;
create trigger friendships_personal_activity
after insert or update or delete on public.friendships
for each row execute function public.notify_friendship_activity();

create or replace function public.notify_friend_post_activity()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare actor_name text;
begin
  select display_name into actor_name from public.profiles where id = new.author_id;
  insert into public.personal_notifications(user_id, kind, actor_id, source_id, title, body, route)
  select
    case when f.requester_id = new.author_id then f.addressee_id else f.requester_id end,
    'friend_post', new.author_id, new.id, 'New friend post',
    coalesce(actor_name, 'A friend') || ' shared ' || new.kind || '.', '/friend-spotlight'
  from public.friendships f
  where f.status = 'accepted'
    and (f.requester_id = new.author_id or f.addressee_id = new.author_id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists friend_posts_personal_activity on public.friend_posts;
create trigger friend_posts_personal_activity after insert on public.friend_posts
for each row execute function public.notify_friend_post_activity();

-- These tables were added after the initial blanket GRANT/publication setup.
-- RLS still decides which rows are visible, but PostgREST and Realtime also
-- need the table privilege and publication membership before they can work.
grant select, insert, update, delete on table public.friendships to authenticated;
grant select, insert, update, delete on table public.friend_posts to authenticated;
grant select, update, delete on table public.personal_notifications to authenticated;
grant select, insert, update, delete on table public.contact_hashes to authenticated;
grant select, insert, update, delete on table public.widget_pins to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['friendships', 'friend_posts', 'personal_notifications'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Task completion and streak correctness (A-7 / A-9 / A-10 / A-11 / C-1)
-- ---------------------------------------------------------------------------

create or replace function public.mark_partner_nudges_seen()
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare caller_space uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select space_id into caller_space from public.space_members where user_id = auth.uid() limit 1;
  update public.nudges set seen_at = now()
  where space_id = caller_space and from_user_id <> auth.uid() and seen_at is null;
end;
$$;
revoke all on function public.mark_partner_nudges_seen() from public, anon;
grant execute on function public.mark_partner_nudges_seen() to authenticated;

alter table public.activity_events add column if not exists dedupe_key text;
create unique index if not exists activity_events_dedupe_unique
  on public.activity_events(dedupe_key) where dedupe_key is not null;

create or replace function public.task_completed_activity()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare task_label text;
begin
  select label into task_label from public.tasks where id = new.task_id;
  insert into public.activity_events(
    space_id, actor_id, kind, entity_type, entity_id, title, body, route, dedupe_key
  ) values (
    new.space_id, new.user_id, 'task_completed', 'task', new.task_id,
    'A 2do was completed', task_label, '/todo',
    'task:' || new.task_id || ':user:' || new.user_id || ':period:' || new.period_key
  ) on conflict do nothing;
  return new;
end;
$$;

create or replace function public.record_space_activity()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  target_space_id uuid;
  actor_id uuid;
  actor_timezone text;
  local_day date;
begin
  target_space_id := (to_jsonb(new) ->> 'space_id')::uuid;
  actor_id := coalesce(
    (to_jsonb(new) ->> 'user_id')::uuid,
    (to_jsonb(new) ->> 'author_id')::uuid,
    (to_jsonb(new) ->> 'created_by')::uuid,
    (to_jsonb(new) ->> 'from_user_id')::uuid,
    (to_jsonb(new) ->> 'uploaded_by')::uuid
  );
  select timezone into actor_timezone from public.profiles where id = actor_id;
  local_day := (now() at time zone coalesce(actor_timezone, 'UTC'))::date;

  insert into public.streaks(space_id, count, last_active_date, grace_left)
  values (target_space_id, 1, local_day, 1)
  on conflict (space_id) do update set
    count = case
      when streaks.last_active_date = local_day then streaks.count
      when local_day - streaks.last_active_date between 1 and 2 then streaks.count + 1
      else 1 end,
    grace_left = case
      when streaks.last_active_date = local_day then streaks.grace_left
      when local_day - streaks.last_active_date = 2 then 0
      else 1 end,
    last_active_date = local_day,
    updated_at = now();
  return new;
end;
$$;

create or replace function public.set_task_complete(
  p_task_id uuid,
  p_completed boolean,
  p_note text default null,
  p_local_date date default null
)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare selected_task public.tasks%rowtype; period date;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into selected_task from public.tasks
  where id = p_task_id and archived_at is null;
  if selected_task.id is null then raise exception 'Task not found'; end if;
  if not public.is_space_member(selected_task.space_id) then raise exception 'Not a member of this space'; end if;
  if p_completed and selected_task.note_required and nullif(trim(p_note), '') is null then
    raise exception 'A completion note is required for this task';
  end if;
  period := public.task_period_key(selected_task.routine, coalesce(p_local_date, current_date));
  if p_completed then
    insert into public.task_completions as c(task_id, space_id, user_id, period_key, note)
    values (selected_task.id, selected_task.space_id, auth.uid(), period, nullif(trim(p_note), ''))
    on conflict (task_id, user_id, period_key)
    do update set note = excluded.note, completed_at = now();
  else
    delete from public.task_completions c
    where c.task_id = selected_task.id and c.user_id = auth.uid() and c.period_key = period;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Space ownership, anniversary, and account lifecycle (C-4 / D-1)
-- ---------------------------------------------------------------------------

create or replace function public.set_space_anniversary(p_anniversary date)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
begin
  update public.spaces set anniversary = p_anniversary, updated_at = now()
  where id = (select space_id from public.space_members where user_id = auth.uid() limit 1);
  if not found then raise exception 'Join a shared space first'; end if;
end;
$$;

create or replace function public.leave_pair_space()
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare target_space uuid; successor uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select space_id into target_space from public.space_members where user_id = auth.uid() limit 1;
  if target_space is null then return; end if;
  select user_id into successor from public.space_members
  where space_id = target_space and user_id <> auth.uid() order by joined_at limit 1;
  if successor is null then
    delete from public.spaces where id = target_space;
  else
    update public.spaces set created_by = successor, updated_at = now() where id = target_space;
    update public.space_members set role = 'owner' where space_id = target_space and user_id = successor;
    delete from public.space_members where space_id = target_space and user_id = auth.uid();
  end if;
end;
$$;

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = public, auth, pg_temp
as $$
begin
  perform public.leave_pair_space();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.set_space_anniversary(date) from public, anon;
revoke all on function public.leave_pair_space() from public, anon;
revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.set_space_anniversary(date) to authenticated;
grant execute on function public.leave_pair_space() to authenticated;
grant execute on function public.delete_own_account() to authenticated;

-- Give an intentional error before the primary-key constraint when a finalize
-- request reuses somebody else's target id (D-6).
create or replace function public.reject_cross_owner_media_id()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare existing_owner uuid; incoming_owner uuid;
begin
  incoming_owner := case when tg_table_name = 'goodies' then new.author_id else new.uploaded_by end;
  if tg_table_name = 'goodies' then
    select author_id into existing_owner from public.goodies where id = new.id;
  else
    select uploaded_by into existing_owner from public.memory_media where id = new.id;
  end if;
  if existing_owner is not null and existing_owner <> incoming_owner then
    raise exception 'Upload id already belongs to another user';
  end if;
  return new;
end;
$$;
drop trigger if exists goodies_cross_owner_id_guard on public.goodies;
create trigger goodies_cross_owner_id_guard before insert on public.goodies
for each row execute function public.reject_cross_owner_media_id();
drop trigger if exists memory_media_cross_owner_id_guard on public.memory_media;
create trigger memory_media_cross_owner_id_guard before insert on public.memory_media
for each row execute function public.reject_cross_owner_media_id();

-- ---------------------------------------------------------------------------
-- Remove server surfaces with no product consumer (C-3 / D-5)
-- ---------------------------------------------------------------------------

drop function if exists public.start_turn_game(text);
drop function if exists public.submit_turn_game_move(uuid, jsonb);
drop function if exists public.top_incomplete_tasks(integer);

-- Pairing previously wrote a widget preference that no widget read. Widgets
-- are OS-managed surfaces, so their presence is the preference source.
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
    new_code := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 8));
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

create or replace function public.join_pair_space(invite_code text)
returns uuid
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare invite public.space_invites%rowtype; member_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if exists(select 1 from public.space_members where user_id = auth.uid()) then
    raise exception 'You already belong to a space';
  end if;
  select * into invite from public.space_invites
  where code = upper(trim(invite_code)) and claimed_at is null and expires_at > now()
  for update;
  if invite.id is null then raise exception 'Invite is invalid or expired'; end if;
  select count(*) into member_count from public.space_members where space_id = invite.space_id;
  if member_count >= 2 then raise exception 'This space already has two members'; end if;
  insert into public.space_members(space_id, user_id, role)
  values (invite.space_id, auth.uid(), 'member');
  update public.space_invites set claimed_by = auth.uid(), claimed_at = now() where id = invite.id;
  return invite.space_id;
end;
$$;

drop table if exists public.widget_preferences;
