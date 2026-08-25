-- Intentionally a no-op.
--
-- This version originally carried a hardcoded email address to scope a one-off
-- cleanup of answered daily questions. That was the wrong mechanism twice over:
-- the address was not the account's Supabase auth email, so it matched nothing
-- and cleared nothing; and a personal identifier does not belong in schema
-- history, which is committed, shared and permanent.
--
-- The version is kept because it has already been applied to the remote
-- database — removing it would put the local and remote migration histories out
-- of step. Data cleanups now run as ad-hoc SQL against a chosen account rather
-- than as migrations.

do $$
begin
  raise notice 'No-op: superseded. See the migration comment.';
end $$;
