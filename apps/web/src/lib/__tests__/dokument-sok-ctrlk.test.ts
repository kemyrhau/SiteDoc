import { describe, it, expect } from "vitest";
import {
  MAKS_DOK_TREFF,
  MIN_DOK_SOK_TEGN,
  skalSokeDokumenter,
  slaaSammenPrDokument,
  leserHref,
  seAlleHref,
} from "../dokument-sok-ctrlk";

// SØK-2: dokumentgruppa i Ctrl K. Tilgang avgjøres på serveren; her låses kun klientreglene.

const P = "11111111-1111-4111-8111-111111111111";

describe("skalSokeDokumenter", () => {
  it("ingen kall utenfor et prosjekt", () => {
    expect(skalSokeDokumenter(null, "adgangskontroll")).toBe(false);
    expect(skalSokeDokumenter(undefined, "adgangskontroll")).toBe(false);
    expect(skalSokeDokumenter("", "adgangskontroll")).toBe(false);
  });

  it(`ingen kall under ${MIN_DOK_SOK_TEGN} tegn (trimmet)`, () => {
    expect(skalSokeDokumenter(P, "ad")).toBe(false);
    expect(skalSokeDokumenter(P, "  ad  ")).toBe(false);
    expect(skalSokeDokumenter(P, "adg")).toBe(true);
  });
});

describe("slaaSammenPrDokument", () => {
  it(`ett treff pr. dokument (første = beste), maks ${MAKS_DOK_TREFF}, serverens rekkefølge`, () => {
    const inn = [
      { id: "a1", documentId: "A" },
      { id: "a2", documentId: "A" },
      { id: "b1", documentId: "B" },
      { id: "a3", documentId: "A" },
      { id: "c1", documentId: "C" },
      { id: "d1", documentId: "D" },
      { id: "e1", documentId: "E" },
      { id: "f1", documentId: "F" },
    ];
    expect(slaaSammenPrDokument(inn).map((t) => t.id)).toEqual(["a1", "b1", "c1", "d1", "e1"]);
  });

  it("tom inn → tom ut", () => {
    expect(slaaSammenPrDokument([])).toEqual([]);
  });
});

describe("lenker", () => {
  it("treff → leseren med søkeordet markert", () => {
    expect(leserHref(P, "dok-1", " adgangs kontroll ")).toBe(
      `/dashbord/${P}/dokumenter/dok-1/les?highlight=adgangs%20kontroll`,
    );
  });

  it("«Se alle» → Dokumentsøk med ?q", () => {
    expect(seAlleHref(P, "påløper & dagmulkt")).toBe(`/dashbord/${P}/sok?q=p%C3%A5l%C3%B8per%20%26%20dagmulkt`);
  });
});
