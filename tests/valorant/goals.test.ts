import { describe, expect, test } from "vitest";
import benchmarks from "../../src/data/valorant/pro-benchmarks.json";
import { goalsFor, mainRole, proStats, roleOfAgent, ROLES } from "../../src/lib/valorant/goals.ts";
import type { PlayerMatch } from "../../src/lib/valorant/types.ts";

function pm(p: Partial<PlayerMatch> = {}): PlayerMatch {
  return {
    matchId: "m", puuid: "p", mode: "premier", startedAt: "2026-11-20T00:00:00Z", map: "Sunset", season: "e11a6",
    agent: "Jett", side: "Red", roundsWon: 13, roundsLost: 7, won: true,
    kills: 20, deaths: 10, assists: 5, headshots: 25, bodyshots: 70, legshots: 5,
    damageMade: 3000, damageReceived: 2000, score: 4400, tier: 20, ...p,
  };
}

describe("roleOfAgent", () => {
  test("normaliza mayúsculas y símbolos", () => {
    expect(roleOfAgent("KAY/O")).toBe("initiator");
    expect(roleOfAgent("Omen")).toBe("controller");
    expect(roleOfAgent("Chamber")).toBe("sentinel");
    expect(roleOfAgent("Desconocido")).toBeNull();
  });
});

describe("mainRole", () => {
  test("gana el rol con más partidas; empate por rondas", () => {
    expect(mainRole([pm({ agent: "Jett" }), pm({ agent: "Raze" }), pm({ agent: "Omen" })])).toBe("duelist");
    expect(mainRole([pm({ agent: "Sova", roundsWon: 13, roundsLost: 11 }), pm({ agent: "Jett", roundsWon: 13, roundsLost: 2 })])).toBe("initiator");
    expect(mainRole([])).toBeNull();
  });
});

describe("proStats", () => {
  test("métricas por ronda como vlr.gg", () => {
    const s = proStats([pm(), pm({ kills: 10, deaths: 20, assists: 15, score: 2000, damageMade: 1000, roundsWon: 5, roundsLost: 15 })]);
    expect(s.rounds).toBe(40);
    expect(s.acs).toBeCloseTo(6400 / 40);
    expect(s.adr).toBeCloseTo(4000 / 40);
    expect(s.kd).toBeCloseTo(30 / 30);
    expect(s.kpr).toBeCloseTo(30 / 40);
    expect(s.apr).toBeCloseTo(20 / 40);
    expect(s.hs).toBeCloseTo(25);
  });
  test("sin partidas → todo null", () => {
    expect(proStats([])).toEqual({ rounds: 0, acs: null, kd: null, adr: null, kpr: null, apr: null, hs: null });
  });
});

describe("goalsFor", () => {
  test("nivel y lo que falta para la siguiente meta", () => {
    const d = benchmarks.roles.duelist;
    const rows = goalsFor("duelist", { rounds: 100, acs: d.acs.top + 1, kd: d.kd.pro, adr: d.adr.pro - 10, kpr: null, apr: 0, hs: 0 });
    const by = Object.fromEntries(rows.map((r) => [r.key, r]));
    expect(by.acs.level).toBe("top");
    expect(by.acs.gap).toBeNull();
    expect(by.kd.level).toBe("pro");
    expect(by.kd.gap).toBeCloseTo(d.kd.top - d.kd.pro);
    expect(by.adr.level).toBe("below");
    expect(by.adr.gap).toBeCloseTo(10);
    expect(by.kpr.level).toBeNull();
  });
  test("cada rol tiene las 6 métricas y pro <= top", () => {
    for (const r of ROLES)
      for (const row of goalsFor(r, proStats([pm()]))) expect(row.pro).toBeLessThanOrEqual(row.top);
  });
});
