import { backendConfig } from './config';
import { requireSupabase } from './supabase';

export type DriveMediaTarget = 'memory' | 'goodie';

export type AuthenticatedMediaSource = {
  uri: string;
  headers: Record<string, string>;
};

/**
 * Builds an authenticated source for a Drive original without exposing the
 * Drive owner's Google access token to either partner's device.
 */
export async function driveMediaSource(
  target: DriveMediaTarget,
  id: string,
): Promise<AuthenticatedMediaSource> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw new Error(error.message);
  if (!data.session?.access_token) throw new Error('Sign in again to open this original.');

  const query = new URLSearchParams({ target, id });
  return {
    uri: `${backendConfig.supabaseUrl}/functions/v1/google-drive-media-content?${query}`,
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      apikey: backendConfig.supabaseKey,
    },
  };
}
