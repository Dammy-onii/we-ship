import { createClient } from 'npm:@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

export const service = createClient(url, serviceKey, { auth: { persistSession: false } });

export async function authenticatedUser(request: Request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization) throw new Error('Authentication required');
  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new Error('Authentication required');
  return data.user;
}

export async function userSpaceId(userId: string) {
  const { data, error } = await service.from('space_members').select('space_id').eq('user_id', userId).single();
  if (error || !data) throw new Error('Create or join a shared space first');
  return data.space_id as string;
}

