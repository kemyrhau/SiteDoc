import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE 2026-11-15 (20) punkt 1: dokumentopprettelse (sjekkliste/oppgave) får samme byggeplass
 * som timeføringen — lagret valg → GPS → ingen. Opprett-flytene leser `kontekstByggeplassId`
 * (utledet med `velgTimerByggeplass`, aldri (c) «første»), ikke visningsverdien `valgtBygningId`.
 * Logikken er testet i `packages/shared/.../standardByggeplass.test.ts`.
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8").replace(/\s+/g, " ");

describe("dokumentopprettelse bruker byggeplass uten (c)", () => {
  it("OpprettVelger (direkte opprett fra blad) henter kontekstByggeplassId", () => {
    const kilde = les("../components/OpprettVelger.tsx");
    expect(kilde).toMatch(/const \{ kontekstByggeplassId: valgtBygningId, hentSistTegning \} = useByggeplass\(\)/);
    // Negativkontroll: visningsverdien (med (c)) destruktureres ikke direkte.
    expect(kilde).not.toMatch(/const \{ valgtBygningId[ ,}]/);
  });

  it("OpprettDokumentModal foreslår fra kontekstByggeplassId", () => {
    const kilde = les("../components/OpprettDokumentModal.tsx");
    expect(kilde).toMatch(/const \{ kontekstByggeplassId: kontekstBygningId,/);
    // Negativkontroll: den gamle aliasingen av visningsverdien er borte.
    expect(kilde).not.toMatch(/valgtBygningId: kontekstBygningId/);
  });

  it("(20b) mobil-HMS oppretter SJA/avvik/RUH med kontekstByggeplassId, aldri «første»", () => {
    const kilde = les("../../app/hms/index.tsx");
    const opprett = kilde.slice(kilde.indexOf("const håndterMal"), kilde.indexOf("const håndterMal") + 1200);
    expect(opprett.match(/byggeplassId: kontekstByggeplassId \?\? undefined/g)?.length).toBe(2);
    // Negativkontroll: visningsverdien (med (c) «første») brukes ikke ved opprettelse.
    expect(opprett).not.toMatch(/byggeplassId: valgtBygningId/);
  });

  it("(20b) ingen opprett-flyt sender lokasjonOmfang «prosjekt»", () => {
    for (const fil of ["../components/OpprettVelger.tsx", "../components/OpprettDokumentModal.tsx", "../../app/hms/index.tsx"]) {
      const kilde = les(fil);
      expect(kilde).not.toMatch(/lokasjonOmfang/);
      expect(kilde).not.toMatch(/"prosjekt"/);
    }
  });
});
