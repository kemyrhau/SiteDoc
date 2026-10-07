import { describe, it, expect } from "vitest";
import { byggSitedocGrupper, grupperFirmaMaler, type KildeKapittel } from "../arkiv-fane-filter";

/**
 * §7b pkt 2 (fabel 2026-10-07): gruppetittelen viser kun standardens NAVN, aldri koden.
 * Koden («NS3420-K») bærer NS-nummeret; med den i tittelen fremstår treet som standarden.
 */
const KODE = "NS3420-K";
const NAVN = "Anleggsgartnerarbeider";

describe("standardtittel uten kode", () => {
  it("SiteDoc-arkivet: tittel = navn, uten kode", () => {
    const grupper = byggSitedocGrupper(
      [
        {
          kode: KODE,
          navn: NAVN,
          kapitler: [
            {
              kode: "KB",
              navn: "Kapittel",
              maler: [{ id: "m1", kategori: "sjekkliste", domene: "kvalitet", referanse: "KB1" }],
            },
          ],
        },
      ],
      undefined,
    );
    expect(grupper[0]!.tittel).toBe(NAVN);
    expect(grupper[0]!.tittel).not.toContain(KODE);
    expect(grupper[0]!.key).toBe(KODE); // nøkkelen er fortsatt koden (stabil identitet)
  });

  it("firmaarkivet: lånt mal grupperes med navn, uten kode", () => {
    const indeks = new Map<string, KildeKapittel>([
      [
        "b1",
        {
          standardKode: KODE,
          standardNavn: NAVN,
          standardSort: 1,
          kapittelKode: "KB",
          kapittelNavn: "Kapittel",
          kapittelSort: 1,
          referanse: "KB1",
        },
      ],
    ]);
    const grupper = grupperFirmaMaler([{ id: "f1", laantFraBibliotekMalId: "b1" }], indeks, "Egenlagde");
    expect(grupper[0]!.tittel).toBe(NAVN);
    expect(grupper[0]!.tittel).not.toContain(KODE);
  });
});
