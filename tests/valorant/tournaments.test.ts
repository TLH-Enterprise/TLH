import { describe, expect, test } from "vitest";
import { colombiaToDate, extractJson, parseReport, upcoming } from "../../src/lib/valorant/tournaments.ts";

const base = {
  nombre: "Copa LAN",
  organizador: "Org",
  formato: "5v5",
  region: "LAN",
  fecha_hora_colombia: "2026-11-30 18:00",
  cierre_inscripcion: "2026-11-29 12:00",
  costo: "Gratis",
  premio: "$100",
  cupos: null,
  requisitos: null,
  link_inscripcion: "https://www.challengermode.com/t/abc",
  fuente: "Challengermode",
  alerta: null,
};

describe("extractJson", () => {
  test("tolera bloque ```json y texto alrededor", () => {
    expect(extractJson('Aquí va:\n```json\n{"torneos": []}\n```\nlisto')).toEqual({ torneos: [] });
  });
  test("sin JSON → lanza", () => {
    expect(() => extractJson("no encontré nada")).toThrow();
  });
});

describe("parseReport", () => {
  test("ordena por fecha, deduplica por enlace y descarta sin nombre o con enlace no http", () => {
    const r = parseReport({
      actualizado: "2026-11-22",
      torneos: [
        { ...base, nombre: "Tarde", fecha_hora_colombia: "2026-12-05 20:00", link_inscripcion: "https://x.gg/2" },
        base,
        { ...base, nombre: "Duplicado" },
        { ...base, nombre: "", link_inscripcion: "https://x.gg/3" },
        { ...base, nombre: "Malicioso", link_inscripcion: "javascript:alert(1)" },
        "basura",
      ],
      riot_proximo_qualifier: "sin anunciar",
      notas: "X no disponible",
    });
    expect(r.torneos.map((t) => t.nombre)).toEqual(["Duplicado", "Tarde"]);
    expect(r.riot_proximo_qualifier).toBe("sin anunciar");
  });

  test("normaliza formato, fechas y valores 'null' en texto", () => {
    const [t] = parseReport({
      torneos: [{ ...base, formato: "5 v 5", fecha_hora_colombia: "2026-11-30", cierre_inscripcion: "null", costo: "  " }],
    }).torneos;
    expect(t.formato).toBe("5v5");
    expect(t.fecha_hora_colombia).toBe("2026-11-30 00:00");
    expect(t.cierre_inscripcion).toBeNull();
    expect(t.costo).toBeNull();
  });

  test("sin arreglo torneos → lanza", () => {
    expect(() => parseReport({ torneos: "x" })).toThrow();
  });
});

describe("upcoming", () => {
  const report = parseReport({
    torneos: [
      { ...base, nombre: "Cerrado", cierre_inscripcion: "2026-11-20 12:00", link_inscripcion: "https://x.gg/a" },
      { ...base, nombre: "Abierto", link_inscripcion: "https://x.gg/b" },
      { ...base, nombre: "Sin fechas", fecha_hora_colombia: null, cierre_inscripcion: null, link_inscripcion: "https://x.gg/c" },
    ],
  });
  test("quita los que ya cerraron inscripción (hora Colombia)", () => {
    expect(upcoming(report, new Date("2026-11-22T12:00:00Z")).map((t) => t.nombre)).toEqual(["Abierto", "Sin fechas"]);
  });
  test("el cierre se interpreta en UTC-5", () => {
    expect(colombiaToDate("2026-11-29 12:00").toISOString()).toBe("2026-11-29T17:00:00.000Z");
  });
  test("reporte nulo → []", () => {
    expect(upcoming(null, new Date())).toEqual([]);
  });
});
