-- A polymorphic trigger cannot safely dereference both table-specific RECORD
-- fields. On a Goodie insert, `new.uploaded_by` does not exist; on a memory
-- media insert, `new.author_id` does not exist. Reading through JSON keeps the
-- shared trigger generic and fixes the Goodie insert failure:
--   record "new" has no field "uploaded_by"
create or replace function public.reject_cross_owner_media_id()
returns trigger
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  existing_owner uuid;
  incoming_owner uuid;
  incoming jsonb;
begin
  incoming := to_jsonb(new);
  incoming_owner := coalesce(
    (incoming ->> 'author_id')::uuid,
    (incoming ->> 'uploaded_by')::uuid
  );

  if incoming_owner is null then
    raise exception 'Media owner is required';
  end if;

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
