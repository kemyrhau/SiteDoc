import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  // Tidligere RED-vakt kjørte selve pdf-parse@1 (pdf.js v1.10.100, 2018) for å vise at
  // `split("\f")` ga 1 «side». pdf-parse er fjernet fra prosesseringen (se
  // pdf-parse-import.test.ts), og den gamle parseren klarer ikke lenger å lese pdf-lib-
  // fixturen på Node 20 (CI/prod) — «Invalid PDF structure», ikke side-feilen vakten
  // skulle vise. Vakten testet dermed et bibliotek vi ikke bruker. Den erstattes av en
  // kildevakt på det som faktisk ga prod-feilen 2026-10-14: deling på form-feed.
  it("RED-vakt: prosesseringen deler ikke på form-feed, men henter sider via ekstraherPdfSider", () => {
    const kilde = readFileSync(join(__dirname, "ftd-prosessering.ts"), "utf8");
    expect(kilde).not.toMatch(/\.split\(\s*["'`]\\f["'`]/);
    expect(kilde).toMatch(/await ekstraherPdfSider\(buffer/);
    // og den nye veien gir 3 sider på samme PDF:
    expect(sider).toHaveLength(3);
  });
});
