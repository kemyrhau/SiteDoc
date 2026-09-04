import { describe, it, expect } from "vitest";
import { ekspanderEndring, kanonisk, likForDiff, segmenterTilTekst, type KolonneDef, type DiffRad } from "@sitedoc/pdf";

/**
 * Rent lag — lesbar diff-transform for endringsloggen (F1, punkt 1–3).
 * Ingen DB: bare strengen inn (lagret `oldValue`/`newValue`) → lesbare rader ut.
 */

const KOL: KolonneDef[] = [
  { id: "c1", label: "Beskrivelse" },
  { id: "c2", label: "Kommentar" },
  { id: "c3", label: "Bilde" },
];

// Verdiene er segmenter (ord-diff). `flat` plukker ut ren tekst for likhet.
const flat = (r: DiffRad) => ({
  felt: r.felt,
  fraVerdi: segmenterTilTekst(r.fraVerdi),
  tilVerdi: segmenterTilTekst(r.tilVerdi),
});
const tekst = (segs: DiffRad["fraVerdi"]) => segmenterTilTekst(segs);

// Hjelpere som speiler lagringsformatet: verdier lagres som JSON.stringify(verdi).
const s = (v: unknown) => JSON.stringify(v);
const celle = (verdi: unknown, ekstra: Record<string, unknown> = {}) => ({ verdi, kommentar: "", vedlegg: [], ...ekstra });
const bilde = (filnavn: string) => ({ id: filnavn, type: "bilde", url: `/uploads/${filnavn}`, filnavn });

// 🔴 PRODUKSJONSFORM: repeater-rader lagres innpakket som { _radId, felter }
// (rad-id-vedtak 2026-08-22). `sRep` pakker inn slik prod gjør; `sRepFlat` er den
// gamle rå/flate formen. Innpakket testes FØRST og er standard under — en test mot
// en form produksjonen ikke bruker måler ingenting (fire bugs sto to døgn bak en
// grønn gate fordi repeater-testene kun brukte flat form, mens prod bruker innpakket).
const sRep = (rader: Record<string, unknown>[]) => s(rader.map((felter, i) => ({ _radId: `r${i + 1}`, felter })));
const sRepFlat = (rader: Record<string, unknown>[]) => s(rader);

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
    expect(ut.map(flat)).toEqual([{ felt: "Tilstand", fraVerdi: "OK", tilVerdi: "Ikke OK" }]);
  });

  it("kun nøkkelrekkefølge endret → ingen rad (kanonisk no-op — vær-radene)", () => {
    const vaerA = s({ temp: "14.9°C", wind: "0.76 m/s", kilde: "automatisk", conditions: "Lett yr" });
    const vaerB = s({ temp: "14.9°C", conditions: "Lett yr", wind: "0.76 m/s", kilde: "automatisk" });
    expect(ekspanderEndring("Vær", vaerA, vaerB)).toEqual([]);
  });

  it("tom → utfylt (null oldValue) → én rad", () => {
    expect(ekspanderEndring("Notat", null, s("Hei")).map(flat)).toEqual([
      { felt: "Notat", fraVerdi: null, tilVerdi: "Hei" },
    ]);
  });

  it("list_multi (array av primitiver) → komma-liste", () => {
    const ut = ekspanderEndring("Valg", s(["OK"]), s(["OK", "Delvis"]));
    expect(ut.map(flat)).toEqual([{ felt: "Valg", fraVerdi: "OK", tilVerdi: "OK, Delvis" }]);
  });
});

describe("ekspanderEndring — bilde-/vedleggsverdi (punkt 3, filnavn beholdt)", () => {
  it("bilde-array → «N bilder (filnavn)» med filnavn", () => {
    const ut = ekspanderEndring("Vedlegg", s([bilde("a.jpg")]), s([bilde("a.jpg"), bilde("IMG_4821.jpg")]));
    expect(ut).toHaveLength(1);
    expect(tekst(ut[0]!.fraVerdi)).toBe("1 bilde (a.jpg)");
    expect(tekst(ut[0]!.tilVerdi)).toBe("2 bilder (a.jpg, IMG_4821.jpg)");
  });

  it("lang filnavn-liste trunkeres med «+N flere»", () => {
    const bilder = ["a", "b", "c", "d", "e", "f"].map((n) => bilde(`${n}.jpg`));
    const ut = ekspanderEndring("Vedlegg", null, s(bilder));
    expect(tekst(ut[0]!.tilVerdi)).toContain("+2 flere");
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
    const fra = sRep([rad("Vegg", "tørr")]);
    const til = sRep([rad("Vegg", "fuktig")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut.map(flat)).toEqual([{ felt: "Rad 1 — Kommentar", fraVerdi: "tørr", tilVerdi: "fuktig" }]);
  });

  it("to endrede celler i samme rad → to rader, kolonne-rekkefølge", () => {
    const fra = sRep([rad("Vegg", "tørr")]);
    const til = sRep([rad("Tak", "fuktig")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut.map((r) => r.felt)).toEqual(["Rad 1 — Beskrivelse", "Rad 1 — Kommentar"]);
  });

  it("lagt til rad → ÉN oppsummeringslinje (ikke per-celle)", () => {
    const fra = sRep([rad("Vegg", "tørr")]);
    const til = sRep([rad("Vegg", "tørr"), { c1: celle("Gulv"), c3: celle([bilde("x.jpg"), bilde("y.jpg")]) }]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut).toHaveLength(1);
    expect(ut[0]!.felt).toBe("Rad 2 (lagt til)");
    expect(tekst(ut[0]!.tilVerdi)).toBe("2 felt utfylt, 2 bilder");
  });

  it("fjernet rad → ÉN oppsummeringslinje", () => {
    const fra = sRep([rad("Vegg", "tørr"), rad("Tak", "ok")]);
    const til = sRep([rad("Vegg", "tørr")]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut.map(flat)).toEqual([{ felt: "Rad 2 (fjernet)", fraVerdi: "2 felt utfylt", tilVerdi: null }]);
  });

  it("nyfylt 5-rads repeater → 5 rader (ikke femten) — rad-add-vedtaket", () => {
    const rader = Array.from({ length: 5 }, (_, i) => ({
      c1: celle(`Punkt ${i + 1}`),
      c2: celle("ok"),
      c3: celle([bilde(`b${i}.jpg`)]),
    }));
    const ut = ekspanderEndring("Kontrollpunkter", null, sRep(rader), KOL);
    expect(ut).toHaveLength(5);
    expect(ut.every((r) => r.felt.endsWith("(lagt til)"))).toBe(true);
  });

  it("uendret repeater (kun nøkkelrekkefølge i celler) → ingen rader", () => {
    const fra = sRep([{ c1: { verdi: "x", kommentar: "", vedlegg: [] } }]);
    const til = sRep([{ c1: { vedlegg: [], kommentar: "", verdi: "x" } }]);
    expect(ekspanderEndring("Kontrollpunkter", fra, til, KOL)).toEqual([]);
  });

  // Funn 3 (2026-08-21): drawing_position-markør i repeater-celle. Målt på BEF-002:
  // markør-verdien er {drawingId,positionX,positionY,drawingName}. Uten render-casen
  // traff den «ukjent objekt → null» → ekte posisjonsendring viste «Ikke utfylt →
  // Ikke utfylt». Fiks i lesbarVerdi (endringsdiff.ts); no-op håndteres av rå-diff.
  describe("drawing_position i repeater-celle (funn 3)", () => {
    const DP: KolonneDef[] = [{ id: "dp", label: "Posisjon i tegning" }];
    const mrk = (x: number, y: number) => celle({ drawingId: "d1", drawingName: "Z-20-01", positionX: x, positionY: y });

    it("ENDRET markør → lesbar posisjon, IKKE «Ikke utfylt → Ikke utfylt»", () => {
      const ut = ekspanderEndring("Befaring", sRep([{ dp: mrk(60.65, 75.2) }]), sRep([{ dp: mrk(84.04, 56.63) }]), DP);
      expect(ut.map(flat)).toEqual([
        { felt: "Rad 1 — Posisjon i tegning", fraVerdi: "Z-20-01 (60,7 %, 75,2 %)", tilVerdi: "Z-20-01 (84,0 %, 56,6 %)" },
      ]);
    });

    it("IDENTISK markør → ingen rad (rå-diff filtrerer no-op)", () => {
      const ut = ekspanderEndring("Befaring", sRep([{ dp: mrk(60.65, 75.2) }]), sRep([{ dp: mrk(60.65, 75.2) }]), DP);
      expect(ut).toEqual([]);
    });

    it("markør fjernet (satt → tom) → «Z-20-01 (…) → Ikke utfylt»", () => {
      const ut = ekspanderEndring("Befaring", sRep([{ dp: mrk(60.65, 75.2) }]), sRep([{ dp: celle(null) }]), DP);
      expect(ut.map(flat)).toEqual([
        { felt: "Rad 1 — Posisjon i tegning", fraVerdi: "Z-20-01 (60,7 %, 75,2 %)", tilVerdi: null },
      ]);
    });
  });

  it("ukjent kolonne-id faller tilbake til «Kolonne N» (ikke UUID/_)", () => {
    const fra = sRep([{ ukjent: celle("a") }]);
    const til = sRep([{ ukjent: celle("b") }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(ut[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("tom kolonne-label faller tilbake til «Kolonne N»", () => {
    const fra = sRep([{ c1: celle("a") }]);
    const til = sRep([{ c1: celle("b") }]);
    const ut = ekspanderEndring("K", fra, til, [{ id: "c1", label: "  " }]);
    expect(ut[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("plassholder-label «_» faller tilbake til «Kolonne N» (overlever trim, ingen alfanum)", () => {
    const fra = sRep([{ c1: celle("a") }]);
    const til = sRep([{ c1: celle("b") }]);
    const ut = ekspanderEndring("K", fra, til, [{ id: "c1", label: "_" }]);
    expect(ut[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("bildeliste gjentas IKKE når bare teksten endret seg (vis kun ulikt)", () => {
    const bilder = [bilde("a.jpg"), bilde("b.jpg")];
    const fra = sRep([{ c1: { verdi: "gammel", vedlegg: bilder, kommentar: "" } }]);
    const til = sRep([{ c1: { verdi: "ny", vedlegg: bilder, kommentar: "" } }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(ut.map(flat)).toEqual([{ felt: "Rad 1 — Beskrivelse", fraVerdi: "gammel", tilVerdi: "ny" }]);
    // Bildelisten skal ikke dukke opp på noen av sidene når den er uendret.
    expect(tekst(ut[0]!.fraVerdi)).not.toContain("bilde");
    expect(tekst(ut[0]!.tilVerdi)).not.toContain("bilde");
  });

  it("når bildelisten FAKTISK endres vises den på begge sider", () => {
    const fra = sRep([{ c1: { verdi: "x", vedlegg: [bilde("a.jpg")], kommentar: "" } }]);
    const til = sRep([{ c1: { verdi: "x", vedlegg: [bilde("a.jpg"), bilde("b.jpg")], kommentar: "" } }]);
    const ut = ekspanderEndring("K", fra, til, KOL);
    expect(tekst(ut[0]!.fraVerdi)).toBe("1 bilde (a.jpg)");
    expect(tekst(ut[0]!.tilVerdi)).toBe("2 bilder (a.jpg, b.jpg)");
  });

  it("aldri barn-UUID eller uploads-sti i utdata", () => {
    const fra = sRep([{ "cfa02a84-uuid": celle([bilde("a.png")]) }]);
    const til = sRep([{ "cfa02a84-uuid": celle([bilde("a.png"), bilde("b.png")]) }]);
    const ut = ekspanderEndring("K", fra, til, [{ id: "cfa02a84-uuid", label: "Foto" }]);
    const json = JSON.stringify(ut);
    expect(json).not.toContain("/uploads");
    expect(json).not.toContain("uuid");
  });

  // Bakoverkompat: eldre rader ble lagret FLATT ({ feltId: celle }) uten { _radId,
  // felter }-wrapper. Begge former må gi samme lesbare rad — feltKartFraRad velger.
  describe("flat legacy-form (bakoverkompatibilitet)", () => {
    it("endret celle i flat rad → «Rad N — kolonnenavn» (som innpakket)", () => {
      const fra = sRepFlat([{ c1: celle("Vegg"), c2: celle("tørr") }]);
      const til = sRepFlat([{ c1: celle("Vegg"), c2: celle("fuktig") }]);
      const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
      expect(ut.map(flat)).toEqual([{ felt: "Rad 1 — Kommentar", fraVerdi: "tørr", tilVerdi: "fuktig" }]);
    });

    it("fjernet flat rad → ÉN oppsummeringslinje", () => {
      const fra = sRepFlat([{ c1: celle("Vegg") }, { c1: celle("Tak") }]);
      const til = sRepFlat([{ c1: celle("Vegg") }]);
      const ut = ekspanderEndring("K", fra, til, KOL);
      expect(ut.map(flat)).toEqual([{ felt: "Rad 2 (fjernet)", fraVerdi: "1 felt utfylt", tilVerdi: null }]);
    });
  });
});

describe("regresjon — prod-symptomet «Rad N — Kolonne 2 til «Ikke utfylt»»", () => {
  // Målt på prod 2026-09-04: innpakket rad ga feil kolonnenavn (posisjon) OG tom
  // celle-diff, fordi diffRepeater leste { _radId, felter } som om cellene lå på
  // raden. Ett symptom, én fiks (feltKartFraRad). Både «fra» og «til» skal nå med.
  it("innpakket celle-endring → riktig kolonnenavn + BÅDE fra og til", () => {
    const fra = s([{ _radId: "r1", felter: { c2: celle("tørr") } }]);
    const til = s([{ _radId: "r1", felter: { c2: celle("fuktig") } }]);
    const ut = ekspanderEndring("Kontrollpunkter", fra, til, KOL);
    expect(ut.map(flat)).toEqual([{ felt: "Rad 1 — Kommentar", fraVerdi: "tørr", tilVerdi: "fuktig" }]);
    // Aldri «Kolonne 2», aldri «felter» eller «_radId» i utdata.
    expect(JSON.stringify(ut)).not.toMatch(/Kolonne 2|felter|_radId/);
  });
});

describe("bar UUID-verdi skjules (funn 3 — historisk tegningsreferanse)", () => {
  const UUID = "7a77c475-c391-48fa-a5fc-233c497a254e";

  it("bar UUID som celle-verdi → «(tegningsreferanse)», ALDRI rå UUID", () => {
    const fra = s([{ _radId: "r1", felter: { c1: celle(null) } }]);
    const til = s([{ _radId: "r1", felter: { c1: celle(UUID) } }]);
    const ut = ekspanderEndring("Befaring", fra, til, KOL);
    expect(ut.map(flat)).toEqual([{ felt: "Rad 1 — Beskrivelse", fraVerdi: null, tilVerdi: "(tegningsreferanse)" }]);
    expect(JSON.stringify(ut)).not.toContain(UUID);
  });

  it("bar UUID som topp-nivå-feltverdi skjules også", () => {
    const ut = ekspanderEndring("Tegning", s(""), s(UUID));
    expect(tekst(ut[0]!.tilVerdi)).toBe("(tegningsreferanse)");
  });

  it("komplett markør (ny data) er UPÅVIRKET — viser navn + posisjon", () => {
    const fra = s({ drawingId: UUID, drawingName: "Z-20-01", positionX: 60.65, positionY: 75.2 });
    const til = s({ drawingId: UUID, drawingName: "Z-20-01", positionX: 84.04, positionY: 56.63 });
    const ut = ekspanderEndring("Posisjon", fra, til);
    expect(tekst(ut[0]!.tilVerdi)).toBe("Z-20-01 (84,0 %, 56,6 %)");
  });
});

describe("ord-nivå diff — endrede ord markeres (endret: true)", () => {
  // Endrede ord = de i segmentene med endret:true, sammenslått.
  const endredeOrd = (segs: DiffRad["fraVerdi"]) =>
    (segs ?? []).filter((sg) => sg.endret).map((sg) => sg.tekst.trim()).filter(Boolean);

  it("ett ord byttet i et avsnitt → kun det ordet markeres, resten uendret", () => {
    const fra = s("Fundamentet er støpt med press og herdet over natten");
    const til = s("Fundamentet er støpt med freseasfalt og herdet over natten");
    const [rad] = ekspanderEndring("Beskrivelse", fra, til);
    expect(endredeOrd(rad!.fraVerdi)).toEqual(["press"]);
    expect(endredeOrd(rad!.tilVerdi)).toEqual(["freseasfalt"]);
    // Hele teksten er fortsatt intakt (segmentene rekonstruerer originalen).
    expect(tekst(rad!.tilVerdi)).toBe("Fundamentet er støpt med freseasfalt og herdet over natten");
  });

  it("BEF-001-sekvensen: press → freseasfalt → fresemasse (to separate endringer)", () => {
    const e1 = ekspanderEndring("B", s("legges press her"), s("legges freseasfalt her"))[0]!;
    const e2 = ekspanderEndring("B", s("legges freseasfalt her"), s("legges fresemasse her"))[0]!;
    expect(endredeOrd(e1.tilVerdi)).toEqual(["freseasfalt"]);
    expect(endredeOrd(e2.tilVerdi)).toEqual(["fresemasse"]);
  });

  it("lagt-til verdi (tom → utfylt) markeres ikke internt (alt er nytt)", () => {
    const [rad] = ekspanderEndring("Notat", null, s("helt ny tekst"));
    expect(endredeOrd(rad!.tilVerdi)).toEqual([]);
    expect(tekst(rad!.tilVerdi)).toBe("helt ny tekst");
  });
});

describe("tomhet — tom→tom er ingen endring, reell tømming er det (endringslogg-støy)", () => {
  it("likForDiff: alle tomhets-former er like (null · \"\" · [] · {} · fraværende)", () => {
    expect(likForDiff("", null)).toBe(true);
    expect(likForDiff({}, [])).toBe(true);
    expect(likForDiff([], undefined)).toBe(true);
    expect(likForDiff({ verdi: "" }, {})).toBe(true);
    expect(likForDiff(celle(""), undefined)).toBe(true);
    expect(likForDiff(celle(null), celle(""))).toBe(true);
  });

  it("likForDiff: reell verdi er IKKE lik tom (tømming spores)", () => {
    expect(likForDiff("Ja", "")).toBe(false);
    expect(likForDiff({ verdi: "Ja" }, { verdi: "" })).toBe(false);
    expect(likForDiff(celle("Ja"), celle(null))).toBe(false);
  });

  it("repeater-celle tom→tom (form-drift) → INGEN rad (symptomet: «Rad N — Kolonne til Ikke utfylt»)", () => {
    // c1 uendret; c2 tom begge sider, men ulik form: {verdi:""} ↔ {}.
    const fra = sRep([{ c1: celle("x"), c2: celle("") }]);
    const til = sRep([{ c1: celle("x"), c2: {} }]);
    expect(ekspanderEndring("K", fra, til, KOL)).toEqual([]);
  });

  it("repeater-celle reell tømming (Ja→tom) → ÉN rad «→ Ikke utfylt»", () => {
    const fra = sRep([{ c1: celle("Ja") }]);
    const til = sRep([{ c1: celle(null) }]);
    expect(ekspanderEndring("K", fra, til, KOL).map(flat)).toEqual([
      { felt: "Rad 1 — Beskrivelse", fraVerdi: "Ja", tilVerdi: null },
    ]);
  });

  it("repeater-rad-identitet bevares: tom LEDENDE rad forskyver ikke «Rad 2»", () => {
    // Tom rad 1 skal ikke kollapses bort (ellers blir rad 2 → rad 1 i loggen).
    expect(
      likForDiff([{}, { c1: { verdi: "x" } }], [{ c1: { verdi: "x" } }]),
    ).toBe(false);
  });
});
