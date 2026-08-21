import { describe, it, expect } from "vitest";
import { byggUtenforRaderBlokk, byggRepeaterTabell } from "./repeater";
import { byggRadkort } from "./radkort";
import { byggInnhold } from "./innhold";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

/**
 * F7 (D1, ordre-arkivmal-f7-objektniva 2026-08-21): innhold festet på repeater-OBJEKTET
 * (kommentar/vedlegg uten «Legg til rad») rendres som egen merket blokk «Registrert utenfor
 * rader» rett OVER tabellen/kortene. Aldri «rad 0», aldri utelatt. Objektbilder nummereres
 * FØR radbildene. Dekker funn #4 hull 2 (nivå-2-kommentar) + vedlegg-datatapet.
 */

const MERKE = "Registrert utenfor rader — kommentar og vedlegg festet direkte på skjemaet, uten 'Legg til rad'.";

const barn = (id: string, type: string, label: string): TreObjekt =>
  ({ id, type, label, required: false, config: {}, sortOrder: 0, parentId: "rep", children: [] }) as TreObjekt;
const fv = (verdi: unknown, kommentar = "", vedlegg: unknown[] = []): FeltVerdi =>
  ({ verdi, kommentar, vedlegg }) as FeltVerdi;
const img = (bildeNr?: number): Record<string, unknown> => ({
  id: `i${bildeNr ?? "x"}`, type: "bilde", url: `data:image/jpeg;base64,${bildeNr ?? "x"}`,
  filnavn: "f.jpg", opprettet: "2026-08-21T16:53:00Z", ...(bildeNr != null ? { bildeNr } : {}),
});

// Helskalar repeater → tabellform.
const TAB: TreObjekt = { id: "rep", type: "repeater", label: "Kontroll", required: false, config: {}, sortOrder: 0, parentId: null, children: [barn("a", "text_field", "A")] } as TreObjekt;
// Rik repeater (drawing_position) → radkortform.
const RIK: TreObjekt = { id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null, children: [barn("a", "text_field", "A"), barn("dp", "drawing_position", "Pos")] } as TreObjekt;

describe("byggUtenforRaderBlokk — F7-blokk direkte", () => {
  it("tomt/uten objektinnhold → tom blokk, teller uendret", () => {
    expect(byggUtenforRaderBlokk(undefined, 1)).toEqual({ html: "", nesteNr: 1 });
    expect(byggUtenforRaderBlokk(fv([]), 5)).toEqual({ html: "", nesteNr: 5 });
  });

  it("kommentar uten vedlegg → merkelinje ORDRETT + kommentar, ingen bilder forbrukt", () => {
    const { html, nesteNr } = byggUtenforRaderBlokk(fv([], "Testkommentar"), 1);
    expect(html).toContain(MERKE);
    expect(html).toContain("Testkommentar");
    expect(nesteNr).toBe(1);
  });

  it("objektbilder uten bildeNr nummereres fra startNr (01, 02) og returnerer nesteNr", () => {
    const { html, nesteNr } = byggUtenforRaderBlokk(fv([], "", [img(), img()]), 1);
    expect(html).toContain("Bilde 01");
    expect(html).toContain("Bilde 02");
    expect(nesteNr).toBe(3);
  });

  it("b.bildeNr fra appen har forrang over telleren", () => {
    expect(byggUtenforRaderBlokk(fv([], "", [img(7)]), 1).html).toContain("Bilde 07");
  });

  it("ikke-bilde-vedlegg → filteller, aldri base64/dump i blokken", () => {
    const pdf = { id: "d", type: "fil", url: "data:application/pdf;base64,XYZ", filnavn: "rapport.pdf" };
    const { html } = byggUtenforRaderBlokk(fv([], "", [pdf]), 1);
    expect(html).toContain("1 vedlegg uten forhåndsvisning");
    expect(html).not.toContain("base64");
    expect(html).not.toContain("XYZ");
  });
});

describe("F7 tabellform — case a/b/c + nummerering", () => {
  it("(a) objektinnhold + 0 rader → blokk + «Ingen rader registrert»", () => {
    const html = byggRepeaterTabell(TAB, [], "Kontroll", fv([], "Kommentar utenfor"));
    expect(html).toContain(MERKE);
    expect(html).toContain("Kommentar utenfor");
    expect(html).toContain("Ingen rader registrert");
  });

  it("(b) objektinnhold + rader → blokk står FØR tabellen", () => {
    const html = byggRepeaterTabell(TAB, [{ a: fv("v") }], "Kontroll", fv([], "Utenfor"));
    expect(html.indexOf(MERKE)).toBeGreaterThan(-1);
    expect(html.indexOf("<table")).toBeGreaterThan(html.indexOf(MERKE));
  });

  it("(c) kun rader, intet objektinnhold → INGEN blokk (uendret utseende)", () => {
    const html = byggRepeaterTabell(TAB, [{ a: fv("v") }], "Kontroll", fv([]));
    expect(html).not.toContain(MERKE);
  });

  it("objektbilder får lavere løpenr enn radbilder (teller forbrukt av blokken først)", () => {
    const objektFelt = fv([], "", [img(), img()]);   // 01, 02
    const rad = { a: fv("v", "", [img()]) };          // 03
    const html = byggRepeaterTabell(TAB, [rad], "Kontroll", objektFelt);
    const i01 = html.indexOf("Bilde 01");
    const i03 = html.indexOf("Bilde 03");
    expect(i01).toBeGreaterThan(-1);
    expect(i03).toBeGreaterThan(i01);
  });

  it("blokken er ALDRI «rad 0» — første datarad har rad-nr 1", () => {
    const html = byggRepeaterTabell(TAB, [{ a: fv("v") }], "Kontroll", fv([], "Utenfor"));
    expect(html).toContain(`<td class="ark-rad-nr">1</td>`);
    expect(html).not.toContain(`<td class="ark-rad-nr">0</td>`);
  });
});

describe("F7 radkortform — case a/b", () => {
  it("(a) objektinnhold + 0 rader → blokk + «Ingen rader registrert»", () => {
    const html = byggRadkort(RIK, [], "Befaring", fv([], "Utenfor"));
    expect(html).toContain(MERKE);
    expect(html).toContain("Ingen rader registrert");
  });

  it("(b) objektinnhold + rader → blokk står FØR kortene", () => {
    const html = byggRadkort(RIK, [{ a: fv("x"), dp: fv(null) }], "Befaring", fv([], "Utenfor radkort"));
    expect(html.indexOf(MERKE)).toBeGreaterThan(-1);
    expect(html.indexOf("Befaring — rad 1")).toBeGreaterThan(html.indexOf(MERKE));
  });

  it("(c) kun rader → ingen blokk", () => {
    const html = byggRadkort(RIK, [{ a: fv("x"), dp: fv(null) }], "Befaring", fv([]));
    expect(html).not.toContain(MERKE);
  });
});

describe("funn #4 — alle fire kommentar-nivåene rendres (regresjonsvakt)", () => {
  // Nivå 1 (radkort skalar) + drawing_position-merknad dekkes i radkort.test.ts;
  // nivå 2 (repeater-objekt) dekkes over. Her: nivå 4 (toppnivå, felt.ts frosset).
  it("toppnivå-felt med kommentar → .kommentar rendres via renderFelt (nivå 4)", () => {
    const rot = { id: "top", type: "text_field", label: "Merknadsfelt", required: false, config: {}, sortOrder: 0, parentId: null, children: [] } as TreObjekt;
    const html = byggInnhold([rot], { top: fv("En verdi", "Toppnivå-kommentar") }, { bildeBaseUrl: "" } as PdfConfig);
    expect(html).toContain("Toppnivå-kommentar");
    expect(html).toContain('class="kommentar"');
  });
});
