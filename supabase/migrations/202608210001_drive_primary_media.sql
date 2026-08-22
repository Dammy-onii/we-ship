-- Make Google Drive the primary store for user-owned photo/video originals.
-- Supabase Storage keeps only compact previews used by pair-scoped app feeds.

-- This product concept was removed from the app and current data model.
alter table public.spaces
  drop column if exists next_together;

alter table public.memory_media
  alter column storage_provider set default 'google_drive';

create unique index if not exists memory_media_drive_file_unique
  on public.memory_media(drive_owner_id, drive_file_id)
  where drive_file_id is not null;

alter table public.goodies
  add column if not exists preview_path text,
  add column if not exists storage_provider text not null default 'supabase'
    check (storage_provider in ('supabase', 'google_drive')),
  add column if not exists drive_file_id text,
  add column if not exists drive_owner_id uuid references public.profiles(id),
  add column if not exists size_bytes bigint,
  add column if not exists upload_status text not null default 'ready'
    check (upload_status in ('uploading', 'ready', 'failed', 'unavailable'));

create unique index if not exists goodies_drive_file_unique
  on public.goodies(drive_owner_id, drive_file_id)
  where drive_file_id is not null;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('goodie-previews', 'goodie-previews', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
set file_size_limit = 2097152
where id = 'memory-previews';

create policy goodie_previews_read on storage.objects for select using (
  bucket_id = 'goodie-previews' and public.is_space_member(public.storage_space_id(name))
);
create policy goodie_previews_insert on storage.objects for insert with check (
  bucket_id = 'goodie-previews'
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);
create policy goodie_previews_update on storage.objects for update using (
  bucket_id = 'goodie-previews'
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);
create policy goodie_previews_delete on storage.objects for delete using (
  bucket_id = 'goodie-previews'
  and public.is_space_member(public.storage_space_id(name))
  and split_part(name, '/', 2) = auth.uid()::text
);

create or replace function public.finalize_drive_memory_upload(
  target_media_id uuid,
  target_space_id uuid,
  target_user_id uuid,
  target_title text,
  target_caption text,
  target_occurred_on date,
  target_media_type text,
  target_preview_path text,
  target_drive_file_id text,
  target_mime_type text,
  target_size_bytes bigint,
  target_checksum text
)
returns table(memory_id uuid, media_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_memory_id uuid;
begin
  if not exists (
    select 1 from public.space_members
    where space_id = target_space_id and user_id = target_user_id
  ) then
    raise exception 'User is not a member of this space';
  end if;
  if target_media_type not in ('photo', 'video') then
    raise exception 'Unsupported memory media type';
  end if;
  if target_preview_path <> target_space_id::text || '/' || target_user_id::text || '/' || target_media_id::text || '.jpg' then
    raise exception 'Invalid memory preview path';
  end if;

  select mm.memory_id, mm.id into created_memory_id, media_id
  from public.memory_media mm
  where mm.id = target_media_id and mm.uploaded_by = target_user_id;
  if found then
    memory_id := created_memory_id;
    return next;
    return;
  end if;

  insert into public.memories(space_id, created_by, title, caption, occurred_on, kind)
  values (
    target_space_id,
    target_user_id,
    left(trim(target_title), 120),
    nullif(trim(target_caption), ''),
    target_occurred_on,
    'moment'
  )
  returning id into created_memory_id;

  insert into public.memory_media(
    id, memory_id, space_id, uploaded_by, media_type, storage_provider,
    storage_path, preview_path, drive_file_id, drive_owner_id, mime_type,
    size_bytes, checksum, upload_status
  ) values (
    target_media_id, created_memory_id, target_space_id, target_user_id,
    target_media_type, 'google_drive', null, target_preview_path,
    target_drive_file_id, target_user_id, target_mime_type,
    target_size_bytes, target_checksum, 'ready'
  );

  memory_id := created_memory_id;
  media_id := target_media_id;
  return next;
end;
$$;

create or replace function public.finalize_drive_goodie_upload(
  target_goodie_id uuid,
  target_space_id uuid,
  target_user_id uuid,
  target_kind text,
  target_body text,
  target_preview_path text,
  target_drive_file_id text,
  target_mime_type text,
  target_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_id uuid;
begin
  if not exists (
    select 1 from public.space_members
    where space_id = target_space_id and user_id = target_user_id
  ) then
    raise exception 'User is not a member of this space';
  end if;
  if target_kind not in ('photo', 'video') then
    raise exception 'Unsupported Goodie media type';
  end if;
  if target_preview_path <> target_space_id::text || '/' || target_user_id::text || '/' || target_goodie_id::text || '.jpg' then
    raise exception 'Invalid Goodie preview path';
  end if;

  select id into created_id from public.goodies
  where id = target_goodie_id and author_id = target_user_id;
  if found then return created_id; end if;

  insert into public.goodies(
    id, space_id, author_id, kind, body, storage_path, preview_path,
    storage_provider, drive_file_id, drive_owner_id, mime_type,
    size_bytes, upload_status
  ) values (
    target_goodie_id, target_space_id, target_user_id, target_kind,
    nullif(trim(target_body), ''), null, target_preview_path,
    'google_drive', target_drive_file_id, target_user_id, target_mime_type,
    target_size_bytes, 'ready'
  )
  returning id into created_id;
  return created_id;
end;
$$;

revoke all on function public.finalize_drive_memory_upload(uuid, uuid, uuid, text, text, date, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.finalize_drive_goodie_upload(uuid, uuid, uuid, text, text, text, text, text, bigint) from public, anon, authenticated;
grant execute on function public.finalize_drive_memory_upload(uuid, uuid, uuid, text, text, date, text, text, text, text, bigint, text) to service_role;
grant execute on function public.finalize_drive_goodie_upload(uuid, uuid, uuid, text, text, text, text, text, bigint) to service_role;
