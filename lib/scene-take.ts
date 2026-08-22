/**
 * The most recent Scene Challenge "take".
 *
 * Stage 1 (now): the recorder saves the real captured video plus a timestamped
 * ranking here; the result screen plays the video back and draws the ranking
 * overlay in sync. Passing this through a module singleton (rather than router
 * params) keeps the video URI and the timing array intact.
 *
 * Stage 2 (native burn-in): a compositor will read `videoUri` + `entries` to
 * bake the overlay into an exportable file. The shape is designed for that.
 */

export type RankEntry = {
  scenarioId: string;
  rank: number;
  /** Milliseconds from the start of the recording when this rank was chosen. */
  atMs: number;
};

export type SceneTake = {
  packId: string;
  /** Local file URI of the captured clip. Undefined if capture was unavailable. */
  videoUri?: string;
  durationMs: number;
  /** Ranking in the order the scenarios were shown (not sorted by rank). */
  entries: RankEntry[];
  /** True when this take has no real recording (e.g. web preview / no camera). */
  simulated: boolean;
  createdAt: string;
};

let lastTake: SceneTake | null = null;

export function setLastTake(take: SceneTake) {
  lastTake = take;
}

export function getLastTake(): SceneTake | null {
  return lastTake;
}

/** Scenario ids ordered best-to-worst (rank 1 first). */
export function rankedOrder(take: SceneTake): string[] {
  return [...take.entries].sort((a, b) => a.rank - b.rank).map((entry) => entry.scenarioId);
}
