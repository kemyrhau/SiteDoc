import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * Vakt mot at `pdf-parse` (pdf.js v1.10.100, 2018) kommer tilbake i
 * PDF-prosesseringen. To prod-/test-feil ligger bak:
 *  - 2026-10-13: pdf-parse@1 sin index.js kjører en debug-blokk som åpner en
 *    ikke-eksisterende testfil → «ENOENT … 05-versions-space.pdf».
 *  - 2026-10-14: pdf-parse holder muterbar prosess-global tilstand → flere
 *    PDF-er i samme langlevde api/web-prosess ga «bad XRef entry» + stille
 *    sidetap (bulk-reekstraksjon). Se ftd-reekstraksjon-xref.test.ts.
 * Begge er løst ved å bruke pdfjs-dist (re-entrant-trygt) i stedet.
 */
describe("ftd-prosessering bruker pdfjs-dist, ikke pdf-parse", () => {
  const kilde = readFileSync(join(__dirname, "ftd-prosessering.ts"), "utf8");

  it("importerer ikke pdf-parse i noen form", () => {
    expect(kilde).not.toMatch(/require\(["']pdf-parse(\/[^"']*)?["']\)/);
    expect(kilde).not.toMatch(/from ["']pdf-parse(\/[^"']*)?["']/);
    expect(kilde).not.toMatch(/import\(["']pdf-parse(\/[^"']*)?["']\)/);
  });

  it("henter tekst pr. side via pdfjs-dist LEGACY-build (Node-målrettet, polyfiller Promise.withResolvers)", () => {
    // 🔴 Node 20-nede 2026-10-15: standard-builden (`pdfjs-dist` bart) kaster
    // «Promise.withResolvers is not a function» i prod (Node 20.20.2). Kun
    // legacy-builden self-polyfiller. Se pdfjs-node20.test.ts.
    expect(kilde).toMatch(/import\(["']pdfjs-dist\/legacy\/build\/pdf\.mjs["']\)/);
    expect(kilde).not.toMatch(/import\(["']pdfjs-dist["']\)/);
  });
});
