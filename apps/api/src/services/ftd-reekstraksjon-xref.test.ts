import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { ekstraherPdfSider } from "./ftd-prosessering";

/**
 * Prod-/test-feil 2026-10-14: tvungen reekstraksjon av `testdok-sidetall.pdf`
 * feilet med «bad XRef entry», mens SAMME fil ble prosessert uten feil ved
 * opplasting. Målt rotårsak: den gamle `ekstraherPdfSider` brukte
 * `pdf-parse@1.1.1` → bundlet pdf.js v1.10.100 (2018), som holder muterbar
 * PROSESS-GLOBAL tilstand. Ett parse i en fersk prosess er stabilt, men flere
 * PDF-er i samme langlevde api/web-prosess (sekvensielt ELLER samtidig — som
 * bulk-reekstraksjonen, maks 2 om gangen) ødelegger hverandres tilstand:
 * intermitterende «bad XRef entry» OG stille tap av sider.
 *
 * Reprodusert (20 awaited kall i én prosess → ~2/3 «bad XRef entry»; ferske
 * byte hjelper ikke → ikke buffer-mutasjon, men global tilstand). pdfjs-dist
 * 4.10.38 (allerede brukt av `ekstraherPdfMedPosisjoner`) er re-entrant-trygg:
 * 0 feil av 20 sekvensielle + 8 samtidige.
 *
 * Denne testen FEILER på den gamle pdf-parse-veien og er grønn på pdfjs-dist.
 * Fixturene lages av test-koden selv (ingen kundefil). `useObjectStreams:false`
 * gir klassisk xref så BEGGE parsere leser formatet — eneste feilmodus som
 * står igjen er tilstandsødeleggelsen, ikke komprimering.
 */

async function lagPdf(sidetall: number, salt: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= sidetall; i++) {
    const p = doc.addPage([595, 842]);
    p.drawText(`Side ${i} av ${sidetall} (${salt}) dagmulkt vernerunde SJA`, {
      x: 50,
      y: 760,
      size: 13,
      font,
    });
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

describe("ekstraherPdfSider — stabil ved gjentatt bruk i samme prosess (bad XRef-regresjon)", () => {
  // Varierte sidetall så et tapt/feil-attribuert resultat fanges, ikke bare kast.
  const PLAN = [3, 2, 5, 3, 4, 2, 5, 3, 2, 4, 3, 5];

  it("12 sekvensielle kall gir alle riktig sidetall uten «bad XRef entry»", async () => {
    const buffere = await Promise.all(PLAN.map((n, i) => lagPdf(n, `seq${i}`)));
    for (let i = 0; i < buffere.length; i++) {
      const res = await ekstraherPdfSider(buffere[i]!);
      expect(res.antallSider, `dok ${i} antallSider`).toBe(PLAN[i]);
      expect(res.sider.map((s) => s.side), `dok ${i} sidenr`).toEqual(
        Array.from({ length: PLAN[i]! }, (_, k) => k + 1),
      );
    }
  });

  it("4 samtidige kall (bulk-reekstraksjon-scenario) gir alle riktig sidetall", async () => {
    const plan = [3, 2, 5, 4];
    const buffere = await Promise.all(plan.map((n, i) => lagPdf(n, `par${i}`)));
    const res = await Promise.all(buffere.map((b) => ekstraherPdfSider(b)));
    res.forEach((r, i) => {
      expect(r.antallSider, `par ${i} antallSider`).toBe(plan[i]);
      expect(r.sider.length, `par ${i} fangede sider`).toBe(plan[i]);
    });
  });
});
