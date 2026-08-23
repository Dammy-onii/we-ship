-- Favouriting a Goodie onto your partner's "Us" widget.
--
-- The table shipped as `widget_pins` in `202608210011` and has never been
-- written to: there was no UI, and no way for the client to supply
-- `preview_path`, which is a Storage path it never sees. Renamed here because
-- "pin" already means something else in this app — `requestPinAppWidget`, the
-- Android call that adds a widget to the home screen — and two meanings of pin
-- in one feature is one too many. Safe to rename precisely because it is empty.

alter table if exists public.widget_pins rename to widget_favourites;
alter index if exists widget_pins_one_per_target rename to widget_favourites_one_per_target;

alter table public.widget_favourites rename column pinned_by to favourited_by;

drop policy if exists widget_pins_read_pair on public.widget_favourites;
create policy widget_favourites_read_pair on public.widget_favourites for select
  using (public.is_space_member(space_id));

drop policy if exists widget_pins_write_actor on public.widget_favourites;
create policy widget_favourites_write_actor on public.widget_favourites for all
  using (favourited_by = auth.uid() and public.is_space_member(space_id))
  with check (favourited_by = auth.uid() and public.is_space_member(space_id));

grant select, insert, update, delete on table public.widget_favourites to authenticated;

/**
 * Favourites one of the Space's Goodies onto the *other* member's widget.
 *
 * Takes a Goodie id rather than a Storage path: the client never sees the path,
 * and letting it name one would let it point the widget at any object it could
 * guess. The unique index on (space_id, target_user_id) means a second
 * favourite replaces the first rather than stacking — one live favourite per
 * person, by design.
 */
create or replace function public.favourite_goodie_for_widget(p_goodie_id uuid)
returns void
language plpgsql
security definer set search_path = public, pg_temp
as $$
declare
  goodie public.goodies%rowtype;
  target uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into goodie from public.goodies where id = p_goodie_id;
  if goodie.id is null then raise exception 'That item no longer exists'; end if;
  if not public.is_space_member(goodie.space_id) then
    raise exception 'That item is not in your space';
  end if;
  if goodie.kind not in ('photo', 'note') then
    raise exception 'Only a photo or a note can be favourited';
  end if;

  select user_id into target
  from public.space_members
  where space_id = goodie.space_id and user_id <> auth.uid()
  limit 1;
  if target is null then raise exception 'Pair with your partner first'; end if;

  insert into public.widget_favourites(
    space_id, favourited_by, target_user_id, kind, body, preview_path
  )
  values (goodie.space_id, auth.uid(), target, goodie.kind, goodie.body, goodie.preview_path)
  on conflict (space_id, target_user_id) do update
    set favourited_by = excluded.favourited_by,
        kind = excluded.kind,
        body = excluded.body,
        preview_path = excluded.preview_path,
        created_at = now();
end;
$$;

/** Removes the favourite this member set for their partner. */
create or replace function public.clear_widget_favourite()
returns void
language sql
security definer set search_path = public, pg_temp
as $$
  delete from public.widget_favourites where favourited_by = auth.uid();
$$;

revoke all on function public.favourite_goodie_for_widget(uuid) from anon;
grant execute on function public.favourite_goodie_for_widget(uuid) to authenticated;
revoke all on function public.clear_widget_favourite() from anon;
grant execute on function public.clear_widget_favourite() to authenticated;
