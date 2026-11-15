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
    expect(kilde).toMatch(/const \{ kontekstByggeplassId: valgtBygningId, hentSistTegning(, opprettLokasjonOmfang)? \} = useByggeplass\(\)/);
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

/**
 * ORDRE 2026-11-15 (20) linja: opprettelsen sender «prosjekt» ved eget «Hele prosjektet»-valg,
 * og detaljsidene viser «Byggeplass ikke valgt · Velg» via `visByggeplassIkkeValgt`.
 */
describe("(20) linja — opprettelse og detaljsider", () => {
  it.each([
    ["../components/OpprettVelger.tsx"],
    ["../components/OpprettDokumentModal.tsx"],
    ["../../app/hms/index.tsx"],
  ])("%s sender lokasjonOmfang fra konteksten", (sti) => {
    const kilde = les(sti);
    expect(kilde).toMatch(/const \{[^}]*\bopprettLokasjonOmfang\b[^}]*\} = useByggeplass\(\)/);
    expect((kilde.match(/lokasjonOmfang: opprettLokasjonOmfang/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it.each([
    ["../../app/sjekkliste/[id].tsx", "aapneLokasjonRedigering"],
    ["../../app/oppgave/[id].tsx", "settVisTegningVelger\\(true\\)"],
  ])("%s viser linja og «Velg» åpner velgeren", (sti, handling) => {
    const kilde = les(sti);
    expect(kilde).toMatch(/visByggeplassIkkeValgt\(\{/);
    expect(kilde).toMatch(new RegExp(`<ByggeplassIkkeValgtLinje onVelg=\\{(\\(\\) => )?${handling}\\} \\/>`));
  });

  // Negativkontroll: regexen treffer ikke en side uten linja.
  it("negativkontroll: OpprettVelger har ingen linje", () => {
    expect(les("../components/OpprettVelger.tsx")).not.toMatch(/ByggeplassIkkeValgtLinje/);
  });
});
