import {
  byKey,
  compositions,
  currentSeason,
  highlights,
  filterHistory,
  timeSince,
  type HistoryFilter,
  includedTeamMatches,
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
import { benchmarkInfo, GOAL_DECIMALS, GOAL_LABELS, goalsFor, isRole, mainRole, proStats, ROLE_LABELS, roleOfAgent, type GoalRow, type Role } from "../lib/valorant/goals.ts";
import { colombiaToDate, parseReport, tournamentKey, upcoming, type Tournament, type TournamentReport } from "../lib/valorant/tournaments.ts";
import type { Dataset, Mode, RosterPlayer, TeamMatch, PlayerMatch, LineupEntry, TeamRound } from "../lib/valorant/types.ts";

/* ==========================================================================
   UTILITIES
   ========================================================================== */
const esc = (s: string) => {
  const map: Record<string, string> = { "&": "&", "<": "<", ">": ">", '"': "\"", "'": "'" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
};
const slug = (p: RosterPlayer) => p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const dash = "—";
const fmtPct = (v: number | null) => (v === null ? dash : `${Math.round(v)}%`);
const fmtKd = (v: number | null) => (v === null ? dash : v.toFixed(2));
const fmtNum = (v: number | null) => (v === null ? dash : String(Math.round(v)));
const fmtElo = (v: number | null) => (v === null ? dash : String(Math.round(v)));
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "2-digit" });
const fmtTimeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 7) return `Hace ${days}d`;
  return fmtDate(iso);
};

/** Parse ISO date string (YYYY-MM-DD) as UTC */
const parseUTC = (iso: string) => new Date(iso + "T00:00:00Z");

/** Format date with month name (e.g., "13 nov") using UTC */
const fmtDateMonth = (iso: string) => {
  const d = parseUTC(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  return `${day} ${month}`;
};

/** Format date for tooltip (e.g., "13 nov 2026, 00:00") using UTC */
const fmtTooltipDate = (iso: string) => {
  const d = parseUTC(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = d.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" });
  const year = d.getUTCFullYear().toString().slice(-2);
  const hour = String(d.getUTCHours()).padStart(2, "0");
  const minute = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${month} ${year}, ${hour}:${minute}`;
};

/** Abbreviate tier name to 3 letters */
const abbrevTier = (tierName: string): string => {
  const short: Record<string, string> = {
    Iron: "Iro",
    Bronze: "Bro",
    Silver: "Sil",
    Gold: "Gol",
    Platinum: "Pla",
    Diamond: "Dia",
    Ascendant: "Asc",
    Immortal: "Imm",
    Radiant: "Rad",
  };
  // Extract base tier (e.g., "Ascendant 1" -> "Ascendant")
  const base = tierName.split(" ")[0];
  return short[base] ?? base.slice(0, 3);
};

const wrClass = (v: number | null) => (v === null ? "" : v >= 55 ? "tac-win" : v < 45 ? "tac-loss" : "");
const sideClass = (side: "Red" | "Blue") => (side === "Red" ? "tac-side--radiant" : "tac-side--dire");
const roundDot = (won: boolean, role: "Attack" | "Defense") =>
  `<span class="tac-round tac-round--${won ? "win" : "loss"}${won ? ` tac-round--${role.toLowerCase()}` : ""}" aria-hidden="true"></span>`;

/* Agent icon system - color-coded fallbacks */
const agentColors: Record<string, string> = {
  jett: "#00d4ff", reyna: "#ff4d6a", sage: "#8bffb0", sova: "#ff6b35", cypher: "#ffffff",
  killjoy: "#ffcc00", breach: "#ff6b00", omen: "#6b4dff", brimstone: "#cc4400", phoenix: "#ffcc00",
  viper: "#00ff88", skye: "#88ff88", yoru: "#aa44ff", astra: "#aa88ff", kayo: "#88aaff",
  chamber: "#ffaa44", neon: "#ff44aa", fade: "#cc66ff", harbor: "#44aaff", gryphon: "#ff8844",
  vyse: "#8866ff", clove: "#ff66aa", iso: "#6644ff", deadlock: "#88cc44", tejo: "#ffaa00",
};

function agentIcon(agent: string, size = 18): string {
  const key = agent.toLowerCase().replace(/\s+/g, "");
  const bg = agentColors[key] || "#6d28d9";
  const initial = agent.slice(0, 2).toUpperCase();
  return `<span class="tac-agent--fallback" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.max(0.45, 0.5625 * (size/18))}rem;">${esc(initial)}</span>`;
}

function initials(name: string, tag: string): string {
  const n = name.trim().split(/\s+/)[0] || name;
  return (n[0] + tag[0]).toUpperCase();
}

/* ==========================================================================
   COMPONENT RENDERERS
   ========================================================================== */

/** KPI Strip */
function renderKpiStrip(items: Array<{ label: string; value: string; trend?: "up" | "down" | "neutral"; trendText?: string; variant?: "radiant" | "dire" | "spike" | "clutch" | "threat" }>): string {
  return `
    <div class="tac-kpi-strip" role="list" aria-label="Indicadores clave">
      ${items
        .map(
          (k) => `
        <div class="tac-kpi tac-kpi--${k.variant || "radiant"}" role="listitem">
          <div class="tac-kpi__label">${esc(k.label)}</div>
          <div class="tac-kpi__value">${esc(k.value)}</div>
          ${k.trend ? `<div class="tac-kpi__trend tac-kpi__trend--${k.trend}">${esc(k.trendText || "")}</div>` : ""}
        </div>
      `
        )
        .join("")}
    </div>
  `;
}

/** Section header */
function sectionHeader(title: string, count?: number, countLabel?: string): string {
  return `
    <div class="tac-section__header">
      <h2 class="tac-section__title">${esc(title)}</h2>
      ${count !== undefined ? `<span class="tac-section__count">${count} ${esc(countLabel || "partidas")}</span>` : ""}
    </div>
  `;
}

/** Scoreboard table */
function renderScoreboard(
  headers: string[],
  rows: Array<{
    cells: string[];
    rowClass?: string;
    expandable?: boolean;
    mapKey?: string;
    detailHtml?: string;
  }>,
  options: {
    numCols?: number[];
    centerCols?: number[];
    sortableCols?: number[];
    /** Clave de orden por columna (índice → clave); sin ella se usa el texto del encabezado. */
    sortKeys?: Record<number, string>;
    /** Orden activo, para marcar aria-sort en el encabezado correspondiente. */
    sorted?: { key: string; dir: "asc" | "desc" };
  } = {}
): string {
  const { numCols = [], centerCols = [], sortableCols = [], sortKeys = {}, sorted } = options;
  const sortKey = (i: number) => sortKeys[i] ?? headers[i].toLowerCase().replace(/\s+/g, "-");
  const ariaSort = (i: number) => (sorted && sorted.key === sortKey(i) ? (sorted.dir === "asc" ? "ascending" : "descending") : "none");
  if (rows.length === 0) {
    return `
      <div class="tac-empty" role="status">
        <svg class="tac-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12h6M12 9v6"/>
        </svg>
        <p class="tac-empty__title">Sin datos</p>
        <p class="tac-empty__desc">No hay partidas que coincidan con los filtros actuales.</p>
      </div>
    `;
  }

  const th = headers
    .map(
      (h, i) => `
    <th
      class="${numCols.includes(i) ? "num" : ""} ${centerCols.includes(i) ? "center" : ""} ${sortableCols.includes(i) ? "sortable" : ""}"
      ${sortableCols.includes(i) ? `data-sort="${esc(sortKey(i))}" aria-sort="${ariaSort(i)}"` : ""}
    >${esc(h)}</th>
  `
    )
    .join("");

  const body = rows
    .map(
      (r, ri) => `
    <tr class="${r.rowClass || ""} ${r.expandable ? "tac-row--expandable" : ""}" ${r.mapKey ? `data-map="${esc(r.mapKey)}"` : ""} ${r.expandable ? 'tabindex="0" aria-expanded="false"' : ""}>
      ${r.cells.map((c, i) => `<td class="${numCols.includes(i) ? "num" : ""} ${centerCols.includes(i) ? "center" : ""}">${c}</td>`).join("")}
    </tr>
    ${r.detailHtml ? `<tr class="tac-detail-row"><td colspan="${headers.length}"><div class="tac-detail-panel">${r.detailHtml}</div></td></tr>` : ""}
  `
    )
    .join("");

  return `
    <div class="tac-table-wrap" style="overflow-x:auto;">
      <table class="tac-scoreboard" role="grid">
        <thead><tr>${th}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

/** Composition cards */
function renderCompositions(comps: ReturnType<typeof compositions>): string {
  if (comps.length === 0) return "";
  return `
    ${sectionHeader("Composiciones", comps.length)}
    <div class="tac-compositions" role="list">
      ${comps
        .slice(0, 8)
        .map(
          (c) => `
        <article class="tac-comp-card" role="listitem">
          <div class="tac-comp-card__map">${esc(c.map)}</div>
          <div class="tac-comp-card__agents" aria-label="Agentes: ${c.agents.join(", ")}">
            ${c.agents.map((a) => agentIcon(a, 36)).join("")}
          </div>
          <div class="tac-comp-card__stats">
            <span class="tac-comp-card__record">${c.games} ${c.games === 1 ? "partida" : "partidas"}</span>
            <span class="tac-comp-card__wr ${c.winRate === null ? "tac-comp-card__wr--neu" : c.winRate && c.winRate >= 50 ? "tac-comp-card__wr--pos" : "tac-comp-card__wr--neg"}">${fmtPct(c.winRate)}</span>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

/** Callouts / Highlights */
function renderCallouts(items: string[]): string {
  if (items.length === 0) return "";
  return `
    <div class="tac-callouts" role="region" aria-label="Aspectos destacados">
      ${items
        .map((t) => {
          let variant: "map" | "trend" | "agent" = "map";
          if (t.includes("HS%") || t.includes("K/D")) variant = "trend";
          else if (t.includes("agente") || t.includes("Agente")) variant = "agent";
          const icons = {
            map: '<svg class="tac-callout__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><path d="M12 22V12M22 15.5L12 12M2 8.5L12 12"/></svg>',
            trend: '<svg class="tac-callout__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
            agent: '<svg class="tac-callout__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
          };
          return `<div class="tac-callout tac-callout--${variant}">${icons[variant]}<span>${esc(t)}</span></div>`;
        })
        .join("")}
    </div>
  `;
}

/** Rank evolution series: snapshots filtered by period for the tooltip */
function rankSeries(ds: Dataset, puuid: string, f: Filter): Array<{ date: string; tierName: string; rr: number; elo: number }> {
  const allSnapshots = ds.snapshots
    .flatMap((s) => (s.players[puuid] ? [{ date: s.date, ...s.players[puuid] }] : []))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (f.period === "all") return allSnapshots;

  const season = currentSeason(ds);
  if (!season) return allSnapshots;

  const seasonMatches = [...ds.playerMatches, ...ds.teamMatches].filter((m) => m.season === season);
  if (seasonMatches.length === 0) return allSnapshots;

  const seasonStart = Math.min(...seasonMatches.map((m) => new Date(m.startedAt).getTime()));

  return allSnapshots.filter((s) => new Date(s.date).getTime() >= seasonStart);
}

/** ELO Timeline (straight line segments with tier bands derived from data) */
function renderEloTimeline(points: Array<{ date: string; tierName: string; rr: number; elo: number }>): string {
  if (points.length < 2) {
    return `
      <div class="tac-elo-timeline" role="img" aria-label="Sin datos suficientes para la gráfica">
        <div class="tac-empty" style="height:100%;border:0;background:transparent;">
          <svg class="tac-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M3 3v18h18"/><path d="M19 9l-7 7-7-7"/></svg>
          <p class="tac-empty__title">Historial de rango</p>
          <p class="tac-empty__desc">Se necesitan al menos dos capturas de rango para mostrar la evolución.</p>
        </div>
      </div>
    `;
  }

  // Fallback tier definitions (used only if data-derived tiers fail)
  const fallbackTiers = [
    { name: "Iron", min: 0, max: 800, color: "var(--tac-text-muted)" },
    { name: "Bronze", min: 800, max: 1050, color: "#c77c4d" },
    { name: "Silver", min: 1050, max: 1300, color: "var(--tac-text)" },
    { name: "Gold", min: 1300, max: 1550, color: "var(--tac-spike)" },
    { name: "Platinum", min: 1550, max: 1800, color: "var(--tac-dire-dim)" },
    { name: "Diamond", min: 1800, max: 2050, color: "var(--tac-dire)" },
    { name: "Ascendant", min: 2050, max: 2300, color: "var(--tac-radiant)" },
    { name: "Immortal", min: 2300, max: 2550, color: "var(--tac-threat)" },
    { name: "Radiant", min: 2550, max: 3000, color: "var(--tac-text)" },
  ];

  const fallbackTierOf = (elo: number) => fallbackTiers.find((t) => elo >= t.min && elo < t.max) ?? fallbackTiers[fallbackTiers.length - 1];

  // Derive tiers from actual data: group points by base tier name (e.g., "Ascendant" from "Ascendant 1")
  // and compute ELO range for each base tier present in the data
  const baseTierOf = (tierName: string) => tierName.split(" ")[0]; // "Ascendant 1" -> "Ascendant"
  const tierGroups = new Map<string, { minElo: number; maxElo: number; points: typeof points }>();

  for (const p of points) {
    const baseTier = baseTierOf(p.tierName);
    const group = tierGroups.get(baseTier) ?? { minElo: Infinity, maxElo: -Infinity, points: [] };
    group.minElo = Math.min(group.minElo, p.elo);
    group.maxElo = Math.max(group.maxElo, p.elo);
    group.points.push(p);
    tierGroups.set(baseTier, group);
  }

  // Build data-derived tiers sorted by ELO
  const derivedTiers = Array.from(tierGroups.entries())
    .map(([name, g]) => ({
      name,
      min: g.minElo,
      max: g.maxElo,
      color: fallbackTierOf(g.minElo).color, // use fallback color for the base tier
      points: g.points,
    }))
    .sort((a, b) => a.min - b.min);

  // If no derived tiers (shouldn't happen), fall back to hardcoded
  const tiers = derivedTiers.length > 0 ? derivedTiers : fallbackTiers;

  // Helper to find tier by ELO using derived tiers (with fallback)
  const tierOf = (elo: number) => tiers.find((t) => elo >= t.min && elo <= t.max) ?? fallbackTierOf(elo);

  const W = 560;
  const H = 180;
  const pad = { top: 16, right: 12, bottom: 28, left: 90 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  // Dynamic y-scale based on data range, with padding
  const dataMin = Math.min(...points.map((p) => p.elo));
  const dataMax = Math.max(...points.map((p) => p.elo));
  const eloSpan = dataMax - dataMin || 1;
  const padding = eloSpan * 0.15;
  const minElo = Math.max(0, dataMin - padding);
  const maxElo = dataMax + padding;

  const xScale = (i: number) => pad.left + (i / (points.length - 1)) * plotW;
  const yScale = (elo: number) => pad.top + plotH - ((elo - minElo) / (maxElo - minElo)) * plotH;

  // Colored line segments — green if ELO gained, red if lost between consecutive points
  const lineSegments = points
    .slice(1)
    .map((p, i) => {
      const xPrev = xScale(i);
      const xCurr = xScale(i + 1);
      const yPrev = yScale(points[i].elo);
      const yCurr = yScale(points[i + 1].elo);
      const gained = points[i + 1].elo >= points[i].elo;
      const color = gained ? "var(--tac-clutch)" : "var(--tac-threat)";
      return `<path d="M${xPrev},${yPrev}L${xCurr},${yCurr}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    })
    .join("");

  // Tier bands — only for tiers derived from data
  const tierBands = tiers
    .map((t) => {
      const y1 = yScale(Math.min(t.max, maxElo));
      const y2 = yScale(Math.max(t.min, minElo));
      const h = Math.abs(y2 - y1);
      if (h < 1) return "";
      return `<rect class="tier-band" x="${pad.left}" y="${Math.min(y1, y2)}" width="${plotW}" height="${h}" fill="${t.color}" opacity="0.08"/><text class="tier-label" x="${pad.left - 8}" y="${(y1 + y2) / 2}">${t.name}</text>`;
    })
    .join("");

  // Division markers within tiers (3 per tier, except Radiant)
  const divisionLines = tiers
    .filter((t) => t.name !== "Radiant")
    .flatMap((t) => {
    const tierHeight = t.max - t.min;
    if (tierHeight <= 0) return [];
    const y1 = yScale(t.min + tierHeight / 3);
    const y2 = yScale(t.min + (2 * tierHeight) / 3);
    return [
      `<line x1="${pad.left}" x2="${pad.left + plotW}" y1="${y1}" y2="${y1}" stroke="var(--tac-stroke)" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`,
      `<line x1="${pad.left}" x2="${pad.left + plotW}" y1="${y2}" y2="${y2}" stroke="var(--tac-stroke)" stroke-width="0.5" stroke-dasharray="2,2" opacity="0.4"/>`,
    ];
  }).join("");

  // Points color-coded by derived tier; latest point highlighted
  const pointEls = points
    .map((p, i) => {
      const x = xScale(i);
      const y = yScale(p.elo);
      const tier = tierOf(p.elo);
      const isLast = i === points.length - 1;
      const r = isLast ? 4.5 : 3.5;
      return `<circle class="elo-point" style="fill:${tier.color};stroke:var(--tac-bg);stroke-width:${isLast ? 3 : 2};" cx="${x}" cy="${y}" r="${r}" data-date="${esc(p.date)}" data-tier="${esc(p.tierName)}" data-rr="${p.rr}" data-elo="${p.elo}" tabindex="0" role="button" aria-label="${esc(p.date)}: ${esc(p.tierName)} ${p.rr} RR (${p.elo} ELO)"/>`;
    })
    .join("");

  // RR deltas between consecutive snapshots
  const rrDeltas = points
    .slice(1)
    .map((p, i) => {
      const delta = p.elo - points[i].elo;
      if (Math.abs(delta) < 1) return "";
      const x = xScale(i + 1);
      const y = Math.min(yScale(points[i].elo), yScale(p.elo)) - 10;
      const color = delta > 0 ? "var(--tac-clutch)" : "var(--tac-threat)";
      const sign = delta > 0 ? "+" : "";
      return `<text class="rr-delta" x="${x}" y="${y}" text-anchor="middle" font-family="var(--tac-font-mono)" font-size="0.5rem" fill="${color}">${sign}${Math.round(delta)}</text>`;
    })
    .join("");

  // Current tier anchor line at latest ELO
  const lastPoint = points[points.length - 1];
  const lastTier = tierOf(lastPoint.elo);
  const anchorY = yScale(lastPoint.elo);
  const anchorLine = `<line x1="${pad.left}" x2="${pad.left + plotW}" y1="${anchorY}" y2="${anchorY}" stroke="${lastTier.color}" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6"/>`;
  const anchorLabel = `<text class="anchor-label" x="${pad.left - 8}" y="${anchorY - 4}" text-anchor="end" font-family="var(--tac-font-mono)" font-size="0.5625rem" fill="${lastTier.color}" font-weight="600">${esc(lastTier.name)} ${lastPoint.rr} RR</text>`;

  // Date axis
  const dateLabels = [0, Math.floor(points.length / 2), points.length - 1]
    .map((i) => {
      const x = xScale(i);
      const date = points[i].date;
      return `<text class="date-axis" x="${x}" y="${H - pad.bottom + 18}" text-anchor="middle">${esc(fmtDateMonth(date))}</text>`;
    })
    .join("");

  return `
    <div class="tac-elo-timeline" role="img" aria-label="Evolución del ELO en el tiempo">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${tierBands}
        ${divisionLines}
        ${anchorLine}
        ${lineSegments}
        ${pointEls}
        ${rrDeltas}
        ${anchorLabel}
        ${dateLabels}
      </svg>
      <div class="tac-elo-tooltip" id="tac-elo-tooltip" hidden>
        <div class="tac-elo-tooltip__date"></div>
        <div class="tac-elo-tooltip__rank"></div>
        <div class="tac-elo-tooltip__rr"></div>
      </div>
    </div>
  `;
}



/** Map detail grid for drill-down */
function renderMapDetailGrid(rows: ReturnType<typeof mapDetail>): string {
  return `
    <div class="tac-map-detail" role="list">
      ${rows
        .map(
          (r) => `
        <article class="tac-map-player" role="listitem">
          <div class="tac-map-player__name">${esc(r.riotId)}</div>
          <div class="tac-map-player__agent">${r.topAgent ? agentIcon(r.topAgent, 16) + " " + esc(r.topAgent) : "—"}</div>
          <div class="tac-map-player__stats">
            <div class="tac-map-player__stat">
              <span class="tac-map-player__stat-label">PJ</span>
              <span class="tac-map-player__stat-value">${r.games}</span>
            </div>
            <div class="tac-map-player__stat">
              <span class="tac-map-player__stat-label">WR</span>
              <span class="tac-map-player__stat-value ${wrClass(r.winRate).replace("tac-", "")}">${fmtPct(r.winRate)}</span>
            </div>
            <div class="tac-map-player__stat">
              <span class="tac-map-player__stat-label">K/D</span>
              <span class="tac-map-player__stat-value">${fmtKd(r.kd)}</span>
            </div>
          </div>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

/* ==========================================================================
   VIEW RENDERERS
   ========================================================================== */

/** Highlights del equipo: una entrada por partida (la del primer jugador del roster que la jugó). */
function teamHighlights(ds: Dataset, tms: TeamMatch[]): string[] {
  const ids = new Set(tms.map((t) => t.matchId));
  const seen = new Set<string>();
  const ms = ds.playerMatches.filter((m) => ids.has(m.matchId) && !seen.has(m.matchId) && seen.add(m.matchId));
  return highlights(ms);
}

function renderTeam(ds: Dataset, f: Filter): string {
  const tms = teamMatchesFor(ds, f);
  const last = ds.snapshots[ds.snapshots.length - 1];
  const pr = last?.premier;
  const wins = tms.filter((t) => t.won === true).length;
  const losses = tms.filter((t) => t.won === false).length;
  const draws = tms.filter((t) => t.won === null).length;
  const maps = teamByMap(tms);
  const comps = compositions(tms);
  const rec = recent(ds, tms, 10);

  // KPI Strip
  const kpis = [
    { label: "Premier", value: pr ? `Div ${pr.division} · #${pr.place}` : dash, variant: "radiant" as const },
    { label: "Puntos", value: pr ? String(pr.points) : dash, variant: "spike" as const },
    { label: "Récord", value: tms.length ? `${wins}–${losses}${draws ? `–${draws}` : ""}` : dash, variant: "clutch" as const, trend: (wins > losses ? "up" : losses > wins ? "down" : "neutral") as "up" | "down" | "neutral", trendText: wins > losses ? `+${wins - losses}` : losses > wins ? `${wins - losses}` : "Empate" },
  ];

  // Map scoreboard
  const mapHeaders = ["Mapa", "PJ", "WR", "Ataque", "Defensa", "Rondas"];
  const mapRows = maps.map((m) => {
    // Un punto por partida (la más reciente primero) y el total de rondas del mapa.
    const resultDots = m.results
      .map((r) => {
        const cls = r.won === true ? "tac-round--win" : r.won === false ? "tac-round--loss" : "";
        const label = `${r.won === true ? "Victoria" : r.won === false ? "Derrota" : "Empate"} ${r.roundsWon}–${r.roundsLost}`;
        return `<span class="tac-round ${cls}" title="${label}" aria-label="${label}"></span>`;
      })
      .join("");
    const diff = m.roundsWon - m.roundsLost;
    return {
      cells: [
        `<strong>${esc(m.map)}</strong>`,
        String(m.games),
        `<span class="${wrClass(m.winRate)}">${fmtPct(m.winRate)}</span>`,
        fmtPct(m.atkPct),
        fmtPct(m.defPct),
        `<div class="tac-rounds" role="img" aria-label="Partidas en ${esc(m.map)}">${resultDots}<span class="tac-rounds__total ${diff > 0 ? "tac-win" : diff < 0 ? "tac-loss" : ""}">${m.roundsWon}–${m.roundsLost}</span></div>`,
      ],
      rowClass: "",
      expandable: true,
      mapKey: m.map,
      detailHtml: renderMapDetailGrid(mapDetail(tms, m.map, ds.roster)),
    };
  });

  // Recent matches
  const recHeaders = ["Fecha", "Modo", "Mapa", "Marcador", "Rival"];
  const recRows = rec.map((r) => ({
    cells: [
      fmtDate(r.date),
      `<span class="tac-badge tac-badge--${r.kindLabel.toLowerCase() === "premier" ? "premier" : r.kindLabel.toLowerCase() === "torneo" ? "torneo" : "scrim"}">${esc(r.kindLabel)}</span>`,
      esc(r.map),
      `<span class="${r.won === true ? "tac-win" : r.won === false ? "tac-loss" : "tac-draw"}">${esc(r.score)}</span>`,
      esc(r.rival) + (r.subs.length ? `<span class="tac-badge tac-badge--sub" style="margin-left:8px;">Suplente: ${esc(r.subs.join(", "))}</span>` : ""),
    ],
  }));

  return `
    ${renderKpiStrip(kpis)}
    ${renderCallouts(teamHighlights(ds, tms))}
    ${sectionHeader("Mapas", maps.length, "mapas")}
    ${renderScoreboard(mapHeaders, mapRows, { numCols: [1, 2, 3, 4], centerCols: [5], sortableCols: [0, 1, 2, 3, 4] })}
    ${renderCompositions(comps)}
    ${sectionHeader("Últimas partidas", rec.length)}
    ${renderScoreboard(recHeaders, recRows, { centerCols: [1, 3] })}
  `;
}

/* ==========================================================================
   METAS NIVEL PRO
   ========================================================================== */
const MIN_GOAL_ROUNDS = 200;

function goalBar(r: GoalRow): string {
  const d = GOAL_DECIMALS[r.key];
  const max = r.top * 1.2;
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(1)}%`;
  const fmt = (v: number) => v.toFixed(d) + (r.key === "hs" ? "%" : "");
  const status =
    r.level === null
      ? "Sin datos"
      : r.level === "top"
        ? "Nivel Pro top ✓"
        : r.level === "pro"
          ? `Nivel Pro ✓ · faltan ${fmt(r.gap!)} para Pro top`
          : `Faltan ${fmt(r.gap!)} para nivel Pro`;
  return `
    <div class="tac-goal tac-goal--${r.level ?? "none"}">
      <div class="tac-goal__head">
        <span class="tac-goal__label">${GOAL_LABELS[r.key]}</span>
        <span class="tac-goal__value">${r.value === null ? dash : fmt(r.value)}</span>
      </div>
      <div class="tac-goal__track" role="img" aria-label="${GOAL_LABELS[r.key]}: ${r.value === null ? "sin datos" : fmt(r.value)}; Pro ${fmt(r.pro)}; Pro top ${fmt(r.top)}">
        <div class="tac-goal__fill" style="width:${r.value === null ? "0%" : pos(r.value)}"></div>
        <span class="tac-goal__mark" style="left:${pos(r.pro)}" title="Pro ${fmt(r.pro)}"></span>
        <span class="tac-goal__mark tac-goal__mark--top" style="left:${pos(r.top)}" title="Pro top ${fmt(r.top)}"></span>
      </div>
      <div class="tac-goal__foot">
        <span>Pro ${fmt(r.pro)} · Pro top ${fmt(r.top)}</span>
        <span class="tac-goal__status">${status}</span>
      </div>
    </div>`;
}

/** Las metas siempre se miden en partidas de equipo (Premier + scrims/torneos), con el periodo del filtro. */
const GOAL_MODES: Mode[] = ["premier", "custom"];

function renderGoals(ds: Dataset, p: RosterPlayer, f: Filter): string {
  const ms = playerMatchesFor(ds, p.puuid, { modes: GOAL_MODES, period: f.period });
  const scope = `Premier + Scrims/Torneos · ${f.period === "act" ? "este acto" : "todo el historial"}`;
  const auto = mainRole(ms);
  const assigned = isRole(p.role) ? p.role : null;
  const roles = [...new Set([assigned, auto].filter((r): r is Role => r !== null))];
  if (roles.length === 0)
    return `${sectionHeader("Metas nivel pro")}<p class="tac-goals__note">Sin partidas de Premier ni scrims/torneos (${f.period === "act" ? "este acto" : "todo el historial"}) para calcular las metas.</p>`;
  const stats = proStats(ms);
  // Agente más jugado DENTRO del rol detectado (el más jugado en general puede ser de otro rol).
  const autoAgent = auto ? byKey(ms, "agent").find((a) => roleOfAgent(a.key) === auto)?.key ?? null : null;
  const tabLabel = (r: Role) =>
    [r === assigned ? "Rol asignado" : null, r === auto ? `Rol por agente${autoAgent ? ` (${esc(autoAgent)})` : ""}` : null].filter(Boolean).join(" · ");
  const warnings = [
    "Los pros sacan estos números jugando contra pros; en Premier y scrims los rivales suelen ser más débiles.",
    stats.rounds < MIN_GOAL_ROUNDS ? `Solo ${stats.rounds} rondas: los números todavía pueden variar mucho.` : null,
  ].filter(Boolean);
  return `
    <section class="tac-goals" data-goals>
      <div class="tac-section__header">
        <h2 class="tac-section__title">Metas nivel pro</h2>
        <span class="tac-section__count">${esc(scope)}</span>
      </div>
      ${
        roles.length > 1
          ? `<div class="tac-goals__roles" role="tablist" aria-label="Rol para comparar">${roles
              .map((r, i) => `<button type="button" role="tab" class="tac-goals__role" data-goal-role="${r}" aria-selected="${i === 0}">${ROLE_LABELS[r]}<small>${tabLabel(r)}</small></button>`)
              .join("")}</div>`
          : `<p class="tac-goals__role-one"><strong>${ROLE_LABELS[roles[0]]}</strong> · ${tabLabel(roles[0])}</p>`
      }
      ${roles
        .map(
          (r, i) => `<div class="tac-goals__grid" data-goal-panel="${r}"${i === 0 ? "" : " hidden"}>${goalsFor(r, stats).map(goalBar).join("")}</div>
          <p class="tac-goals__note" data-goal-panel="${r}"${i === 0 ? "" : " hidden"}>Pro = mediana y Pro top = 25% mejor de los ${benchmarkInfo.playersFor(r)} ${ROLE_LABELS[r].toLowerCase()}s de VCT Americas 2026 (vlr.gg, datos del ${benchmarkInfo.collectedAt}). Se mide solo en Premier y scrims/torneos, sin importar el filtro de modo.</p>`,
        )
        .join("")}
      ${warnings.map((w) => `<p class="tac-goals__warn">⚠ ${esc(w!)}</p>`).join("")}
    </section>`;
}

function renderPlayer(ds: Dataset, p: RosterPlayer, f: Filter): string {
  const ms = playerMatchesFor(ds, p.puuid, f);
  const l = line(ms);
  const last = ds.snapshots[ds.snapshots.length - 1]?.players[p.puuid];
  const tips = highlights(ms);
  const agents = byKey(ms, "agent");
  const maps = byKey(ms, "map");

  const kpis = [
    { label: "Rango", value: last ? `${esc(last.tierName)} · ${last.rr} RR` : dash, variant: "radiant" as const },
    { label: "K/D", value: fmtKd(l.kd), variant: "clutch" as const },
    { label: "HS%", value: fmtPct(l.hsPct), variant: "spike" as const },
    { label: "Daño/R", value: fmtNum(l.dmgPerRound), variant: "dire" as const },
    { label: "Partidas", value: String(l.games), variant: "threat" as const },
  ];

  const agentHeaders = ["Agente", "PJ", "WR", "K/D", "HS%"];
  const agentRows = agents.map((a) => ({
    cells: [
      `<span class="tac-agent">${agentIcon(a.key, 18)} ${esc(a.key)}</span>`,
      String(a.line.games),
      `<span class="${wrClass(a.line.winRate)}">${fmtPct(a.line.winRate)}</span>`,
      fmtKd(a.line.kd),
      fmtPct(a.line.hsPct),
    ],
  }));

  const mapHeaders = ["Mapa", "PJ", "WR", "K/D", "Agente top"];
  const mapRows = maps.map((m) => ({
    cells: [
      esc(m.key),
      String(m.line.games),
      `<span class="${wrClass(m.line.winRate)}">${fmtPct(m.line.winRate)}</span>`,
      fmtKd(m.line.kd),
      m.topAgent ? `<span class="tac-agent">${esc(m.topAgent)}</span>` : dash,
    ],
  }));

  return `
    ${renderKpiStrip(kpis)}
    ${renderCallouts(tips)}
    ${renderGoals(ds, p, f)}
    ${sectionHeader("Agentes", agents.length, "agentes")}
    ${renderScoreboard(agentHeaders, agentRows, { numCols: [1, 2, 3, 4], sortableCols: [0, 1, 2, 3, 4] })}
    ${sectionHeader("Mapas", maps.length, "mapas")}
    ${renderScoreboard(mapHeaders, mapRows, { numCols: [1, 2, 3], sortableCols: [0, 1, 2, 3, 4] })}
    ${sectionHeader("Evolución del rango")}
    ${renderEloTimeline(rankSeries(ds, p.puuid, f))}
    ${sectionHeader("Tus ultimas partidas")}
    ${renderLastMatches(ms)}
  `;
}

/** Last Matches - match cards similar to in-game match history */
const MATCH_PAGE = 35;
const MODE_LABELS: Record<Mode, string> = {
  competitive: "Ranked",
  premier: "Premier",
  custom: "Scrim/Torneo",
};

/** Last Matches - match cards similar to in-game match history */
function renderLastMatches(ms: PlayerMatch[]): string {
  const options = (values: string[], all: string, label: (v: string) => string = (v) => v) =>
    `<option value="">${all} (${values.length})</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join("");
  const sorted = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, "es"));
  const agents = sorted(ms.map((m) => m.agent));
  const maps = sorted(ms.map((m) => m.map));
  const modes = sorted(ms.map((m) => m.mode));

  return `
    <section class="tac-match-section" data-history>
      <div class="tac-match-filters" role="group" aria-label="Filtros de historial de partidos">
        <select class="tac-match-filter" data-history-filter="agent" aria-label="Filtrar por agente">${options(agents, "Todos los agentes")}</select>
        <select class="tac-match-filter" data-history-filter="map" aria-label="Filtrar por mapa">${options(maps, "Todos los mapas")}</select>
        <select class="tac-match-filter" data-history-filter="mode" aria-label="Filtrar por modo"${modes.length < 2 ? " disabled" : ""}>${options(modes, "Todos los modos", (v) => MODE_LABELS[v as Mode] ?? v)}</select>
      </div>
      <div data-history-body>${renderHistoryBody(ms, MATCH_PAGE)}</div>
    </section>
  `;
}

function renderHistoryBody(ms: PlayerMatch[], shown: number): string {
  if (ms.length === 0) {
    return `<div class="tac-empty" style="padding:24px 0;"><p class="tac-empty__desc">Ninguna partida coincide con los filtros.</p></div>`;
  }
  const wins = ms.filter((m) => m.won === true).length;
  const losses = ms.filter((m) => m.won === false).length;
  const draws = ms.filter((m) => m.won === null).length;
  const kd = ms.reduce((a, m) => a + m.kills, 0) / Math.max(ms.reduce((a, m) => a + m.deaths, 0), 1);
  const hsPct = (ms.reduce((a, m) => a + m.headshots, 0) / Math.max(ms.reduce((a, m) => a + m.bodyshots + m.headshots + m.legshots, 0), 1)) * 100;
  const totalRounds = ms.reduce((a, m) => a + m.roundsWon + m.roundsLost, 0);
  const dmgPerRound = totalRounds > 0 ? ms.reduce((a, m) => a + m.damageMade, 0) / totalRounds : null;
  const kda = ms.reduce((a, m) => a + m.kills + m.assists, 0) / Math.max(ms.reduce((a, m) => a + m.deaths, 0), 1);

  const statCards: Array<{ label: string; value: string; trend?: "up" | "down" | "neutral" }> = [
    { label: "Partidas", value: String(ms.length) },
    { label: "Victorias", value: String(wins), trend: wins > losses ? "up" : wins < losses ? "down" : "neutral" },
    { label: "Derrotas", value: String(losses) },
    { label: "Empates", value: String(draws) },
    { label: "K/D", value: fmtKd(kd) },
    { label: "HS%", value: fmtPct(hsPct) },
    { label: "Daño/R", value: fmtNum(dmgPerRound) },
    { label: "KDA", value: fmtKd(kda) },
  ];

  const matchCards = ms
    .slice(0, shown)
    .map((m) => {
      const agentIconHtml = agentIcon(m.agent, 24);
      const totalHsBodyLegs = m.headshots + m.bodyshots + m.legshots;
      const matchHsPct = totalHsBodyLegs > 0 ? (m.headshots / totalHsBodyLegs) * 100 : 0;
      const matchKda = (m.kills + m.assists) / Math.max(m.deaths, 1);
      const matchRounds = m.roundsWon + m.roundsLost;
      const matchAcs = matchRounds > 0 ? Math.round(m.score / matchRounds) : 0;
      const wonClass = m.won === true ? "won" : m.won === false ? "lost" : "neutral";
      const resultText = m.won === true ? "Victoria" : m.won === false ? "Derrota" : "Empate";
      const resultClass = m.won === true ? "won" : m.won === false ? "lost" : "";
      const modeLabels = MODE_LABELS;

      return `
        <article class="tac-match-card tac-match-card--${wonClass}" role="listitem" aria-label="${esc(m.map)} - ${resultText}" data-match-id="${esc(m.matchId)}" data-puuid="${esc(m.puuid)}" tabindex="0">
          <div class="tac-match-card__header">
            <span class="tac-match-card__map">${esc(m.map)}</span>
            <span class="tac-match-card__result tac-match-card__result--${resultClass}">${esc(resultText)}</span>
          </div>
          <div class="tac-match-card__score">${m.roundsWon}:${m.roundsLost}</div>
          <div class="tac-match-card__mode">${esc(modeLabels[m.mode])}</div>
          <div class="tac-match-card__agent">${agentIconHtml} ${esc(m.agent)}</div>
          <div class="tac-match-card__stats">
            <div class="tac-match-card__stat">
              <span class="tac-match-card__stat-label">K/D</span>
              <span class="tac-match-card__stat-value">${fmtKd(m.kills / Math.max(m.deaths, 1))}</span>
            </div>
            <div class="tac-match-card__stat">
              <span class="tac-match-card__stat-label">HS%</span>
              <span class="tac-match-card__stat-value">${fmtPct(matchHsPct)}</span>
            </div>
            <div class="tac-match-card__stat">
              <span class="tac-match-card__stat-label">ACS</span>
              <span class="tac-match-card__stat-value">${matchAcs}</span>
            </div>
            <div class="tac-match-card__stat">
              <span class="tac-match-card__stat-label">KDA</span>
              <span class="tac-match-card__stat-value">${fmtKd(matchKda)}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  const remaining = ms.length - shown;
  return `
    <div class="tac-kpi-strip" role="list" aria-label="Resumen de partidos">
      ${statCards
        .map(
          (k) => `
        <div class="tac-kpi tac-kpi--${k.trend ? `tac-kpi__trend--${k.trend}` : "radiant"}" role="listitem">
          <div class="tac-kpi__label">${esc(k.label)}</div>
          <div class="tac-kpi__value">${esc(k.value)}</div>
        </div>
      `
        )
        .join("")}
    </div>

    <div class="tac-match-cards" role="list" aria-label="Historial de partidos">
      ${matchCards}
    </div>
    ${remaining > 0 ? `<button type="button" class="tac-match-more" data-history-more>Ver ${Math.min(remaining, MATCH_PAGE)} más <span class="tac-match-filter__count">${remaining} restantes</span></button>` : ""}
  `;
}

/** Match Detail Modal - detailed view for a single match (base info + async team data) */
function renderMatchDetail(m: PlayerMatch, ds: Dataset): string {
  const modeLabels: Record<Mode, string> = {
    competitive: "Ranked",
    premier: "Premier",
    custom: "Scrim/Torneo",
  };
  const totalHsBodyLegs = m.headshots + m.bodyshots + m.legshots;
  const matchHsPct = totalHsBodyLegs > 0 ? (m.headshots / totalHsBodyLegs) * 100 : 0;
  const matchKda = (m.kills + m.assists) / Math.max(m.deaths, 1);
  const matchRounds = m.roundsWon + m.roundsLost;
  const matchAcs = matchRounds > 0 ? Math.round(m.score / matchRounds) : 0;
  const wonClass = m.won === true ? "won" : m.won === false ? "lost" : "neutral";
  const resultText = m.won === true ? "Victoria" : m.won === false ? "Derrota" : "Empate";
  const resultClass = m.won === true ? "won" : m.won === false ? "lost" : "";
  const dateStr = new Date(m.startedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });

  // Base rounds (fallback) - will be replaced with ATK/DEF roles when team data loads
  const roundsWonHtml = Array.from({ length: m.roundsWon }, () => `<span class="tac-match-detail__round tac-match-detail__round--win" aria-hidden="true"></span>`).join("");
  const roundsLostHtml = Array.from({ length: m.roundsLost }, () => `<span class="tac-match-detail__round tac-match-detail__round--loss" aria-hidden="true"></span>`).join("");
  const baseRoundsHtml = roundsWonHtml + roundsLostHtml;

  return `
    <section class="tac-match-detail">
      <div class="tac-match-detail__header">
        <div>
          <span class="tac-match-detail__map">${esc(m.map)}</span>
          <span class="tac-match-detail__result tac-match-detail__result--${resultClass}">${esc(resultText)}</span>
        </div>
        <div class="tac-match-detail__score">${m.roundsWon}:${m.roundsLost}</div>
        <div class="tac-match-detail__mode">${esc(modeLabels[m.mode])}</div>
        <div class="tac-match-detail__agent">${agentIcon(m.agent, 32)} ${esc(m.agent)}</div>
      </div>

      <div class="tac-match-detail__meta">
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Rival</span>
          <span class="tac-match-detail__stat-value" data-opponent>Cargando…</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Fecha</span>
          <span class="tac-match-detail__stat-value">${dateStr}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Lado inicial</span>
          <span class="tac-match-detail__stat-value">${m.side === "Red" ? "ATK" : "DEF"}</span>
        </div>
      </div>

      <div class="tac-match-detail__stats">
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">K/D</span>
          <span class="tac-match-detail__stat-value">${fmtKd(m.kills / Math.max(m.deaths, 1))}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">HS%</span>
          <span class="tac-match-detail__stat-value">${fmtPct(matchHsPct)}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">ACS</span>
          <span class="tac-match-detail__stat-value">${matchAcs}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">KDA</span>
          <span class="tac-match-detail__stat-value">${fmtKd(matchKda)}</span>
        </div>
      </div>
      <div class="tac-match-detail__stats">
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Daño</span>
          <span class="tac-match-detail__stat-value">${fmtNum(m.damageMade)}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Daño/R</span>
          <span class="tac-match-detail__stat-value">${matchRounds > 0 ? Math.round(m.damageMade / matchRounds) : 0}</span>
        </div>
        <div class="tac-match-detail__stat">
          <span class="tac-match-detail__stat-label">Daño recibido</span>
          <span class="tac-match-detail__stat-value">${fmtNum(m.damageReceived)}</span>
        </div>
      </div>

      <div class="tac-match-detail__section">
        <div class="tac-match-detail__section-title">Rondas</div>
        <div class="tac-match-detail__rounds">${baseRoundsHtml}</div>
      </div>

      <div class="tac-match-detail__section" id="tac-our-lineup" hidden>
        <div class="tac-match-detail__section-title">Nuestro equipo</div>
        <div class="tac-match-detail__lineup" id="tac-our-lineup-inner">Cargando equipo aliado…</div>
      </div>

      <div class="tac-match-detail__section" id="tac-opp-lineup" hidden>
        <div class="tac-match-detail__section-title">Equipo rival</div>
        <div class="tac-match-detail__lineup" id="tac-opp-lineup-inner">Cargando equipo enemigo…</div>
      </div>

    </section>
  `;
}

const IDLE_WARN_DAYS = 7;
const IDLE_ALERT_DAYS = 14;
const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Celda "Última ranked": tiempo sin jugar ranked y, debajo, fecha y hora locales. */
function renderLastPlayed(iso: string | null, now: Date): string {
  if (!iso) return `<span class="tac-idle tac-idle--none">Sin ranked</span>`;
  const { label, days } = timeSince(iso, now);
  const level = days >= IDLE_ALERT_DAYS ? "alert" : days >= IDLE_WARN_DAYS ? "warn" : "ok";
  const when = fmtDateTime(iso);
  return `<span class="tac-idle tac-idle--${level}" title="${esc(when)}">
      <span class="tac-idle__ago">${esc(label)}</span>
      <time class="tac-idle__when" datetime="${esc(iso)}">${esc(when)}</time>
    </span>`;
}

function renderRanking(ds: Dataset, f: Filter, sort: { key: LeaderKey; dir: "asc" | "desc" }): string {
  const base = leaderboard(ds, f);
  const lead = leaders(base);
  const rows = sortLeaderboard(base, sort.key, sort.dir);

  const rankHeaders = ["Jugador", "Rango", "PJ", "WR", "K/D", "HS%", "Daño/R", "KDA", "Última ranked"];
  const rankSortKeys: Record<number, LeaderKey> = { 1: "rank", 2: "games", 3: "winRate", 4: "kd", 5: "hsPct", 6: "dmgPerRound", 7: "kda", 8: "lastPlayed" };
  const now = new Date();
  const rankRows = rows.map((r) => {
    const rankStr = r.tierName ? `${esc(r.tierName)} · ${esc(String(r.rr ?? 0))} RR` : dash;
    const isLeader = (key: keyof typeof lead) => lead[key].includes(r.puuid);
    return {
      cells: [
        `<a class="tac-player" href="#${slug({ name: r.name, tag: "", puuid: r.puuid })}">${esc(r.name)}</a>`,
        `<span class="tac-nowrap${isLeader("rank") ? " tac-leader" : ""}">${isLeader("rank") ? esc(rankStr) : rankStr}</span>`,
        isLeader("games") ? `<span class="tac-leader">${esc(String(r.line.games))}</span>` : String(r.line.games),
        isLeader("winRate") ? `<span class="tac-leader ${wrClass(r.line.winRate)}">${esc(fmtPct(r.line.winRate))}</span>` : `<span class="${wrClass(r.line.winRate)}">${esc(fmtPct(r.line.winRate))}</span>`,
        isLeader("kd") ? `<span class="tac-leader">${esc(fmtKd(r.line.kd))}</span>` : fmtKd(r.line.kd),
        isLeader("hsPct") ? `<span class="tac-leader">${esc(fmtPct(r.line.hsPct))}</span>` : fmtPct(r.line.hsPct),
        isLeader("dmgPerRound") ? `<span class="tac-leader">${esc(fmtNum(r.line.dmgPerRound))}</span>` : fmtNum(r.line.dmgPerRound),
        isLeader("kda") ? `<span class="tac-leader">${esc(fmtKd(r.kda))}</span>` : fmtKd(r.kda),
        renderLastPlayed(r.lastPlayedAt, now),
      ],
    };
  });

  return `
    <p class="tac-canvas__subtitle" style="margin-bottom:16px;">Click en encabezado para ordenar. <span class="tac-leader" style="background:var(--tac-radiant);color:#fff;padding:0 6px;border-radius:3px;font-size:0.625rem;">Líder</span> = mejor valor de la columna.</p>
    ${renderScoreboard(rankHeaders, rankRows, { numCols: [2, 3, 4, 5, 6, 7], sortableCols: [1, 2, 3, 4, 5, 6, 7, 8], sortKeys: rankSortKeys, sorted: sort })}
    <p class="tac-canvas__subtitle" style="margin-top:12px;">"Última ranked" es la partida competitiva más reciente de cada jugador, sin importar el filtro. Se actualiza con cada recolección de datos.</p>
  `;
}

/* ==========================================================================
   LIVE PANEL CONTENT
   ========================================================================== */

function renderLiveTeam(ds: Dataset, f: Filter): string {
  const tms = teamMatchesFor(ds, f);
  const last = ds.snapshots[ds.snapshots.length - 1];
  const pr = last?.premier;

  if (!tms.length) {
    return `
      <div class="tac-live-card">
        <div class="tac-live-card__header"><span class="tac-live-card__title">Última partida</span></div>
        <div class="tac-live-next">
          <div class="tac-empty" style="padding:16px 0;"><p class="tac-empty__desc">Sin partidas en filtro actual</p></div>
        </div>
      </div>
    `;
  }

  const nextMatch = tms[0];
  const side = nextMatch.side === "Red" ? "ATK" : "DEF";
  const sideColor = nextMatch.side === "Red" ? "var(--tac-radiant)" : "var(--tac-dire)";

  return `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Última partida</span></div>
      <div class="tac-live-next">
        <div class="tac-live-next__item">
          <span class="tac-live-next__label">Mapa</span>
          <span class="tac-live-next__value">${esc(nextMatch.map)}</span>
        </div>
        <div class="tac-live-next__item">
          <span class="tac-live-next__label">Lado inicial</span>
          <span class="tac-live-next__value" style="color:${sideColor};">${side}</span>
        </div>
        <div class="tac-live-next__item">
          <span class="tac-live-next__label">Rival</span>
          <span class="tac-live-next__value">${esc(nextMatch.opponentName || nextMatch.opponentPlayers[0] || "Desconocido")}</span>
        </div>
        <div class="tac-live-next__item">
          <span class="tac-live-next__label">Tipo</span>
          <span class="tac-live-next__value"><span class="tac-badge tac-badge--${nextMatch.kind === "premier" ? "premier" : "custom"}">${esc(nextMatch.kind === "premier" ? "Premier" : "Scrim/Torneo")}</span></span>
        </div>
      </div>
    </div>

    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Economía del filtro</span></div>
      <div class="tac-live-econ">
        <div class="tac-live-econ__item tac-live-econ__item--won">
          <div class="tac-live-econ__label">Ganadas</div>
          <div class="tac-live-econ__value">${tms.filter((t) => t.won === true).length}</div>
        </div>
        <div class="tac-live-econ__item tac-live-econ__item--lost">
          <div class="tac-live-econ__label">Perdidas</div>
          <div class="tac-live-econ__value">${tms.filter((t) => t.won === false).length}</div>
        </div>
        <div class="tac-live-econ__item tac-live-econ__item--spike">
          <div class="tac-live-econ__label">Empates</div>
          <div class="tac-live-econ__value">${tms.filter((t) => t.won === null).length}</div>
        </div>
      </div>
    </div>

    ${pr ? `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Premier Status</span></div>
      <div class="tac-live-econ">
        <div class="tac-live-econ__item">
          <div class="tac-live-econ__label">División</div>
          <div class="tac-live-econ__value">${pr.division}</div>
        </div>
        <div class="tac-live-econ__item">
          <div class="tac-live-econ__label">Puesto</div>
          <div class="tac-live-econ__value">#${pr.place}</div>
        </div>
        <div class="tac-live-econ__item">
          <div class="tac-live-econ__label">Puntos</div>
          <div class="tac-live-econ__value">${pr.points}</div>
        </div>
      </div>
    </div>
    ` : ""}
  `;
}

function renderLivePlayer(ds: Dataset, p: RosterPlayer, f: Filter): string {
  const ms = playerMatchesFor(ds, p.puuid, f);
  const l = line(ms);
  const last = ds.snapshots[ds.snapshots.length - 1]?.players[p.puuid];
  const tips = highlights(ms);

  const recentForm = ms.slice(0, 5).map((m) => (m.won === true ? "W" : m.won === false ? "L" : "D")).join("");

  return `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Forma reciente</span></div>
      <div style="display:flex;gap:8px;justify-content:center;font-family:var(--tac-font-mono);font-size:1.25rem;font-weight:700;letter-spacing:4px;">
        ${recentForm.split("").map((c) => `<span style="color:${c === "W" ? "var(--tac-clutch)" : c === "L" ? "var(--tac-threat)" : "var(--tac-spike)"}">${c}</span>`).join("")}
      </div>
      <p style="text-align:center;margin-top:8px;font-size:0.75rem;color:var(--tac-text-muted);">${ms.length} partidas en filtro</p>
    </div>

    ${last ? `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Rango actual</span></div>
      <div style="text-align:center;">
        <div style="font-family:var(--tac-font-display);font-weight:700;font-size:1.5rem;color:var(--tac-radiant);">${esc(last.tierName)}</div>
        <div style="font-family:var(--tac-font-mono);font-size:1rem;color:var(--tac-text-dim);">${last.rr} RR · ${last.elo} ELO</div>
      </div>
    </div>
    ` : ""}

    ${tips.length ? `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Insights</span></div>
      <ul style="display:flex;flex-direction:column;gap:8px;">
        ${tips.map((t) => `<li style="font-size:0.8125rem;line-height:1.5;color:var(--tac-text);">${esc(t)}</li>`).join("")}
      </ul>
    </div>
    ` : ""}
  `;
}

function renderLiveRanking(ds: Dataset, f: Filter): string {
  const base = leaderboard(ds, f);
  const lead = leaders(base);

  return `
    <div class="tac-live-card">
      <div class="tac-live-card__header"><span class="tac-live-card__title">Líderes del equipo</span></div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${Object.entries(lead)
          .filter(([, v]) => v.length > 0)
          .slice(0, 5)
          .map(([key, puuids]) => {
            const labels: Record<Exclude<LeaderKey, "lastPlayed">, string> = {
              rank: "Rango",
              games: "Partidas",
              winRate: "Win%",
              kd: "K/D",
              hsPct: "HS%",
              dmgPerRound: "Daño/R",
              kda: "KDA",
            };
            const players = ds.roster.players.filter((p) => puuids.includes(p.puuid));
            return `
              <div style="padding:12px;background:var(--tac-bg-elevated);border-radius:var(--tac-r-sm);border:1px solid var(--tac-stroke);">
                <div style="font-family:var(--tac-font-mono);font-size:0.5625rem;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--tac-radiant);margin-bottom:4px;">${labels[key as keyof typeof labels]}</div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;">
                  ${players.map((p) => `<span class="tac-badge tac-badge--premier" style="font-size:0.625rem;">${esc(p.name)}</span>`).join("")}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   MAIN APPLICATION
   ========================================================================== */

/* ==========================================================================
   TORNEOS (campana del header)
   ========================================================================== */
const SEEN_KEY = "tlh-valorant-torneos-vistos";
const SOON_HOURS = 72;

function loadSeen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
function saveSeen(keys: Iterable<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...keys]));
  } catch {
    /* sin almacenamiento: la campana sigue funcionando, solo no recuerda lo visto */
  }
}

const fmtColombia = (s: string) => {
  const d = colombiaToDate(s);
  const date = d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "numeric", month: "short" });
  // Las fechas sin hora se guardan como 00:00: en ese caso no se muestra hora.
  if (s.endsWith(" 00:00")) return date;
  return `${date} · ${d.toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit" })}`;
};

function renderTourney(t: Tournament, isNew: boolean, now: Date): string {
  const closeIso = t.cierre_inscripcion ?? t.fecha_hora_colombia;
  const hoursLeft = closeIso ? (colombiaToDate(closeIso).getTime() - now.getTime()) / 3_600_000 : Infinity;
  const tags = [
    isNew ? `<span class="tac-tourney__tag tac-tourney__tag--new">Nuevo</span>` : "",
    t.formato ? `<span class="tac-tourney__tag${t.formato === "5v5" ? " tac-tourney__tag--main" : ""}">${esc(t.formato)}</span>` : "",
    t.region ? `<span class="tac-tourney__tag">${esc(t.region)}</span>` : "",
    hoursLeft < SOON_HOURS
      ? `<span class="tac-tourney__tag tac-tourney__tag--soon">${hoursLeft < 24 ? "Cierra hoy" : `Cierra en ${Math.ceil(hoursLeft / 24)} días`}</span>`
      : "",
  ].join("");
  const facts: Array<[string, string | null]> = [
    ["Inicio", t.fecha_hora_colombia && fmtColombia(t.fecha_hora_colombia)],
    ["Cierre", t.cierre_inscripcion && fmtColombia(t.cierre_inscripcion)],
    ["Costo", t.costo],
    ["Premio", t.premio],
    ["Cupos", t.cupos],
    ["Requisitos", t.requisitos],
  ];
  const org = [t.organizador, t.fuente && t.fuente !== t.organizador ? `vía ${t.fuente}` : null].filter(Boolean).join(" · ");
  return `
    <article class="tac-tourney${isNew ? " is-new" : ""}">
      <div class="tac-tourney__tags">${tags}</div>
      <div class="tac-tourney__name">${esc(t.nombre)}</div>
      ${org ? `<div class="tac-tourney__org">${esc(org)}</div>` : ""}
      <dl class="tac-tourney__facts">
        ${facts.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v!)}</dd>`).join("")}
      </dl>
      ${t.alerta ? `<p class="tac-tourney__alert"><span aria-hidden="true">⚠</span><span>${esc(t.alerta)}</span></p>` : ""}
      <a class="tac-tourney__cta" href="${esc(t.link_inscripcion)}" target="_blank" rel="noopener noreferrer">
        Inscribirse
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M7 17L17 7M8 7h9v9"/></svg>
      </a>
    </article>`;
}

function setupTournaments(raw: unknown) {
  const btn = document.getElementById("tac-notify-btn");
  const panel = document.getElementById("tac-notify-panel");
  const badge = document.getElementById("tac-notify-badge");
  const list = document.getElementById("tac-notify-list");
  const meta = document.getElementById("tac-notify-meta");
  const foot = document.getElementById("tac-notify-foot");
  if (!btn || !panel || !badge || !list || !meta || !foot) return;

  // Se re-valida en el cliente: descarta enlaces que no sean http(s) aunque el archivo venga alterado.
  let report: TournamentReport | null = null;
  try {
    report = raw ? parseReport(raw) : null;
  } catch {
    report = null;
  }
  const now = new Date();
  const items = upcoming(report, now);
  // 5v5 primero; dentro de cada grupo se respeta el orden por fecha.
  items.sort((a, b) => Number(b.formato === "5v5") - Number(a.formato === "5v5"));
  const seen = loadSeen();
  let newKeys = new Set(items.map(tournamentKey).filter((k) => !seen.has(k)));

  const updateBadge = () => {
    badge.hidden = newKeys.size === 0;
    badge.textContent = newKeys.size > 9 ? "9+" : String(newKeys.size);
    btn.classList.toggle("has-new", newKeys.size > 0);
    btn.setAttribute("aria-label", newKeys.size ? `Próximos torneos (${newKeys.size} nuevos)` : "Próximos torneos");
  };

  const render = () => {
    meta.textContent = items.length ? `${items.length} abiertos` : "";
    list.innerHTML = !report
      ? `<p class="tac-notify__empty">Todavía no hay búsqueda de torneos.<br>La búsqueda automática corre los lunes y jueves.</p>`
      : items.length
        ? items.map((t) => renderTourney(t, newKeys.has(tournamentKey(t)), now)).join("")
        : `<p class="tac-notify__empty">No hay torneos con inscripción abierta por ahora.</p>`;
    foot.innerHTML = report
      ? `<div><strong>Próximo qualifier de Riot:</strong> ${esc(report.riot_proximo_qualifier ?? "sin anunciar")}</div>
         <div>Búsqueda del ${esc(report.generadoEn ? fmtDateTime(report.generadoEn) : report.actualizado)}. Verifica los datos antes de inscribirte.</div>
         ${report.notas ? `<details><summary>Notas de la búsqueda</summary>${esc(report.notas)}</details>` : ""}`
      : "";
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
    if (open) {
      render(); // muestra "Nuevo" en lo que no se había visto…
      saveSeen([...seen, ...newKeys]); // …y desde ya cuenta como visto.
      for (const k of newKeys) seen.add(k);
      newKeys = new Set();
      updateBadge();
    }
  };

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!panel.hidden && !panel.contains(e.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      setOpen(false);
      btn.focus();
    }
  });

  updateBadge();
}

async function main() {
  const updatedEl = document.getElementById("tac-updated")!;
  const tabsEl = document.getElementById("tac-tabs")!;
  const filtersEl = document.getElementById("tac-filters")!;
  const canvasTitle = document.getElementById("tac-view-title")!;
  const canvasSubtitle = document.getElementById("tac-view-subtitle")!;
  const contentEl = document.getElementById("tac-content")!;
  const liveEl = document.getElementById("tac-live")!;
  const liveContentEl = document.getElementById("tac-live-content")!;
  const intelEl = document.getElementById("tac-intel")!;
  const mainEl = document.getElementById("tac-main")!;

  // Mobile overlay for live panel
  let overlay = document.querySelector(".tac-live-overlay") as HTMLElement;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "tac-live-overlay";
    document.body.appendChild(overlay);
  }

  // Match detail modal
  let modalEl = document.querySelector(".tac-modal-overlay") as HTMLElement;
  if (!modalEl) {
    modalEl = document.createElement("div");
    modalEl.className = "tac-modal-overlay";
    modalEl.innerHTML = `
      <div class="tac-modal" role="dialog" aria-modal="true" aria-label="Detalles del partido">
        <div class="tac-modal__header">
          <div>
            <span class="tac-modal__title">Detalles del partido</span>
            <span class="tac-modal__subtitle" id="tac-modal-map"></span>
          </div>
          <button type="button" class="tac-modal__close" aria-label="Cerrar">&times;</button>
        </div>
        <div class="tac-modal__body" id="tac-modal-body"></div>
      </div>
    `;
    document.body.appendChild(modalEl);
  }

  const modalCloseBtn = modalEl.querySelector(".tac-modal__close")!;
  const modalBody = document.getElementById("tac-modal-body")!;

  function openModal(match: PlayerMatch) {
    // Render base match info immediately, team data loads async
    modalBody.innerHTML = renderMatchDetail(match, ds);
    modalEl.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    // Los datos de equipo (alineaciones, rondas) ya vienen en el dataset; solo existen para partidas de equipo.
    const teamMatch = ds.teamMatches.find((t) => t.matchId === match.matchId);
    if (teamMatch) populateMatchTeamData(teamMatch);
    else {
      const opponentStat = document.querySelector('.tac-match-detail__stat-value[data-opponent]');
      if (opponentStat) opponentStat.textContent = dash;
    }
  }

  function populateMatchTeamData(teamMatch: TeamMatch) {
    if (teamMatch.lineup.length === 0) return;

    const ourLineup = teamMatch.lineup;
    const opponentLineup = teamMatch.opponentLineup;

    // Update rounds with ATK/DEF roles
    const roundsContainer = document.querySelector('.tac-match-detail__rounds');
    if (roundsContainer && teamMatch.rounds.length > 0) {
      // Remove any existing legend first
      const existingLegend = roundsContainer.parentElement?.querySelector('.tac-match-detail__rounds-legend');
      existingLegend?.remove();

      // Rondas con separador en cada cambio de lado
      const roundsHtml = teamMatch.rounds
        .map((r: TeamRound, i: number) => {
          const roleLabel = r.role === 'Attack' ? 'ATK' : 'DEF';
          const roleClass = r.role === 'Attack' ? 'tac-round--atk' : 'tac-round--def';
          // Separador donde cambia el rol (medio tiempo y cada ronda de la prórroga).
          const next = teamMatch.rounds[i + 1];
          const isSideSwitch = next && next.role !== r.role ? ' tac-round--side-switch' : '';
          return `<span class="tac-match-detail__round tac-match-detail__round--${r.won ? 'win' : 'loss'} ${roleClass}${isSideSwitch}" aria-label="Ronda ${i + 1}: ${roleLabel} ${r.won ? 'Ganada' : 'Perdida'}" title="Ronda ${i + 1}: ${roleLabel} ${r.won ? 'Ganada' : 'Perdida'}"></span>`;
        })
        .join('');
      roundsContainer.innerHTML = roundsHtml;

      // Dynamic legend based on starting side (first 12 rounds = starting side)
      const startingSide = teamMatch.rounds[0].role;
      const firstHalfRole = startingSide === 'Attack' ? 'ATK' : 'DEF';
      const secondHalfRole = startingSide === 'Attack' ? 'DEF' : 'ATK';

      const legend = document.createElement('div');
      legend.className = 'tac-match-detail__rounds-legend';
      legend.innerHTML = `
        <div class="tac-match-detail__legend-half">
          <span class="tac-match-detail__legend-half-title">Primer half (${firstHalfRole})</span>
          <span class="tac-match-detail__legend-item"><span class="tac-match-detail__round tac-match-detail__round--win tac-round--${firstHalfRole.toLowerCase()}" aria-hidden="true"></span> ${firstHalfRole} Ganada</span>
          <span class="tac-match-detail__legend-item"><span class="tac-match-detail__round tac-match-detail__round--loss tac-round--${firstHalfRole.toLowerCase()}" aria-hidden="true"></span> ${firstHalfRole} Perdida</span>
        </div>
        <div class="tac-match-detail__legend-half">
          <span class="tac-match-detail__legend-half-title">Segundo half (${secondHalfRole})</span>
          <span class="tac-match-detail__legend-item"><span class="tac-match-detail__round tac-match-detail__round--win tac-round--${secondHalfRole.toLowerCase()}" aria-hidden="true"></span> ${secondHalfRole} Ganada</span>
          <span class="tac-match-detail__legend-item"><span class="tac-match-detail__round tac-match-detail__round--loss tac-round--${secondHalfRole.toLowerCase()}" aria-hidden="true"></span> ${secondHalfRole} Perdida</span>
        </div>
      `;
      roundsContainer.parentElement?.appendChild(legend);
    }

    // Opponent name
    const opponentStat = document.querySelector('.tac-match-detail__stat-value[data-opponent]');
    if (opponentStat) {
      opponentStat.textContent = teamMatch.opponentName ?? dash;
    }

    // Alineaciones: la nuestra siempre trae agente y K/D/A; la rival solo si el recolector guardó opponentLineup.
    const playerChip = (p: LineupEntry, sub: boolean) => `
      <div class="tac-match-detail__player">
        <span class="tac-match-detail__player-agent">${agentIcon(p.agent, 24)}</span>
        <span class="tac-match-detail__player-name">${esc(p.riotId)}</span>
        <span class="tac-match-detail__player-kda" title="Kills / Muertes / Asistencias">${p.kills}/${p.deaths}/${p.assists}</span>
        ${sub ? '<span class="tac-badge tac-badge--sub">Suplente</span>' : ''}
      </div>`;
    const nameChip = (riotId: string) => `
      <div class="tac-match-detail__player">
        <span class="tac-match-detail__player-name">${esc(riotId)}</span>
      </div>`;

    const ourLineupContainer = document.getElementById('tac-our-lineup-inner');
    if (ourLineupContainer && ourLineup.length > 0) {
      ourLineupContainer.innerHTML = ourLineup.map((p) => playerChip(p, !p.inRoster)).join('');
      document.getElementById('tac-our-lineup')!.hidden = false;
    }

    const oppLineupContainer = document.getElementById('tac-opp-lineup-inner');
    if (oppLineupContainer && (opponentLineup?.length || teamMatch.opponentPlayers.length)) {
      oppLineupContainer.innerHTML = opponentLineup?.length
        ? opponentLineup.map((p) => playerChip(p, false)).join('')
        : teamMatch.opponentPlayers.map(nameChip).join('');
      document.getElementById('tac-opp-lineup')!.hidden = false;
    }
  }

  function closeModal() {
    modalEl.removeAttribute("open");
    document.body.style.overflow = "";
    modalBody.innerHTML = "";
  }

  modalCloseBtn.addEventListener("click", closeModal);
  modalEl.addEventListener("click", (e) => {
    if (e.target === modalEl) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.hasAttribute("open")) closeModal();
  });

  let ds: Dataset;
  try {
    const res = await fetch("/valorant-data.json", { cache: "no-cache" });
    ds = (await res.json()) as Dataset;
  } catch {
    updatedEl.textContent = "No se pudieron cargar los datos.";
    contentEl.innerHTML = `<div class="tac-empty"><svg class="tac-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg><p class="tac-empty__title">Error de carga</p><p class="tac-empty__desc">No se pudo obtener el dataset. Intenta recargar la página.</p></div>`;
    return;
  }

  updatedEl.textContent = ds.meta.updatedAt
    ? `Actualizado: ${new Date(ds.meta.updatedAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}`
    : "Aún no hay datos";

  setupTournaments(ds.tournaments);

  type Kind = "team" | "ranking" | "player";
  const filters: Record<Kind, Filter> = {
    team: { modes: ["premier", "custom"], period: "act" },
    ranking: { modes: ["competitive"], period: "act" },
    player: { modes: ["competitive"], period: "act" },
  };
  const rankSort: { key: LeaderKey; dir: "asc" | "desc" } = { key: "rank", dir: "desc" };

  const TEAM = "equipo";
  const RANKING = "ranking";
  const kindOf = (tab: string): Kind => (tab === TEAM ? "team" : tab === RANKING ? "ranking" : "player");

  const tabs: Array<{ id: string; label: string; icon?: string; avatar?: string }> = [
    { id: TEAM, label: "Equipo", icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>` },
    { id: RANKING, label: "Ranking", icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M19 9l-7 7-7-7"/></svg>` },
    ...ds.roster.players.map((p) => ({
      id: slug(p),
      label: p.name,
      avatar: initials(p.name, p.tag),
    })),
  ];

  function currentTab(): string {
    const h = decodeURIComponent(location.hash.slice(1));
    return tabs.some((t) => t.id === h) ? h : TEAM;
  }

  function renderTabs() {
    tabsEl.innerHTML = tabs
      .map(
        (t) => `
      <button type="button" class="tac-tab" role="tab" data-tab="${esc(t.id)}" aria-selected="false">
        ${t.icon ? `<span class="tac-tab__icon">${t.icon}</span>` : ""}
        ${t.avatar ? `<span class="tac-tab__avatar">${esc(t.avatar)}</span>` : ""}
        <span>${esc(t.label)}</span>
      </button>
    `
      )
      .join("");
  }

  function updateFilterBadges() {
    const f = filters[kindOf(currentTab())];
    document.querySelectorAll<HTMLInputElement>('.tac-segment input[name="mode"]').forEach((input) => {
      const badge = input.parentElement?.querySelector(".tac-segment__badge");
      if (badge) {
        const count = ds.playerMatches.filter((m) => m.mode === input.value && f.modes.includes(m.mode as Mode)).length;
        badge.textContent = count > 0 ? String(count) : "";
      }
    });
  }

  function render() {
    const tab = currentTab();
    const kind = kindOf(tab);
    const f = filters[kind];

    // Update tabs
    tabsEl.querySelectorAll<HTMLButtonElement>(".tac-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));

    // Update filter controls
    filtersEl.querySelectorAll<HTMLInputElement>('.tac-segment input[name="mode"]').forEach((input) => {
      input.checked = f.modes.includes(input.value as Mode);
      input.disabled = kind === "team" && input.value === "competitive";
      input.parentElement!.classList.toggle("disabled", input.disabled);
    });
    filtersEl.querySelectorAll<HTMLInputElement>('.tac-toggle input[name="period"]').forEach((input) => {
      input.checked = input.value === f.period;
    });

    updateFilterBadges();

    // Update live panel visibility
    const showLive = kind !== "ranking" || ds.roster.players.length > 0;
    liveEl.hidden = !showLive;
    closeDrawers();

    // Find player if player tab
    const player = ds.roster.players.find((p) => slug(p) === tab);

    // Render canvas
    if (player) {
      canvasTitle.textContent = player.name;
      canvasSubtitle.textContent = `${ds.roster.players.indexOf(player) + 1} de ${ds.roster.players.length} · ${fmtTimeAgo(ds.meta.updatedAt || new Date().toISOString())}`;
      historyAll = playerMatchesFor(ds, player.puuid, f);
      historyFilter.agent = historyFilter.map = historyFilter.mode = "";
      historyShown = MATCH_PAGE;
      contentEl.innerHTML = renderPlayer(ds, player, f);
      liveContentEl.innerHTML = renderLivePlayer(ds, player, f);
    } else if (kind === "ranking") {
      canvasTitle.textContent = "Ranking del equipo";
      canvasSubtitle.textContent = "Ordenado por ELO · Filtro: Ranked / Este acto";
      contentEl.innerHTML = renderRanking(ds, f, rankSort);
      liveContentEl.innerHTML = renderLiveRanking(ds, f);
    } else {
      canvasTitle.textContent = "Visión de equipo";
      canvasSubtitle.textContent = "Premier + Scrims · Este acto";
      contentEl.innerHTML = renderTeam(ds, f);
      liveContentEl.innerHTML = renderLiveTeam(ds, f);
    }

    // Attach detail row listeners
    attachDetailListeners();
    attachSortListeners();
    attachEloTooltipListeners();
  }

  function attachDetailListeners() {
    contentEl.querySelectorAll<HTMLTableRowElement>("tr.tac-row--expandable").forEach((row) => {
      row.addEventListener("click", () => toggleDetail(row));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleDetail(row);
        }
      });
    });
  }

  function toggleDetail(row: HTMLTableRowElement) {
    const detailRow = row.nextElementSibling as HTMLElement;
    const expanded = row.getAttribute("aria-expanded") === "true";
    row.setAttribute("aria-expanded", String(!expanded));
    if (detailRow && detailRow.classList.contains("tac-detail-row")) {
      detailRow.style.display = expanded ? "none" : "table-row";
      // Re-attach listeners for nested content
      attachSortListeners();
    }
  }

  function attachSortListeners() {
    contentEl.querySelectorAll<HTMLButtonElement>("th.sortable").forEach((th) => {
      th.onclick = () => {
        if (kindOf(currentTab()) !== "ranking") return;
        const key = th.dataset.sort as LeaderKey;
        if (rankSort.key === key) rankSort.dir = rankSort.dir === "desc" ? "asc" : "desc";
        else Object.assign(rankSort, { key, dir: "desc" });
        render();
      };
    });
  }

  function attachEloTooltipListeners() {
    const tooltip = document.getElementById("tac-elo-tooltip") as HTMLElement;
    const timeline = document.querySelector(".tac-elo-timeline") as HTMLElement;
    if (!tooltip || !timeline) return;

    contentEl.querySelectorAll<SVGCircleElement>(".elo-point").forEach((point) => {
      point.addEventListener("mouseenter", () => {
        const date = point.dataset.date ?? "";
        const tier = point.dataset.tier ?? "";
        const rr = point.dataset.rr ?? "";
        tooltip.querySelector(".tac-elo-tooltip__date")!.textContent = date ? fmtTooltipDate(date) : "";
        tooltip.querySelector(".tac-elo-tooltip__rank")!.textContent = tier;
        tooltip.querySelector(".tac-elo-tooltip__rr")!.textContent = `${rr} RR`;
        tooltip.hidden = false;
      });
      point.addEventListener("mousemove", (e) => {
        const rect = timeline.getBoundingClientRect();
        tooltip.style.left = `${e.clientX - rect.left + 12}px`;
        tooltip.style.top = `${e.clientY - rect.top - 12}px`;
      });
      point.addEventListener("mouseleave", () => {
        tooltip.hidden = true;
      });
      // Keyboard support
      point.addEventListener("focus", () => {
        const date = point.dataset.date ?? "";
        const tier = point.dataset.tier ?? "";
        const rr = point.dataset.rr ?? "";
        tooltip.querySelector(".tac-elo-tooltip__date")!.textContent = date ? fmtTooltipDate(date) : "";
        tooltip.querySelector(".tac-elo-tooltip__rank")!.textContent = tier;
        tooltip.querySelector(".tac-elo-tooltip__rr")!.textContent = `${rr} RR`;
        const pointRect = point.getBoundingClientRect();
        const timelineRect = timeline.getBoundingClientRect();
        tooltip.style.left = `${pointRect.left - timelineRect.left + 12}px`;
        tooltip.style.top = `${pointRect.top - timelineRect.top - 12}px`;
        tooltip.hidden = false;
      });
      point.addEventListener("blur", () => {
        tooltip.hidden = true;
      });
    });
  }

  // Historial del jugador: filtros por agente/mapa/modo y "ver más" (se re-renderiza solo el cuerpo).
  let historyAll: PlayerMatch[] = [];
  const historyFilter: HistoryFilter = { agent: "", map: "", mode: "" };
  let historyShown = MATCH_PAGE;

  function renderHistory() {
    const body = contentEl.querySelector<HTMLElement>("[data-history-body]");
    if (body) body.innerHTML = renderHistoryBody(filterHistory(historyAll, historyFilter), historyShown);
  }

  contentEl.addEventListener("change", (e) => {
    const sel = (e.target as HTMLElement).closest<HTMLSelectElement>("[data-history-filter]");
    if (!sel) return;
    historyFilter[sel.dataset.historyFilter as keyof HistoryFilter] = sel.value;
    historyShown = MATCH_PAGE;
    renderHistory();
  });

  // Delegado: sirve para las tarjetas que se pintan después (filtros, "ver más").
  function cardMatch(target: EventTarget | null): PlayerMatch | undefined {
    const card = (target as HTMLElement | null)?.closest<HTMLElement>(".tac-match-card");
    if (!card) return undefined;
    const { matchId, puuid } = card.dataset;
    return ds.playerMatches.find((m) => m.matchId === matchId && m.puuid === puuid);
  }
  contentEl.addEventListener("click", (e) => {
    const roleBtn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-goal-role]");
    if (roleBtn) {
      const box = roleBtn.closest("[data-goals]")!;
      box.querySelectorAll("[data-goal-role]").forEach((b) => b.setAttribute("aria-selected", String(b === roleBtn)));
      box.querySelectorAll<HTMLElement>("[data-goal-panel]").forEach((el) => (el.hidden = el.dataset.goalPanel !== roleBtn.dataset.goalRole));
      return;
    }
    if ((e.target as HTMLElement).closest("[data-history-more]")) {
      historyShown += MATCH_PAGE;
      renderHistory();
      return;
    }
    const match = cardMatch(e.target);
    if (match) openModal(match);
  });
  contentEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const match = cardMatch(e.target);
    if (!match) return;
    e.preventDefault();
    openModal(match);
  });

  // Tab click
  tabsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(".tac-tab");
    if (btn) location.hash = btn.dataset.tab!;
  });
  window.addEventListener("hashchange", render);

  // Filter changes
  filtersEl.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (!target || target.disabled) return;
    const f = filters[kindOf(currentTab())];
    if (target.name === "mode") {
      const mode = target.value as Mode;
      const next = f.modes.includes(mode) ? f.modes.filter((x) => x !== mode) : [...f.modes, mode];
      if (next.length === 0) { target.checked = true; return; }
      f.modes = next;
    } else if (target.name === "period") {
      f.period = target.value as Period;
    }
    render();
  });

  // Cajones en pantallas angostas: menú (izquierda, ≤880px) e intel en vivo (derecha, ≤1200px).
  // En escritorio .is-open no tiene efecto porque ambos paneles están en el grid.
  const menuBtn = document.getElementById("tac-menu-btn")!;
  const liveBtn = document.getElementById("tac-live-btn")!;
  const liveCloseBtn = liveEl.querySelector<HTMLButtonElement>(".tac-live__close")!;
  liveCloseBtn.hidden = false;

  function setDrawer(el: HTMLElement, btn: HTMLElement, open: boolean) {
    el.classList.toggle("is-open", open);
    btn.setAttribute("aria-expanded", String(open));
  }
  function syncOverlay() {
    overlay.toggleAttribute("visible", intelEl.classList.contains("is-open") || liveEl.classList.contains("is-open"));
  }
  function closeDrawers() {
    setDrawer(intelEl, menuBtn, false);
    setDrawer(liveEl, liveBtn, false);
    syncOverlay();
  }
  menuBtn.addEventListener("click", () => {
    const open = !intelEl.classList.contains("is-open");
    closeDrawers();
    setDrawer(intelEl, menuBtn, open);
    syncOverlay();
  });
  liveBtn.addEventListener("click", () => {
    const open = !liveEl.classList.contains("is-open");
    closeDrawers();
    setDrawer(liveEl, liveBtn, open);
    syncOverlay();
  });
  liveCloseBtn.addEventListener("click", closeDrawers);
  overlay.addEventListener("click", closeDrawers);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalEl.hasAttribute("open")) closeDrawers();
  });

  // Initial render
  renderTabs();
  render();
}

main();