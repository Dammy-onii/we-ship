import * as Crypto from 'expo-crypto';
import type * as Contacts from 'expo-contacts';

import { requireSupabase } from './backend/supabase';
import { signedUrl } from './backend/repository';
import { loadNativeModule, nativeUnavailableReason } from './native-modules';
import type { PersonSummary } from './types';
import { userFacingError } from './user-facing-error';

/**
 * Contact matching that never uploads an address book.
 *
 * The device hashes each email and phone number it finds and sends only the
 * hashes; the server derives every user's own hash from their verified sign-up
 * email and compares. Raw contacts never leave the phone and are never stored.
 *
 * The salt is app-wide and public — it must match `private.contact_salt()` in
 * the database. It defeats a generic rainbow table; it does **not** make a
 * low-entropy identifier like an email unguessable to anyone holding both this
 * constant and the hash table. That is a deliberate, documented trade-off for
 * a feature that has to work without the server ever seeing a contact list.
 */
const CONTACT_SALT = 'weship.contact.v1';

/** Matches the server's format guard in `sync_contact_hashes`. */
async function hashIdentifier(identifier: string): Promise<string | null> {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${normalized}${CONTACT_SALT}`,
  );
}

/**
 * Phone numbers vary wildly between address books (+234 801…, 0801…, spaces,
 * dashes), so a raw hash almost never matches. Reduced to digits, with a
 * leading national zero dropped, they line up far more often.
 */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.length < 7) return null;
  return digits.startsWith('+') ? digits : digits.replace(/^0+/, '');
}

export type ContactScanResult =
  | { ok: true; scanned: number; matches: PersonSummary[] }
  | { ok: false; reason: string };

/**
 * Reads the address book, uploads hashes, and returns who is already here.
 *
 * `expo-contacts` is imported type-only and required at call time: it throws at
 * *module load* where the native module is absent, and a route that throws at
 * import takes down the whole router (see AGENTS.md).
 */
export async function scanContacts(): Promise<ContactScanResult> {
  const unavailable = nativeUnavailableReason('Finding friends from contacts');
  if (unavailable) return { ok: false, reason: unavailable };

  const contacts = loadNativeModule<typeof Contacts>(() => require('expo-contacts'));
  if (!contacts) {
    return { ok: false, reason: 'Contacts are not available in this build.' };
  }

  const permission = await contacts.requestPermissionsAsync();
  if (permission.status !== 'granted') {
    return { ok: false, reason: 'Weship needs permission to read your contacts.' };
  }

  const { data } = await contacts.getContactsAsync({
    fields: [contacts.Fields.Emails, contacts.Fields.PhoneNumbers],
  });

  const identifiers = new Set<string>();
  for (const contact of data ?? []) {
    for (const email of contact.emails ?? []) {
      if (email.email) identifiers.add(email.email);
    }
    for (const phone of contact.phoneNumbers ?? []) {
      const normalized = phone.number ? normalizePhone(phone.number) : null;
      if (normalized) identifiers.add(normalized);
    }
  }

  const hashes = (await Promise.all([...identifiers].map(hashIdentifier))).filter(
    (hash): hash is string => Boolean(hash),
  );

  const client = requireSupabase();
  const sync = await client.rpc('sync_contact_hashes', { p_hashes: hashes });
  if (sync.error) {
    return { ok: false, reason: userFacingError(sync.error, 'Could not match contacts. Please try again.') };
  }

  const matches = await findContactsOnWeship();
  return { ok: true, scanned: identifiers.size, matches };
}

/** People already on Weship who appear in the contacts synced earlier. */
export async function findContactsOnWeship(): Promise<PersonSummary[]> {
  const { data, error } = await requireSupabase().rpc('find_contacts_on_weship');
  if (error) throw new Error(error.message);

  return Promise.all(
    ((data ?? []) as Record<string, any>[]).map(async (row) => ({
      id: row.id,
      displayName: row.display_name ?? 'Weship member',
      username: row.username ?? '',
      photoUri: row.avatar_path ? await signedUrl('avatars', row.avatar_path) : undefined,
      status: row.friend_status as PersonSummary['status'],
    })),
  );
}

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
