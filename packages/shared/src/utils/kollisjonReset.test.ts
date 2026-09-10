import { describe, it, expect } from "vitest";
import { løsKollisjonsVerdi, verdiErLik } from "./kollisjonReset";

describe("verdiErLik", () => {
  it("primitiver", () => {
    expect(verdiErLik("A", "A")).toBe(true);
    expect(verdiErLik("A", "B")).toBe(false);
    expect(verdiErLik(3, 3)).toBe(true);
  });

  it("null og undefined normaliseres likt", () => {
    expect(verdiErLik(null, undefined)).toBe(true);
    expect(verdiErLik(undefined, null)).toBe(true);
  });

  it("arrays (repeater-rader) sammenlignes strukturelt", () => {
    expect(verdiErLik([{ a: 1 }], [{ a: 1 }])).toBe(true);
    expect(verdiErLik([{ a: 1 }], [{ a: 2 }])).toBe(false);
  });
});

describe("løsKollisjonsVerdi", () => {
  it("rent felt (ikke rørt under flight) → server-vinneren vises", () => {
    // naavaerende == sendt: brukeren ser ikke på feltet → server-verdi.
    const res = løsKollisjonsVerdi({ naavaerende: "min", sendt: "min", server: "annen" });
    expect(res).toEqual({ verdi: "annen", reDirty: false });
  });

  it("dirty felt (endret under flight) → brukerens tekst står", () => {
    // naavaerende != sendt: tegn skrevet mens lagringen var i luften bevares.
    const res = løsKollisjonsVerdi({ naavaerende: "min ny", sendt: "min", server: "annen" });
    expect(res).toEqual({ verdi: "min ny", reDirty: true });
  });

  it("manglende server-verdi (null) på rent felt → feltet tømmes til server-tilstand", () => {
    const res = løsKollisjonsVerdi({ naavaerende: "min", sendt: "min", server: null });
    expect(res).toEqual({ verdi: null, reDirty: false });
  });

  it("manglende server-verdi men re-dirty → brukerens tekst står likevel", () => {
    const res = løsKollisjonsVerdi({ naavaerende: "min ny", sendt: "min", server: null });
    expect(res).toEqual({ verdi: "min ny", reDirty: true });
  });

  it("tilbake til sendt verdi under flight teller IKKE som re-dirty → server vises", () => {
    // Skrev noe og angret tilbake til sendt verdi: samme som opprinnelig design.
    const res = løsKollisjonsVerdi({ naavaerende: "min", sendt: "min", server: "annen" });
    expect(res.reDirty).toBe(false);
  });

  it("flere kolliderte felt samtidig — hvert felt avgjøres uavhengig", () => {
    const kollisjoner = [
      { feltId: "f1", naavaerende: "a", sendt: "a", server: "srv-a" }, // rent → server
      { feltId: "f2", naavaerende: "b2", sendt: "b", server: "srv-b" }, // dirty → behold
      { feltId: "f3", naavaerende: ["x"], sendt: ["x"], server: ["y"] }, // rent array → server
    ];
    const resultat = kollisjoner.map((k) => ({
      feltId: k.feltId,
      ...løsKollisjonsVerdi(k),
    }));
    expect(resultat).toEqual([
      { feltId: "f1", verdi: "srv-a", reDirty: false },
      { feltId: "f2", verdi: "b2", reDirty: true },
      { feltId: "f3", verdi: ["y"], reDirty: false },
    ]);
  });
});
