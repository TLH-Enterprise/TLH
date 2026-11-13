# /valorant — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Página pública `/valorant` en thelasthope.dev con estadísticas por mapa y agente del equipo T L H y de sus 6 jugadores, alimentada a diario desde HenrikDev.

**Architecture:**
- Un script recolector en TypeScript (Node 22, que ejecuta `.ts` directamente) lo corre una GitHub Action diaria. Guarda JSON compactos en la rama `valorant-data` y luego llama al Deploy Hook de Vercel.
- Antes del build, un script `.mjs` descarga esos JSON (fijados al SHA de la rama) a `public/valorant-data.json`.
- La página Astro carga ese archivo en el navegador y calcula los agregados con `src/lib/valorant/stats.ts` según las pestañas y filtros.

**Tech Stack:** Astro 5, TypeScript (strict), Vitest, GitHub Actions, HenrikDev API v1/v3/v4, Vercel Deploy Hooks.

**Spec:** `docs/superpowers/specs/2026-11-13-valorant-tracking-design.md`

## Global Constraints

- Node `22.x` (`.nvmrc`, `package.json#engines`). Los `.ts` del recolector se ejecutan con `node archivo.ts` (type stripping). No usar `enum`, `namespace` ni parameter properties. Importar con extensión `.ts`.
- API base: `https://api.henrikdev.xyz/valorant`. Header `Authorization: <HENRIKDEV_API_KEY>`. Región en rutas: siempre `na`. Plataforma: `pc`.
- Límite: 30 peticiones/min. El cliente espera ≥ 2100 ms entre peticiones.
- Nombres y tags en URLs siempre con `encodeURIComponent`. Hay espacios, como en "T L H".
- Los jugadores se identifican por **PUUID**, nunca por nombre.
- Equipo Premier: nombre `T L H`, tag `T L H`.
- Regla de custom de equipo: **≥ 4 de los 6 PUUIDs del roster en el mismo lado**.
- Premier de equipo: partida cuyo lado tiene `premier_roster.name === "T L H"`.
- La clave nunca se escribe en archivos del repo, en logs ni en el bundle del navegador.
- Mínimo de partidas para mostrar un winrate o entrar en destacados: `MIN_GAMES = 3`.
- Sin dependencias de runtime nuevas. Solo `vitest` como devDependency. Gráfica en SVG a mano.
- Estilos: usar los tokens de `src/styles/theme.css` (`--brand-1`, `--surface-1`, `--stroke-1`, `--text-1..3`, `--r-md`, `--container`, `--gutter`). Debe funcionar a 375 px de ancho.
- Textos de la UI en español.

## Review Focus

1. **Un jugador sin partidas en el filtro elegido** (Sharky hoy no tiene partidas de equipo). Debe verse "Sin partidas en este filtro", nunca `NaN`, `Infinity` ni una tabla rota. Test en la Tarea 6.
2. **HenrikDev cae, da 5xx o sigue con 429 después de reintentar a mitad de la corrida.** El recolector termina con código ≠ 0 **sin escribir** ningún archivo, para no dejar datos a medias. Si un jugador da 404 (cambió su Riot ID), se avisa y se sigue con los demás. Tests en las Tareas 4 y 5.
3. **Riot IDs con espacios o caracteres especiales** ("T L H", "dagestan aim f"). Las URLs van bien codificadas. Test en la Tarea 4.
4. **Partidas incompletas, remakes o empates.** Las que tienen `is_completed === false` o 0 rondas se descartan. Los empates cuentan como jugadas pero no como victorias. Tests en las Tareas 1 y 2.
5. **El build de Vercel no llega a GitHub** (sin red o con rate limit). El build no falla: escribe un dataset vacío y la página muestra "Aún no hay datos". Test en la Tarea 7.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/valorant/types.ts` | Tipos compartidos: Roster, PlayerMatch, TeamMatch, Snapshot, Labels, Dataset |
| `src/data/valorant/roster.json` | Roster y equipo (editable) |
| `src/lib/valorant/normalize.ts` | Respuestas de la API → PlayerMatch / TeamMatch, y la regla de equipo |
| `src/lib/valorant/store.ts` | Merge sin duplicados y upsert de fotos diarias |
| `src/lib/valorant/api.ts` | Cliente HTTP con throttle y reintentos |
| `scripts/valorant/collect.ts` | Orquesta una corrida y lee/escribe un directorio de datos |
| `src/lib/valorant/stats.ts` | Agregados para la página (funciones puras) |
| `scripts/valorant/fetch-data.mjs` | Prebuild: descarga los datos de la rama `valorant-data` |
| `src/pages/valorant.astro` + `src/components/valorant/*.astro` + `src/scripts/valorant.ts` | La página |
| `.github/workflows/valorant-collect.yml` | Cron diario + manual |
| `tests/valorant/**` | Tests y fixtures |

Archivos en la rama `valorant-data`, dentro de `data/`: `player-matches.json`, `team-matches.json`, `snapshots.json`, `labels.json` (a mano) y `meta.json`.

---

### Task 1: Vitest, tipos, roster y `toPlayerMatch`

**Files:**
- Modify: `package.json` (devDependency `vitest`, script `"test": "vitest run"`)
- Create: `src/lib/valorant/types.ts`, `src/data/valorant/roster.json`, `src/lib/valorant/normalize.ts`
- Create: `tests/valorant/fixtures/stored-match-competitive.json`, `tests/valorant/normalize.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type Mode = "competitive" | "premier" | "custom";
  export type Side = "Red" | "Blue";
  export interface RosterPlayer { name: string; tag: string; puuid: string }
  export interface Roster { region: "na"; premierTeam: { name: string; tag: string }; players: RosterPlayer[] }
  export interface PlayerMatch {
    matchId: string; puuid: string; mode: Mode; startedAt: string; map: string; season: string;
    agent: string; side: Side; roundsWon: number; roundsLost: number; won: boolean | null; // null = empate
    kills: number; deaths: number; assists: number; headshots: number; bodyshots: number; legshots: number;
    damageMade: number; damageReceived: number; score: number; tier: number;
  }
  export interface LineupEntry { puuid: string; riotId: string; agent: string; inRoster: boolean;
    kills: number; deaths: number; assists: number; headshots: number; bodyshots: number; legshots: number; damage: number; score: number }
  export interface TeamRound { won: boolean; role: "Attack" | "Defense" }
  export interface TeamMatch {
    matchId: string; kind: "premier" | "custom"; startedAt: string; map: string; season: string;
    side: Side; roundsWon: number; roundsLost: number; won: boolean | null;
    opponentName: string | null; opponentPlayers: string[]; lineup: LineupEntry[]; rounds: TeamRound[];
  }
  export interface Snapshot { date: string; // YYYY-MM-DD
    players: Record<string, { tier: number; tierName: string; rr: number; elo: number }>;
    premier: { points: number; division: number; place: number; conference: string; wins: number; losses: number } | null }
  export interface MatchLabel { rival?: string; type?: "scrim" | "torneo"; include?: boolean }
  export type Labels = Record<string, MatchLabel>;
  export interface Meta { updatedAt: string | null; nonTeamMatchIds: string[] }
  export interface Dataset { meta: Meta; roster: Roster; playerMatches: PlayerMatch[]; teamMatches: TeamMatch[]; snapshots: Snapshot[]; labels: Labels }
  ```
- Produces (normalize.ts): `toPlayerMatch(row: StoredMatchRow, mode: Mode): PlayerMatch | null`, where `StoredMatchRow` is the item type of `data[]` in `/v1/stored-matches` (`meta`, `stats`, `teams: { red: number; blue: number }`).

- [ ] **Step 1: Instalar vitest y crear `roster.json`**

`npm i -D vitest`. Contenido de `roster.json`:
```json
{ "region": "na", "premierTeam": { "name": "T L H", "tag": "T L H" }, "players": [
  { "name": "Zeiko", "tag": "BRS", "puuid": "33061b1f-7843-528a-a83c-cdd909de674d" },
  { "name": "BiggS", "tag": "ING", "puuid": "ab7191eb-25fd-5639-b895-e5cf2257621e" },
  { "name": "McFly", "tag": "GOAT", "puuid": "65ec15a9-d6b8-5ff2-8159-115b4b10564b" },
  { "name": "ezekiel", "tag": "bored", "puuid": "25997071-9a45-52bb-95e0-652245a96ac6" },
  { "name": "TDiamond", "tag": "COL", "puuid": "1693c1eb-22d0-5aa8-a972-7d01b5e45d43" },
  { "name": "Sharky", "tag": "kztro", "puuid": "e1f792dc-f201-58fc-8bed-17fc55e01080" } ] }
```

- [ ] **Step 2: Guardar el fixture**

Copiar esta fila real, tal cual, en `stored-match-competitive.json`:
```json
{"meta":{"id":"76af13c9-7dd4-4a14-b851-2f5f3ffaa4d9","map":{"id":"92584fbe-486a-b1b2-9faa-39b0f486b498","name":"Sunset"},"version":"release-13.10-shipping-18-5893614","mode":"Competitive","started_at":"2026-11-13T04:16:48.149Z","season":{"id":"d816f426-48ea-f052-117f-9697a155b319","short":"e11a6"},"region":"latam","cluster":"Miami"},"stats":{"puuid":"33061b1f-7843-528a-a83c-cdd909de674d","name":"","tag":"","team":"Blue","level":472,"character":{"id":"320b2a48-4d9b-a075-30f1-1f93a9b638fa","name":"Sova"},"tier":21,"score":6306,"kills":23,"deaths":17,"assists":13,"shots":{"head":16,"body":24,"leg":5},"damage":{"made":4389,"received":3321}},"teams":{"red":13,"blue":11}}
```

- [ ] **Step 3: Escribir los tests que fallan**

```ts
test("toPlayerMatch mapea una fila de stored-matches", () => {
  const m = toPlayerMatch(fixture, "competitive")!;
  expect(m).toMatchObject({ matchId: "76af13c9-7dd4-4a14-b851-2f5f3ffaa4d9", puuid: "33061b1f-7843-528a-a83c-cdd909de674d",
    mode: "competitive", map: "Sunset", season: "e11a6", agent: "Sova", side: "Blue",
    roundsWon: 11, roundsLost: 13, won: false, kills: 23, deaths: 17, assists: 13,
    headshots: 16, bodyshots: 24, legshots: 5, damageMade: 4389, damageReceived: 3321, score: 6306, tier: 21 });
});
test("empate → won null", () => { /* teams {red:12, blue:12} */ expect(toPlayerMatch(draw, "custom")!.won).toBeNull(); });
test("0 rondas → null", () => { /* teams {red:0, blue:0} */ expect(toPlayerMatch(empty, "custom")).toBeNull(); });
```

- [ ] **Step 4: Correr y ver que fallan** — `npx vitest run tests/valorant/normalize.test.ts`. Esperado: FAIL, porque `toPlayerMatch` no existe.
- [ ] **Step 5: Implementar `types.ts` y `toPlayerMatch` en `normalize.ts`**
- [ ] **Step 6: Correr y ver que pasan** — mismo comando. Esperado: 3 passed.
- [ ] **Step 7: Commit** — `git commit -m "feat(valorant): tipos, roster y normalización de stored-matches"`

---

### Task 2: `toTeamMatch` y regla de partida de equipo

**Files:**
- Modify: `src/lib/valorant/normalize.ts`
- Create: `tests/valorant/fixtures/v4-match-premier.json`, `tests/valorant/team.test.ts`

**Interfaces:**
- Consumes: tipos de la Tarea 1.
- Produces:
  - `teamCandidates(rows: PlayerMatch[], roster: Roster, labels: Labels): Map<string, "premier" | "custom">`: matchIds que vale la pena pedir completos.
    - Premier: cualquier fila con `mode === "premier"`.
    - Custom: ≥ 4 PUUIDs del roster con el mismo `side`, o `labels[id].include === true`.
    - Se excluye todo id con `labels[id].include === false`.
  - `toTeamMatch(match: V4Match, roster: Roster, kind: "premier" | "custom", force?: boolean): TeamMatch | null`.
    - `V4Match` es `data` de `/v4/match/na/{id}`: se usan `metadata`, `players`, `teams` y `rounds`.
    - Devuelve `null` si `metadata.is_completed === false` o si no hay rondas.
    - Premier: devuelve `null` si ningún lado tiene `premier_roster.name === roster.premierTeam.name`.
    - Custom: devuelve `null` si ningún lado tiene ≥ 4 del roster y `force` no es `true`. Con `force`, el lado es el que tenga más jugadores del roster.

- [ ] **Step 1: Generar el fixture recortado** a partir de la partida real `10f293f7-912b-444c-9e82-b57adc832f5f`. Conservar `metadata.{match_id,map,started_at,is_completed,queue,season}`, `players[].{puuid,name,tag,team_id,agent.name,stats}`, `teams[].{team_id,won,rounds,premier_roster.name}` y `rounds[].{winning_team,winning_team_role}`:
  ```bash
  curl -s -H "Authorization: $HENRIKDEV_API_KEY" https://api.henrikdev.xyz/valorant/v4/match/na/10f293f7-912b-444c-9e82-b57adc832f5f \
   | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=JSON.parse(s).data;const out={metadata:(({match_id,map,started_at,is_completed,queue,season})=>({match_id,map,started_at,is_completed,queue,season}))(m.metadata),players:m.players.map(p=>({puuid:p.puuid,name:p.name,tag:p.tag,team_id:p.team_id,agent:{name:p.agent.name},stats:p.stats})),teams:m.teams.map(t=>({team_id:t.team_id,won:t.won,rounds:t.rounds,premier_roster:t.premier_roster?{name:t.premier_roster.name}:null})),rounds:m.rounds.map(r=>({winning_team:r.winning_team,winning_team_role:r.winning_team_role}))};process.stdout.write(JSON.stringify(out,null,1))})' \
   > tests/valorant/fixtures/v4-match-premier.json
  ```
  Antes, cargar la clave en la terminal con `set -a; . ./.env; set +a`.
- [ ] **Step 2: Escribir los tests que fallan**
  ```ts
  test("premier T L H", () => {
    const t = toTeamMatch(fx, roster, "premier")!;
    expect(t).toMatchObject({ kind: "premier", map: "Sunset", side: "Red", roundsWon: 13, roundsLost: 5, won: true, opponentName: "Paw Patrolls" });
    expect(t.rounds).toHaveLength(18);
    expect(t.lineup.filter(l => !l.inRoster).map(l => l.riotId)).toEqual(["dagestan aim f#splsh"]); // suplente
    expect(t.opponentPlayers).toHaveLength(5);
  });
  test("rol de ronda: si T L H perdió la ronda, su rol es el opuesto a winning_team_role", () => {
    // ronda 3 del fixture: winning_team Blue → TLH (Red) perdió; role = opuesto de rounds[2].winning_team_role
  });
  test("premier de otro equipo → null", () => { /* premier_roster.name cambiado a "Otro" en ambos lados */ });
  test("incompleta → null", () => { /* is_completed false */ });
  test("custom con 3 del roster en un lado → null; con force → TeamMatch", () => {});
  test("teamCandidates: 4 del roster mismo side en custom sí; 4 repartidos 2/2 no; include:false excluye; include:true fuerza", () => {});
  ```
- [ ] **Step 3: Correr y ver que fallan** — `npx vitest run tests/valorant/team.test.ts`. Esperado: FAIL.
- [ ] **Step 4: Implementar `teamCandidates` y `toTeamMatch`.**
  - El rol de T L H en cada ronda es `won ? winning_team_role : (winning_team_role === "Attack" ? "Defense" : "Attack")`.
  - `riotId` = `${name}#${tag}`.
  - `opponentName` = `premier_roster.name` del otro lado, o `null`.
- [ ] **Step 5: Correr y ver que pasan.** Esperado: todo pasa.
- [ ] **Step 6: Commit** — `git commit -m "feat(valorant): regla de partida de equipo y resumen de partidas v4"`

---

### Task 3: Store (merge y fotos diarias)

**Files:**
- Create: `src/lib/valorant/store.ts`, `tests/valorant/store.test.ts`

**Interfaces:**
- Produces:
  - `mergePlayerMatches(a: PlayerMatch[], b: PlayerMatch[]): PlayerMatch[]`: sin duplicados por `matchId + puuid` (gana `b`), ordenado por `startedAt` descendente.
  - `mergeTeamMatches(a: TeamMatch[], b: TeamMatch[]): TeamMatch[]`: sin duplicados por `matchId`, ordenado descendente.
  - `upsertSnapshot(list: Snapshot[], s: Snapshot): Snapshot[]`: reemplaza la foto con la misma `date` y ordena de forma ascendente.

- [ ] **Step 1: Tests que fallan.** Un merge con un id repetido da una sola fila y queda la de `b`. El orden es descendente. Dos fotos con la misma fecha dejan una sola. Una lista vacía con lista vacía da `[]`.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run tests/valorant/store.test.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `git commit -m "feat(valorant): merge de partidas y fotos diarias"`

---

### Task 4: Cliente de la API

**Files:**
- Create: `src/lib/valorant/api.ts`, `tests/valorant/api.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export class ApiError extends Error { status: number }
  export interface HenrikClient {
    recentMatches(name: string, tag: string, mode: Mode): Promise<void>;          // GET /v4/matches/na/pc/{n}/{t}?mode=&size=10; descarta el cuerpo
    storedMatches(name: string, tag: string, mode: Mode, page: number, size: number): Promise<{ rows: StoredMatchRow[]; total: number }>;
    match(id: string): Promise<V4Match>;                                            // GET /v4/match/na/{id}
    mmr(name: string, tag: string): Promise<{ tier: number; tierName: string; rr: number; elo: number }>; // GET /v3/mmr/na/pc/{n}/{t} → data.current
    premierTeam(name: string, tag: string): Promise<Snapshot["premier"]>;          // GET /v1/premier/{n}/{t} → stats + placement
  }
  export function createClient(opts: { key: string; fetch?: typeof fetch; minIntervalMs?: number; sleep?: (ms: number) => Promise<void> }): HenrikClient
  ```
  - `minIntervalMs` vale 2100 por defecto.
  - Ante un 429: esperar `x-ratelimit-reset` segundos (si falta, 60) y reintentar, hasta 3 veces.
  - Ante un 5xx: reintentar 2 veces con espera de 5 s.
  - Cualquier otro status distinto de 2xx lanza `ApiError(status)` sin reintentar. El mensaje del error nunca incluye la clave.

- [ ] **Step 1: Tests que fallan** (con `fetch` y `sleep` falsos):
  - `premierTeam("T L H","T L H")` pide la URL `https://api.henrikdev.xyz/valorant/v1/premier/T%20L%20H/T%20L%20H`.
  - Se envía el header `Authorization`.
  - Dos llamadas seguidas → `sleep` recibe un valor ≥ 2100 antes de la segunda.
  - 429 con `x-ratelimit-reset: 9`, luego 200 → `sleep(9000)` y el resultado es correcto.
  - Cuatro 429 seguidos → `ApiError` con status 429.
  - 404 → `ApiError` con status 404, una sola llamada a fetch.
  - El mensaje del error no contiene la clave.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run tests/valorant/api.test.ts`.
- [ ] **Step 3: Implementar.** El throttle guarda la hora de la última petición y llama a `sleep` con la diferencia que falte.
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `git commit -m "feat(valorant): cliente HenrikDev con throttle y reintentos"`

---

### Task 5: Recolector

**Files:**
- Create: `scripts/valorant/collect.ts`, `tests/valorant/collect.test.ts`

**Interfaces:**
- Consumes: `createClient`, `toPlayerMatch`, `teamCandidates`, `toTeamMatch`, `merge*`, `upsertSnapshot`.
- Produces:
  - `runCollection(opts: { client: HenrikClient; roster: Roster; dataDir: string; now: Date; log?: (m: string) => void }): Promise<{ newPlayerMatches: number; newTeamMatches: number }>`
  - CLI: `node scripts/valorant/collect.ts <dataDir>`. Lee `HENRIKDEV_API_KEY` del entorno y `src/data/valorant/roster.json`.

Algoritmo de `runCollection`:
1. Leer de `dataDir` los archivos `player-matches.json`, `team-matches.json`, `snapshots.json`, `labels.json` y `meta.json`. Si alguno falta, usar `[]` o `{}`; para `meta`, `{ updatedAt: null, nonTeamMatchIds: [] }`.
2. Por cada jugador y cada modo (`custom`, `premier`, `competitive`):
   - `recentMatches`.
   - `storedMatches` con `size = 100` y `page = 1, 2, …`. Parar cuando la página venga corta o cuando **todas** sus filas ya estén guardadas.
   - Pasar cada fila por `toPlayerMatch` con `puuid` = el del roster.
   - Si un jugador da `ApiError` 404: avisar con `log`, saltar a ese jugador y seguir.
3. Sacar los candidatos con `teamCandidates`. Descartar los que ya están en team-matches o en `meta.nonTeamMatchIds`.
4. Por cada candidato, llamar a `match(id)` y luego `toTeamMatch(…, force = labels[id]?.include === true)`. Si devuelve `null`, agregar el id a `nonTeamMatchIds`.
5. Pedir `mmr` de cada jugador y `premierTeam`, y hacer upsert de la foto con `date = now.toISOString().slice(0, 10)`.
6. **Solo al final**, escribir los cuatro archivos (todos menos `labels.json`, que nunca se escribe) con `JSON.stringify(x, null, 1)` y `meta.updatedAt = now.toISOString()`.
   - Cualquier error que no sea un 404 de un jugador se propaga sin haber escrito nada. El CLI termina con `process.exit(1)`.

- [ ] **Step 1: Tests que fallan.** Usan un cliente falso en memoria y un `dataDir` temporal (`fs.mkdtemp`):
  - Corrida inicial: escribe los 4 archivos, y `labels.json` no se crea ni se toca.
  - Segunda corrida con los mismos datos: `newPlayerMatches === 0` y `match()` no se vuelve a llamar.
  - Un custom con 3 del roster no llama a `match()`. Uno con 4 del roster sí.
  - Un candidato que `toTeamMatch` rechaza queda en `nonTeamMatchIds` y no se vuelve a pedir.
  - Si `mmr` lanza 500 a mitad de la corrida, se rechaza la promesa y los archivos del `dataDir` quedan idénticos a como estaban.
  - Un jugador con 404 sale en `log` y los demás sí se guardan.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run tests/valorant/collect.test.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Corrida real local** — `set -a; . ./.env; set +a; node scripts/valorant/collect.ts /tmp/valorant-data-check`.
  - Esperado: termina con código 0 en unos 2-4 minutos.
  - `player-matches.json` tiene cientos de filas.
  - `team-matches.json` incluye `10f293f7-…` y `3cbda09f-…`.
  - `snapshots.json` tiene 1 foto con 6 jugadores y `premier.division === 21`.
- [ ] **Step 6: Commit** — `git commit -m "feat(valorant): recolector diario"`

---

### Task 6: Agregados para la página

**Files:**
- Create: `src/lib/valorant/stats.ts`, `tests/valorant/stats.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const MIN_GAMES = 3;
  export type Period = "act" | "all";
  export interface Filter { modes: Mode[]; period: Period }
  export function currentSeason(ds: Dataset): string | null;            // season de la partida más reciente (player o team)
  export function includedTeamMatches(ds: Dataset): TeamMatch[];          // excluye labels include:false
  export function teamMatchesFor(ds: Dataset, f: Filter): TeamMatch[];   // modes: "premier" → kind premier; "custom" → kind custom; "competitive" ignorado
  export function playerMatchesFor(ds: Dataset, puuid: string, f: Filter): PlayerMatch[]; // custom solo si matchId ∈ includedTeamMatches
  export interface Line { games: number; wins: number; winRate: number | null; kd: number | null; hsPct: number | null; dmgPerRound: number | null }
  export function line(ms: PlayerMatch[]): Line;                          // winRate null si games < MIN_GAMES; demás null si 0 partidas
  export function byKey(ms: PlayerMatch[], key: "map" | "agent"): Array<{ key: string; line: Line; topAgent?: string }>; // orden: games desc
  export function teamByMap(tms: TeamMatch[]): Array<{ map: string; games: number; wins: number; winRate: number | null; atkPct: number | null; defPct: number | null }>;
  export function compositions(tms: TeamMatch[]): Array<{ map: string; agents: string[]; games: number; winRate: number | null }>; // agents ordenados alfabéticamente, lado T L H
  export function mapDetail(tms: TeamMatch[], map: string, roster: Roster): Array<{ riotId: string; topAgent: string | null; games: number; winRate: number | null; kd: number | null }>;
  export function recent(ds: Dataset, tms: TeamMatch[], n: number): Array<{ matchId: string; date: string; kindLabel: "Premier" | "Scrim" | "Torneo"; map: string; score: string; won: boolean | null; rival: string; subs: string[] }>;
  export function highlights(all: PlayerMatch[]): string[];               // máx 3
  export function rrSeries(ds: Dataset, puuid: string): Array<{ date: string; elo: number }>;
  ```
- Reglas fijas:
  - K/D = kills / max(deaths, 1).
  - HS% = head / (head + body + leg) × 100, o `null` si son 0 disparos.
  - Daño por ronda = daño / rondas.
  - En `recent`, el rival de un custom es `labels.rival ?? "Scrim vs " + opponentPlayers[0]`, y `kindLabel` sale de `labels.type`; si no hay etiqueta es "Scrim".
  - `subs` = riotId de los jugadores del lineup con `!inRoster`.
- Destacados, solo con mapas que tengan ≥ MIN_GAMES partidas:
  - `Mejor mapa: <map> (<wr>% en <n>)` y `Peor mapa: …`, si son distintos.
  - `HS% <subió|bajó> de <x>% a <y>% en las últimas 10`, si la diferencia es ≥ 3 puntos y hay ≥ 15 partidas.
  - `K/D <subió|bajó> de <x> a <y> en las últimas 10`, si la diferencia es ≥ 0.15 y hay ≥ 15 partidas.
  - Redondeo: porcentajes a entero y K/D a 2 decimales.

- [ ] **Step 1: Tests que fallan** (dataset sintético armado con helpers en el test):
  - `line([])` → `{ games: 0, wins: 0, winRate: null, kd: null, hsPct: null, dmgPerRound: null }`. Ningún valor es `NaN`.
  - `line` con 2 partidas → `winRate === null`, `kd` es un número.
  - Un empate cuenta en `games` pero no en `wins`.
  - `teamByMap`: con rondas `[{won:true,role:"Attack"},{won:false,role:"Attack"},{won:true,role:"Defense"}]` → `atkPct 50`, `defPct 100`.
  - `playerMatchesFor(…, { modes: ["custom"] })` excluye un custom que no está en team-matches, o que tiene `include:false`.
  - Periodo `act` filtra por `currentSeason`.
  - `recent`: un custom sin etiqueta → rival `"Scrim vs X#1"` y `kindLabel "Scrim"`; con `{type:"torneo", rival:"ABC"}` → `"Torneo"` y `"ABC"`. Una partida con suplente → `subs` contiene su riotId.
  - `highlights`: un jugador con 0 partidas → `[]`.
  - `mapDetail` para un jugador del roster que no jugó ese mapa → `games 0`, `topAgent null`.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run tests/valorant/stats.test.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Commit** — `git commit -m "feat(valorant): agregados de estadísticas"`

---

### Task 7: Descarga de datos antes del build

**Files:**
- Create: `scripts/valorant/fetch-data.mjs`, `tests/valorant/fetch-data.test.ts`, `vercel.json`
- Modify: `package.json` (scripts `"prebuild"` y `"predev"`: `node scripts/valorant/fetch-data.mjs`), `.gitignore` (`public/valorant-data.json`)

**Interfaces:**
- Consumes: el formato de `Dataset` (Tarea 1). `roster` se lee de `src/data/valorant/roster.json`, no de la rama.
- Produces:
  - `export async function buildDataset({ fetch, roster }): Promise<Dataset>`.
    - Pide `GET https://api.github.com/repos/TLH-Enterprise/TLH/commits/valorant-data` y toma `.sha`.
    - Luego pide `https://raw.githubusercontent.com/TLH-Enterprise/TLH/<sha>/data/<file>` para los 5 archivos.
    - Si algo falla (red, status distinto de 2xx o JSON inválido), devuelve el dataset vacío `{ meta: { updatedAt: null, nonTeamMatchIds: [] }, roster, playerMatches: [], teamMatches: [], snapshots: [], labels: {} }` y escribe una advertencia en consola.
  - Al ejecutarse como CLI, escribe `public/valorant-data.json` y siempre termina con código 0.
  - Si existe la variable de entorno `VALORANT_DATA_DIR`, lee los archivos de ese directorio local en vez de la red. Sirve para desarrollo local.
- `vercel.json`: `{ "git": { "deploymentEnabled": { "valorant-data": false } } }`, para que los commits de datos no generen previews.

- [ ] **Step 1: Tests que fallan** (con `fetch` falso):
  - Camino feliz: el SHA se usa en las 5 URLs raw y se devuelven los datos.
  - El commit da 403 → dataset vacío y no lanza error.
  - Un archivo con JSON inválido → dataset vacío.
- [ ] **Step 2: Correr y ver que fallan** — `npx vitest run tests/valorant/fetch-data.test.ts`.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr y ver que pasan.**
- [ ] **Step 5: Verificar** — `VALORANT_DATA_DIR=/tmp/valorant-data-check/ npm run build`. Esperado: el build pasa y `dist/valorant-data.json` existe y tiene partidas. Después, `npm run build` sin la variable (la rama aún no existe): el build pasa igual, con la advertencia y un dataset vacío.
- [ ] **Step 6: Commit** — `git commit -m "feat(valorant): descarga de datos antes del build"`

---

### Task 8: La página `/valorant`

**Files:**
- Create: `src/pages/valorant.astro`, `src/components/valorant/ValorantApp.astro` (markup + `<style>`), `src/scripts/valorant.ts`
- Test: verificación con build y en el navegador (la lógica ya está probada en la Tarea 6)

**Interfaces:**
- Consumes: todo `stats.ts`, `Dataset` y `/valorant-data.json`.
- Produces: la ruta `/valorant`.

Estructura de la página:
- Usa `Layout` con el título `"TLH — Valorant"` y `<meta name="robots" content="noindex">`. Para eso hay que añadir a `Layout` una prop opcional `robots`, con valor por defecto `"index, follow"`.
- Usa `Navbar` y `Footer` existentes.
- `valorant.ts` hace `fetch("/valorant-data.json")` y renderiza en contenedores con `id`:
  1. **Pestañas:** Equipo + una por jugador (nombre del roster). La pestaña activa se guarda en `location.hash` (`#equipo`, `#zeiko`, …).
  2. **Chips de modo** (multiselección: Premier, Scrims/Torneos, Ranked) y **periodo** (Este acto / Todo).
     - Valores por defecto: Equipo = Premier + Scrims/Torneos + Este acto. Jugador = Ranked + Este acto.
     - En la pestaña Equipo el chip Ranked está deshabilitado.
  3. **Equipo:**
     - KPIs: Premier (`Div <division> · #<place>` y puntos de la última foto) y Récord `<wins>–<losses>` del filtro.
     - Tabla de mapas (`teamByMap`). Al hacer clic en una fila se despliega `mapDetail` debajo.
     - Tabla de composiciones (`compositions`, top 5).
     - Últimas 10 partidas (`recent`), con la etiqueta "con suplente: X" cuando aplique.
  4. **Jugador:**
     - KPIs: Rango (`tierName · rr RR` de la última foto), K/D, HS% y Daño/ronda, calculados con `line` sobre el filtro.
     - Destacados (`highlights`), si hay.
     - Tabla de agentes y tabla de mapas (`byKey`).
     - Gráfica SVG de `rrSeries`: una polilínea en `--brand-1`. Con menos de 2 puntos, mostrar "La gráfica aparece cuando haya al menos 2 días de datos".
  5. **Pie:** "Actualizado: <fecha local de meta.updatedAt>" o "Aún no hay datos".
  6. **Estado vacío** de cualquier tabla: "Sin partidas en este filtro". Todos los valores `null` se muestran como "—".

- [ ] **Step 1: Implementar el markup, los estilos y `valorant.ts`.**
- [ ] **Step 2: Correr los tests** — `npm test`. Esperado: todo pasa.
- [ ] **Step 3: Revisar los tipos** — `npx astro check`. Esperado: 0 errores. Si hace falta, instalar `@astrojs/check` y `typescript` como devDependencies.
- [ ] **Step 4: Verificar en el navegador** — `VALORANT_DATA_DIR=/tmp/valorant-data-check/ npm run dev`, abrir `/valorant` y comprobar:
  - La pestaña Equipo muestra Sunset con 2 partidas en Premier.
  - La pestaña de Sharky con el filtro Scrims/Torneos muestra "Sin partidas en este filtro", sin `NaN`.
  - A 375 px no hay scroll horizontal; las tablas hacen scroll dentro de su contenedor.
  - En la consola no hay errores.
  - Tomar capturas de las pestañas Equipo y Zeiko.
- [ ] **Step 5: Commit** — `git commit -m "feat(valorant): página /valorant"`

---

### Task 9: GitHub Action, rama de datos y pasos manuales

**Files:**
- Create: `.github/workflows/valorant-collect.yml`
- Modify: `README.md` (sección "Valorant: datos")

**Workflow:**
- `on: schedule: - cron: "0 10 * * *"` (5:00 hora de Colombia) y `workflow_dispatch`.
- `permissions: contents: write` y `concurrency: valorant-collect`.
- Pasos:
  1. `actions/checkout@v4` sobre `main`.
  2. `actions/checkout@v4` con `ref: valorant-data` y `path: data-branch`.
  3. `actions/setup-node@v4` con `node-version: 22`.
  4. `npm ci`.
  5. `node scripts/valorant/collect.ts data-branch/data`, con `env: HENRIKDEV_API_KEY: ${{ secrets.HENRIKDEV_API_KEY }}`.
  6. Dentro de `data-branch`: si `git status --porcelain` no está vacío, hacer commit `"data: actualización <fecha>"` como `github-actions[bot]` y push.
  7. `curl -fsS -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"` si existe el secreto. El paso no falla si el secreto no existe y sí falla si el hook responde con error.

- [ ] **Step 1: Crear la rama `valorant-data`** como rama huérfana, con solo `data/` (los archivos de `/tmp/valorant-data-check` y `labels.json` con `{}`) y un `README.md` de una línea.
  - Commit `"data: carga inicial"`.
  - `git push origin valorant-data`.
  - Si el push lo rechaza el ruleset "protect main branch" (por el check "Vercel"), **parar** y avisar al usuario: hay que excluir `valorant-data` del ruleset.
- [ ] **Step 2: Escribir el workflow.**
- [ ] **Step 3: Validar la sintaxis** — `npx --yes action-validator .github/workflows/valorant-collect.yml`. Si no está disponible, revisar el YAML con `node -e "require('yaml')"`.
- [ ] **Step 4: Escribir la sección del README** con los pasos para el usuario, en español:
  1. En Vercel, ir a Project → Settings → Git → Deploy Hooks, crear uno con nombre "valorant" para la rama `main` y copiar la URL.
  2. En GitHub, ir a TLH-Enterprise/TLH → Settings → Secrets and variables → Actions y crear `HENRIKDEV_API_KEY` y `VERCEL_DEPLOY_HOOK_URL`.
  3. En Actions → "Valorant collect" → Run workflow, ejecutarlo una vez y comprobar que aparece un commit en `valorant-data` y un deploy en Vercel.
  4. Editar `data/labels.json` en la rama `valorant-data` desde GitHub para nombrar rivales, marcar torneos o excluir partidas.
  5. Para cambiar el roster, editar `src/data/valorant/roster.json` con un PR.
- [ ] **Step 5: Commit, push de la rama y abrir el PR** hacia `main`. En la descripción, la lista de pasos manuales.
