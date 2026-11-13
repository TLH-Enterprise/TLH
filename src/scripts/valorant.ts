import {
  byKey,
  compositions,
  highlights,
  leaderboard,
  leaders,
  line,
  mapDetail,
  playerMatchesFor,
  recent,
  rrSeries,
  sortLeaderboard,
  teamByMap,
  teamMatchesFor,
  type Filter,
  type LeaderKey,
  type Period,
} from "../lib/valorant/stats.ts";
import type { Dataset, Mode, RosterPlayer } from "../lib/valorant/types.ts";

const TEAM = "equipo";
const RANKING = "ranking";
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const slug = (p: RosterPlayer) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const dash = "—";
const fmtPct = (v: number | null) => (v === null ? dash : `${Math.round(v)}%`);
const fmtKd = (v: number | null) => (v === null ? dash : v.toFixed(2));
const fmtNum = (v: number | null) => (v === null ? dash : String(Math.round(v)));
const wrClass = (v: number | null) => (v === null ? "" : v >= 55 ? "vgood" : v < 45 ? "vbad" : "");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
const EMPTY = `<p class="vempty">Sin partidas en este filtro</p>`;

function table(head: string[], rows: string[][], numCols: number[] = [], rowAttrs: string[] = []): string {
  if (rows.length === 0) return `<div class="vtable-wrap">${EMPTY}</div>`;
  const th = head.map((h, i) => `<th${numCols.includes(i) ? ' class="num"' : ""}>${h}</th>`).join("");
  const body = rows
    .map((r, ri) => `<tr${rowAttrs[ri] ?? ""}>${r.map((c, i) => `<td${numCols.includes(i) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<div class="vtable-wrap"><table class="vtable"><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

const kpi = (label: string, value: string) =>
  `<div class="vkpi"><div class="vkpi__label">${label}</div><div class="vkpi__value">${value}</div></div>`;
const wrCell = (v: number | null) => `<span class="${wrClass(v)}">${fmtPct(v)}</span>`;

function chart(points: Array<{ date: string; elo: number }>): string {
  if (points.length < 2) return `<p class="vempty">La gráfica aparece cuando haya al menos 2 días de datos</p>`;
  const W = 600;
  const H = 160;
  const pad = 8;
  const min = Math.min(...points.map((p) => p.elo));
  const max = Math.max(...points.map((p) => p.elo));
  const span = Math.max(max - min, 1);
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (W - 2 * pad);
    const y = H - pad - ((p.elo - min) / span) * (H - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `<svg class="vchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución del rango">
    <polyline points="${xy.join(" ")}" fill="none" stroke="var(--brand-1)" stroke-width="2.5" vector-effect="non-scaling-stroke" />
  </svg>
  <div class="vchart__label"><span>${esc(points[0].date)}</span><span>${esc(points[points.length - 1].date)}</span></div>`;
}

function renderTeam(ds: Dataset, f: Filter): string {
  const tms = teamMatchesFor(ds, f);
  const last = ds.snapshots[ds.snapshots.length - 1];
  const pr = last?.premier;
  const wins = tms.filter((t) => t.won === true).length;
  const losses = tms.filter((t) => t.won === false).length;
  const maps = teamByMap(tms);
  const comps = compositions(tms).slice(0, 5);
  const rec = recent(ds, tms, 10);

  return `
    <div class="vkpis">
      ${kpi("Premier", pr ? `Div ${pr.division} · #${pr.place}` : dash)}
      ${kpi("Puntos Premier", pr ? String(pr.points) : dash)}
      ${kpi("Récord (filtro)", tms.length ? `${wins}–${losses}` : dash)}
    </div>
    <h2 class="vsec">Mapas</h2>
    ${table(
      ["Mapa", "PJ", "Win%", "Ataque", "Defensa"],
      maps.map((m) => [`${esc(m.map)} ▸`, String(m.games), wrCell(m.winRate), fmtPct(m.atkPct), fmtPct(m.defPct)]),
      [1, 2, 3, 4],
      maps.map((m) => ` class="vrow-btn" data-map="${esc(m.map)}" tabindex="0" aria-expanded="false"`),
    )}
    <h2 class="vsec">Composiciones</h2>
    ${table(
      ["Composición", "Mapa", "PJ", "Win%"],
      comps.map((c) => [esc(c.agents.join(" · ")), esc(c.map), String(c.games), wrCell(c.winRate)]),
      [2, 3],
    )}
    <h2 class="vsec">Últimas partidas</h2>
    ${table(
      ["Fecha", "Tipo", "Mapa", "Marcador", "Rival"],
      rec.map((r) => [
        fmtDate(r.date),
        r.kindLabel,
        esc(r.map),
        `<span class="${r.won === true ? "vgood" : r.won === false ? "vbad" : ""}">${r.score}</span>`,
        esc(r.rival) + (r.subs.length ? `<span class="vbadge">con suplente: ${esc(r.subs.join(", "))}</span>` : ""),
      ]),
    )}`;
}

function renderMapDetail(ds: Dataset, f: Filter, map: string): string {
  const rows = mapDetail(teamMatchesFor(ds, f), map, ds.roster);
  return table(
    ["Jugador", "Agente", "PJ", "Win%", "K/D"],
    rows.map((r) => [esc(r.riotId), r.topAgent ? esc(r.topAgent) : dash, String(r.games), wrCell(r.winRate), fmtKd(r.kd)]),
    [2, 3, 4],
  );
}

function renderPlayer(ds: Dataset, p: RosterPlayer, f: Filter): string {
  const ms = playerMatchesFor(ds, p.puuid, f);
  const l = line(ms);
  const last = ds.snapshots[ds.snapshots.length - 1]?.players[p.puuid];
  const tips = highlights(ms);
  const agents = byKey(ms, "agent");
  const maps = byKey(ms, "map");
  return `
    <div class="vkpis">
      ${kpi("Rango", last ? `${esc(last.tierName)} · ${last.rr} RR` : dash)}
      ${kpi("K/D", fmtKd(l.kd))}
      ${kpi("HS%", fmtPct(l.hsPct))}
      ${kpi("Daño/ronda", fmtNum(l.dmgPerRound))}
      ${kpi("Partidas", String(l.games))}
    </div>
    ${tips.length ? `<ul class="vtips">${tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
    <h2 class="vsec">Agentes</h2>
    ${table(
      ["Agente", "PJ", "Win%", "K/D", "HS%"],
      agents.map((a) => [esc(a.key), String(a.line.games), wrCell(a.line.winRate), fmtKd(a.line.kd), fmtPct(a.line.hsPct)]),
      [1, 2, 3, 4],
    )}
    <h2 class="vsec">Mapas</h2>
    ${table(
      ["Mapa", "PJ", "Win%", "K/D", "Agente top"],
      maps.map((m) => [esc(m.key), String(m.line.games), wrCell(m.line.winRate), fmtKd(m.line.kd), m.topAgent ? esc(m.topAgent) : dash]),
      [1, 2, 3],
    )}
    <h2 class="vsec">Evolución del rango</h2>
    <div class="vchart-wrap">${chart(rrSeries(ds, p.puuid))}</div>`;
}

const RANK_COLS: Array<{ key: LeaderKey; label: string }> = [
  { key: "rank", label: "Rango" },
  { key: "games", label: "PJ" },
  { key: "winRate", label: "Win%" },
  { key: "kd", label: "K/D" },
  { key: "hsPct", label: "HS%" },
  { key: "dmgPerRound", label: "Daño/ronda" },
  { key: "kda", label: "KDA" },
];

function renderRanking(ds: Dataset, f: Filter, sort: { key: LeaderKey; dir: "asc" | "desc" }): string {
  const base = leaderboard(ds, f);
  const lead = leaders(base);
  const rows = sortLeaderboard(base, sort.key, sort.dir);
  const cell = (r: (typeof rows)[number], key: LeaderKey, text: string) =>
    lead[key].includes(r.puuid) ? `<span class="vlead">${text}</span>` : text;
  const th = RANK_COLS.map((c) => {
    const active = c.key === sort.key;
    const aria = active ? (sort.dir === "asc" ? "ascending" : "descending") : "none";
    const arrow = active ? (sort.dir === "asc" ? " ▲" : " ▼") : "";
    return `<th class="num" aria-sort="${aria}"><button type="button" class="vsort" data-sort="${c.key}">${c.label}${arrow}</button></th>`;
  }).join("");
  const body = rows
    .map((r) => {
      const rank = r.tierName ? `${esc(r.tierName)} · ${esc(String(r.rr ?? 0))} RR` : dash;
      const tds = [
        cell(r, "rank", rank),
        cell(r, "games", String(r.line.games)),
        cell(r, "winRate", fmtPct(r.line.winRate)),
        cell(r, "kd", fmtKd(r.line.kd)),
        cell(r, "hsPct", fmtPct(r.line.hsPct)),
        cell(r, "dmgPerRound", fmtNum(r.line.dmgPerRound)),
        cell(r, "kda", fmtKd(r.kda)),
      ];
      return `<tr><td><a class="vplayer" href="#${esc(r.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"))}">${esc(r.name)}</a></td>${tds.map((t) => `<td class="num">${t}</td>`).join("")}</tr>`;
    })
    .join("");
  return `<p class="vsub">Toca un encabezado para ordenar. Resaltado: el mejor de cada columna.</p>
    <div class="vtable-wrap"><table class="vtable vrank"><thead><tr><th>Jugador</th>${th}</tr></thead><tbody>${body}</tbody></table></div>`;
}

async function main() {
  const updated = document.getElementById("v-updated")!;
  const tabsEl = document.getElementById("v-tabs")!;
  const content = document.getElementById("v-content")!;
  const filtersEl = document.getElementById("v-filters")!;

  let ds: Dataset;
  try {
    const res = await fetch("/valorant-data.json", { cache: "no-cache" });
    ds = (await res.json()) as Dataset;
  } catch {
    updated.textContent = "No se pudieron cargar los datos.";
    return;
  }
  updated.textContent = ds.meta.updatedAt
    ? `Actualizado: ${new Date(ds.meta.updatedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`
    : "Aún no hay datos";

  type Kind = "team" | "ranking" | "player";
  const filters: Record<Kind, Filter> = {
    team: { modes: ["premier", "custom"], period: "act" },
    ranking: { modes: ["competitive"], period: "act" },
    player: { modes: ["competitive"], period: "act" },
  };
  const rankSort: { key: LeaderKey; dir: "asc" | "desc" } = { key: "rank", dir: "desc" };
  const kindOf = (tab: string): Kind => (tab === TEAM ? "team" : tab === RANKING ? "ranking" : "player");
  const tabs = [{ id: TEAM, label: "Equipo" }, { id: RANKING, label: "Ranking" }, ...ds.roster.players.map((p) => ({ id: slug(p), label: p.name }))];
  const current = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    return tabs.some((t) => t.id === h) ? h : TEAM;
  };

  tabsEl.innerHTML = tabs
    .map((t) => `<button type="button" class="vtab" role="tab" data-tab="${esc(t.id)}">${esc(t.label)}</button>`)
    .join("");

  function render() {
    const tab = current();
    const kind = kindOf(tab);
    const f = filters[kind];
    tabsEl.querySelectorAll<HTMLButtonElement>(".vtab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    filtersEl.querySelectorAll<HTMLButtonElement>("[data-mode]").forEach((b) => {
      const m = b.dataset.mode as Mode;
      b.disabled = kind === "team" && m === "competitive";
      b.setAttribute("aria-pressed", String(f.modes.includes(m) && !b.disabled));
    });
    filtersEl.querySelectorAll<HTMLButtonElement>("[data-period]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.period === f.period)));
    const player = ds.roster.players.find((p) => slug(p) === tab);
    content.innerHTML = player
      ? renderPlayer(ds, player, f)
      : kind === "ranking"
        ? renderRanking(ds, f, rankSort)
        : renderTeam(ds, f);
  }

  tabsEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".vtab");
    if (b) location.hash = b.dataset.tab!;
  });
  window.addEventListener("hashchange", render);

  filtersEl.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b || b.disabled) return;
    const f = filters[kindOf(current())];
    if (b.dataset.mode) {
      const m = b.dataset.mode as Mode;
      const next = f.modes.includes(m) ? f.modes.filter((x) => x !== m) : [...f.modes, m];
      if (next.length === 0) return; // siempre al menos un modo
      f.modes = next;
    } else if (b.dataset.period) {
      f.period = b.dataset.period as Period;
    }
    render();
  });

  function toggleMap(row: HTMLTableRowElement) {
    const next = row.nextElementSibling;
    if (next?.classList.contains("vdetail")) {
      next.remove();
      row.setAttribute("aria-expanded", "false");
      return;
    }
    const tr = document.createElement("tr");
    tr.className = "vdetail";
    tr.innerHTML = `<td colspan="5">${renderMapDetail(ds, filters.team, row.dataset.map!)}</td>`;
    row.after(tr);
    row.setAttribute("aria-expanded", "true");
  }
  content.addEventListener("click", (e) => {
    const sortBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("button.vsort");
    if (sortBtn) {
      const key = sortBtn.dataset.sort as LeaderKey;
      if (rankSort.key === key) rankSort.dir = rankSort.dir === "desc" ? "asc" : "desc";
      else Object.assign(rankSort, { key, dir: "desc" });
      render();
      return;
    }
    const row = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr.vrow-btn");
    if (row) toggleMap(row);
  });
  content.addEventListener("keydown", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLTableRowElement>("tr.vrow-btn");
    if (row && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      toggleMap(row);
    }
  });

  render();
}

main();
