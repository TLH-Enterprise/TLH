import type { Labels, LineupEntry, Mode, PlayerMatch, Roster, Side, TeamMatch, TeamRound } from "./types.ts";

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

/** `data` de GET /v4/match/{region}/{id} (solo los campos que usamos). */
export interface V4Match {
  metadata: {
    match_id: string;
    map: { name: string };
    started_at: string;
    is_completed: boolean;
    season: { short: string };
  };
  players: Array<{
    puuid: string;
    name: string;
    tag: string;
    team_id: string;
    agent: { name: string };
    stats: {
      score: number;
      kills: number;
      deaths: number;
      assists: number;
      headshots: number;
      bodyshots: number;
      legshots: number;
      damage: { dealt: number };
    };
  }>;
  teams: Array<{
    team_id: string;
    rounds: { won: number; lost: number };
    premier_roster: { name: string } | null;
  }>;
  rounds: Array<{ winning_team: string; winning_team_role: string }>;
}

export const MIN_ROSTER_ON_SIDE = 4;

const toSide = (s: string): Side => (s.toLowerCase() === "red" ? "Red" : "Blue");
const toRole = (r: string): TeamRound["role"] => (r.toLowerCase().startsWith("attack") ? "Attack" : "Defense");

/** IDs de partida que vale la pena pedir completas para ver si son de equipo. */
export function teamCandidates(rows: PlayerMatch[], roster: Roster, labels: Labels): Map<string, "premier" | "custom"> {
  const inRoster = new Set(roster.players.map((p) => p.puuid));
  const out = new Map<string, "premier" | "custom">();
  const perSide = new Map<string, Map<Side, Set<string>>>();
  for (const r of rows) {
    if (!inRoster.has(r.puuid)) continue;
    if (r.mode === "premier") out.set(r.matchId, "premier");
    else if (r.mode === "custom") {
      const sides = perSide.get(r.matchId) ?? new Map<Side, Set<string>>();
      const set = sides.get(r.side) ?? new Set<string>();
      set.add(r.puuid);
      sides.set(r.side, set);
      perSide.set(r.matchId, sides);
    }
  }
  for (const [id, sides] of perSide) {
    const max = Math.max(...[...sides.values()].map((s) => s.size));
    if (max >= MIN_ROSTER_ON_SIDE || labels[id]?.include === true) out.set(id, "custom");
  }
  for (const [id, label] of Object.entries(labels)) {
    if (label.include === false) out.delete(id);
  }
  return out;
}

export function toTeamMatch(match: V4Match, roster: Roster, kind: "premier" | "custom", force = false): TeamMatch | null {
  const { metadata, players, teams, rounds } = match;
  if (metadata.is_completed === false || rounds.length === 0) return null;
  const inRoster = new Set(roster.players.map((p) => p.puuid));

  let side: Side | null = null;
  if (kind === "premier") {
    const t = teams.find((t) => t.premier_roster?.name === roster.premierTeam.name);
    if (t) side = toSide(t.team_id);
  } else {
    const count = (s: Side) => players.filter((p) => toSide(p.team_id) === s && inRoster.has(p.puuid)).length;
    const red = count("Red");
    const blue = count("Blue");
    const best: Side = red >= blue ? "Red" : "Blue";
    if (Math.max(red, blue) >= MIN_ROSTER_ON_SIDE || (force && Math.max(red, blue) > 0)) side = best;
  }
  if (!side) return null;

  const ours = teams.find((t) => toSide(t.team_id) === side);
  const theirs = teams.find((t) => toSide(t.team_id) !== side);
  if (!ours) return null;
  const riotId = (p: { name: string; tag: string }) => `${p.name}#${p.tag}`;

  const lineup: LineupEntry[] = players
    .filter((p) => toSide(p.team_id) === side)
    .map((p) => ({
      puuid: p.puuid,
      riotId: riotId(p),
      agent: p.agent.name,
      inRoster: inRoster.has(p.puuid),
      kills: p.stats.kills,
      deaths: p.stats.deaths,
      assists: p.stats.assists,
      headshots: p.stats.headshots,
      bodyshots: p.stats.bodyshots,
      legshots: p.stats.legshots,
      damage: p.stats.damage.dealt,
      score: p.stats.score,
    }));

  const teamRounds: TeamRound[] = rounds.map((r) => {
    const won = toSide(r.winning_team) === side;
    const winnerRole = toRole(r.winning_team_role);
    return { won, role: won ? winnerRole : winnerRole === "Attack" ? "Defense" : "Attack" };
  });

  return {
    matchId: metadata.match_id,
    kind,
    startedAt: metadata.started_at,
    map: metadata.map.name,
    season: metadata.season.short,
    side,
    roundsWon: ours.rounds.won,
    roundsLost: ours.rounds.lost,
    won: outcome(ours.rounds.won, ours.rounds.lost),
    opponentName: kind === "premier" ? (theirs?.premier_roster?.name ?? null) : null,
    opponentPlayers: players.filter((p) => toSide(p.team_id) !== side).map(riotId),
    lineup,
    rounds: teamRounds,
  };
}
