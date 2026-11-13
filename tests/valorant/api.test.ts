import { describe, expect, test } from "vitest";
import { ApiError, createClient } from "../../src/lib/valorant/api.ts";

const KEY = "HDEV-secret-key";

function fakeFetch(responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const fn = (async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    const r = responses.shift() ?? { status: 200, body: { data: {} } };
    return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers: r.headers });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

function fakeClock() {
  let now = 0;
  const sleeps: number[] = [];
  return {
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

const premierBody = {
  data: {
    stats: { wins: 2, losses: 0, matches: 2 },
    placement: { points: 200, conference: "LATAM_NORTH", division: 21, place: 50 },
  },
};

describe("createClient", () => {
  test("codifica nombres con espacios y manda la clave", async () => {
    const f = fakeFetch([{ status: 200, body: premierBody }]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    const p = await client.premierTeam("T L H", "T L H");
    expect(f.calls[0].url).toBe("https://api.henrikdev.xyz/valorant/v1/premier/T%20L%20H/T%20L%20H");
    expect(f.calls[0].headers.Authorization).toBe(KEY);
    expect(p).toEqual({ points: 200, division: 21, place: 50, conference: "LATAM_NORTH", wins: 2, losses: 0 });
  });

  test("respeta 2100 ms entre peticiones", async () => {
    const f = fakeFetch([{ status: 200, body: premierBody }, { status: 200, body: premierBody }]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    await client.premierTeam("a", "b");
    await client.premierTeam("a", "b");
    expect(c.sleeps.some((ms) => ms >= 2100)).toBe(true);
  });

  test("429 con x-ratelimit-reset espera y reintenta", async () => {
    const f = fakeFetch([{ status: 429, headers: { "x-ratelimit-reset": "9" } }, { status: 200, body: premierBody }]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    const p = await client.premierTeam("a", "b");
    expect(c.sleeps).toContain(9000);
    expect(p?.division).toBe(21);
  });

  test("cuatro 429 seguidos → ApiError 429", async () => {
    const f = fakeFetch(Array.from({ length: 4 }, () => ({ status: 429 })));
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    await expect(client.premierTeam("a", "b")).rejects.toMatchObject({ status: 429 });
    expect(f.calls).toHaveLength(4);
  });

  test("5xx reintenta 2 veces y luego falla", async () => {
    const f = fakeFetch(Array.from({ length: 3 }, () => ({ status: 503 })));
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    await expect(client.mmr("a", "b")).rejects.toMatchObject({ status: 503 });
    expect(f.calls).toHaveLength(3);
  });

  test("error de red (fetch lanza) reintenta como un 5xx", async () => {
    let n = 0;
    const fn = (async () => {
      n++;
      if (n === 1) throw new TypeError("fetch failed");
      return new Response(JSON.stringify(premierBody), { status: 200 });
    }) as unknown as typeof fetch;
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: fn, sleep: c.sleep, now: c.now });
    expect((await client.premierTeam("a", "b"))?.division).toBe(21);
    expect(n).toBe(2);
  });

  test("error de red persistente → ApiError status 0 tras 3 intentos", async () => {
    let n = 0;
    const fn = (async () => {
      n++;
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: fn, sleep: c.sleep, now: c.now });
    await expect(client.premierTeam("a", "b")).rejects.toMatchObject({ status: 0 });
    expect(n).toBe(3);
  });

  test("cada petición lleva un timeout (signal)", async () => {
    let signal: AbortSignal | undefined;
    const fn = (async (_u: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Response(JSON.stringify(premierBody), { status: 200 });
    }) as unknown as typeof fetch;
    const c = fakeClock();
    await createClient({ key: KEY, fetch: fn, sleep: c.sleep, now: c.now }).premierTeam("a", "b");
    expect(signal).toBeInstanceOf(AbortSignal);
  });

  test("404 → ApiError sin reintentar, sin la clave en el mensaje", async () => {
    const f = fakeFetch([{ status: 404 }]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    const err = await client.mmr("a", "b").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(String(err.message)).not.toContain(KEY);
    expect(f.calls).toHaveLength(1);
  });

  test("mmr devuelve data.current normalizado", async () => {
    const f = fakeFetch([
      { status: 200, body: { data: { current: { tier: { id: 21, name: "Ascendant 1" }, rr: 65, elo: 1865 } } } },
    ]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    expect(await client.mmr("Zeiko", "BRS")).toEqual({ tier: 21, tierName: "Ascendant 1", rr: 65, elo: 1865 });
    expect(f.calls[0].url).toBe("https://api.henrikdev.xyz/valorant/v3/mmr/na/pc/Zeiko/BRS");
  });

  test("storedMatches arma la URL y devuelve filas y total", async () => {
    const f = fakeFetch([{ status: 200, body: { data: [{ meta: { id: "x" } }], results: { total: 385 } } }]);
    const c = fakeClock();
    const client = createClient({ key: KEY, fetch: f.fn, sleep: c.sleep, now: c.now });
    const r = await client.storedMatches("dagestan aim f", "splsh", "custom", 2, 100);
    expect(f.calls[0].url).toBe(
      "https://api.henrikdev.xyz/valorant/v1/stored-matches/na/dagestan%20aim%20f/splsh?mode=custom&page=2&size=100",
    );
    expect(r.total).toBe(385);
    expect(r.rows).toHaveLength(1);
  });
});
