// Valida el JSON del buscador de torneos y lo guarda normalizado en <dataDir>/tournaments.json.
// Lo usa la rutina programada de Claude (claude.ai/code/routines) que corre tournaments-prompt.md.
// Uso: node scripts/valorant/save-tournaments.ts <respuesta.json> <dataDir>
// Si el JSON no es válido, NO toca el archivo anterior y termina con código 1.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { extractJson, parseReport } from "../../src/lib/valorant/tournaments.ts";

const [input, dataDir] = process.argv.slice(2);
try {
  if (!input || !dataDir) throw new Error("Uso: node scripts/valorant/save-tournaments.ts <respuesta.json> <dataDir>");
  const report = parseReport(extractJson(await readFile(input, "utf8")));
  report.generadoEn = new Date().toISOString();
  await mkdir(dataDir, { recursive: true });
  const out = join(dataDir, "tournaments.json");
  await writeFile(out + ".tmp", JSON.stringify(report, null, 2) + "\n");
  await rename(out + ".tmp", out);
  console.log(`[torneos] ${report.torneos.length} torneos válidos guardados en ${out}.`);
} catch (e) {
  console.error("[torneos]", e instanceof Error ? e.message : e);
  process.exit(1);
}
