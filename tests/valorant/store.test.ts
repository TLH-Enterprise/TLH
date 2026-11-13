import { describe, expect, test } from "vitest";
import { mergePlayerMatches, mergeTeamMatches, upsertSnapshot } from "../../src/lib/valorant/store.ts";
import type { PlayerMatch, Snapshot, TeamMatch } from "../../src/lib/valorant/types.ts";

const pm = (matchId: string, puuid: string, startedAt: string, kills = 0) =>
  ({ matchId, puuid, startedAt, kills }) as PlayerMatch;
const tm = (matchId: string, startedAt: string, roundsWon = 0) => ({ matchId, startedAt, roundsWon }) as TeamMatch;
const snap = (date: string, elo: number): Snapshot => ({
  date,
  players: { p: { tier: 1, tierName: "x", rr: 0, elo } },
  premier: null,
});

describe("mergePlayerMatches", () => {
  test("dedupe por matchId+puuid, gana b, orden desc", () => {
    const a = [pm("1", "z", "2026-11-01T00:00:00Z", 5), pm("2", "z", "2026-11-03T00:00:00Z")];
    const b = [pm("1", "z", "2026-11-01T00:00:00Z", 9), pm("1", "b", "2026-11-01T00:00:00Z"), pm("3", "z", "2026-11-02T00:00:00Z")];
    const out = mergePlayerMatches(a, b);
    expect(out).toHaveLength(4);
    expect(out[0].matchId).toBe("2");
    expect(out[1].matchId).toBe("3");
    expect(out.find((m) => m.matchId === "1" && m.puuid === "z")!.kills).toBe(9);
  });
  test("vacío con vacío", () => expect(mergePlayerMatches([], [])).toEqual([]));
});

describe("mergeTeamMatches", () => {
  test("dedupe por matchId, gana b, orden desc", () => {
    const out = mergeTeamMatches([tm("1", "2026-11-01T00:00:00Z", 1)], [tm("1", "2026-11-01T00:00:00Z", 13), tm("2", "2026-11-05T00:00:00Z")]);
    expect(out.map((m) => m.matchId)).toEqual(["2", "1"]);
    expect(out[1].roundsWon).toBe(13);
  });
  test("vacío con vacío", () => expect(mergeTeamMatches([], [])).toEqual([]));
});

describe("upsertSnapshot", () => {
  test("misma fecha reemplaza; orden asc", () => {
    const out = upsertSnapshot([snap("2026-11-12", 1), snap("2026-11-10", 2)], snap("2026-11-12", 3));
    expect(out.map((s) => s.date)).toEqual(["2026-11-10", "2026-11-12"]);
    expect(out[1].players.p.elo).toBe(3);
  });
});
