import { describe, it, expect, beforeAll } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ekstraherPdfSider, delTekstIChunks } from "./ftd-prosessering";

/**
 * Prod-feil 2026-10-14: PDF-side-attribusjon kollapset til «side 1» fordi
 * `prosesserPdf` delte den sammenslåtte teksten på form-feed (`\f`), som
 * pdf-parse v1 aldri emitter (sidene skilles med `\n\n`). Fiksen bruker
 * pdf-parse sin `pagerender`-opsjon for å fange tekst pr. side med sann
 * `pageNumber`. Fixturen lages av test-koden selv (ingen kundefil).
 */

const TOKENS = { en: "ALFAUNIKA", to: "BETAUNIKB", tre: "GAMMAUNIKC" } as const;

async function lagTreSidersPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sider = [
    { tittel: "Side en", token: TOKENS.en },
    { tittel: "Side to", token: TOKENS.to },
    { tittel: "Side tre", token: TOKENS.tre },
  ];
  for (const s of sider) {
    const p = doc.addPage([595, 842]);
    p.drawText(`${s.tittel} ${s.token} innledende avsnitt med tekst.`, {
      x: 50,
      y: 760,
      size: 14,
      font,
    });
    p.drawText(`Andre linje paa ${s.tittel} med token ${s.token} igjen.`, {
      x: 50,
      y: 730,
      size: 12,
      font,
    });
  }
  return Buffer.from(await doc.save());
}

/** Sammenlign uten whitespace — pdf.js kan slå sammen/dele ordmellomrom. */
function uten(tekst: string): string {
  return tekst.replace(/\s/g, "");
}

describe("PDF side-attribusjon (pagerender pr. side)", () => {
  let pdf: Buffer;
  let sider: Array<{ side: number; tekst: string }>;
  let antallSider: number;

  beforeAll(async () => {
    pdf = await lagTreSidersPdf();
    const res = await ekstraherPdfSider(pdf);
    sider = res.sider;
    antallSider = res.antallSider;
  });

  it("gir nøyaktig 3 sider for en 3-siders PDF", () => {
    expect(sider).toHaveLength(3);
    expect(antallSider).toBe(3);
  });

  it("nummererer sidene 1, 2, 3 i rekkefølge", () => {
    expect(sider.map((s) => s.side)).toEqual([1, 2, 3]);
  });

  it("legger side 1-teksten på side 1 (og ikke de andre sidenes)", () => {
    const s1 = sider.find((s) => s.side === 1)!;
    expect(uten(s1.tekst)).toContain(TOKENS.en);
    expect(uten(s1.tekst)).not.toContain(TOKENS.to);
    expect(uten(s1.tekst)).not.toContain(TOKENS.tre);
  });

  it("legger side 2-teksten på side 2", () => {
    const s2 = sider.find((s) => s.side === 2)!;
    expect(uten(s2.tekst)).toContain(TOKENS.to);
    expect(uten(s2.tekst)).not.toContain(TOKENS.en);
  });

  it("legger side 3-teksten på side 3", () => {
    const s3 = sider.find((s) => s.side === 3)!;
    expect(uten(s3.tekst)).toContain(TOKENS.tre);
    expect(uten(s3.tekst)).not.toContain(TOKENS.to);
  });

  it("bevarer sann pageNumber gjennom delTekstIChunks", () => {
    const chunks = delTekstIChunks(sider);
    const chunkMed = (token: string) =>
      chunks.find((c) => uten(c.chunkText).includes(token));
    expect(chunkMed(TOKENS.en)?.pageNumber).toBe(1);
    expect(chunkMed(TOKENS.to)?.pageNumber).toBe(2);
    expect(chunkMed(TOKENS.tre)?.pageNumber).toBe(3);
  });

  it("RED-vakt: gammel split('\\f')-strategi gir bare 1 «side» på samme PDF", async () => {
    // Dokumenterer hvorfor pagerender trengs: den sammenslåtte teksten fra
    // pdf-parse har ingen form-feed, så den gamle delingen så kun én side.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
      b: Buffer,
    ) => Promise<{ text: string }>;
    const res = await pdfParse(pdf);
    const gamleSider = res.text.split("\f").filter((s) => s.trim());
    expect(gamleSider).toHaveLength(1); // feilen: 3-siders PDF → 1 «side»
    // mens den nye veien korrekt gir 3:
    expect(sider).toHaveLength(3);
  });
});
