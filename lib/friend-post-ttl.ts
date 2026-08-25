/**
 * How long a friend-board post lives.
 *
 * The friend board is deliberately ephemeral: posts are for the next day or
 * two, not an archive. The lifetime is enforced in four places, and they must
 * agree — this module is the one definition all of them read.
 *
 * 1. **The database** — an RLS `select` guard hides expired rows the moment
 *    they pass the cutoff, so expiry is correct even between purges.
 * 2. **The purge** — `dispatch-reminders` deletes expired rows and their
 *    storage objects, so nothing lingers server-side.
 * 3. **The client** — `fetchFriendPosts` filters by the same cutoff, so the
 *    board and the Spotlight drop a post the instant it expires.
 * 4. **The device cache** — local copies of friend media are pruned on the
 *    same clock rather than outliving the posts they belong to.
 */

export const FRIEND_POST_TTL_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * The lifetime in days, for anything shown to a person.
 *
 * Derived rather than written out again: the board tells users how long a post
 * lasts, and a hardcoded "2 days" in the copy would quietly start lying the
 * moment the constant above changed.
 */
export const FRIEND_POST_TTL_DAYS = Math.round(FRIEND_POST_TTL_MS / 86_400_000);

/** The oldest `created_at` that is still visible, as a Postgres-safe string. */
export function friendPostCutoffISO(now: number = Date.now()): string {
  return new Date(now - FRIEND_POST_TTL_MS).toISOString();
}
