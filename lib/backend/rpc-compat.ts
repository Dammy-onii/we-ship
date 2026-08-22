/**
 * Tolerating a database that is behind the app.
 *
 * Migrations and app code ship separately, so there is always a window where a
 * build calls an RPC the project has not been given yet. PostgREST reports that
 * as `PGRST202` ("could not find the function ... in the schema cache") rather
 * than anything the user could act on, and an unguarded call surfaces it as a
 * raw error in the middle of a normal flow.
 *
 * Callers use this to decide between a real failure and a not-yet-deployed one,
 * so they can fall back to a direct table write where the policies allow it, or
 * say something honest where they cannot.
 */
export function isMissingRpc(error: { code?: string; message?: string } | null, name: string) {
  if (!error) return false;
  const message = error.message ?? '';
  return (
    error.code === 'PGRST202' ||
    (message.includes(name) && /schema cache|could not find the function/i.test(message))
  );
}

/** Same idea for a column a pending migration has not added yet. */
export function isMissingColumn(
  error: { code?: string; message?: string } | null,
  columns: string[],
) {
  if (!error) return false;
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    columns.some((column) => new RegExp(`(?:column|field).*${column}`, 'i').test(error.message ?? ''))
  );
}

/**
 * Message shown when an RPC is genuinely required and has no client-side
 * equivalent — the policies do not permit the equivalent direct write.
 */
export function pendingMigrationMessage(feature: string) {
  return `${feature} needs a database update that has not been applied yet. Run "npx supabase db push" and try again.`;
}
