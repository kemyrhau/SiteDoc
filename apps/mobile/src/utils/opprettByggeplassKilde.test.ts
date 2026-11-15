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
});
