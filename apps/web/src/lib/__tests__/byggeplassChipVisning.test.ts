import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ORDRE (20b) GATE (46) vilkår 1: «Hele prosjektet» er kun et visningsfilter. Byggeplass-chipen i
 * sjekkliste- og oppgavedetaljen viser «—» når dokumentet mangler byggeplass og prosjektet har
 * byggeplasser; «Hele prosjektet» bare når prosjektet ikke har noen.
 */
const her = dirname(fileURLToPath(import.meta.url));
const les = (sti: string) => readFileSync(join(her, sti), "utf-8").replace(/\s+/g, " ");

describe("byggeplass-chip uten byggeplass", () => {
  it("oppgavedetaljen viser «—» når prosjektet har byggeplasser", () => {
    const kilde = les("../../app/dashbord/[prosjektId]/oppgaver/[oppgaveId]/page.tsx");
    expect(kilde).toMatch(
      /oppgaveLokasjon\.bygningNavn \?\? \(\(\(bygningerRå as unknown\[\] \| undefined\)\?\.length \?\? 0\) > 0 \? "—" : t\("kontekstChip\.heleProsjektet"\)\)/,
    );
    // Negativkontroll: den gamle fallbacken rett til «Hele prosjektet» er borte.
    expect(kilde).not.toMatch(/bygningNavn \?\? t\("kontekstChip\.heleProsjektet"\)/);
  });

  it("sjekklistedetaljen bruker samme regel", () => {
    const kilde = les("../../app/dashbord/[prosjektId]/sjekklister/[sjekklisteId]/page.tsx");
    expect(kilde).toMatch(/byggeplass\?\.name \?\? \(bygninger\.length > 0 \? "—" : t\("kontekstChip\.heleProsjektet"\)\)/);
  });
});
