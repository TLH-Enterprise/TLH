import { describe, expect, test } from "vitest";
import {
  MIN_GAMES,
  byKey,
  compositions,
  currentSeason,
  highlights,
  includedTeamMatches,
  leaderboard,
  leaders,
  sortLeaderboard,
  line,
  mapDetail,
  playerMatchesFor,
  recent,
  rrSeries,
  teamByMap,
  filterHistory,
  teamMatchesFor,
} from "../../src/lib/valorant/stats.ts";
import type { Dataset, LineupEntry, PlayerMatch, Roster, TeamMatch } from "../../src/lib/valorant/types.ts";
import rosterJson from "../../src/data/valorant/roster.json";

const roster = rosterJson as Roster;
const [Z, B, M, E, T, S] = roster.players;

let seq = 0;
function pm(p: Partial<PlayerMatch> = {}): PlayerMatch {
  seq++;
  return {
    matchId: `m${seq}`, puuid: Z.puuid, mode: "competitive", startedAt: `2026-11-${String((seq % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    map: "Sunset", season: "e11a6", agent: "Sova", side: "Red", roundsWon: 13, roundsLost: 7, won: true,
    kills: 20, deaths: 10, assists: 5, headshots: 10, bodyshots: 30, legshots: 0, damageMade: 4000, damageReceived: 3000,
    score: 5000, tier: 21, ...p,
  };
}

function lu(puuid: string, riotId: string, agent: string, inRoster = true, k = 10, d = 10): LineupEntry {
  return { puuid, riotId, agent, inRoster, kills: k, deaths: d, assists: 0, headshots: 1, bodyshots: 1, legshots: 0, damage: 100, score: 1 };
}
const fullLineup = () => [
  lu(Z.puuid, "Zeiko#BRS", "Sova"), lu(B.puuid, "BiggS#ING", "Omen"), lu(M.puuid, "McFly#GOAT", "Vyse"),
  lu(E.puuid, "ezekiel#bored", "Iso"), lu(T.puuid, "TDiamond#COL", "Neon"),
];

function tm(p: Partial<TeamMatch> = {}): TeamMatch {
  seq++;
  return {
    matchId: `t${seq}`, kind: "premier", startedAt: `2026-11-${String((seq % 28) + 1).padStart(2, "0")}T00:00:00Z`,
    map: "Sunset", season: "e11a6", side: "Red", roundsWon: 13, roundsLost: 5, won: true, opponentName: "Paw Patrolls",
    opponentPlayers: ["X#1", "Y#2"], lineup: fullLineup(), rounds: [], ...p,
  };
}

function ds(p: Partial<Dataset> = {}): Dataset {
  return {
    meta: { updatedAt: "2026-11-13T10:00:00Z", nonTeamMatchIds: [] }, roster, playerMatches: [], teamMatches: [],
    snapshots: [], labels: {}, ...p,
  };
}

describe("line", () => {
  test("vacío → todo null, sin NaN", () => {
    expect(line([])).toEqual({ games: 0, wins: 0, winRate: null, kd: null, hsPct: null, dmgPerRound: null });
  });
  test(`menos de ${MIN_GAMES} partidas → winRate null, kd número`, () => {
    const l = line([pm(), pm()]);
    expect(l.winRate).toBeNull();
    expect(l.kd).toBe(2);
    expect(l.hsPct).toBe(25);
    expect(l.dmgPerRound).toBe(200);
  });
  test("empate cuenta en games pero no en wins", () => {
    const l = line([pm(), pm(), pm({ won: null, roundsWon: 12, roundsLost: 12 })]);
    expect(l).toMatchObject({ games: 3, wins: 2 });
    expect(l.winRate).toBeCloseTo(66.67, 1);
  });
  test("0 muertes no da Infinity", () => {
    expect(line([pm({ deaths: 0, kills: 7 })]).kd).toBe(7);
  });
  test("0 disparos → hsPct null", () => {
    expect(line([pm({ headshots: 0, bodyshots: 0, legshots: 0 })]).hsPct).toBeNull();
  });
});

describe("byKey", () => {
  test("agrupa por mapa con agente top, orden por partidas", () => {
    const rows = [pm({ map: "Haven", agent: "Omen" }), pm({ map: "Sunset" }), pm({ map: "Sunset", agent: "Fade" }), pm({ map: "Sunset" })];
    const r = byKey(rows, "map");
    expect(r.map((x) => x.key)).toEqual(["Sunset", "Haven"]);
    expect(r[0].line.games).toBe(3);
    expect(r[0].topAgent).toBe("Sova");
  });
});

describe("filtros", () => {
  test("currentSeason = temporada de la partida más reciente", () => {
    const d = ds({ playerMatches: [pm({ season: "e11a5", startedAt: "2026-10-01T00:00:00Z" }), pm({ season: "e11a6", startedAt: "2026-11-12T00:00:00Z" })] });
    expect(currentSeason(d)).toBe("e11a6");
    expect(currentSeason(ds())).toBeNull();
  });

  test("periodo act filtra por currentSeason", () => {
    const d = ds({ playerMatches: [pm({ season: "e11a5", startedAt: "2026-10-01T00:00:00Z" }), pm({ season: "e11a6", startedAt: "2026-11-12T00:00:00Z" })] });
    expect(playerMatchesFor(d, Z.puuid, { modes: ["competitive"], period: "act" })).toHaveLength(1);
    expect(playerMatchesFor(d, Z.puuid, { modes: ["competitive"], period: "all" })).toHaveLength(2);
  });

  test("custom del jugador solo si es partida de equipo incluida", () => {
    const team = tm({ matchId: "C1", kind: "custom" });
    const excluded = tm({ matchId: "C2", kind: "custom" });
    const d = ds({
      playerMatches: [pm({ matchId: "C1", mode: "custom" }), pm({ matchId: "C2", mode: "custom" }), pm({ matchId: "C3", mode: "custom" })],
      teamMatches: [team, excluded],
      labels: { C2: { include: false } },
    });
    expect(includedTeamMatches(d).map((t) => t.matchId)).toEqual(["C1"]);
    expect(playerMatchesFor(d, Z.puuid, { modes: ["custom"], period: "all" }).map((m) => m.matchId)).toEqual(["C1"]);
  });

  test("teamMatchesFor separa premier y custom e ignora competitive", () => {
    const d = ds({ teamMatches: [tm({ kind: "premier" }), tm({ kind: "custom" })] });
    expect(teamMatchesFor(d, { modes: ["premier"], period: "all" })).toHaveLength(1);
    expect(teamMatchesFor(d, { modes: ["premier", "custom", "competitive"], period: "all" })).toHaveLength(2);
    expect(teamMatchesFor(d, { modes: ["competitive"], period: "all" })).toHaveLength(0);
  });
});

describe("equipo", () => {
  test("teamByMap calcula % de ataque y defensa", () => {
    const r = teamByMap([tm({ rounds: [{ won: true, role: "Attack" }, { won: false, role: "Attack" }, { won: true, role: "Defense" }] })]);
    expect(r[0]).toMatchObject({ map: "Sunset", games: 1, wins: 1, winRate: null, atkPct: 50, defPct: 100 });
  });

  test("teamByMap suma las rondas y da el resultado de cada partida en orden", () => {
    const r = teamByMap([tm({ roundsWon: 13, roundsLost: 5 }), tm({ roundsWon: 9, roundsLost: 13, won: false })]);
    expect(r[0]).toMatchObject({ roundsWon: 22, roundsLost: 18 });
    expect(r[0].results).toEqual([
      { won: true, roundsWon: 13, roundsLost: 5 },
      { won: false, roundsWon: 9, roundsLost: 13 },
    ]);
  });

  test("filterHistory: los campos vacíos no filtran y los llenos se combinan", () => {
    const ms = [pm({ agent: "Sova", map: "Lotus" }), pm({ agent: "Omen", map: "Lotus", mode: "custom" }), pm({ agent: "Sova", map: "Bind" })];
    expect(filterHistory(ms, { agent: "", map: "", mode: "" })).toHaveLength(3);
    expect(filterHistory(ms, { agent: "Sova", map: "", mode: "" })).toEqual([ms[0], ms[2]]);
    expect(filterHistory(ms, { agent: "Sova", map: "Lotus", mode: "" })).toEqual([ms[0]]);
    expect(filterHistory(ms, { agent: "", map: "Lotus", mode: "custom" })).toEqual([ms[1]]);
  });

  test("teamByMap sin rondas → atk/def null", () => {
    expect(teamByMap([tm()])[0]).toMatchObject({ atkPct: null, defPct: null });
  });

  test("compositions: agentes ordenados alfabéticamente", () => {
    const r = compositions([tm(), tm(), tm({ won: false })]);
    expect(r[0]).toMatchObject({ map: "Sunset", agents: ["Iso", "Neon", "Omen", "Sova", "Vyse"], games: 3 });
    expect(r[0].winRate).toBeCloseTo(66.67, 1);
  });

  test("mapDetail: jugador que no jugó el mapa → games 0, topAgent null", () => {
    const r = mapDetail([tm()], "Sunset", roster);
    expect(r).toHaveLength(6);
    expect(r.find((x) => x.riotId === "Sharky#kztro")).toEqual({ riotId: "Sharky#kztro", topAgent: null, games: 0, winRate: null, kd: null });
    expect(r.find((x) => x.riotId === "Zeiko#BRS")).toMatchObject({ topAgent: "Sova", games: 1, kd: 1 });
  });

  test("recent: rival y tipo por defecto y con etiqueta; suplentes", () => {
    const sub = fullLineup();
    sub[4] = lu("x", "dagestan aim f#splsh", "Neon", false);
    const a = tm({ matchId: "A", kind: "custom", opponentName: null, startedAt: "2026-11-10T00:00:00Z" });
    const b = tm({ matchId: "B", kind: "custom", opponentName: null, startedAt: "2026-11-09T00:00:00Z" });
    const c = tm({ matchId: "C", kind: "premier", lineup: sub, startedAt: "2026-11-08T00:00:00Z" });
    const d = ds({ teamMatches: [a, b, c], labels: { B: { type: "torneo", rival: "ABC" } } });
    const r = recent(d, [a, b, c], 10);
    expect(r[0]).toMatchObject({ matchId: "A", kindLabel: "Scrim", rival: "Scrim vs X#1", score: "13–5", won: true, subs: [] });
    expect(r[1]).toMatchObject({ kindLabel: "Torneo", rival: "ABC" });
    expect(r[2]).toMatchObject({ kindLabel: "Premier", rival: "Paw Patrolls", subs: ["dagestan aim f#splsh"] });
  });
});

describe("jugador", () => {
  test("highlights vacío con 0 partidas", () => {
    expect(highlights([])).toEqual([]);
  });

  test("highlights: mejor y peor mapa con ≥ MIN_GAMES", () => {
    const rows = [
      ...Array.from({ length: 3 }, () => pm({ map: "Sunset", won: true })),
      ...Array.from({ length: 3 }, () => pm({ map: "Haven", won: false })),
      pm({ map: "Lotus", won: true }),
    ];
    const h = highlights(rows);
    expect(h).toContain("Mejor mapa: Sunset (100% en 3)");
    expect(h).toContain("Peor mapa: Haven (0% en 3)");
  });

  test("highlights: tendencia de HS% en las últimas 10", () => {
    const old = Array.from({ length: 10 }, (_, i) => pm({ startedAt: `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00Z`, headshots: 30, bodyshots: 70 }));
    const last = Array.from({ length: 10 }, (_, i) => pm({ startedAt: `2026-11-${String(i + 1).padStart(2, "0")}T00:00:00Z`, headshots: 10, bodyshots: 90 }));
    const h = highlights([...old, ...last]);
    expect(h.some((x) => x.startsWith("HS% bajó de 20% a 10%"))).toBe(true);
    expect(h.length).toBeLessThanOrEqual(3);
  });

  test("rrSeries toma el elo del jugador por fecha", () => {
    const d = ds({
      snapshots: [
        { date: "2026-11-12", players: { [Z.puuid]: { tier: 21, tierName: "Ascendant 1", rr: 50, elo: 1850 } }, premier: null },
        { date: "2026-11-13", players: {}, premier: null },
      ],
    });
    expect(rrSeries(d, Z.puuid)).toEqual([{ date: "2026-11-12", elo: 1850 }]);
    expect(rrSeries(d, S.puuid)).toEqual([]);
  });
});



describe("leaderboard", () => {
  const snap = {
    date: "2026-11-13",
    players: {
      [Z.puuid]: { tier: 21, tierName: "Ascendant 1", rr: 65, elo: 1865 },
      [T.puuid]: { tier: 24, tierName: "Immortal 1", rr: 69, elo: 2169 },
    },
    premier: null,
  };
  const d = () =>
    ds({
      snapshots: [snap],
      playerMatches: [
        ...Array.from({ length: 3 }, () => pm({ puuid: Z.puuid, kills: 20, deaths: 10, assists: 10 })),
        ...Array.from({ length: 3 }, () => pm({ puuid: T.puuid, kills: 30, deaths: 10, assists: 0, won: false })),
        pm({ puuid: B.puuid, kills: 5, deaths: 0, assists: 1 }),
      ],
    });
  const f = { modes: ["competitive" as const], period: "all" as const };

  test("una fila por jugador del roster, con rango de la última foto y KDA", () => {
    const rows = leaderboard(d(), f);
    expect(rows).toHaveLength(6);
    const z = rows.find((r) => r.puuid === Z.puuid)!;
    expect(z).toMatchObject({ riotId: "Zeiko#BRS", name: "Zeiko", tierName: "Ascendant 1", rr: 65, elo: 1865, kda: 3 });
    expect(z.line.games).toBe(3);
    const s = rows.find((r) => r.puuid === S.puuid)!;
    expect(s).toMatchObject({ elo: null, kda: null });
    expect(s.line.games).toBe(0);
    expect(rows.find((r) => r.puuid === B.puuid)!.kda).toBe(6); // 0 muertes → divide por 1
  });

  test("ordenar por rango desc y nulls al final", () => {
    const sorted = sortLeaderboard(leaderboard(d(), f), "rank", "desc");
    expect(sorted.slice(0, 2).map((r) => r.name)).toEqual(["TDiamond", "Zeiko"]);
    expect(sorted.slice(2).every((r) => r.elo === null)).toBe(true);
  });

  test("ordenar por winRate asc: nulls (menos de MIN_GAMES) siguen al final", () => {
    const sorted = sortLeaderboard(leaderboard(d(), f), "winRate", "asc");
    expect(sorted.map((r) => r.name).slice(0, 2)).toEqual(["TDiamond", "Zeiko"]);
    expect(sorted.at(-1)!.line.winRate).toBeNull();
  });

  test("líderes por columna, ignorando nulls", () => {
    const l = leaders(leaderboard(d(), f));
    expect(l.rank).toEqual([T.puuid]);
    expect(l.winRate).toEqual([Z.puuid]);
    expect(l.kd).toEqual([B.puuid]); // 5/max(0,1)=5
    expect(l.games).toEqual([Z.puuid, T.puuid]); // empate en 3
  });

  test("dataset vacío → filas sin NaN y sin líderes", () => {
    const rows = leaderboard(ds(), f);
    expect(rows).toHaveLength(6);
    expect(JSON.stringify(rows)).not.toMatch(/NaN|Infinity/);
    expect(leaders(rows).kd).toEqual([]);
  });
});
