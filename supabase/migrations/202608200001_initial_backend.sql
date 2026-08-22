-- Weship production data foundation.
-- Apply with `supabase db push` or paste into a new Supabase project's SQL editor.

create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_path text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our space',
  created_by uuid not null references public.profiles(id),
  mode text not null default 'distance' check (mode in ('together', 'distance')),
  anniversary date,
  next_together date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create unique index one_active_space_per_user on public.space_members(user_id);

create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  claimed_by uuid references public.profiles(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  label text not null check (char_length(label) between 1 and 120),
  routine text not null check (routine in ('daily', 'weekly', 'monthly')),
  note_required boolean not null default false,
  color text not null default '#5F5B57',
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_space_order_idx on public.tasks(space_id, archived_at, sort_order, created_at);

create table public.task_completions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period_key date not null,
  note text,
  completed_at timestamptz not null default now(),
  unique (task_id, user_id, period_key)
);

create table public.goodies (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('photo', 'video', 'voice', 'note', 'reminder')),
  body text,
  storage_path text,
  mime_type text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  reminder_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 120),
  caption text,
  occurred_on date not null,
  kind text not null default 'moment' check (kind in ('moment', 'question', 'milestone')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memory_media (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references public.memories(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  media_type text not null check (media_type in ('photo', 'video', 'audio')),
  storage_provider text not null default 'supabase' check (storage_provider in ('supabase', 'google_drive')),
  storage_path text,
  preview_path text,
  drive_file_id text,
  drive_owner_id uuid references public.profiles(id),
  mime_type text,
  size_bytes bigint,
  checksum text,
  upload_status text not null default 'ready' check (upload_status in ('pending', 'uploading', 'ready', 'failed', 'unavailable')),
  created_at timestamptz not null default now()
);

create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  created_by uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 160),
  details text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default true,
  timezone text not null default 'UTC',
  source text not null default 'manual' check (source in ('manual', 'google_calendar')),
  provider_calendar_id text,
  provider_event_id text,
  provider_etag text,
  sync_status text not null default 'local' check (sync_status in ('local', 'pending', 'synced', 'conflict', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, source, provider_event_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.presence (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood text,
  status_text text,
  updated_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create table public.streaks (
  space_id uuid primary key references public.spaces(id) on delete cascade,
  count integer not null default 0 check (count >= 0),
  last_active_date date,
  grace_left integer not null default 1 check (grace_left >= 0),
  updated_at timestamptz not null default now()
);

create table public.nudges (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('thinkingOfYou', 'heart', 'hug', 'goodnight')),
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.question_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  prompt_id uuid references public.question_prompts(id),
  prompt text not null,
  prompt_date date not null,
  created_at timestamptz not null default now(),
  unique (space_id, prompt_date)
);

create table public.question_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  answer text not null check (char_length(answer) between 1 and 2000),
  answered_at timestamptz not null default now(),
  unique (question_id, user_id)
);

create table public.widget_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  top_todo_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  app_version text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  kind text not null,
  entity_type text,
  entity_id uuid,
  title text not null,
  body text,
  route text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_event_id uuid references public.activity_events(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, activity_event_id)
);

create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('google', 'spotify')),
  provider_account_id text not null,
  account_label text,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'expired', 'revoked', 'error')),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table private.provider_tokens (
  connection_id uuid primary key references public.provider_connections(id) on delete cascade,
  encrypted_access_token text,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  key_version integer not null default 1,
  updated_at timestamptz not null default now()
);

create table private.oauth_sessions (
  state_hash text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  code_verifier_encrypted text,
  return_url text not null,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  created_at timestamptz not null default now()
);

create table public.calendar_sources (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.provider_connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider_calendar_id text not null,
  name text not null,
  color text,
  selected boolean not null default false,
  share_with_space boolean not null default false,
  sync_token text,
  last_synced_at timestamptz,
  unique (connection_id, provider_calendar_id)
);

create table public.game_catalog (
  id text primary key,
  name text not null,
  description text not null,
  min_players integer not null default 2,
  max_players integer not null default 2,
  config jsonb not null default '{}'::jsonb,
  active boolean not null default true
);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  game_id text not null references public.game_catalog(id),
  created_by uuid not null references public.profiles(id),
  status text not null default 'waiting' check (status in ('waiting', 'active', 'complete', 'abandoned')),
  current_turn_user_id uuid references public.profiles(id),
  state jsonb not null default '{}'::jsonb,
  winner_user_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.game_moves (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  move_number integer not null,
  move jsonb not null,
  created_at timestamptz not null default now(),
  unique (session_id, move_number)
);

insert into public.question_prompts(prompt) values
  ('What small thing made you think of us today?'),
  ('Where would you take us for a quiet weekend?'),
  ('What is one thing you want us to make time for this week?')
on conflict do nothing;

insert into public.game_catalog(id, name, description, config) values
  ('our-take', 'Our Take', 'Rank the same scenes and reveal where your choices match.', '{"mode":"ranking"}'),
  ('would-you-rather', 'Would you rather', 'Pick one of two choices, then reveal together.', '{"mode":"simultaneous-choice"}'),
  ('truth-or-dare', 'Truth or dare', 'Take turns drawing a softer truth or dare.', '{"mode":"turn-based"}'),
  ('quick-chess', 'Quick chess', 'A lightweight shared chess game that deep-links from the widget.', '{"mode":"turn-based","board":"chess"}')
on conflict (id) do update set name = excluded.name, description = excluded.description, config = excluded.config;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger spaces_updated_at before update on public.spaces for each row execute function public.set_updated_at();
create trigger tasks_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger memories_updated_at before update on public.memories for each row execute function public.set_updated_at();
create trigger timeline_events_updated_at before update on public.timeline_events for each row execute function public.set_updated_at();
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();
create trigger provider_connections_updated_at before update on public.provider_connections for each row execute function public.set_updated_at();
create trigger game_sessions_updated_at before update on public.game_sessions for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1), 'Weship member'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles(id, display_name)
select id, coalesce(nullif(raw_user_meta_data ->> 'display_name', ''), split_part(email, '@', 1), 'Weship member')
from auth.users
on conflict (id) do nothing;

create or replace function public.is_space_member(target_space_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = target_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.shares_space_with(target_user_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select target_user_id = auth.uid() or exists (
    select 1
    from public.space_members mine
    join public.space_members theirs using (space_id)
    where mine.user_id = auth.uid() and theirs.user_id = target_user_id
  );
$$;

create or replace function public.create_pair_space(space_name text default 'Our space')
returns table(space_id uuid, invite_code text)
language plpgsql
security definer set search_path = public
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
    new_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
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

create or replace function public.join_pair_space(invite_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  invite public.space_invites%rowtype;
  member_count integer;
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
  insert into public.widget_preferences(user_id, space_id) values (auth.uid(), invite.space_id);
  update public.space_invites set claimed_by = auth.uid(), claimed_at = now() where id = invite.id;
  return invite.space_id;
end;
$$;

create or replace function public.task_period_key(task_routine text, at_date date default current_date)
returns date
language sql immutable
as $$
  select case task_routine
    when 'weekly' then date_trunc('week', at_date::timestamp)::date
    when 'monthly' then date_trunc('month', at_date::timestamp)::date
    else at_date
  end;
$$;

create or replace function public.set_task_complete(task_id uuid, completed boolean, completion_note text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  selected_task public.tasks%rowtype;
  period date;
begin
  select * into selected_task from public.tasks where id = task_id and archived_at is null;
  if selected_task.id is null or not public.is_space_member(selected_task.space_id) then
    raise exception 'Task not found';
  end if;
  period := public.task_period_key(selected_task.routine, current_date);

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

create or replace function public.top_incomplete_tasks(task_limit integer default 3)
returns table(id uuid, label text, routine text, note_required boolean, color text, sort_order integer)
language sql
stable
security definer set search_path = public
as $$
  select t.id, t.label, t.routine, t.note_required, t.color, t.sort_order
  from public.tasks t
  join public.space_members sm on sm.space_id = t.space_id and sm.user_id = auth.uid()
  where t.archived_at is null
    and not exists (
      select 1 from public.task_completions c
      where c.task_id = t.id
        and c.user_id = auth.uid()
        and c.period_key = public.task_period_key(t.routine, current_date)
    )
  order by t.sort_order, t.created_at
  limit greatest(1, least(task_limit, 10));
$$;

create or replace function public.fan_out_activity_notification()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.notifications(user_id, activity_event_id)
  select user_id, new.id from public.space_members
  where space_id = new.space_id and user_id is distinct from new.actor_id
  on conflict do nothing;
  return new;
end;
$$;

create trigger activity_notification_fanout
after insert on public.activity_events
for each row execute function public.fan_out_activity_notification();

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.goodies enable row level security;
alter table public.memories enable row level security;
alter table public.memory_media enable row level security;
alter table public.timeline_events enable row level security;
alter table public.notes enable row level security;
alter table public.presence enable row level security;
alter table public.streaks enable row level security;
alter table public.nudges enable row level security;
alter table public.question_prompts enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
alter table public.widget_preferences enable row level security;
alter table public.push_tokens enable row level security;
alter table public.activity_events enable row level security;
alter table public.notifications enable row level security;
alter table public.provider_connections enable row level security;
alter table public.calendar_sources enable row level security;
alter table public.game_catalog enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_moves enable row level security;

create policy profiles_read_pair on public.profiles for select using (public.shares_space_with(id));
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy spaces_members on public.spaces for select using (public.is_space_member(id));
create policy spaces_update_members on public.spaces for update using (public.is_space_member(id)) with check (public.is_space_member(id));
create policy members_read_pair on public.space_members for select using (public.is_space_member(space_id));
create policy invites_read_pair on public.space_invites for select using (public.is_space_member(space_id));
create policy invites_manage_owner on public.space_invites for all using (created_by = auth.uid()) with check (created_by = auth.uid() and public.is_space_member(space_id));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tasks', 'task_completions', 'goodies', 'memories', 'memory_media', 'timeline_events',
    'notes', 'presence', 'streaks', 'nudges', 'questions', 'question_answers',
    'activity_events', 'game_sessions', 'game_moves'
  ] loop
    execute format('create policy %I on public.%I for select using (public.is_space_member(space_id))', table_name || '_read', table_name);
    execute format('create policy %I on public.%I for insert with check (public.is_space_member(space_id))', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for update using (public.is_space_member(space_id)) with check (public.is_space_member(space_id))', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for delete using (public.is_space_member(space_id))', table_name || '_delete', table_name);
  end loop;
end $$;

create policy prompts_authenticated_read on public.question_prompts for select to authenticated using (active);
create policy widget_preferences_self on public.widget_preferences for all using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_space_member(space_id));
create policy push_tokens_self on public.push_tokens for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_self on public.notifications for select using (user_id = auth.uid());
create policy notifications_self_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy provider_connections_self on public.provider_connections for select using (user_id = auth.uid());
create policy provider_connections_self_delete on public.provider_connections for delete using (user_id = auth.uid());
create policy calendar_sources_self on public.calendar_sources for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy game_catalog_authenticated on public.game_catalog for select to authenticated using (active);

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('goodies', 'goodies', false, 157286400, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'audio/m4a', 'audio/mp4', 'audio/aac']),
  ('memories', 'memories', false, 524288000, array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('memory-previews', 'memory-previews', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create or replace function public.storage_space_id(object_name text)
returns uuid language plpgsql immutable as $$
begin
  return split_part(object_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

create policy avatar_read_pair on storage.objects for select using (
  bucket_id = 'avatars' and public.shares_space_with(split_part(name, '/', 1)::uuid)
);
create policy avatar_write_self on storage.objects for insert with check (
  bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text
);
create policy avatar_update_self on storage.objects for update using (
  bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text
);
create policy avatar_delete_self on storage.objects for delete using (
  bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text
);

create policy shared_media_read on storage.objects for select using (
  bucket_id in ('goodies', 'memories', 'memory-previews') and public.is_space_member(public.storage_space_id(name))
);
create policy shared_media_insert on storage.objects for insert with check (
  bucket_id in ('goodies', 'memories', 'memory-previews')
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);
create policy shared_media_update on storage.objects for update using (
  bucket_id in ('goodies', 'memories', 'memory-previews')
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);
create policy shared_media_delete on storage.objects for delete using (
  bucket_id in ('goodies', 'memories', 'memory-previews')
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
revoke all on all tables in schema private from anon, authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'space_members', 'tasks', 'task_completions', 'goodies', 'memories',
    'memory_media', 'timeline_events', 'notes', 'presence', 'streaks', 'nudges',
    'questions', 'question_answers', 'activity_events', 'notifications', 'game_sessions', 'game_moves'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
