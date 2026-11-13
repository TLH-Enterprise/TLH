import type { Dataset, Mode, PlayerMatch, Roster, TeamMatch } from "./types.ts";

export const MIN_GAMES = 3;
const TREND_WINDOW = 10;
const TREND_MIN_GAMES = 15;
const HS_TREND_POINTS = 3;
const KD_TREND = 0.15;

export type Period = "act" | "all";
export interface Filter {
  modes: Mode[];
  period: Period;
}

export interface Line {
  games: number;
  wins: number;
  winRate: number | null;
  kd: number | null;
  hsPct: number | null;
  dmgPerRound: number | null;
}

const byNewest = <T extends { startedAt: string }>(xs: T[]) => [...xs].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : null);
const winRateOf = (games: number, wins: number) => (games >= MIN_GAMES ? (wins / games) * 100 : null);

function mostCommon(xs: string[]): string | null {
  const counts = new Map<string, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [k, c] of counts) if (c > n) [best, n] = [k, c];
  return best;
}

export function currentSeason(ds: Dataset): string | null {
  const all = [...ds.playerMatches, ...ds.teamMatches];
  if (all.length === 0) return null;
  return byNewest(all)[0].season;
}

export function includedTeamMatches(ds: Dataset): TeamMatch[] {
  return ds.teamMatches.filter((t) => ds.labels[t.matchId]?.include !== false);
}

function inPeriod(ds: Dataset, period: Period) {
  const season = period === "act" ? currentSeason(ds) : null;
  return (m: { season: string }) => season === null || m.season === season;
}

export function teamMatchesFor(ds: Dataset, f: Filter): TeamMatch[] {
  const ok = inPeriod(ds, f.period);
  return byNewest(includedTeamMatches(ds).filter((t) => f.modes.includes(t.kind) && ok(t)));
}

export function playerMatchesFor(ds: Dataset, puuid: string, f: Filter): PlayerMatch[] {
  const ok = inPeriod(ds, f.period);
  const teamIds = new Set(includedTeamMatches(ds).map((t) => t.matchId));
  return byNewest(
    ds.playerMatches.filter(
      (m) => m.puuid === puuid && f.modes.includes(m.mode) && ok(m) && (m.mode !== "custom" || teamIds.has(m.matchId)),
    ),
  );
}

export function line(ms: PlayerMatch[]): Line {
  const games = ms.length;
  const wins = ms.filter((m) => m.won === true).length;
  if (games === 0) return { games, wins, winRate: null, kd: null, hsPct: null, dmgPerRound: null };
  const sum = (f: (m: PlayerMatch) => number) => ms.reduce((a, m) => a + f(m), 0);
  const kills = sum((m) => m.kills);
  const deaths = sum((m) => m.deaths);
  const head = sum((m) => m.headshots);
  const shots = head + sum((m) => m.bodyshots) + sum((m) => m.legshots);
  const rounds = sum((m) => m.roundsWon + m.roundsLost);
  return {
    games,
    wins,
    winRate: winRateOf(games, wins),
    kd: kills / Math.max(deaths, 1),
    hsPct: pct(head, shots),
    dmgPerRound: rounds > 0 ? sum((m) => m.damageMade) / rounds : null,
  };
}

export function byKey(ms: PlayerMatch[], key: "map" | "agent"): Array<{ key: string; line: Line; topAgent?: string }> {
  const groups = new Map<string, PlayerMatch[]>();
  for (const m of ms) groups.set(m[key], [...(groups.get(m[key]) ?? []), m]);
  return [...groups.entries()]
    .map(([k, g]) => ({ key: k, line: line(g), ...(key === "map" ? { topAgent: mostCommon(g.map((m) => m.agent)) ?? undefined } : {}) }))
    .sort((a, b) => b.line.games - a.line.games || a.key.localeCompare(b.key));
}

export function teamByMap(tms: TeamMatch[]) {
  const groups = new Map<string, TeamMatch[]>();
  for (const t of tms) groups.set(t.map, [...(groups.get(t.map) ?? []), t]);
  return [...groups.entries()]
    .map(([map, g]) => {
      const rounds = g.flatMap((t) => t.rounds);
      const atk = rounds.filter((r) => r.role === "Attack");
      const def = rounds.filter((r) => r.role === "Defense");
      const wins = g.filter((t) => t.won === true).length;
      return {
        map,
        games: g.length,
        wins,
        winRate: winRateOf(g.length, wins),
        atkPct: pct(atk.filter((r) => r.won).length, atk.length),
        defPct: pct(def.filter((r) => r.won).length, def.length),
      };
    })
    .sort((a, b) => b.games - a.games || a.map.localeCompare(b.map));
}

export function compositions(tms: TeamMatch[]) {
  const groups = new Map<string, { map: string; agents: string[]; games: number; wins: number }>();
  for (const t of tms) {
    const agents = t.lineup.map((l) => l.agent).sort();
    const k = `${t.map}|${agents.join(",")}`;
    const g = groups.get(k) ?? { map: t.map, agents, games: 0, wins: 0 };
    g.games++;
    if (t.won === true) g.wins++;
    groups.set(k, g);
  }
  return [...groups.values()]
    .map(({ map, agents, games, wins }) => ({ map, agents, games, winRate: winRateOf(games, wins) }))
    .sort((a, b) => b.games - a.games);
}

export function mapDetail(tms: TeamMatch[], map: string, roster: Roster) {
  const onMap = tms.filter((t) => t.map === map);
  return roster.players.map((p) => {
    const riotId = `${p.name}#${p.tag}`;
    const played = onMap.flatMap((t) => {
      const l = t.lineup.find((x) => x.puuid === p.puuid);
      return l ? [{ l, won: t.won }] : [];
    });
    if (played.length === 0) return { riotId, topAgent: null, games: 0, winRate: null, kd: null };
    const kills = played.reduce((a, x) => a + x.l.kills, 0);
    const deaths = played.reduce((a, x) => a + x.l.deaths, 0);
    return {
      riotId,
      topAgent: mostCommon(played.map((x) => x.l.agent)),
      games: played.length,
      winRate: winRateOf(played.length, played.filter((x) => x.won === true).length),
      kd: kills / Math.max(deaths, 1),
    };
  });
}

export function recent(ds: Dataset, tms: TeamMatch[], n: number) {
  return byNewest(tms)
    .slice(0, n)
    .map((t) => {
      const label = ds.labels[t.matchId];
      const kindLabel: "Premier" | "Scrim" | "Torneo" =
        t.kind === "premier" ? "Premier" : label?.type === "torneo" ? "Torneo" : "Scrim";
      const rival =
        t.kind === "premier"
          ? (t.opponentName ?? "—")
          : (label?.rival ?? (t.opponentPlayers[0] ? `Scrim vs ${t.opponentPlayers[0]}` : "Scrim"));
      return {
        matchId: t.matchId,
        date: t.startedAt,
        kindLabel,
        map: t.map,
        score: `${t.roundsWon}–${t.roundsLost}`,
        won: t.won,
        rival,
        subs: t.lineup.filter((l) => !l.inRoster).map((l) => l.riotId),
      };
    });
}

export function highlights(all: PlayerMatch[]): string[] {
  const out: string[] = [];
  const maps = byKey(all, "map").filter((m) => m.line.winRate !== null);
  if (maps.length >= 2) {
    const sorted = [...maps].sort((a, b) => b.line.winRate! - a.line.winRate!);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.line.winRate !== worst.line.winRate) {
      out.push(`Mejor mapa: ${best.key} (${Math.round(best.line.winRate!)}% en ${best.line.games})`);
      out.push(`Peor mapa: ${worst.key} (${Math.round(worst.line.winRate!)}% en ${worst.line.games})`);
    }
  }
  if (all.length >= TREND_MIN_GAMES) {
    const whole = line(all);
    const last = line(byNewest(all).slice(0, TREND_WINDOW));
    if (whole.hsPct !== null && last.hsPct !== null && Math.abs(last.hsPct - whole.hsPct) >= HS_TREND_POINTS) {
      const dir = last.hsPct > whole.hsPct ? "subió" : "bajó";
      out.push(`HS% ${dir} de ${Math.round(whole.hsPct)}% a ${Math.round(last.hsPct)}% en las últimas ${TREND_WINDOW}`);
    }
    if (whole.kd !== null && last.kd !== null && Math.abs(last.kd - whole.kd) >= KD_TREND) {
      const dir = last.kd > whole.kd ? "subió" : "bajó";
      out.push(`K/D ${dir} de ${whole.kd.toFixed(2)} a ${last.kd.toFixed(2)} en las últimas ${TREND_WINDOW}`);
    }
  }
  return out.slice(0, 3);
}

export function rrSeries(ds: Dataset, puuid: string): Array<{ date: string; elo: number }> {
  return ds.snapshots.flatMap((s) => (s.players[puuid] ? [{ date: s.date, elo: s.players[puuid].elo }] : []));
}
