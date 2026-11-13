import type { PlayerMatch, Snapshot, TeamMatch } from "./types.ts";

const byStartedDesc = (x: { startedAt: string }, y: { startedAt: string }) =>
  y.startedAt.localeCompare(x.startedAt);

function mergeBy<T extends { startedAt: string }>(a: T[], b: T[], key: (x: T) => string): T[] {
  const map = new Map<string, T>();
  for (const x of a) map.set(key(x), x);
  for (const x of b) map.set(key(x), x);
  return [...map.values()].sort(byStartedDesc);
}

export function mergePlayerMatches(a: PlayerMatch[], b: PlayerMatch[]): PlayerMatch[] {
  return mergeBy(a, b, (m) => `${m.matchId}:${m.puuid}`);
}

export function mergeTeamMatches(a: TeamMatch[], b: TeamMatch[]): TeamMatch[] {
  return mergeBy(a, b, (m) => m.matchId);
}

export function upsertSnapshot(list: Snapshot[], s: Snapshot): Snapshot[] {
  return [...list.filter((x) => x.date !== s.date), s].sort((x, y) => x.date.localeCompare(y.date));
}
