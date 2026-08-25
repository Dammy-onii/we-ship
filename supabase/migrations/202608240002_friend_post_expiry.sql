-- Friend-board posts expire after two days, everywhere.
--
-- Previously only the *device media cache* expired on this clock: the rows and
-- their storage objects lived forever, so an old post stayed in the database
-- and kept appearing on the Spotlight while the widget quietly dropped it.
--
-- Expiry is enforced here, in the read policy, so it is a rule rather than a
-- cleanup job — a post becomes unreadable the instant it passes the cutoff,
-- with no dependence on when the purge next runs. The purge itself lives in the
-- scheduled `dispatch-reminders` function, which holds the service role and can
-- therefore delete the storage *objects* as well as the rows. Deleting
-- `storage.objects` from SQL would unlink the metadata and leave the underlying
-- file orphaned in the bucket.

-- The purge scans by age across all authors, so the existing
-- (author_id, created_at) index does not serve it.
create index if not exists friend_posts_created_at_idx
  on public.friend_posts(created_at);

/**
 * How long a friend post lives.
 *
 * Mirrors FRIEND_POST_TTL_MS in lib/friend-post-ttl.ts, which documents every
 * layer that reads it. Change both together.
 */
create or replace function public.friend_post_ttl()
returns interval
language sql
immutable
as $$ select interval '2 days' $$;

drop policy if exists friend_posts_read_friends on public.friend_posts;
create policy friend_posts_read_friends on public.friend_posts for select
  using (
    created_at > now() - public.friend_post_ttl()
    and (author_id = auth.uid() or public.is_friend(author_id))
  );
