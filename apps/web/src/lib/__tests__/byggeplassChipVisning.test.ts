import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE (20b) GATE (46) vilkår 1 + TILLEGG (22) 2026-11-15: byggeplass-chipen i sjekkliste- og
 * oppgavedetaljen viser «—» når dokumentet mangler byggeplass — uansett om prosjektet har
 * byggeplasser. Etiketten for «hele prosjektet» finnes ikke lenger.
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8").replace(/\s+/g, " ");

describe("byggeplass-chip uten byggeplass", () => {
  it("oppgavedetaljen viser «—»", () => {
    const kilde = les("../../app/dashbord/[prosjektId]/oppgaver/[oppgaveId]/page.tsx");
    expect(kilde).toMatch(/verdi: oppgaveLokasjon\.bygningNavn \?\? "—",/);
    // Negativkontroll: den fjernede etiketten brukes ikke.
    expect(kilde).not.toMatch(/kontekstChip\.heleProsjektet/);
  });

  it("sjekklistedetaljen bruker samme regel", () => {
    const kilde = les("../../app/dashbord/[prosjektId]/sjekklister/[sjekklisteId]/page.tsx");
    expect(kilde).toMatch(/verdi: fullSjekkliste\?\.byggeplass\?\.name \?\? "—",/);
    expect(kilde).not.toMatch(/kontekstChip\.heleProsjektet/);
  });

  it("negativkontroll: ingen kildefil i web eller mobil bruker de fjernede nøklene", () => {
    const filer = [
      "../../app/dashbord/[prosjektId]/sjekklister/page.tsx",
      "../../app/dashbord/[prosjektId]/bilder/page.tsx",
      "../../app/dashbord/[prosjektId]/mannskap/page.tsx",
      "../../../../mobile/app/sjekkliste/index.tsx",
      "../../../../mobile/app/(tabs)/tegninger.tsx",
    ];
    for (const f of filer) {
      const kilde = les(f);
      expect(kilde.length).toBeGreaterThan(1000);
      expect(kilde).not.toMatch(/kontekstChip\.heleProsjektet|mannskap\.heleProsjektet|byggeplass\.filtrererListe/);
    }
  });
});
