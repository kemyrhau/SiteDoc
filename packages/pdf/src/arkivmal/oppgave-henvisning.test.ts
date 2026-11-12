import { describe, it, expect } from "vitest";
import { byggInnhold } from "./innhold";
import { byggRepeaterTabell } from "./repeater";
import { byggRadkort } from "./radkort";
import { byggFilListe, erPdfVedlegg } from "../hjelpere";
import type { TreObjekt, FeltVerdi, PdfConfig } from "../typer";

/**
 * PDF-1 (ordre 2026-11-12, Kenneth): oppgaver opprettet fra et felt eller en repeater-rad
 * vises som henvisningslinje under feltet/raden — alltid, uavhengig av utskriftsvalgene.
 * Med «Ta med vedlegg» listes ikke-bilde-filer med filnavn (PDF-er merket «vedlagt bakerst»).
 */

const fv = (verdi: unknown, kommentar = "", vedlegg: unknown[] = []): FeltVerdi =>
  ({ verdi, kommentar, vedlegg }) as FeltVerdi;
const barn = (id: string, type: string, label: string): TreObjekt =>
  ({ id, type, label, required: false, config: {}, sortOrder: 0, parentId: "rep", children: [] }) as TreObjekt;
const FELT: TreObjekt = { id: "f1", type: "text_field", label: "Kantstein", required: false, config: {}, sortOrder: 0, parentId: null, children: [] } as TreObjekt;
const TAB: TreObjekt = { id: "rep", type: "repeater", label: "Kontroll", required: false, config: {}, sortOrder: 0, parentId: null, children: [barn("a", "text_field", "A")] } as TreObjekt;
const RIK: TreObjekt = { id: "rep", type: "repeater", label: "Befaring", required: false, config: {}, sortOrder: 0, parentId: null, children: [barn("a", "text_field", "A"), barn("dp", "drawing_position", "Pos")] } as TreObjekt;

const LINJE_FELT = "Oppgaver: BEF-015 Skjev kant (Sendt) · BEF-016 Mangler fuge (Utkast)";
const LINJE_RAD = "Oppgaver: BEF-017 Rad-avvik (Sendt)";
const CFG: PdfConfig = { bildeBaseUrl: "/api", oppgaveHenvisninger: { f1: LINJE_FELT, "rep:r2": LINJE_RAD } };

describe("PDF-1 henvisningslinje", () => {
  it("felt med oppgaver → linja under feltet; felt uten → ingen linje", () => {
    const html = byggInnhold([FELT], { f1: fv("ok") }, CFG);
    expect(html).toContain("ark-oppgave-henvisning");
    expect(html).toContain("BEF-015 Skjev kant (Sendt) · BEF-016 Mangler fuge (Utkast)");
    expect(html.indexOf("BEF-015")).toBeGreaterThan(html.indexOf("Kantstein"));
    expect(byggInnhold([FELT], { f1: fv("ok") }, { bildeBaseUrl: "/api" })).not.toContain("ark-oppgave-henvisning");
  });

  it("tabell-repeater: linja står under riktig rad (rad 2), ikke rad 1", () => {
    const rader = [{ _radId: "r1", felter: { a: fv("én") } }, { _radId: "r2", felter: { a: fv("to") } }];
    const html = byggRepeaterTabell(TAB, rader, "Kontroll", undefined, undefined, CFG);
    expect(html).toContain("ark-henvisning-rad");
    expect(html).toContain("BEF-017 Rad-avvik");
    expect(html.indexOf("BEF-017")).toBeGreaterThan(html.indexOf(">to<"));
    expect((html.match(/ark-henvisning-rad/g) ?? [])).toHaveLength(1);
  });

  it("radkort-repeater: linja står i kortet til rad 2", () => {
    const rader = [{ _radId: "r1", felter: { a: fv("én") } }, { _radId: "r2", felter: { a: fv("to") } }];
    const html = byggRadkort(RIK, rader, "Befaring", undefined, undefined, CFG);
    expect(html).toContain("BEF-017 Rad-avvik");
    expect(html.indexOf("BEF-017")).toBeGreaterThan(html.indexOf("Befaring — rad 2"));
  });
});

describe("PDF-1T henvisningslinja escapes (G7)", () => {
  // Oppgavetittelen er brukerinnhold og går rett inn i pdf-render-HTML-en.
  const ONDSINNET = "Oppgaver: BEF-001 <img src=x onerror=alert(1)> (Sendt)";
  const ESCAPET = "&lt;img src=x onerror=alert(1)&gt;";
  const ond: PdfConfig = { bildeBaseUrl: "/api", oppgaveHenvisninger: { f1: ONDSINNET, "rep:r2": ONDSINNET } };
  const rader = [{ _radId: "r1", felter: { a: fv("én") } }, { _radId: "r2", felter: { a: fv("to") } }];

  it.each([
    ["felt", () => byggInnhold([FELT], { f1: fv("ok") }, ond)],
    ["tabell-repeater", () => byggRepeaterTabell(TAB, rader, "Kontroll", undefined, undefined, ond)],
    ["radkort-repeater", () => byggRadkort(RIK, rader, "Befaring", undefined, undefined, ond)],
  ])("%s: teksten escapes, taggen kommer aldri med", (_navn, bygg) => {
    const html = bygg();
    expect(html).toContain(ESCAPET);
    expect(html).not.toMatch(/<img[^>]*onerror/i);
  });
});

describe("PDF-1 vedlegg med filnavn", () => {
  const pdf = { id: "d", type: "fil", url: "/uploads/x/rapport.pdf", filnavn: "rapport.pdf" };
  const docx = { id: "e", type: "fil", url: "/uploads/x/notat.docx", filnavn: "notat.docx" };
  const merke = { bakerstMerke: "vedlagt bakerst" };

  it("erPdfVedlegg kjenner igjen pdf på filnavn eller url", () => {
    expect(erPdfVedlegg(pdf)).toBe(true);
    expect(erPdfVedlegg({ url: "/uploads/a.PDF?exp=1" })).toBe(true);
    expect(erPdfVedlegg(docx)).toBe(false);
  });

  it("med vedlegg: filnavn listes, PDF merkes «vedlagt bakerst», annen fil bare navn", () => {
    const html = byggFilListe([pdf, docx], { bildeBaseUrl: "", vedleggFilnavn: merke }, "TELLER");
    expect(html).toContain("rapport.pdf (vedlagt bakerst)");
    expect(html).toContain("notat.docx");
    expect(html).not.toContain("notat.docx (vedlagt bakerst)");
  });

  it("uten vedlegg-valget: dagens teller (fallback)", () => {
    expect(byggFilListe([pdf], { bildeBaseUrl: "" }, "TELLER")).toBe("TELLER");
  });

  it("felt med fil i byggInnhold viser filnavnet når valget er på", () => {
    const html = byggInnhold([FELT], { f1: fv("ok", "", [docx]) }, { bildeBaseUrl: "", vedleggFilnavn: merke });
    expect(html).toContain("notat.docx");
  });
});
