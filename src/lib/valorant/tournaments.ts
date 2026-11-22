// Torneos de VALORANT encontrados por la búsqueda automática (scripts/valorant/tournaments.ts).
// El formato es el JSON que devuelve el prompt del buscador; aquí se valida y normaliza.

export type TournamentFormat = "5v5" | "3v3" | "2v2" | "1v1";

export interface Tournament {
  nombre: string;
  organizador: string | null;
  formato: TournamentFormat | null;
  region: string | null;
  /** "YYYY-MM-DD HH:MM" en hora de Colombia (UTC-5). */
  fecha_hora_colombia: string | null;
  cierre_inscripcion: string | null;
  costo: string | null;
  premio: string | null;
  cupos: string | null;
  requisitos: string | null;
  link_inscripcion: string;
  fuente: string | null;
  alerta: string | null;
}

export interface TournamentReport {
  actualizado: string;
  /** ISO del momento en que se generó (lo añade el script, no el modelo). */
  generadoEn?: string;
  torneos: Tournament[];
  riot_proximo_qualifier: string | null;
  notas: string | null;
}

const FORMATS: TournamentFormat[] = ["5v5", "3v3", "2v2", "1v1"];
const DATETIME = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/;

const str = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.toLowerCase() !== "null" ? s : null;
};

const safeUrl = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};

const normDateTime = (v: unknown): string | null => {
  const m = str(v)?.match(DATETIME);
  return m ? `${m[1]} ${m[2] ?? "00:00"}` : null;
};

/** "YYYY-MM-DD HH:MM" (hora Colombia) → Date. */
export function colombiaToDate(s: string): Date {
  return new Date(s.replace(" ", "T") + ":00-05:00");
}

/** Saca el objeto JSON del texto del modelo (tolera ```json … ``` o texto alrededor). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("La respuesta no contiene un objeto JSON.");
  return JSON.parse(text.slice(start, end + 1));
}

function toTournament(raw: unknown): Tournament | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nombre = str(r.nombre);
  const link = safeUrl(r.link_inscripcion);
  // Sin nombre o sin un enlace válido no sirve de nada en la campana.
  if (!nombre || !link) return null;
  const formato = str(r.formato)?.toLowerCase().replace(/\s/g, "") as TournamentFormat | undefined;
  return {
    nombre,
    organizador: str(r.organizador),
    formato: formato && FORMATS.includes(formato) ? formato : null,
    region: str(r.region),
    fecha_hora_colombia: normDateTime(r.fecha_hora_colombia),
    cierre_inscripcion: normDateTime(r.cierre_inscripcion),
    costo: str(r.costo),
    premio: str(r.premio),
    cupos: str(r.cupos),
    requisitos: str(r.requisitos),
    link_inscripcion: link,
    fuente: str(r.fuente),
    alerta: str(r.alerta),
  };
}

const sortKey = (t: Tournament) => t.fecha_hora_colombia ?? "9999";

/** Valida y normaliza el JSON del buscador. Lanza si la forma general no es la esperada. */
export function parseReport(raw: unknown): TournamentReport {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { torneos?: unknown }).torneos))
    throw new Error("El JSON no tiene el arreglo \"torneos\".");
  const r = raw as Record<string, unknown>;
  const torneos = (r.torneos as unknown[]).map(toTournament).filter((t): t is Tournament => t !== null);
  // Mismo enlace repetido → uno solo.
  const unique = [...new Map(torneos.map((t) => [t.link_inscripcion, t])).values()];
  unique.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  return {
    actualizado: normDateTime(r.actualizado)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    ...(str(r.generadoEn) ? { generadoEn: str(r.generadoEn)! } : {}),
    torneos: unique,
    riot_proximo_qualifier: str(r.riot_proximo_qualifier),
    notas: str(r.notas),
  };
}

/** Torneos que todavía se pueden jugar: el cierre (o, si no hay, el inicio) no ha pasado. */
export function upcoming(report: TournamentReport | null | undefined, now: Date): Tournament[] {
  if (!report) return [];
  return report.torneos.filter((t) => {
    const limit = t.cierre_inscripcion ?? t.fecha_hora_colombia;
    return !limit || colombiaToDate(limit).getTime() >= now.getTime();
  });
}

/** Identificador estable para marcar un torneo como visto. */
export const tournamentKey = (t: Tournament) => t.link_inscripcion;
