import * as WebBrowser from 'expo-web-browser';

import { requireSupabase } from './supabase';

export type ProviderConnection = {
  id: string;
  provider: 'google' | 'spotify';
  account_label?: string;
  scopes: string[];
  status: 'active' | 'expired' | 'revoked' | 'error';
};

export async function listConnections(): Promise<ProviderConnection[]> {
  const { data, error } = await requireSupabase()
    .from('provider_connections')
    .select('id, provider, account_label, scopes, status')
    .order('connected_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as ProviderConnection[];
}

export async function connectGoogle() {
  const { data, error } = await requireSupabase().functions.invoke('google-oauth-start', {
    body: { returnUrl: 'weship://connections/google' },
  });
  if (error) throw new Error(error.message);
  if (!data?.authorizationUrl) throw new Error('Google authorization URL was not returned.');
  const result = await WebBrowser.openAuthSessionAsync(data.authorizationUrl, 'weship://connections/google');
  if (result.type !== 'success') return false;
  return true;
}

export async function disconnectProvider(provider: 'google' | 'spotify') {
  const { error } = await requireSupabase().functions.invoke('provider-disconnect', { body: { provider } });
  if (error) throw new Error(error.message);
}

export async function listGoogleCalendars() {
  const { data, error } = await requireSupabase().functions.invoke('google-calendar-list');
  if (error) throw new Error(error.message);
  return (data?.calendars ?? []) as { id: string; name: string; color?: string; selected: boolean }[];
}

export async function importGoogleCalendar(calendarIds: string[]) {
  const { data, error } = await requireSupabase().functions.invoke('google-calendar-import', {
    body: { calendarIds, timeMin: new Date().toISOString() },
  });
  if (error) throw new Error(error.message);
  return data as { imported: number; updated: number };
}

export async function createGoogleCalendarEvent(input: {
  title: string;
  details?: string;
  startsAt: string;
  date?: string;
  endsAt?: string;
  allDay: boolean;
  calendarId?: string;
}) {
  const { data, error } = await requireSupabase().functions.invoke('google-calendar-create', { body: input });
  if (error) throw new Error(error.message);
  return data;
}
