import { describe, expect, test, vi } from "vitest";
import { buildDataset } from "../../scripts/valorant/fetch-data.mjs";
import rosterJson from "../../src/data/valorant/roster.json";

const SHA = "abc123";
const files: Record<string, unknown> = {
  "player-matches.json": [{ matchId: "1" }],
  "team-matches.json": [{ matchId: "T" }],
  "snapshots.json": [{ date: "2026-11-13" }],
  "labels.json": { T: { rival: "ABC" } },
  "meta.json": { updatedAt: "2026-11-13T10:00:00Z", nonTeamMatchIds: [] },
  "tournaments.json": { actualizado: "2026-11-22", torneos: [], riot_proximo_qualifier: null, notas: null },
};

function fakeFetch(override: (url: string) => Response | undefined = () => undefined) {
  const urls: string[] = [];
  const fn = async (url: string) => {
    urls.push(url);
    const o = override(url);
    if (o) return o;
    if (url === "https://api.github.com/repos/TLH-Enterprise/TLH/commits/valorant-data")
      return new Response(JSON.stringify({ sha: SHA }), { status: 200 });
    const name = url.split("/").pop()!;
    return new Response(JSON.stringify(files[name]), { status: 200 });
  };
  return { fn, urls };
}

describe("buildDataset", () => {
  test("usa el SHA de la rama en las 6 URLs raw", async () => {
    const f = fakeFetch();
    const ds = await buildDataset({ fetch: f.fn, roster: rosterJson });
    for (const name of Object.keys(files))
      expect(f.urls).toContain(`https://raw.githubusercontent.com/TLH-Enterprise/TLH/${SHA}/data/${name}`);
    expect(ds.playerMatches).toEqual([{ matchId: "1" }]);
    expect(ds.labels).toEqual({ T: { rival: "ABC" } });
    expect(ds.tournaments).toEqual(files["tournaments.json"]);
    expect(ds.meta.updatedAt).toBe("2026-11-13T10:00:00Z");
    expect(ds.roster).toEqual(rosterJson);
  });

  test("commit 403 y raw caído → dataset vacío sin lanzar", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch((u) => (u.includes("api.github.com") ? new Response("{}", { status: 403 }) : new Response("x", { status: 500 })));
    const ds = await buildDataset({ fetch: f.fn, roster: rosterJson });
    expect(ds).toEqual({
      meta: { updatedAt: null, nonTeamMatchIds: [] }, roster: rosterJson, playerMatches: [], teamMatches: [], snapshots: [], labels: {}, tournaments: null, act: null,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test("API de commits limitada (403) → usa la rama por nombre en raw", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch((u) => (u.includes("api.github.com") ? new Response("{}", { status: 403 }) : undefined));
    const ds = await buildDataset({ fetch: f.fn, roster: rosterJson });
    expect(f.urls).toContain("https://raw.githubusercontent.com/TLH-Enterprise/TLH/valorant-data/data/team-matches.json");
    expect(ds.teamMatches).toEqual([{ matchId: "T" }]);
    warn.mockRestore();
  });

  test("cada petición lleva timeout", async () => {
    const signals: unknown[] = [];
    const f = fakeFetch();
    const fn = async (u: string, init?: RequestInit) => { signals.push(init?.signal); return f.fn(u); };
    await buildDataset({ fetch: fn, roster: rosterJson });
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });

  test("JSON inválido → dataset vacío", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const f = fakeFetch((u) => (u.endsWith("snapshots.json") ? new Response("{nope", { status: 200 }) : undefined));
    const ds = await buildDataset({ fetch: f.fn, roster: rosterJson });
    expect(ds.playerMatches).toEqual([]);
    warn.mockRestore();
  });

  test("error de red → dataset vacío", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ds = await buildDataset({ fetch: async () => { throw new TypeError("fetch failed"); }, roster: rosterJson });
    expect(ds.teamMatches).toEqual([]);
    warn.mockRestore();
  });

  test("labels.json ausente (local o 404) → labels {} y el resto de datos se conserva", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "vd-"));
    for (const [n, v] of Object.entries(files)) if (n !== "labels.json") await writeFile(join(dir, n), JSON.stringify(v));
    const local = await buildDataset({ fetch: async () => { throw new Error("x"); }, roster: rosterJson, dataDir: dir });
    expect(local.labels).toEqual({});
    expect(local.playerMatches).toEqual([{ matchId: "1" }]);
    const f = fakeFetch((u) => (u.endsWith("labels.json") ? new Response("404: Not Found", { status: 404 }) : undefined));
    const remote = await buildDataset({ fetch: f.fn, roster: rosterJson });
    expect(remote.labels).toEqual({});
    expect(remote.teamMatches).toEqual([{ matchId: "T" }]);
  });

  test("tournaments.json ausente (local o 404) → tournaments null", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "vd-"));
    for (const [n, v] of Object.entries(files)) if (n !== "tournaments.json") await writeFile(join(dir, n), JSON.stringify(v));
    const local = await buildDataset({ fetch: async () => { throw new Error("x"); }, roster: rosterJson, dataDir: dir });
    expect(local.tournaments).toBeNull();
    expect(local.playerMatches).toEqual([{ matchId: "1" }]);
    const f = fakeFetch((u) => (u.endsWith("tournaments.json") ? new Response("404: Not Found", { status: 404 }) : undefined));
    const remote = await buildDataset({ fetch: f.fn, roster: rosterJson });
    expect(remote.tournaments).toBeNull();
    expect(remote.teamMatches).toEqual([{ matchId: "T" }]);
  });

  test("dataDir local en vez de red", async () => {
    const { mkdtemp, writeFile } = await import("node:fs/promises");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const dir = await mkdtemp(join(tmpdir(), "vd-"));
    for (const [n, v] of Object.entries(files)) await writeFile(join(dir, n), JSON.stringify(v));
    const ds = await buildDataset({ fetch: async () => { throw new Error("no debería llamar"); }, roster: rosterJson, dataDir: dir });
    expect(ds.teamMatches).toEqual([{ matchId: "T" }]);
  });
});

describe("currentAct / fetchAct", () => {
  const seasons = [
    { uuid: "ep", displayName: "V26", type: null, startTime: "2026-06-24T00:00:00Z", endTime: "2027-01-06T00:00:00Z", parentUuid: null },
    { uuid: "a5", displayName: "ACT V", type: "EAresSeasonType::Act", startTime: "2026-08-20T00:00:00Z", endTime: "2026-10-14T00:00:00Z", parentUuid: "ep" },
    { uuid: "a6", displayName: "ACT VI", type: "EAresSeasonType::Act", startTime: "2026-10-14T00:00:00Z", endTime: "2027-01-06T00:00:00Z", parentUuid: "ep" },
  ];

  test("elige el acto en curso con su episodio", async () => {
    const { currentAct } = await import("../../scripts/valorant/fetch-data.mjs");
    expect(currentAct(seasons, new Date("2026-11-23T12:00:00Z"))).toEqual({
      name: "V26 · Acto VI", startsAt: "2026-10-14T00:00:00Z", endsAt: "2027-01-06T00:00:00Z",
    });
    expect(currentAct(seasons, new Date("2027-02-01T00:00:00Z"))).toBeNull();
  });

  test("fetchAct no lanza si la API falla", async () => {
    const { fetchAct } = await import("../../scripts/valorant/fetch-data.mjs");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await fetchAct(async () => new Response("x", { status: 500 }))).toBeNull();
    expect(await fetchAct(async () => new Response(JSON.stringify({ data: seasons })), new Date("2026-11-23T00:00:00Z"))).toMatchObject({ name: "V26 · Acto VI" });
    warn.mockRestore();
  });
});
