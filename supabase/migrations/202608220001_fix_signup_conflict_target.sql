-- Fix: every sign-up failed with "Database error saving new user".
--
-- ROOT CAUSE. `202608210011` created `personal_notifications` with
-- `unique (user_id, kind, actor_id)`, and `notify_contacts_of_join` relied on
-- it via `on conflict (user_id, kind, actor_id) do nothing`.
--
-- `202608210013` then dropped that constraint and replaced it with a *partial*
-- unique index on `(user_id, kind, source_id) where source_id is not null`,
-- without updating the trigger. An `ON CONFLICT` whose column list matches no
-- constraint raises `42P10`, and because this trigger fires `after insert on
-- public.profiles` — which `handle_new_user` performs inside the `auth.users`
-- insert — the failure aborted the whole sign-up transaction.
--
-- The trigger no longer names a constraint at all. `where not exists` cannot be
-- invalidated by a future index change, which is exactly how this broke.

create or replace function public.notify_contacts_of_join()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.identity_hash is null then return new; end if;

  insert into public.personal_notifications(user_id, kind, actor_id, source_id, title, body, route)
  select
    c.user_id,
    'contact_joined',
    new.id,
    -- Populates the partial unique index introduced by 202608210013 so repeat
    -- inserts stay deduplicated.
    new.id,
    new.display_name || ' just joined Weship',
    'They are in your contacts. Send a friend request to see their board.',
    '/friends'
  from public.contact_hashes c
  where c.hash = new.identity_hash
    and c.user_id <> new.id
    and not exists (
      select 1 from public.personal_notifications existing
      where existing.user_id = c.user_id
        and existing.kind = 'contact_joined'
        and existing.actor_id = new.id
    );

  return new;
exception
  -- A notification is never worth failing a sign-up for. This trigger runs
  -- inside the auth transaction, so anything it raises costs the user an
  -- account.
  when others then
    return new;
end;
$$;
