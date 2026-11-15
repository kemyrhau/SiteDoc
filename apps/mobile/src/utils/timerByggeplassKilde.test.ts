import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE 2026-11-15 (18) RETUR — GATE (42) vilkår 2: Bekreft dag, innsjekk og ny timer-rad
 * leser `kontekstByggeplassId` (lagret/GPS, aldri (c) første), ikke visningsverdien
 * `valgtBygningId`. Logikken er testet i `packages/shared/.../standardByggeplass.test.ts`.
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8").replace(/\s+/g, " ");

const FORBRUKERE = {
  "bekreft-dag": "../../app/timer/bekreft-dag.tsx",
  MannskapInnsjekkKort: "../components/MannskapInnsjekkKort.tsx",
  NyTimerRadFlyt: "../components/timer-detalj/NyTimerRadFlyt.tsx",
};

describe("timer-/innsjekk-forbrukere bruker byggeplass uten (c)", () => {
  for (const [navn, sti] of Object.entries(FORBRUKERE)) {
    it(`${navn} henter kontekstByggeplassId`, () => {
      const kilde = les(sti);
      expect(kilde).toMatch(/const \{ kontekstByggeplassId: valgtBygningId[ ,}]/);
      // Negativkontroll: visningsverdien (med (c)) destruktureres ikke direkte.
      expect(kilde).not.toMatch(/const \{ valgtBygningId[ ,}]/);
    });
  }

  it("konteksten utleder kontekstByggeplassId med velgTimerByggeplass", () => {
    const kilde = les("../kontekst/ByggeplassKontekst.tsx");
    expect(kilde).toContain("const kontekstByggeplassId = useMemo(");
    expect(kilde).toContain("return velgTimerByggeplass({");
  });
});
