import { describe, it, expect } from "vitest";
import { ekspanderEndring, kanonisk, type KolonneDef } from "@sitedoc/pdf";

/**
 * Rent lag — lesbar diff-transform for endringsloggen (F1, punkt 1–3).
 * Ingen DB: bare strengen inn (lagret `oldValue`/`newValue`) → lesbare rader ut.
 */

const KOL: KolonneDef[] = [
  { id: "c1", label: "Beskrivelse" },
  { id: "c2", label: "Kommentar" },
  { id: "c3", label: "Bilde" },
];

// Hjelpere som speiler lagringsformatet: verdier lagres som JSON.stringify(verdi).
const s = (v: unknown) => JSON.stringify(v);
const celle = (verdi: unknown, ekstra: Record<string, unknown> = {}) => ({ verdi, kommentar: "", vedlegg: [], ...ekstra });
const bilde = (filnavn: string) => ({ id: filnavn, type: "bilde", url: `/uploads/${filnavn}`, filnavn });

describe("kanonisk — nøkkelsortering, uendret array-rekkefølge", () => {
  it("samme innhold ulik nøkkelrekkefølge → lik streng", () => {
    expect(kanonisk({ b: 1, a: 2 })).toBe(kanonisk({ a: 2, b: 1 }));
  });
  it("nestet nøkkelsortering", () => {
    expect(kanonisk({ x: { q: 1, p: 2 } })).toBe(kanonisk({ x: { p: 2, q: 1 } }));
  });
  it("array-rekkefølge BEVARES (betydningsbærende)", () => {
    expect(kanonisk([1, 2])).not.toBe(kanonisk([2, 1]));
  });
});

describe("ekspanderEndring — primitiver + no-op (punkt 1)", () => {
  it("primitiv streng-endring → ren tekst uten JSON-anførselstegn", () => {
    const ut = ekspanderEndring("Tilstand", s("OK"), s("Ikke OK"));
    expect(ut).toEqual([{ felt: "Tilstand", fraVerdi: "OK", tilVerdi: "Ikke OK" }]);
  });

  it("kun nøkkelrekkefølge endret → ingen rad (kanonisk no-op — vær-radene)", () => {
    const vaerA = s({ temp: "14.9°C", wind: "0.76 m/s", kilde: "automatisk", conditions: "Lett yr" });
    const vaerB = s({ temp: "14.9°C", conditions: "Lett yr", wind: "0.76 m/s", kilde: "automatisk" });
    expect(ekspanderEndring("Vær", vaerA, vaerB)).toEqual([]);
  });

  it("tom → utfylt (null oldValue) → én rad", () => {
    expect(ekspanderEndring("Notat", null, s("Hei"))).toEqual([
      { felt: "Notat", fraVerdi: null, tilVerdi: "Hei" },
    ]);
  });

  it("list_multi (array av primitiver) → komma-liste", () => {
    const ut = ekspanderEndring("Valg", s(["OK"]), s(["OK", "Delvis"]));
    expect(ut).toEqual([{ felt: "Valg", fraVerdi: "OK", tilVerdi: "OK, Delvis" }]);
  });
});

describe("ekspanderEndring — bilde-/vedleggsverdi (punkt 3, filnavn beholdt)", () => {
  it("bilde-array → «N bilder (filnavn)» med filnavn", () => {
    const ut = ekspanderEndring("Vedlegg", s([bilde("a.jpg")]), s([bilde("a.jpg"), bilde("IMG_4821.jpg")]));
    expect(ut).toHaveLength(1);
    expect(ut[0]!.fraVerdi).toBe("1 bilde (a.jpg)");
    expect(ut[0]!.tilVerdi).toBe("2 bilder (a.jpg, IMG_4821.jpg)");
  });

  it("lang filnavn-liste trunkeres med «+N flere»", () => {
    const bilder = ["a", "b", "c", "d", "e", "f"].map((n) => bilde(`${n}.jpg`));
    const ut = ekspanderEndring("Vedlegg", null, s(bilder));
    expect(ut[0]!.tilVerdi).toContain("+2 flere");
  });
});

describe("normalisering — signert-URL-query ignoreres (rotårsak-symptom)", () => {
  const medSig = (exp: string, sig: string) =>
    s([{ c3: celle([{ id: "a", type: "bilde", filnavn: "a.jpg", url: `/uploads/a.jpg?exp=${exp}&sig=${sig}` }]) }]);

  it("kun signatur endret på bilde-URL → ingen rad (repeater-celle)", () => {
    expect(ekspanderEndring("K", medSig("100", "AAA"), medSig("200", "BBB"), KOL)).toEqual([]);
  });

  it("kun signatur endret → ingen rad (ikke-repeater bilde-array)", () => {
    const a = s([{ id: "a", type: "bilde", filnavn: "a.jpg", url: "/uploads/a.jpg?exp=1&sig=X" }]);
    const b = s([{ id: "a", type: "bilde", filnavn: "a.jpg", url: "/uploads/a.jpg?exp=9&sig=Y" }]);
    expect(ekspanderEndring("Vedlegg", a, b)).toEqual([]);
  });

  it("ekte bildebytte (ulik sti, ikke bare query) → én rad", () => {
    const a = s([{ c3: celle([{ id: "a", type: "bilde", filnavn: "a.jpg", url: "/uploads/a.jpg?sig=X" }]) }]);
    const b = s([{ c3: celle([{ id: "b", type: "bilde", filnavn: "b.jpg", url: "/uploads/b.jpg?sig=X" }]) }]);
    expect(ekspanderEndring("K", a, b, KOL)).toHaveLength(1);
  });
});

describe("ekspanderEndring — repeater celle-diff (punkt 2)", () => {
  const rad = (b: string, k: string) => ({ c1: celle(b), c2: celle(k) });

  it("endret celle → «Rad N — kolonnenavn», kun den endrede cellen", () => {
    const fra = s([rad("Vegg", "tørr")]);
    const til = s([rad("Vegg", "fuktig")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut).toEqual([{ felt: "Rad 1 — Kommentar", fraVerdi: "tørr", tilVerdi: "fuktig" }]);
  });

  it("to endrede celler i samme rad → to rader, kolonne-rekkefølge", () => {
    const fra = s([rad("Vegg", "tørr")]);
    const til = s([rad("Tak", "fuktig")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut.map((r) => r.felt)).toEqual(["Rad 1 — Beskrivelse", "Rad 1 — Kommentar"]);
  });

  it("lagt til rad → ÉN oppsummeringslinje (ikke per-celle)", () => {
    const fra = s([rad("Vegg", "tørr")]);
    const til = s([rad("Vegg", "tørr"), { c1: celle("Gulv"), c3: celle([bilde("x.jpg"), bilde("y.jpg")]) }]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut).toHaveLength(1);
    expect(ut[0]!.felt).toBe("Rad 2 (lagt til)");
    expect(ut[0]!.tilVerdi).toBe("2 felt utfylt, 2 bilder");
  });

  it("fjernet rad → ÉN oppsummeringslinje", () => {
    const fra = s([rad("Vegg", "tørr"), rad("Tak", "ok")]);
    const til = s([rad("Vegg", "tørr")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut).toEqual([{ felt: "Rad 2 (fjernet)", fraVerdi: "2 felt utfylt", tilVerdi: null }]);
  });

  it("nyfylt 5-rads repeater → 5 rader (ikke femten) — rad-add-vedtaket", () => {
    const rader = Array.from({ length: 5 }, (_, i) => ({
      c1: celle(`Punkt ${i + 1}`),
      c2: celle("ok"),
      c3: celle([bilde(`b${i}.jpg`)]),
    }));
    const ut = ekspanderEndring("Kontrollpunkter", null, s(rader), KOL);
    expect(ut).toHaveLength(5);
    expect(ut.every((r) => r.felt.endsWith("(lagt til)"))).toBe(true);
  });

  it("uendret repeater (kun nøkkelrekkefølge i celler) → ingen rader", () => {
    const fra = s([{ c1: { verdi: "x", kommentar: "", vedlegg: [] } }]);
    const til = s([{ c1: { vedlegg: [], kommentar: "", verdi: "x" } }]);
    expect(ekspanderEndring("Kontrollpunkter", fra, til, KOL)).toEqual([]);
  });

  it("ukjent kolonne-id faller tilbake til «Kolonne N» (ikke UUID/_)", () => {
    const fra = s([{ ukjent: celle("a") }]);
    const til = s([{ ukjent: celle("b") }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(ut[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("tom kolonne-label faller tilbake til «Kolonne N»", () => {
    const fra = s([{ c1: celle("a") }]);
    const til = s([{ c1: celle("b") }]);
    const ut = ekspanderEndring("K", fra, til, [{ id: "c1", label: "  " }]);
    expect(ut[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("bildeliste gjentas IKKE når bare teksten endret seg (vis kun ulikt)", () => {
    const bilder = [bilde("a.jpg"), bilde("b.jpg")];
    const fra = s([{ c1: { verdi: "gammel", vedlegg: bilder, kommentar: "" } }]);
    const til = s([{ c1: { verdi: "ny", vedlegg: bilder, kommentar: "" } }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(ut).toEqual([{ felt: "Rad 1 — Beskrivelse", fraVerdi: "gammel", tilVerdi: "ny" }]);
    // Bildelisten skal ikke dukke opp på noen av sidene når den er uendret.
    expect(ut[0]!.fraVerdi).not.toContain("bilde");
    expect(ut[0]!.tilVerdi).not.toContain("bilde");
  });

  it("når bildelisten FAKTISK endres vises den på begge sider", () => {
    const fra = s([{ c1: { verdi: "x", vedlegg: [bilde("a.jpg")], kommentar: "" } }]);
    const til = s([{ c1: { verdi: "x", vedlegg: [bilde("a.jpg"), bilde("b.jpg")], kommentar: "" } }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(ut[0]!.fraVerdi).toBe("1 bilde (a.jpg)");
    expect(ut[0]!.tilVerdi).toBe("2 bilder (a.jpg, b.jpg)");
  });

  it("aldri barn-UUID eller uploads-sti i utdata", () => {
    const fra = s([{ "cfa02a84-uuid": celle([bilde("a.png")]) }]);
    const til = s([{ "cfa02a84-uuid": celle([bilde("a.png"), bilde("b.png")]) }]);
    const ut = ekspanderEndring("K", fra, til, [{ id: "cfa02a84-uuid", label: "Foto" }]);
    const json = JSON.stringify(ut);
    expect(json).not.toContain("/uploads");
    expect(json).not.toContain("uuid");
  });
});
