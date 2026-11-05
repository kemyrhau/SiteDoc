import { describe, it, expect } from "vitest";
import { byggInnhold } from "./innhold";
import { hentArkivCss } from "./arkiv-css";
import { renderFelt } from "../felt";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

/**
 * PDF: tekst før bilder, større svartekst, bildetekst «Bilde NN · dato tid» med ÉN
 * løpende teller for hele dokumentet (ordre 2026-11-04 (2)). Appens lagrede `bildeNr`
 * er alt dokument-løpende (`nesteBildeNr` i @sitedoc/shared) og har forrang; telleren
 * er fallback for arkiverte bilder uten nummer.
 */

const CFG: PdfConfig = { bildeBaseUrl: "", visTommeStrukturer: true };

const obj = (o: Partial<TreObjekt> & { id: string; type: string; label: string }): TreObjekt => ({
  required: false,
  config: {},
  sortOrder: 0,
  parentId: null,
  children: [],
  ...o,
});

let n = 0;
const bilde = (ekstra: Record<string, unknown> = {}) => {
  n += 1;
  return { id: `b${n}`, type: "bilde", url: `data:image/jpeg;base64,${n}`, filnavn: `IMG_${n}.jpg`, opprettet: "2026-11-03T08:56:00Z", ...ekstra };
};
const fv = (verdi: unknown, vedlegg: unknown[] = [], kommentar = ""): FeltVerdi =>
  ({ verdi, kommentar, vedlegg }) as unknown as FeltVerdi;

/** Alle «Bilde NN» i rekkefølgen de står i HTML-en. */
const nummer = (html: string) => [...html.matchAll(/Bilde (\d{2})/g)].map((m) => m[1]);

describe("rekkefølge i felt-blokka", () => {
  const felt = obj({ id: "t", type: "text_field", label: "Beskrivelse" });

  it("svarteksten står FØR bildene, kommentaren ETTER", () => {
    const html = renderFelt(felt, fv("Svarteksten her", [bilde()], "Min kommentar"), CFG);
    const iTekst = html.indexOf("Svarteksten her");
    const iBilde = html.indexOf("<img");
    const iKommentar = html.indexOf("Min kommentar");
    expect(iTekst).toBeGreaterThan(-1);
    expect(iTekst).toBeLessThan(iBilde);
    expect(iBilde).toBeLessThan(iKommentar);
  });

  it("bildeteksten står under bildet (etter <img>)", () => {
    const html = renderFelt(felt, fv("x", [bilde()]), CFG);
    expect(html.indexOf("Bilde 01")).toBeGreaterThan(html.indexOf("<img"));
  });
});

describe("bildetekst — tre tidstilstander", () => {
  const felt = obj({ id: "t", type: "text_field", label: "Beskrivelse" });

  it("opptakstidspunkt → «Bilde 01 · 03.11.2026 09:56»", () => {
    const html = renderFelt(felt, fv("x", [bilde({ opptakTidspunkt: "2026-11-03T08:56:00Z", opprettet: "2026-11-04T12:00:00Z" })]), CFG);
    expect(html).toContain("Bilde 01 · 03.11.2026 09:56");
  });

  it("historisk bilde uten feltet → opprettet-tid", () => {
    const html = renderFelt(felt, fv("x", [bilde({ opprettet: "2026-11-02T07:15:00Z" })]), CFG);
    expect(html).toContain("Bilde 01 · 02.11.2026 08:15");
  });

  it("nytt bilde uten EXIF-tid → «Tidspunkt ikke tilgjengelig»", () => {
    const html = renderFelt(felt, fv("x", [bilde({ opptakTidspunkt: null })]), CFG);
    expect(html).toContain("Bilde 01 · Tidspunkt ikke tilgjengelig");
  });
});

describe("løpenummer for hele dokumentet", () => {
  const f1 = obj({ id: "f1", type: "text_field", label: "Felt 1" });
  const f2 = obj({ id: "f2", type: "list_single", label: "Felt 2" });
  const tabell = obj({
    id: "r",
    type: "repeater",
    label: "Kontrollpunkter",
    children: [obj({ id: "k", type: "text_field", label: "Kommentar" })],
  });
  const rik = obj({
    id: "rk",
    type: "repeater",
    label: "Befaring",
    children: [
      obj({ id: "a", type: "text_field", label: "Funn" }),
      obj({ id: "v", type: "attachments", label: "Bilder" }),
    ],
  });

  it("fortsetter over to felt + tabell-repeater + radkort-repeater (01…07)", () => {
    const data: Record<string, FeltVerdi> = {
      f1: fv("a", [bilde(), bilde()]),
      f2: fv("b", [bilde()]),
      r: fv([{ k: fv("rad", [bilde()]) }]),
      rk: fv([{ a: fv("funn"), v: fv([bilde(), bilde()]) }], [bilde()]),
    };
    // Render-rekkefølge: f1(01,02) f2(03) tabell-rad(04) radkort: utenfor rader(05) → rad(06,07)
    expect(nummer(byggInnhold([f1, f2, tabell, rik], data, CFG))).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
  });

  it("repeaterens bilder fortsetter fra feltene foran (også «Registrert utenfor rader»)", () => {
    const data: Record<string, FeltVerdi> = {
      f1: fv("a", [bilde(), bilde()]),
      r: fv([{ k: fv("rad", [bilde()]) }], [bilde()]),
    };
    expect(nummer(byggInnhold([f1, tabell], data, CFG))).toEqual(["01", "02", "03", "04"]);
  });

  it("frittstående vedleggsfelt teller med", () => {
    const vedlegg = obj({ id: "att", type: "attachments", label: "Vedlegg" });
    const data: Record<string, FeltVerdi> = {
      f1: fv("a", [bilde()]),
      att: fv([bilde(), bilde()]),
    };
    expect(nummer(byggInnhold([f1, vedlegg], data, CFG))).toEqual(["01", "02", "03"]);
  });

  it("lagret bildeNr fra appen har forrang", () => {
    const data: Record<string, FeltVerdi> = {
      f1: fv("a", [bilde({ bildeNr: 4 }), bilde({ bildeNr: 2 })]),
      r: fv([{ k: fv("rad", [bilde({ bildeNr: 9 })]) }]),
    };
    expect(nummer(byggInnhold([f1, tabell], data, CFG))).toEqual(["04", "02", "09"]);
  });

  it("hver byggInnhold-kjøring starter på 01", () => {
    const data = { f1: fv("a", [bilde()]) };
    expect(nummer(byggInnhold([f1], data, CFG))).toEqual(["01"]);
    expect(nummer(byggInnhold([f1], data, CFG))).toEqual(["01"]);
  });
});

describe("RETUR 1 — reserverte nummer og nestet seksjon", () => {
  const fA = obj({ id: "fA", type: "text_field", label: "Felt A" });
  const fB = obj({ id: "fB", type: "text_field", label: "Felt B" });
  const fC = obj({ id: "fC", type: "text_field", label: "Felt C" });

  it("R1: fallback hopper over lagret bildeNr — gammelt dokument + nytt nummerert bilde gir unike nummer", () => {
    const data: Record<string, FeltVerdi> = {
      fA: fv("a", [bilde({ bildeNr: 4 })]),
      fB: fv("b", [bilde(), bilde()]),
      fC: fv("c", [bilde()]),
    };
    const nr = nummer(byggInnhold([fA, fB, fC], data, CFG));
    expect(nr).toEqual(["04", "01", "02", "03"]);
    expect(new Set(nr).size).toBe(nr.length);
  });

  it("R1: fallback som når et reservert nummer hopper over det (02 lagret → 01, 03, 04)", () => {
    const data: Record<string, FeltVerdi> = {
      fA: fv("a", [bilde({ bildeNr: 2 })]),
      fB: fv("b", [bilde(), bilde()]),
      fC: fv("c", [bilde()]),
    };
    const nr = nummer(byggInnhold([fA, fB, fC], data, CFG));
    expect(nr).toEqual(["02", "01", "03", "04"]);
    expect(new Set(nr).size).toBe(nr.length);
  });

  it("R1: reservasjon samles også fra repeater-rader, attachments-verdier og objektnivå-vedlegg", () => {
    const tabell = obj({
      id: "r",
      type: "repeater",
      label: "Rader",
      children: [obj({ id: "k", type: "text_field", label: "K" })],
    });
    const att = obj({ id: "att", type: "attachments", label: "Vedlegg" });
    const data: Record<string, FeltVerdi> = {
      fA: fv("a", [bilde(), bilde()]),
      r: fv([{ k: fv("rad", [bilde({ bildeNr: 2 })]) }], [bilde({ bildeNr: 1 })]),
      att: fv([bilde({ bildeNr: 3 }), bilde()]),
    };
    // Lagret: 1 (objektnivå), 2 (rad), 3 (attachments) → fallback for fA blir 04, 05; siste vedlegg 06.
    const nr = nummer(byggInnhold([fA, tabell, att], data, CFG));
    expect(nr).toEqual(["04", "05", "01", "02", "03", "06"]);
    expect(new Set(nr).size).toBe(nr.length);
  });

  it("R2: nestet seksjon — barnas bilder fortsetter fra feltene foran", () => {
    const seksjon = obj({
      id: "s",
      type: "heading",
      label: "Seksjon",
      children: [obj({ id: "barn", type: "text_field", label: "Barn" })],
    });
    const data: Record<string, FeltVerdi> = {
      fA: fv("a", [bilde(), bilde()]),
      barn: fv("b", [bilde()]),
    };
    expect(nummer(byggInnhold([fA, seksjon], data, CFG))).toEqual(["01", "02", "03"]);
  });
});

describe("ordre (3) — opprydding", () => {
  // «Gjør rik»-feltet (tomt attachments-barn) gjør repeateren til radkort; dets egen label telles ikke.
  const overskrifter = (html: string) =>
    [...html.matchAll(/class="ark-radkort-label">([^<]*)</g)].map((m) => m[1]).filter((l) => l !== "Gjør rik");
  const rik = (barn: TreObjekt) =>
    obj({ id: "rk", type: "repeater", label: "Befaring", children: [obj({ id: "v", type: "attachments", label: "Gjør rik" }), barn] });

  it("P1: attachments i radkort har ÉN overskrift — feltets egen label", () => {
    const html = byggInnhold([rik(obj({ id: "att", type: "attachments", label: "Bilder" }))], { rk: fv([{ att: fv([bilde()]) }]) }, CFG);
    expect(overskrifter(html)).toEqual(["Bilder"]);
  });

  it("P1: attachments uten meningsfull label beholder «Bilder» som eneste overskrift", () => {
    const html = byggInnhold([rik(obj({ id: "att", type: "attachments", label: "_" }))], { rk: fv([{ att: fv([bilde()]) }]) }, CFG);
    expect(overskrifter(html)).toEqual(["Bilder"]);
  });

  it("P1: skalarfelt med egne bilder beholder label + «Bilder» (ikke dobbel)", () => {
    const html = byggInnhold([rik(obj({ id: "t", type: "text_field", label: "Funn" }))], { rk: fv([{ t: fv("riss", [bilde()]) }]) }, CFG);
    expect(overskrifter(html)).toEqual(["Funn", "Bilder"]);
  });

  it("P1: tabell-repeaterens bilderad har ingen ekstra «Bilder»-overskrift", () => {
    const tabell = obj({ id: "r", type: "repeater", label: "Rader", children: [obj({ id: "k", type: "text_field", label: "K" })] });
    const html = byggInnhold([tabell], { r: fv([{ k: fv("rad", [bilde()]) }]) }, CFG);
    expect(html).not.toMatch(/>Bilder</);
  });

  it("P2: lagret bildeNr null → fallback-nummer, aldri «Bilde null»", () => {
    const f = obj({ id: "f", type: "text_field", label: "Felt" });
    const html = renderFelt(f, fv("x", [bilde({ bildeNr: null }), bilde()]), CFG);
    expect(html).not.toContain("Bilde null");
    expect(nummer(html)).toEqual(["01", "02"]);
  });
});

describe("større svartekst", () => {
  it(".felt-verdi er 12px i arkiv-CSS-en", () => {
    expect(hentArkivCss()).toMatch(/\.felt-verdi\{[^}]*font-size:12px/);
  });
});
