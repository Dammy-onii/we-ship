-- Service-role-only helpers keep provider credentials out of public REST tables.

create or replace function public.private_store_provider_tokens(
  target_connection_id uuid,
  access_cipher text,
  refresh_cipher text,
  expires_at timestamptz,
  token_key_version integer default 1
)
returns void
language plpgsql
security definer set search_path = public, private
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  insert into private.provider_tokens(connection_id, encrypted_access_token, encrypted_refresh_token, access_token_expires_at, key_version)
  values (target_connection_id, access_cipher, refresh_cipher, expires_at, token_key_version)
  on conflict (connection_id) do update set
    encrypted_access_token = excluded.encrypted_access_token,
    encrypted_refresh_token = coalesce(excluded.encrypted_refresh_token, private.provider_tokens.encrypted_refresh_token),
    access_token_expires_at = excluded.access_token_expires_at,
    key_version = excluded.key_version,
    updated_at = now();
end;
$$;

create or replace function public.private_get_provider_tokens(target_user_id uuid, target_provider text)
returns table(connection_id uuid, access_cipher text, refresh_cipher text, expires_at timestamptz, scopes text[])
language plpgsql
security definer set search_path = public, private
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  select c.id, t.encrypted_access_token, t.encrypted_refresh_token, t.access_token_expires_at, c.scopes
  from public.provider_connections c
  join private.provider_tokens t on t.connection_id = c.id
  where c.user_id = target_user_id and c.provider = target_provider and c.status = 'active';
end;
$$;

create or replace function public.private_store_oauth_session(
  target_state_hash text,
  target_user_id uuid,
  target_provider text,
  verifier_cipher text,
  target_return_url text
)
returns void
language plpgsql
security definer set search_path = public, private
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  delete from private.oauth_sessions where expires_at <= now();
  insert into private.oauth_sessions(state_hash, user_id, provider, code_verifier_encrypted, return_url)
  values (target_state_hash, target_user_id, target_provider, verifier_cipher, target_return_url);
end;
$$;

create or replace function public.private_claim_oauth_session(target_state_hash text)
returns table(user_id uuid, provider text, verifier_cipher text, return_url text)
language plpgsql
security definer set search_path = public, private
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  delete from private.oauth_sessions
  where state_hash = target_state_hash and expires_at > now()
  returning oauth_sessions.user_id, oauth_sessions.provider, oauth_sessions.code_verifier_encrypted, oauth_sessions.return_url;
end;
$$;

revoke all on function public.private_store_provider_tokens(uuid, text, text, timestamptz, integer) from anon, authenticated;
revoke all on function public.private_get_provider_tokens(uuid, text) from anon, authenticated;
revoke all on function public.private_store_oauth_session(text, uuid, text, text, text) from anon, authenticated;
revoke all on function public.private_claim_oauth_session(text) from anon, authenticated;
grant execute on function public.private_store_provider_tokens(uuid, text, text, timestamptz, integer) to service_role;
grant execute on function public.private_get_provider_tokens(uuid, text) to service_role;
grant execute on function public.private_store_oauth_session(text, uuid, text, text, text) to service_role;
grant execute on function public.private_claim_oauth_session(text) to service_role;
