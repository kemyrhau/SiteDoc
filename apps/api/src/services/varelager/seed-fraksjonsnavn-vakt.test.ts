import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ORDRE 34 pkt 5 — vakt for fraksjonsnavn i A.Markussens vare-seed.
 * Bransjepraksis: 0-x er knust fjell (ikke pukk); pukk har øvre fraksjon ≤ 32;
 * over 32 med nedre > 6 er grovpukk. Kildetekst-sjekk — seed-fila kjører
 * `main()` ved import og kan ikke importeres i en test.
 */
const __dir = dirname(fileURLToPath(import.meta.url));
const seed = readFileSync(
  join(__dir, "../../../../../packages/db-varelager/prisma/seed-amarkussen.ts"),
  "utf8",
);
const navn = [...seed.matchAll(/navn: "([^"]+)"/g)].map((m) => m[1]!);

describe("vare-seed — fraksjonsnavn (ORDRE 34 pkt 5)", () => {
  it("seed-fila er lest (negativkontroll)", () => {
    expect(navn.length).toBeGreaterThan(50);
    expect(navn).toContain("Pukk 8-22");
  });

  it("🔴 ingen «Pukk 0-*» (0-x er knust fjell)", () => {
    expect(navn.filter((n) => /^Pukk 0-/.test(n))).toEqual([]);
  });

  it("🔴 ingen «Pukk» med øvre fraksjon > 32 (det er grovpukk)", () => {
    const forStor = navn.filter((n) => {
      const m = /^Pukk (\d+)-(\d+)/.exec(n);
      return m ? Number(m[2]) > 32 : false;
    });
    expect(forStor).toEqual([]);
  });

  it("de omdøpte navnene finnes i både m3 og tonn", () => {
    for (const n of ["Knust fjell 0-11", "Knust fjell 0-120", "Grovpukk 22-64", "Grovpukk 22-120"]) {
      expect(navn.filter((x) => x === n)).toHaveLength(2);
    }
  });
});
