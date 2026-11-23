// Objetivos generales del equipo (pestaña Ranking). La lista vive en src/data/valorant/team-goals.json.
import data from "../../data/valorant/team-goals.json";
import type { LeaderRow } from "./stats.ts";

export type TeamGoalMetric = "rank" | "winRate" | "kd" | "hsPct" | "dmgPerRound" | "kda" | "games" | "activeDays";

export interface TeamGoal {
  id: string;
  label: string;
  metric: TeamGoalMetric;
  target: number;
}

export interface GoalProgress {
  puuid: string;
  name: string;
  /** Valor actual (para activeDays: días desde la última ranked). null sin datos. */
  value: number | null;
  met: boolean;
  /** 0..1, cuánto lleva del objetivo. */
  progress: number;
}

export interface TeamGoalResult {
  goal: TeamGoal;
  players: GoalProgress[];
  metCount: number;
}

export const teamGoals: TeamGoal[] = data.goals as TeamGoal[];

const DAY = 86_400_000;
/** ELO de HenrikDev: (tier - 3) * 100 + RR. */
const eloOfTier = (tier: number) => (tier - 3) * 100;

function valueOf(r: LeaderRow, metric: TeamGoalMetric, now: Date): number | null {
  switch (metric) {
    case "rank":
      return r.elo;
    case "kda":
      return r.kda;
    case "games":
      return r.line.games;
    case "activeDays":
      return r.lastPlayedAt === null ? null : (now.getTime() - Date.parse(r.lastPlayedAt)) / DAY;
    default:
      return r.line[metric];
  }
}

export function evaluateGoal(goal: TeamGoal, rows: LeaderRow[], now = new Date()): TeamGoalResult {
  const players = rows.map((r) => {
    const value = valueOf(r, goal.metric, now);
    let met = false;
    let progress = 0;
    if (value !== null) {
      if (goal.metric === "activeDays") {
        met = value <= goal.target;
        progress = met ? 1 : Math.max(0, goal.target / value);
      } else {
        const target = goal.metric === "rank" ? eloOfTier(goal.target) : goal.target;
        met = goal.metric === "rank" ? (r.tier ?? 0) >= goal.target : value >= target;
        progress = met ? 1 : Math.max(0, Math.min(1, value / target));
      }
    }
    return { puuid: r.puuid, name: r.name, value, met, progress };
  });
  players.sort((a, b) => b.progress - a.progress || a.name.localeCompare(b.name));
  return { goal, players, metCount: players.filter((p) => p.met).length };
}

export function evaluateTeamGoals(rows: LeaderRow[], goals: TeamGoal[] = teamGoals, now = new Date()): TeamGoalResult[] {
  return goals.map((g) => evaluateGoal(g, rows, now));
}

/** Cuántos objetivos cumple cada jugador (puuid → n). */
export function goalsMetBy(results: TeamGoalResult[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const res of results) for (const p of res.players) out[p.puuid] = (out[p.puuid] ?? 0) + (p.met ? 1 : 0);
  return out;
}
