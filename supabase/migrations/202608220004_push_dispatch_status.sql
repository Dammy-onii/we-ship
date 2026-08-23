-- A way to answer "is push delivery actually wired up?" without guessing.
--
-- Push was configured but dead for weeks because every part of the chain fails
-- silently by design: the dispatch trigger swallows exceptions so a failed
-- notification can never roll back the thing the user did, and a missing pg_net
-- makes it a no-op. Nothing anywhere said so.
--
-- Returns booleans only — never the secret, never the endpoint. Safe to expose
-- to a signed-in user, which is what makes it usable as a health check.

create or replace function public.push_dispatch_status()
returns table (endpoint_set boolean, secret_set boolean, net_available boolean, triggers_installed integer)
language sql
stable
security definer set search_path = private, public
as $$
  select
    exists (select 1 from private.app_settings where key = 'push_endpoint' and value <> ''),
    exists (select 1 from private.app_settings where key = 'push_secret' and value <> ''),
    exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where p.proname = 'http_post' and n.nspname in ('net', 'extensions')
    ),
    (
      select count(*)::integer from pg_trigger
      where tgname in ('personal_notifications_push', 'activity_events_push')
        and not tgisinternal
    );
$$;

revoke all on function public.push_dispatch_status() from public, anon;
grant execute on function public.push_dispatch_status() to authenticated, service_role;
