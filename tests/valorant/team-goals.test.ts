import { describe, expect, test } from "vitest";
import { evaluateGoal, evaluateTeamGoals, goalsMetBy, teamGoals, type TeamGoal } from "../../src/lib/valorant/team-goals.ts";
import type { LeaderRow } from "../../src/lib/valorant/stats.ts";

function row(p: Partial<Omit<LeaderRow, "line">> & { line?: Partial<LeaderRow["line"]> } = {}): LeaderRow {
  const { line, ...rest } = p;
  return {
    puuid: "p", riotId: "P#1", name: "P", tier: 23, tierName: "Ascendant 3", rr: 50, elo: 2050,
    kda: 1.5, lastPlayedAt: "2026-11-22T00:00:00Z",
    ...rest,
    line: { games: 10, wins: 6, winRate: 60, kd: 1.2, hsPct: 20, dmgPerRound: 140, ...line },
  };
}
const now = new Date("2026-11-23T00:00:00Z");

describe("evaluateGoal", () => {
  test("rango: cumple solo con tier >= objetivo; progreso por ELO", () => {
    const g: TeamGoal = { id: "r", label: "Radiant", metric: "rank", target: 27 };
    const res = evaluateGoal(g, [row({ puuid: "a", name: "A" }), row({ puuid: "b", name: "B", tier: 27, elo: 2410 })], now);
    expect(res.metCount).toBe(1);
    expect(res.players[0].name).toBe("B");
    expect(res.players[1].progress).toBeCloseTo(2050 / 2400);
  });

  test("stat: mayor o igual al objetivo; null no cumple", () => {
    const g: TeamGoal = { id: "kd", label: "K/D", metric: "kd", target: 1.1 };
    const res = evaluateGoal(g, [row({ puuid: "a", name: "A" }), row({ puuid: "b", name: "B", line: { kd: null } })], now);
    expect(res.players.map((p) => [p.name, p.met])).toEqual([["A", true], ["B", false]]);
    expect(res.players[1].progress).toBe(0);
  });

  test("activeDays: cumple si jugó ranked dentro del plazo", () => {
    const g: TeamGoal = { id: "act", label: "Activo", metric: "activeDays", target: 7 };
    const res = evaluateGoal(g, [row({ puuid: "a", name: "A" }), row({ puuid: "b", name: "B", lastPlayedAt: "2026-11-09T00:00:00Z" })], now);
    expect(res.players.find((p) => p.name === "A")!.met).toBe(true);
    const b = res.players.find((p) => p.name === "B")!;
    expect(b.met).toBe(false);
    expect(b.progress).toBeCloseTo(7 / 14);
  });
});

test("goalsMetBy cuenta objetivos cumplidos por jugador", () => {
  const goals: TeamGoal[] = [
    { id: "kd", label: "K/D", metric: "kd", target: 1.1 },
    { id: "hs", label: "HS", metric: "hsPct", target: 25 },
  ];
  expect(goalsMetBy(evaluateTeamGoals([row({ puuid: "a" })], goals, now))).toEqual({ a: 1 });
});

test("el JSON de objetivos es válido", () => {
  expect(teamGoals.length).toBeGreaterThan(0);
  for (const g of teamGoals) expect(typeof g.target).toBe("number");
  expect(new Set(teamGoals.map((g) => g.id)).size).toBe(teamGoals.length);
});
