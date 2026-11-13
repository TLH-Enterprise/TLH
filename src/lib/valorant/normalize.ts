import type { Mode, PlayerMatch, Side } from "./types.ts";

/** Una fila de `data[]` en GET /v1/stored-matches/{region}/{name}/{tag}. */
export interface StoredMatchRow {
  meta: {
    id: string;
    map: { name: string };
    started_at: string;
    season: { short: string };
  };
  stats: {
    puuid: string;
    team: string;
    character: { name: string };
    tier: number;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    shots: { head: number; body: number; leg: number };
    damage: { made: number; received: number };
  };
  teams: { red: number; blue: number };
}

export function outcome(won: number, lost: number): boolean | null {
  return won === lost ? null : won > lost;
}

export function toPlayerMatch(row: StoredMatchRow, mode: Mode): PlayerMatch | null {
  const { meta, stats, teams } = row;
  if (teams.red + teams.blue === 0) return null;
  const side: Side = stats.team.toLowerCase() === "red" ? "Red" : "Blue";
  const roundsWon = side === "Red" ? teams.red : teams.blue;
  const roundsLost = side === "Red" ? teams.blue : teams.red;
  return {
    matchId: meta.id,
    puuid: stats.puuid,
    mode,
    startedAt: meta.started_at,
    map: meta.map.name,
    season: meta.season.short,
    agent: stats.character.name,
    side,
    roundsWon,
    roundsLost,
    won: outcome(roundsWon, roundsLost),
    kills: stats.kills,
    deaths: stats.deaths,
    assists: stats.assists,
    headshots: stats.shots.head,
    bodyshots: stats.shots.body,
    legshots: stats.shots.leg,
    damageMade: stats.damage.made,
    damageReceived: stats.damage.received,
    score: stats.score,
    tier: stats.tier,
  };
}
