// Metas "nivel pro": compara las stats de un jugador con los pros de VCT Americas de su rol.
// Las cifras viven en src/data/valorant/pro-benchmarks.json (sacadas de vlr.gg; ver "method").
import benchmarks from "../../data/valorant/pro-benchmarks.json";
import type { PlayerMatch } from "./types.ts";

export type Role = "duelist" | "initiator" | "controller" | "sentinel";
export const ROLES: Role[] = ["duelist", "initiator", "controller", "sentinel"];
export const ROLE_LABELS: Record<Role, string> = {
  duelist: "Duelista",
  initiator: "Iniciador",
  controller: "Controlador",
  sentinel: "Centinela",
};

const AGENT_ROLE: Record<string, Role> = {
  jett: "duelist", raze: "duelist", reyna: "duelist", phoenix: "duelist", yoru: "duelist", neon: "duelist", iso: "duelist", waylay: "duelist",
  sova: "initiator", breach: "initiator", skye: "initiator", kayo: "initiator", fade: "initiator", gekko: "initiator", tejo: "initiator",
  omen: "controller", brimstone: "controller", viper: "controller", astra: "controller", harbor: "controller", clove: "controller",
  sage: "sentinel", cypher: "sentinel", killjoy: "sentinel", chamber: "sentinel", deadlock: "sentinel", vyse: "sentinel", veto: "sentinel",
};

/** "KAY/O" → kayo; null si el agente no está en la tabla. */
export function roleOfAgent(agent: string): Role | null {
  return AGENT_ROLE[agent.toLowerCase().replace(/[^a-z]/g, "")] ?? null;
}

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as string[]).includes(v);

/** Rol del agente con el que más partidas jugó (empate: el de más rondas). null sin partidas o sin agentes conocidos. */
export function mainRole(ms: PlayerMatch[]): Role | null {
  const count = new Map<Role, { games: number; rounds: number }>();
  for (const m of ms) {
    const r = roleOfAgent(m.agent);
    if (!r) continue;
    const c = count.get(r) ?? { games: 0, rounds: 0 };
    c.games++;
    c.rounds += m.roundsWon + m.roundsLost;
    count.set(r, c);
  }
  let best: Role | null = null;
  let bestC = { games: 0, rounds: 0 };
  for (const [r, c] of count)
    if (c.games > bestC.games || (c.games === bestC.games && c.rounds > bestC.rounds)) [best, bestC] = [r, c];
  return best;
}

export type GoalKey = "acs" | "kd" | "adr" | "kpr" | "apr" | "hs";
export const GOAL_KEYS: GoalKey[] = ["acs", "kd", "adr", "kpr", "apr", "hs"];
export const GOAL_LABELS: Record<GoalKey, string> = {
  acs: "ACS",
  kd: "K/D",
  adr: "Daño/R",
  kpr: "Kills/R",
  apr: "Asist./R",
  hs: "HS%",
};
/** Decimales con que se muestra cada métrica. */
export const GOAL_DECIMALS: Record<GoalKey, number> = { acs: 0, kd: 2, adr: 0, kpr: 2, apr: 2, hs: 0 };

export type ProStats = Record<GoalKey, number | null> & { rounds: number };

/** Las mismas métricas que vlr.gg, a partir de las partidas del jugador. */
export function proStats(ms: PlayerMatch[]): ProStats {
  const sum = (f: (m: PlayerMatch) => number) => ms.reduce((a, m) => a + f(m), 0);
  const rounds = sum((m) => m.roundsWon + m.roundsLost);
  const kills = sum((m) => m.kills);
  const deaths = sum((m) => m.deaths);
  const head = sum((m) => m.headshots);
  const shots = head + sum((m) => m.bodyshots) + sum((m) => m.legshots);
  const per = (n: number) => (rounds > 0 ? n / rounds : null);
  return {
    rounds,
    acs: per(sum((m) => m.score)),
    kd: ms.length ? kills / Math.max(deaths, 1) : null,
    adr: per(sum((m) => m.damageMade)),
    kpr: per(kills),
    apr: per(sum((m) => m.assists)),
    hs: shots > 0 ? (head / shots) * 100 : null,
  };
}

export interface GoalRow {
  key: GoalKey;
  value: number | null;
  pro: number;
  top: number;
  /** "top" si ya alcanzó Pro top, "pro" si alcanzó Pro, "below" si no, null sin datos. */
  level: "top" | "pro" | "below" | null;
  /** Cuánto falta para la siguiente meta (null si ya está en top o sin datos). */
  gap: number | null;
}

export function goalsFor(role: Role, stats: ProStats): GoalRow[] {
  const b = benchmarks.roles[role];
  return GOAL_KEYS.map((key) => {
    const { pro, top } = b[key];
    const value = stats[key];
    if (value === null) return { key, value, pro, top, level: null, gap: null };
    const level = value >= top ? "top" : value >= pro ? "pro" : "below";
    const gap = level === "top" ? null : (level === "pro" ? top : pro) - value;
    return { key, value, pro, top, level, gap };
  });
}

export const benchmarkInfo = {
  collectedAt: benchmarks.collectedAt,
  events: benchmarks.events,
  playersFor: (role: Role) => benchmarks.roles[role].players,
};
