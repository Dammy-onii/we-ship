/**
 * Converts infrastructure and SDK failures into copy that is safe to show in
 * the interface. Detailed errors still belong in development logs; database
 * object names, constraint names, JWTs, and SDK internals do not belong in a
 * user-facing banner or alert.
 */
export function userFacingError(cause: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const raw = cause instanceof Error
    ? cause.message.trim()
    : cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string'
      ? cause.message.trim()
      : '';
  if (!raw) return fallback;

  if (/network request failed|failed to fetch|network error|fetch failed|timed? out|econn|enotfound/i.test(raw)) {
    return 'Can’t connect right now. Check your internet connection and try again.';
  }

  if (/get_friend_graph|friend_posts.*(?:width|height)|schema cache|pgrst\d+/i.test(raw)) {
    return 'Friends are temporarily unavailable. Please try again shortly.';
  }

  if (/jwt|refresh token|session.*(?:expired|missing)|not authenticated|authentication required/i.test(raw)) {
    return 'Your session has expired. Please sign in again.';
  }

  if (/permission denied|row-level security|violates row-level security|not authorized|unauthorized/i.test(raw)) {
    return 'You don’t have permission to do that.';
  }

  if (/duplicate key|unique constraint|violates.*constraint|foreign key constraint|check constraint/i.test(raw)) {
    return 'That change conflicts with something already saved.';
  }

  // These signatures almost always contain implementation details from
  // Postgres, PostgREST, Supabase Functions, or native modules.
  if (
    /(?:public|private|auth|storage)\.[a-z_]+|function [a-z_]+\(|column ["']?[a-z_]+|relation ["']?[a-z_]+|sqlstate|postgres|supabase|expo-[a-z-]+|native module|edge function/i.test(raw)
    || raw.length > 180
  ) {
    return fallback;
  }

  // Purpose-written domain messages (for example, "That username is taken")
  // remain useful and should not be flattened into generic copy.
  return raw;
}
