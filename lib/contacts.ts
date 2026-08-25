import { requireSupabase } from './backend/supabase';

/**
 * Personal notifications: friend requests, acceptances, and friend-board posts.
 *
 * This file also held address-book matching, which has been removed. It hashed
 * every email and phone number on the device and compared them against the
 * address each person verified at sign-up — but almost nobody stores an email
 * on a contact card, so it read a whole address book and reliably found nobody.
 * Matching it properly needs a verified phone number, which Weship does not
 * collect. People are added by username instead.
 *
 * The database side (`contact_hashes`, `sync_contact_hashes`,
 * `find_contacts_on_weship`, `profiles.identity_hash`) is left in place and is
 * simply unused; nothing writes to it any more.
 */

export type PersonalNotification = {
  id: string;
  kind:
    | 'contact_joined'
    | 'friend_request'
    | 'friend_accepted'
    | 'friend_declined'
    | 'friend_withdrawn'
    | 'friend_removed'
    | 'friend_post';
  title: string;
  body?: string;
  route?: string;
  readAt?: string;
  createdAt: string;
};

export async function fetchPersonalNotifications(): Promise<PersonalNotification[]> {
  const { data, error } = await requireSupabase()
    .from('personal_notifications')
    .select('id, kind, title, body, route, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, any>[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? undefined,
    route: row.route ?? undefined,
    readAt: row.read_at ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function markPersonalNotificationsRead() {
  const { error } = await requireSupabase()
    .from('personal_notifications')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null);
  if (error) throw new Error(error.message);
}
