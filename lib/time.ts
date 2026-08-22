/** Small date/time helpers. Uses Intl where available, with safe fallbacks. */

/**
 * The calendar day (YYYY-MM-DD) in a given timezone.
 *
 * Daily tasks and streaks must roll over at the user's local midnight, not
 * UTC's — `toISOString().slice(0, 10)` puts the boundary at 01:00 in Lagos and
 * 17:00 in US Pacific. Pass the profile's IANA timezone; falls back to the
 * device zone, then to UTC.
 */
export function dayKeyIn(timezone?: string, now = new Date()): string {
  try {
    // en-CA formats as YYYY-MM-DD, which is exactly the key shape we store.
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone || undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  } catch {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
    } catch {
      return now.toISOString().slice(0, 10);
    }
  }
}

/** The device's own IANA timezone, or undefined if unavailable. */
export function deviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/** Calendar day containing an instant in the requested timezone. */
export function dayKeyForInstant(isoDateTime: string, timezone?: string): string {
  const instant = new Date(isoDateTime);
  return dayKeyIn(timezone, Number.isNaN(instant.getTime()) ? new Date(0) : instant);
}

export function localTimeIn(timezone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(now);
  }
}

export function partOfDayIn(timezone: string, now = new Date()): string {
  let hour = now.getHours();
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(now),
    );
  } catch {}
  if (hour < 5) return 'late night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

/** Whole days from now until an ISO date (YYYY-MM-DD), floored at 0. */
export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(isoDate + 'T00:00:00');
  const ms = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function relativeDay(isoDate: string, now = new Date()): string {
  const d = new Date(isoDate + 'T00:00:00');
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff < 0) {
    const ahead = Math.abs(diff);
    if (ahead === 1) return 'Tomorrow';
    if (ahead < 7) return `In ${ahead} days`;
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
  }
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}
