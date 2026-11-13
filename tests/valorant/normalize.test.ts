import { describe, expect, test } from "vitest";
import { toPlayerMatch, type StoredMatchRow } from "../../src/lib/valorant/normalize.ts";
import fixture from "./fixtures/stored-match-competitive.json";

const row = fixture as StoredMatchRow;
const withTeams = (red: number, blue: number): StoredMatchRow => ({ ...row, teams: { red, blue } });

describe("toPlayerMatch", () => {
  test("mapea una fila de stored-matches", () => {
    const m = toPlayerMatch(row, "competitive")!;
    expect(m).toMatchObject({
      matchId: "76af13c9-7dd4-4a14-b851-2f5f3ffaa4d9",
      puuid: "33061b1f-7843-528a-a83c-cdd909de674d",
      mode: "competitive",
      startedAt: "2026-11-13T04:16:48.149Z",
      map: "Sunset",
      season: "e11a6",
      agent: "Sova",
      side: "Blue",
      roundsWon: 11,
      roundsLost: 13,
      won: false,
      kills: 23,
      deaths: 17,
      assists: 13,
      headshots: 16,
      bodyshots: 24,
      legshots: 5,
      damageMade: 4389,
      damageReceived: 3321,
      score: 6306,
      tier: 21,
    });
  });

  test("lado Red ganador → won true", () => {
    const m = toPlayerMatch({ ...row, stats: { ...row.stats, team: "Red" } }, "competitive")!;
    expect(m).toMatchObject({ side: "Red", roundsWon: 13, roundsLost: 11, won: true });
  });

  test("empate → won null", () => {
    expect(toPlayerMatch(withTeams(12, 12), "custom")!.won).toBeNull();
  });

  test("0 rondas → null", () => {
    expect(toPlayerMatch(withTeams(0, 0), "custom")).toBeNull();
  });
});
