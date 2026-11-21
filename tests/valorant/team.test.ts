import { describe, expect, test } from "vitest";
import { teamCandidates, toTeamMatch, type V4Match } from "../../src/lib/valorant/normalize.ts";
import type { Labels, PlayerMatch, Roster } from "../../src/lib/valorant/types.ts";
import rosterJson from "../../src/data/valorant/roster.json";
import fixture from "./fixtures/v4-match-premier.json";

const roster = rosterJson as Roster;
const fx = () => structuredClone(fixture) as V4Match;
const [zeiko, biggs, mcfly, ezekiel, tdiamond, sharky] = roster.players.map((p) => p.puuid);

describe("toTeamMatch", () => {
  test("premier T L H", () => {
    const t = toTeamMatch(fx(), roster, "premier")!;
    expect(t).toMatchObject({
      matchId: "10f293f7-912b-444c-9e82-b57adc832f5f",
      kind: "premier",
      map: "Sunset",
      season: "e11a6",
      side: "Red",
      roundsWon: 13,
      roundsLost: 5,
      won: true,
      opponentName: "Paw Patrolls",
    });
    expect(t.rounds).toHaveLength(18);
    expect(t.lineup).toHaveLength(5);
    expect(t.lineup.filter((l) => !l.inRoster).map((l) => l.riotId)).toEqual(["dagestan aim f#splsh"]);
    expect(t.opponentPlayers).toHaveLength(5);
    expect(t.opponentLineup!.map((l) => l.riotId)).toEqual(t.opponentPlayers);
    expect(t.opponentLineup!.every((l) => !l.inRoster && l.agent.length > 0)).toBe(true);
    const z = t.lineup.find((l) => l.puuid === zeiko)!;
    expect(z).toMatchObject({ riotId: "Zeiko#BRS", agent: "Sova", inRoster: true, kills: 16, deaths: 12, assists: 12 });
  });

  test("rol de ronda: ganó → rol del ganador; perdió → el opuesto", () => {
    const t = toTeamMatch(fx(), roster, "premier")!;
    // ronda 1: Red gana como Attacker
    expect(t.rounds[0]).toEqual({ won: true, role: "Attack" });
    // ronda 3: Blue gana como Defender → T L H (Red) perdió atacando
    expect(t.rounds[2]).toEqual({ won: false, role: "Attack" });
  });

  test("premier de otro equipo → null", () => {
    const m = fx();
    m.teams.forEach((t) => (t.premier_roster = { name: "Otro" }));
    expect(toTeamMatch(m, roster, "premier")).toBeNull();
  });

  test("incompleta → null", () => {
    const m = fx();
    m.metadata.is_completed = false;
    expect(toTeamMatch(m, roster, "premier")).toBeNull();
  });

  test("sin rondas → null", () => {
    const m = fx();
    m.rounds = [];
    expect(toTeamMatch(m, roster, "premier")).toBeNull();
  });

  test("custom con 3 del roster en un lado → null; con force → TeamMatch", () => {
    const m = fx();
    // el fixture tiene 4 del roster en Red (Zeiko, BiggS, McFly, ezekiel); saco a uno
    const mc = m.players.find((p) => p.puuid === mcfly)!;
    mc.puuid = "ajeno";
    expect(toTeamMatch(m, roster, "custom")).toBeNull();
    const forced = toTeamMatch(m, roster, "custom", true)!;
    expect(forced).toMatchObject({ kind: "custom", side: "Red", opponentName: null });
  });

  test("custom con 4 del roster en un lado → TeamMatch", () => {
    expect(toTeamMatch(fx(), roster, "custom")).toMatchObject({ kind: "custom", side: "Red" });
  });
});

function pm(matchId: string, puuid: string, mode: PlayerMatch["mode"], side: PlayerMatch["side"]): PlayerMatch {
  return {
    matchId, puuid, mode, side, startedAt: "2026-11-01T00:00:00Z", map: "Lotus", season: "e11a6", agent: "Omen",
    roundsWon: 13, roundsLost: 7, won: true, kills: 0, deaths: 0, assists: 0, headshots: 0, bodyshots: 0, legshots: 0,
    damageMade: 0, damageReceived: 0, score: 0, tier: 0,
  };
}

describe("teamCandidates", () => {
  const rows = [
    // custom A: 4 del roster en Red
    ...[zeiko, biggs, mcfly, ezekiel].map((p) => pm("A", p, "custom", "Red")),
    // custom B: 4 del roster repartidos 2/2
    pm("B", zeiko, "custom", "Red"), pm("B", biggs, "custom", "Red"),
    pm("B", tdiamond, "custom", "Blue"), pm("B", sharky, "custom", "Blue"),
    // custom C: solo 1
    pm("C", zeiko, "custom", "Blue"),
    // premier P
    pm("P", zeiko, "premier", "Red"),
    // ranked R
    pm("R", zeiko, "competitive", "Red"),
  ];

  test("4 del mismo lado sí; 2/2 no; premier sí; ranked no", () => {
    const c = teamCandidates(rows, roster, {});
    expect([...c.entries()].sort()).toEqual([["A", "custom"], ["P", "premier"]]);
  });

  test("include:false excluye; include:true fuerza", () => {
    const labels: Labels = { A: { include: false }, C: { include: true } };
    const c = teamCandidates(rows, roster, labels);
    expect([...c.entries()].sort()).toEqual([["C", "custom"], ["P", "premier"]]);
  });
});
