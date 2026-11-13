import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ApiError, createClient, type HenrikClient } from "../../src/lib/valorant/api.ts";
import { teamCandidates, toPlayerMatch, toTeamMatch } from "../../src/lib/valorant/normalize.ts";
import { mergePlayerMatches, mergeTeamMatches, upsertSnapshot } from "../../src/lib/valorant/store.ts";
import type { Labels, Meta, Mode, PlayerMatch, RankSnapshot, Roster, Snapshot, TeamMatch } from "../../src/lib/valorant/types.ts";

const MODES: Mode[] = ["custom", "premier", "competitive"];
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

export interface CollectOptions {
  client: HenrikClient;
  roster: Roster;
  dataDir: string;
  now: Date;
  log?: (m: string) => void;
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
}

const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

export async function runCollection(opts: CollectOptions): Promise<{ newPlayerMatches: number; newTeamMatches: number }> {
  const { client, roster, dataDir, now } = opts;
  const log = opts.log ?? console.log;
  const f = (name: string) => join(dataDir, name);

  const playerMatches = await readJson<PlayerMatch[]>(f("player-matches.json"), []);
  const teamMatches = await readJson<TeamMatch[]>(f("team-matches.json"), []);
  const snapshots = await readJson<Snapshot[]>(f("snapshots.json"), []);
  const labels = await readJson<Labels>(f("labels.json"), {});
  const meta = await readJson<Meta>(f("meta.json"), { updatedAt: null, nonTeamMatchIds: [] });

  const since = roster.teamSince;
  const known = new Set(playerMatches.map((m) => `${m.matchId}:${m.puuid}`));
  const fresh: PlayerMatch[] = [];
  const missing = new Set<string>();

  for (const p of roster.players) {
    const before = fresh.length;
    try {
      for (const mode of MODES) {
        await client.recentMatches(p.puuid, mode);
        for (let page = 1; page <= MAX_PAGES; page++) {
          const { rows } = await client.storedMatches(p.puuid, mode, page, PAGE_SIZE);
          let anyNew = false;
          let anyInRange = false;
          for (const row of rows) {
            const m = toPlayerMatch(row, mode);
            if (!m) continue;
            if (mode !== "competitive" && since && m.startedAt < since) continue;
            anyInRange = true;
            m.puuid = p.puuid;
            const key = `${m.matchId}:${m.puuid}`;
            if (known.has(key)) continue;
            known.add(key);
            fresh.push(m);
            anyNew = true;
          }
          if (rows.length < PAGE_SIZE || !anyNew || !anyInRange) break;
        }
      }
      log(`${p.name}#${p.tag}: ${fresh.length - before} partidas nuevas`);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      missing.add(p.puuid);
      log(`Aviso: ${p.name}#${p.tag} no se encontró en la API (¿cuenta borrada o PUUID mal copiado?). Se salta.`);
    }
  }

  const allPlayerMatches = mergePlayerMatches(playerMatches, fresh);
  const haveTeam = new Set(teamMatches.map((t) => t.matchId));
  const skip = new Set(meta.nonTeamMatchIds);
  const newTeam: TeamMatch[] = [];
  const nonTeam = [...meta.nonTeamMatchIds];

  const pending = [...teamCandidates(allPlayerMatches, roster, labels)].filter(([id]) => !haveTeam.has(id) && !skip.has(id));
  log(`Partidas de equipo por revisar: ${pending.length}`);
  for (const [id, kind] of pending) {
    const full = await client.match(id);
    const t = toTeamMatch(full, roster, kind, labels[id]?.include === true);
    if (t) newTeam.push(t);
    else nonTeam.push(id);
  }

  const players: Record<string, RankSnapshot> = {};
  for (const p of roster.players) {
    if (missing.has(p.puuid)) continue;
    try {
      players[p.puuid] = await client.mmr(p.puuid);
    } catch (e) {
      if (!isNotFound(e)) throw e;
      log(`Aviso: sin rango para ${p.name}#${p.tag}.`);
    }
  }
  const premier = await client.premierTeam(roster.premierTeam.name, roster.premierTeam.tag);
  const snap: Snapshot = { date: now.toISOString().slice(0, 10), players, premier };

  // Solo aquí se escribe: si algo falló antes, los archivos quedan como estaban.
  const out: Array<[string, unknown]> = [
    ["player-matches.json", allPlayerMatches],
    ["team-matches.json", mergeTeamMatches(teamMatches, newTeam)],
    ["snapshots.json", upsertSnapshot(snapshots, snap)],
    ["meta.json", { updatedAt: now.toISOString(), nonTeamMatchIds: nonTeam } satisfies Meta],
  ];
  await mkdir(dataDir, { recursive: true });
  for (const [name, data] of out) await writeFile(f(name) + ".tmp", JSON.stringify(data, null, 1) + "\n");
  for (const [name] of out) await rename(f(name) + ".tmp", f(name));

  return { newPlayerMatches: fresh.length, newTeamMatches: newTeam.length };
}

async function main() {
  const dataDir = process.argv[2];
  const key = process.env.HENRIKDEV_API_KEY;
  if (!dataDir || !key) {
    console.error("Uso: HENRIKDEV_API_KEY=… node scripts/valorant/collect.ts <dataDir>");
    process.exit(1);
  }
  const here = dirname(fileURLToPath(import.meta.url));
  const roster = JSON.parse(await readFile(join(here, "../../src/data/valorant/roster.json"), "utf8")) as Roster;
  const r = await runCollection({ client: createClient({ key }), roster, dataDir, now: new Date() });
  console.log(`Listo: ${r.newPlayerMatches} partidas de jugador nuevas, ${r.newTeamMatches} de equipo nuevas.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
