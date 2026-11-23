import { execFileSync } from "node:child_process";
import { describe, expect, test } from "vitest";

describe("cm_tournaments.py --html", () => {
  test("saca enlace y texto de cada tarjeta, sin mezclar tarjetas", () => {
    const out = JSON.parse(
      execFileSync("python3", ["scripts/valorant/cm_tournaments.py", "--html", "tests/valorant/fixtures/cm-list.html"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    ) as Array<{ url: string; organizador: string; tarjeta: string }>;
    expect(out).toHaveLength(2);
    const lev = out.find((t) => t.organizador === "LEVIATAN")!;
    expect(lev.url).toBe("https://www.challengermode.com/s/LEVIATAN/tournaments/e84ed17e-fe08-4b2a-e922-08df3e4c1535");
    expect(lev.tarjeta).toContain("Latin America • 2v2");
    expect(lev.tarjeta).not.toContain("Brazil");
    expect(out.find((t) => t.organizador === "Wolfoxy")!.tarjeta).toContain("Brazil");
  });
});
