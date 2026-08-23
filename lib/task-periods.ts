import type { Habit, TaskRoutine } from './types';

/**
 * Which periods a shared 2do went unfinished.
 *
 * A task carries a routine — daily, weekly or monthly — and each completion is
 * stamped with the start date of the period it belongs to. A period with no
 * completion row is a period the task was not done in.
 *
 * The current period is never counted: it is still open, and calling today's
 * task "missed" before the day is over would be wrong and nagging.
 */

export type MissedPeriod = {
  taskId: string;
  label: string;
  routine: TaskRoutine;
  /** Start date of the period, ISO. Also the sort key. */
  periodKey: string;
  /** How to say it: "yesterday", "last week", "in March". */
  when: string;
  /** True when you did not complete it. */
  missedByYou: boolean;
  /** True when your partner did not complete it. */
  missedByPartner: boolean;
};

export type CompletionRow = { taskId: string; userId: string; periodKey: string };

/**
 * How far back the tracker looks, per routine.
 *
 * Split by routine so each one gets a useful amount of history without the
 * query paying for the longest: seven days of dailies is a week of rows, while
 * three weeks of weeklies is only three. A single shared window would have to
 * be the widest of the three, and daily rows are what actually make the query
 * big — two per task per day.
 *
 * Anything older than the fetch has no row loaded, and *no row* is
 * indistinguishable from *not done*, so the tracker never looks past it. That
 * would invent failures rather than report them.
 */
export const LOOKBACK_DAYS: Record<TaskRoutine, number> = {
  daily: 7,
  weekly: 21,
  // Only the open period. Reaching a whole month further back would more than
  // quadruple the rows fetched on every sync, for one extra data point.
  monthly: 0,
};

/** Widest lookback, which is what the fetch has to cover. */
export const COMPLETION_WINDOW_DAYS = Math.max(...Object.values(LOOKBACK_DAYS));

/** Period start for a date, matching `public.task_period_key` exactly. */
export function periodStart(routine: TaskRoutine, date: Date): string {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (routine === 'weekly') {
    // Postgres `date_trunc('week')` starts on Monday; getUTCDay() has Sunday 0.
    const day = value.getUTCDay() || 7;
    value.setUTCDate(value.getUTCDate() - day + 1);
  } else if (routine === 'monthly') {
    value.setUTCDate(1);
  }
  return value.toISOString().slice(0, 10);
}

function previousPeriod(routine: TaskRoutine, periodKey: string): string {
  const value = new Date(`${periodKey}T00:00:00Z`);
  if (routine === 'weekly') value.setUTCDate(value.getUTCDate() - 7);
  else if (routine === 'monthly') value.setUTCMonth(value.getUTCMonth() - 1);
  else value.setUTCDate(value.getUTCDate() - 1);
  return periodStart(routine, value);
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Plain words for a period, relative to now where that reads better. */
function describe(routine: TaskRoutine, periodKey: string, now: Date): string {
  const start = new Date(`${periodKey}T00:00:00Z`);
  const currentStart = new Date(`${periodStart(routine, now)}T00:00:00Z`);
  const stepMs = routine === 'daily' ? 86_400_000 : 7 * 86_400_000;

  if (routine === 'monthly') {
    const months =
      (currentStart.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (currentStart.getUTCMonth() - start.getUTCMonth());
    if (months === 1) return 'last month';
    return `in ${MONTHS[start.getUTCMonth()]}`;
  }

  const steps = Math.round((currentStart.getTime() - start.getTime()) / stepMs);
  if (routine === 'daily') {
    if (steps === 1) return 'yesterday';
    if (steps < 7) return `${steps} days ago`;
    // The daily lookback ends at seven, so this is the oldest it can read.
    return 'a week ago';
  }
  if (steps === 1) return 'last week';
  return `${steps} weeks ago`;
}

/**
 * Every period each task went unfinished, newest first.
 *
 * `meId` and `partnerId` are the local aliases the store uses, so the result
 * can say which of the two people let it slip.
 */
export function findMissedPeriods(
  tasks: Habit[],
  completions: CompletionRow[],
  meId: string,
  partnerId: string,
  now = new Date(),
): MissedPeriod[] {
  const missed: MissedPeriod[] = [];

  for (const task of tasks) {
    const lookbackDays = LOOKBACK_DAYS[task.routine];
    // A routine with no lookback has only its open period, which is never missed.
    if (lookbackDays <= 0) continue;
    const earliestKnown = new Date(now.getTime() - lookbackDays * 86_400_000);
    const done = new Set(
      completions
        .filter((row) => row.taskId === task.id)
        .map((row) => `${row.userId}@${row.periodKey}`),
    );
    // Nothing before the task existed, and nothing before the fetch window.
    const createdAt = task.createdAt ? new Date(task.createdAt) : earliestKnown;
    const floor = createdAt > earliestKnown ? createdAt : earliestKnown;
    const floorKey = periodStart(task.routine, floor);

    let periodKey = previousPeriod(task.routine, periodStart(task.routine, now));
    // Bounded rather than while(true): a corrupt date must not spin forever.
    for (let guard = 0; guard < 64 && periodKey >= floorKey; guard += 1) {
      const missedByYou = !done.has(`${meId}@${periodKey}`);
      const missedByPartner = !done.has(`${partnerId}@${periodKey}`);
      if (missedByYou || missedByPartner) {
        missed.push({
          taskId: task.id,
          label: task.label,
          routine: task.routine,
          periodKey,
          when: describe(task.routine, periodKey, now),
          missedByYou,
          missedByPartner,
        });
      }
      periodKey = previousPeriod(task.routine, periodKey);
    }
  }

  return missed.sort((a, b) => b.periodKey.localeCompare(a.periodKey));
}
