// Antes del build: descarga los datos de Valorant de la rama `valorant-data`
// y los deja en public/valorant-data.json. Nunca hace fallar el build.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = "TLH-Enterprise/TLH";
const BRANCH = "valorant-data";
const FILES = {
  playerMatches: "player-matches.json",
  teamMatches: "team-matches.json",
  snapshots: "snapshots.json",
  labels: "labels.json",
  meta: "meta.json",
};

function empty(roster) {
  return { meta: { updatedAt: null, nonTeamMatchIds: [] }, roster, playerMatches: [], teamMatches: [], snapshots: [], labels: {} };
}

/**
 * @param {{ fetch: (url: string, init?: RequestInit) => Promise<Response>, roster: any, dataDir?: string }} opts
 * @returns {Promise<import("../../src/lib/valorant/types.ts").Dataset>}
 */
export async function buildDataset({ fetch, roster, dataDir }) {
  try {
    let read;
    if (dataDir) {
      read = async (name) => JSON.parse(await readFile(join(dataDir, name), "utf8"));
    } else {
      const res = await fetch(`https://api.github.com/repos/${REPO}/commits/${BRANCH}`, {
        headers: { Accept: "application/vnd.github+json" },
      });
      if (!res.ok) throw new Error(`GitHub respondió ${res.status} al buscar la rama ${BRANCH}`);
      const { sha } = await res.json();
      read = async (name) => {
        const r = await fetch(`https://raw.githubusercontent.com/${REPO}/${sha}/data/${name}`);
        if (!r.ok) throw new Error(`${name}: ${r.status}`);
        return JSON.parse(await r.text());
      };
    }
    /** @type {Record<string, unknown>} */
    const out = { roster };
    for (const [key, name] of Object.entries(FILES)) out[key] = await read(name);
    return /** @type {any} */ (out);
  } catch (e) {
    console.warn(`[valorant] No se pudieron cargar los datos (${e instanceof Error ? e.message : e}). La página saldrá vacía.`);
    return empty(roster);
  }
}

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const roster = JSON.parse(await readFile(join(root, "src/data/valorant/roster.json"), "utf8"));
  const ds = await buildDataset({ fetch, roster, dataDir: process.env.VALORANT_DATA_DIR || undefined });
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "public/valorant-data.json"), JSON.stringify(ds));
  console.log(`[valorant] ${ds.playerMatches.length} partidas de jugador, ${ds.teamMatches.length} de equipo.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.warn("[valorant]", e);
  });
}
