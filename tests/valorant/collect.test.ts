import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { runCollection } from "../../scripts/valorant/collect.ts";
import { ApiError, type HenrikClient } from "../../src/lib/valorant/api.ts";
import type { StoredMatchRow, V4Match } from "../../src/lib/valorant/normalize.ts";
import type { Mode, Roster } from "../../src/lib/valorant/types.ts";
import rosterJson from "../../src/data/valorant/roster.json";

const roster = rosterJson as Roster;
const P = roster.players;
const NOW = new Date("2026-11-13T10:00:00Z");

function row(id: string, puuid: string, team: "Red" | "Blue", startedAt = "2026-11-10T00:00:00Z"): StoredMatchRow {
  return {
    meta: { id, map: { name: "Lotus" }, started_at: startedAt, season: { short: "e11a6" } },
    stats: {
      puuid, team, character: { name: "Omen" }, tier: 20, score: 100, kills: 10, deaths: 10, assists: 2,
      shots: { head: 5, body: 10, leg: 1 }, damage: { made: 2000, received: 1900 },
    },
    teams: { red: 13, blue: 9 },
  };
}

function v4(id: string, redPuuids: string[], premier: string | null = null): V4Match {
  const players = Array.from({ length: 10 }, (_, i) => {
    const red = i < 5;
    const puuid = red ? (redPuuids[i] ?? `ajeno-r${i}`) : `rival-${i}`;
    return {
      puuid, name: `n${i}`, tag: "t", team_id: red ? "Red" : "Blue", agent: { name: "Omen" },
      stats: { score: 1, kills: 1, deaths: 1, assists: 1, headshots: 1, bodyshots: 1, legshots: 1, damage: { dealt: 100 } },
    };
  });
  return {
    metadata: { match_id: id, map: { name: "Lotus" }, started_at: "2026-11-10T00:00:00Z", is_completed: true, season: { short: "e11a6" } },
    players,
    teams: [
      { team_id: "Red", rounds: { won: 13, lost: 9 }, premier_roster: premier ? { name: premier } : null },
      { team_id: "Blue", rounds: { won: 9, lost: 13 }, premier_roster: premier ? { name: "Rival" } : null },
    ],
    rounds: Array.from({ length: 22 }, (_, i) => ({ winning_team: i < 13 ? "Red" : "Blue", winning_team_role: "Attacker" })),
  };
}

interface Fake {
  stored: Record<string, StoredMatchRow[]>; // `${name}:${mode}`
  matches: Record<string, V4Match>;
  failMmrAt?: string; // nombre del jugador
  notFound?: string; // nombre del jugador
}

const nameOf = (puuid: string) => P.find((p) => p.puuid === puuid)?.name ?? "?";

function fakeClient(f: Fake) {
  const calls = { match: [] as string[], recent: 0 };
  const client: HenrikClient = {
    async recentMatches(puuid) {
      const name = nameOf(puuid);
      if (name === f.notFound) throw new ApiError(404, "x");
      calls.recent++;
    },
    async storedMatches(puuid, mode: Mode, page, size) {
      const name = nameOf(puuid);
      if (name === f.notFound) throw new ApiError(404, "x");
      const all = f.stored[`${name}:${mode}`] ?? [];
      return { rows: all.slice((page - 1) * size, page * size), total: all.length };
    },
    async match(id) {
      calls.match.push(id);
      return structuredClone(f.matches[id]);
    },
    async mmr(puuid) {
      const name = nameOf(puuid);
      if (name === f.failMmrAt) throw new ApiError(500, "x");
      if (name === f.notFound) throw new ApiError(404, "x");
      return { tier: 21, tierName: "Ascendant 1", rr: 50, elo: 1850 };
    },
    async premierTeam() {
      return { points: 200, division: 21, place: 50, conference: "LATAM_NORTH", wins: 2, losses: 0 };
    },
  };
  return { client, calls };
}

const red4 = P.slice(0, 4).map((p) => p.puuid);
const red3 = P.slice(0, 3).map((p) => p.puuid);

function baseFake(): Fake {
  return {
    stored: {
      // custom A: 4 del roster en Red; custom B: 3 del roster en Red
      ...Object.fromEntries(P.map((p) => [`${p.name}:custom`, [
        ...(red4.includes(p.puuid) ? [row("A", p.puuid, "Red")] : []),
        ...(red3.includes(p.puuid) ? [row("B", p.puuid, "Red")] : []),
      ]])),
      [`${P[0].name}:premier`]: [row("P", P[0].puuid, "Red")],
      [`${P[0].name}:competitive`]: [row("R1", P[0].puuid, "Blue"), row("R2", P[0].puuid, "Red", "2026-11-11T00:00:00Z")],
    },
    matches: { A: v4("A", red4), P: v4("P", [P[0].puuid], "T L H") },
  };
}

const readJson = async (dir: string, f: string) => JSON.parse(await readFile(join(dir, f), "utf8"));

describe("runCollection", () => {
  test("corrida inicial escribe 4 archivos y no toca labels.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const { client, calls } = fakeClient(baseFake());
    const r = await runCollection({ client, roster, dataDir: dir, now: NOW });
    expect((await readdir(dir)).sort()).toEqual(["meta.json", "player-matches.json", "snapshots.json", "team-matches.json"]);
    expect(r.newTeamMatches).toBe(2);
    expect(calls.match.sort()).toEqual(["A", "P"]); // B (3 del roster) no se pide
    const meta = await readJson(dir, "meta.json");
    expect(meta.updatedAt).toBe(NOW.toISOString());
    const snaps = await readJson(dir, "snapshots.json");
    expect(snaps).toHaveLength(1);
    expect(snaps[0].date).toBe("2026-11-13");
    expect(Object.keys(snaps[0].players)).toHaveLength(6);
    expect(snaps[0].premier.division).toBe(21);
    const pms = await readJson(dir, "player-matches.json");
    expect(pms.find((m: { matchId: string }) => m.matchId === "R1").mode).toBe("competitive");
  });

  test("segunda corrida no repite partidas ni pide match()", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const fake = baseFake();
    await runCollection({ client: fakeClient(fake).client, roster, dataDir: dir, now: NOW });
    const second = fakeClient(fake);
    const r = await runCollection({ client: second.client, roster, dataDir: dir, now: NOW });
    expect(r.newPlayerMatches).toBe(0);
    expect(r.newTeamMatches).toBe(0);
    expect(second.calls.match).toEqual([]);
  });

  test("candidato rechazado queda en nonTeamMatchIds y no se vuelve a pedir", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const fake = baseFake();
    fake.matches.P = v4("P", [P[0].puuid], "Otro equipo");
    await runCollection({ client: fakeClient(fake).client, roster, dataDir: dir, now: NOW });
    expect((await readJson(dir, "meta.json")).nonTeamMatchIds).toEqual(["P"]);
    const second = fakeClient(fake);
    await runCollection({ client: second.client, roster, dataDir: dir, now: NOW });
    expect(second.calls.match).toEqual([]);
  });

  test("labels include:true fuerza un custom; labels.json no se reescribe", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const labels = '{ "B": { "include": true, "rival": "ABC" } }\n';
    await writeFile(join(dir, "labels.json"), labels);
    const fake = baseFake();
    fake.matches.B = v4("B", red3);
    const { client, calls } = fakeClient(fake);
    await runCollection({ client, roster, dataDir: dir, now: NOW });
    expect(calls.match).toContain("B");
    expect((await readJson(dir, "team-matches.json")).map((t: { matchId: string }) => t.matchId)).toContain("B");
    expect(await readFile(join(dir, "labels.json"), "utf8")).toBe(labels);
  });

  test("un 500 a mitad de la corrida no escribe nada", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const fake = baseFake();
    await runCollection({ client: fakeClient(fake).client, roster, dataDir: dir, now: NOW });
    const before = await Promise.all(["meta.json", "player-matches.json", "snapshots.json", "team-matches.json"].map((f) => readFile(join(dir, f), "utf8")));
    fake.stored[`${P[0].name}:competitive`].push(row("R3", P[0].puuid, "Red", "2026-11-12T00:00:00Z"));
    fake.failMmrAt = P[2].name;
    await expect(runCollection({ client: fakeClient(fake).client, roster, dataDir: dir, now: new Date("2026-11-14T10:00:00Z") })).rejects.toMatchObject({ status: 500 });
    const after = await Promise.all(["meta.json", "player-matches.json", "snapshots.json", "team-matches.json"].map((f) => readFile(join(dir, f), "utf8")));
    expect(after).toEqual(before);
  });

  test("informa el progreso por jugador y por partida de equipo", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const logs: string[] = [];
    await runCollection({ client: fakeClient(baseFake()).client, roster, dataDir: dir, now: NOW, log: (m) => logs.push(m) });
    expect(logs).toContain("Zeiko#BRS: 5 partidas nuevas");
    expect(logs.some((l) => l.startsWith("Partidas de equipo por revisar: 2"))).toBe(true);
  });

  test("premier y customs antes de teamSince se ignoran; ranked no se recorta", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const fake = baseFake();
    fake.stored[`${P[0].name}:premier`].push(row("OLD-P", P[0].puuid, "Red", "2026-11-01T00:00:00Z"));
    for (const p of P.slice(0, 4)) fake.stored[`${p.name}:custom`].push(row("OLD-C", p.puuid, "Red", "2026-11-02T00:00:00Z"));
    fake.stored[`${P[0].name}:competitive`].push(row("OLD-R", P[0].puuid, "Red", "2025-06-01T00:00:00Z"));
    const { client, calls } = fakeClient(fake);
    await runCollection({ client, roster: { ...roster, teamSince: "2026-11-08" }, dataDir: dir, now: NOW });
    const ids = (await readJson(dir, "player-matches.json")).map((m: { matchId: string }) => m.matchId);
    expect(ids).not.toContain("OLD-P");
    expect(ids).not.toContain("OLD-C");
    expect(ids).toContain("OLD-R");
    expect(calls.match.sort()).toEqual(["A", "P"]);
  });

  test("un jugador que cambió su Riot ID en la API se sigue encontrando (se consulta por PUUID)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const renamed: Roster = { ...roster, players: roster.players.map((p, i) => (i === 0 ? { ...p, name: "NombreViejo" } : p)) };
    await runCollection({ client: fakeClient(baseFake()).client, roster: renamed, dataDir: dir, now: NOW });
    const ids = (await readJson(dir, "player-matches.json")).filter((m: { puuid: string }) => m.puuid === P[0].puuid).map((m: { matchId: string }) => m.matchId);
    expect(ids).toContain("R1");
  });

  test("un jugador con 404 se avisa y los demás se guardan", async () => {
    const dir = await mkdtemp(join(tmpdir(), "val-"));
    const fake = baseFake();
    fake.notFound = P[5].name;
    const logs: string[] = [];
    await runCollection({ client: fakeClient(fake).client, roster, dataDir: dir, now: NOW, log: (m) => logs.push(m) });
    expect(logs.some((l) => l.includes(`${P[5].name}#${P[5].tag}`))).toBe(true);
    expect((await readJson(dir, "player-matches.json")).length).toBeGreaterThan(0);
  });
});
