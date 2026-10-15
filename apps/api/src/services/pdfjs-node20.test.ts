import { describe, it, expect, vi } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";

/**
 * Prod-/test-nede 2026-10-15: all PDF-ekstraksjon feilet med
 * «Promise.withResolvers is not a function». Rotårsak: `pdfjs-dist@4.10.38`
 * sin STANDARD-build (`build/pdf.mjs`) er nettleser-målrettet og kaller
 * `Promise.withResolvers` (ECMAScript, Node ≥ 21.7 / 22) uten polyfill.
 * Container-ene kjører Node 20.20.2, der metoden ikke finnes. pdfjs advarer
 * selv ved import i Node: «Please use the `legacy` build in Node.js
 * environments.» LEGACY-builden (`legacy/build/pdf.mjs`) bunter core-js og
 * self-polyfiller `Promise.withResolvers` (feature-detektert → no-op på Node
 * 22+). `blokk-prosessering.ts` bruker allerede legacy; `ekstraherPdfSider`
 * og `ekstraherPdfMedPosisjoner` gjorde det ikke.
 *
 * Fixturene lages av test-koden selv (ingen kundefil).
 *
 * 🔴 RØD FØRST: kjør under Node 20 (`npx -y node@20 …` eller `node:20`-image).
 * Lokal Node er v25, der `Promise.withResolvers` finnes nativt og feilen er
 * USYNLIG — det var fella. `node20-simulering`-testen under fjerner metoden
 * eksplisitt, så feilen fanges på ENHVER Node (også i gaten).
 */

async function lagPdf(sidetall: number, salt: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= sidetall; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Side ${i} av ${sidetall} (${salt}) dagmulkt vernerunde`, {
      x: 50,
      y: 760,
      size: 13,
      font,
    });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

describe("PDF-ekstraksjon virker uten native Promise.withResolvers (Node 20-nede)", () => {
  // 🔴 Fanger prod-nede på ALLE Node-versjoner: fjern metoden, kjør de to
  // ekstraksjons-veiene via et ferskt modul-tre. RØD på standard-build
  // (ingen polyfill), GRØNN på legacy-build (core-js self-polyfill).
  it("node20-simulering: ekstraherPdfSider + ekstraherPdfMedPosisjoner uten withResolvers", async () => {
    // Bracket-aksess via typet alias: api `lib` er under es2024, så direkte
    // `Promise.withResolvers` gir TS2550. Mekanismen er runtime, ikke typer.
    const P = Promise as unknown as { withResolvers?: unknown };
    const orig = P.withResolvers;
    delete P.withResolvers; // simulerer Node 20.20.2 (metoden mangler)
    vi.resetModules();
    try {
      expect(P.withResolvers).toBeUndefined();
      const mod = await import("./ftd-prosessering");
      const pdf = await lagPdf(3, "n20");

      const sider = await mod.ekstraherPdfSider(pdf);
      expect(sider.antallSider).toBe(3);
      expect(sider.sider.map((s) => s.side)).toEqual([1, 2, 3]);
      expect(sider.sider[0]!.tekst).toContain("dagmulkt");

      const posisjoner = await mod.ekstraherPdfMedPosisjoner(pdf);
      expect(posisjoner).toContain("dagmulkt");
      expect(posisjoner).toContain("Side 1");
    } finally {
      P.withResolvers = orig;
      vi.resetModules();
    }
  });

  // Funksjonell kontroll på native runtime (grønn på Node 20 ETTER fiks og på
  // nyere Node): begge veiene gir riktig innhold, flere kall i samme prosess
  // (re-entrant, xref-saken) holder.
  it("begge ekstraksjonsveiene gir riktig innhold ved gjentatt bruk", async () => {
    const mod = await import("./ftd-prosessering");
    for (const n of [2, 3, 4]) {
      const pdf = await lagPdf(n, `rep${n}`);
      const sider = await mod.ekstraherPdfSider(pdf);
      expect(sider.antallSider).toBe(n);
      const pos = await mod.ekstraherPdfMedPosisjoner(pdf);
      expect(pos).toContain("vernerunde");
    }
  });
});
