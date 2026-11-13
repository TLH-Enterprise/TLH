import type { StoredMatchRow, V4Match } from "./normalize.ts";
import type { Mode, PremierStatus, RankSnapshot } from "./types.ts";

const BASE = "https://api.henrikdev.xyz/valorant";
const REGION = "na";
const PLATFORM = "pc";

export class ApiError extends Error {
  status: number;
  constructor(status: number, path: string) {
    super(status === 0 ? `HenrikDev sin respuesta (red o timeout) en ${path}` : `HenrikDev ${status} en ${path}`);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface HenrikClient {
  /** Pide las últimas partidas para que HenrikDev las registre; descarta el cuerpo. */
  // Los jugadores se consultan por PUUID: no cambia aunque cambien su Riot ID.
  recentMatches(puuid: string, mode: Mode): Promise<void>;
  storedMatches(puuid: string, mode: Mode, page: number, size: number): Promise<{ rows: StoredMatchRow[]; total: number }>;
  match(id: string): Promise<V4Match>;
  mmr(puuid: string): Promise<RankSnapshot>;
  premierTeam(name: string, tag: string): Promise<PremierStatus | null>;
}

export interface ClientOptions {
  key: string;
  fetch?: typeof fetch;
  minIntervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const MAX_429_RETRIES = 3;
const MAX_5XX_RETRIES = 2;
const RETRY_5XX_MS = 5000;
const REQUEST_TIMEOUT_MS = 30_000;

export function createClient(opts: ClientOptions): HenrikClient {
  const doFetch = opts.fetch ?? fetch;
  const minInterval = opts.minIntervalMs ?? 2100;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = opts.now ?? Date.now;
  let last: number | null = null;

  async function throttle() {
    if (last !== null) {
      const wait = last + minInterval - now();
      if (wait > 0) await sleep(wait);
    }
    last = now();
  }

  async function get<T>(path: string): Promise<T> {
    let tries429 = 0;
    let tries5xx = 0;
    for (;;) {
      await throttle();
      let res: Response;
      try {
        res = await doFetch(BASE + path, {
          headers: { Authorization: opts.key, Accept: "application/json" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch {
        // error de red o timeout: se trata como un 5xx
        if (tries5xx < MAX_5XX_RETRIES) {
          tries5xx++;
          await sleep(RETRY_5XX_MS);
          continue;
        }
        throw new ApiError(0, path);
      }
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 && tries429 < MAX_429_RETRIES) {
        tries429++;
        const reset = Number(res.headers.get("x-ratelimit-reset"));
        await sleep((Number.isFinite(reset) && reset > 0 ? reset : 60) * 1000);
        continue;
      }
      if (res.status >= 500 && tries5xx < MAX_5XX_RETRIES) {
        tries5xx++;
        await sleep(RETRY_5XX_MS);
        continue;
      }
      throw new ApiError(res.status, path);
    }
  }

  const e = encodeURIComponent;
  const who = (name: string, tag: string) => `${e(name)}/${e(tag)}`;

  return {
    async recentMatches(puuid, mode) {
      await get(`/v4/by-puuid/matches/${REGION}/${PLATFORM}/${e(puuid)}?mode=${mode}&size=10`);
    },
    async storedMatches(puuid, mode, page, size) {
      const r = await get<{ data?: StoredMatchRow[]; results?: { total?: number } }>(
        `/v1/by-puuid/stored-matches/${REGION}/${e(puuid)}?mode=${mode}&page=${page}&size=${size}`,
      );
      return { rows: r.data ?? [], total: r.results?.total ?? 0 };
    },
    async match(id) {
      const r = await get<{ data: V4Match }>(`/v4/match/${REGION}/${e(id)}`);
      return r.data;
    },
    async mmr(puuid) {
      const r = await get<{ data: { current: { tier: { id: number; name: string }; rr: number; elo: number } } }>(
        `/v3/by-puuid/mmr/${REGION}/${PLATFORM}/${e(puuid)}`,
      );
      const c = r.data.current;
      return { tier: c.tier.id, tierName: c.tier.name, rr: c.rr, elo: c.elo };
    },
    async premierTeam(name, tag) {
      const r = await get<{
        data?: {
          stats?: { wins: number; losses: number };
          placement?: { points: number; conference: string; division: number; place: number };
        };
      }>(`/v1/premier/${who(name, tag)}`);
      const d = r.data;
      if (!d?.placement || !d.stats) return null;
      return {
        points: d.placement.points,
        division: d.placement.division,
        place: d.placement.place,
        conference: d.placement.conference,
        wins: d.stats.wins,
        losses: d.stats.losses,
      };
    },
  };
}
