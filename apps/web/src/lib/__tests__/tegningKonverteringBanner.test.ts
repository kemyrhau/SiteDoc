import { describe, it, expect } from "vitest";
import { konverteringBanner } from "../tegningKonverteringBanner";

/**
 * Låser mislabel-fiksen: PDF→PNG-feil ble vist som «DWG-konvertering feilet» i tre måneder,
 * og feil-knappen kalte DWG-veien. Denne testen fanger regresjon til begge deler.
 */
describe("konverteringBanner", () => {
  it("PDF → PDF-tekst + rekonverterPdf-vei (ikke DWG-mislabel)", () => {
    const b = konverteringBanner("pdf");
    expect(b.feiletNokkel).toBe("tegninger.pdfKonverteringFeilet");
    expect(b.konverteresNokkel).toBe("tegninger.pdfKonverteres");
    expect(b.handling).toBe("rekonverterPdf");
  });

  it("PDF er case-insensitiv (PDF/Pdf)", () => {
    expect(konverteringBanner("PDF").handling).toBe("rekonverterPdf");
    expect(konverteringBanner("Pdf").feiletNokkel).toBe("tegninger.pdfKonverteringFeilet");
  });

  it("DWG → DWG-tekst + provKonverteringIgjen (én tegning)", () => {
    const b = konverteringBanner("dwg");
    expect(b.feiletNokkel).toBe("tegninger.dwgKonverteringFeilet");
    expect(b.konverteresNokkel).toBe("tegninger.dwgKonverteres");
    expect(b.handling).toBe("provKonverteringIgjen");
  });

  it("ukjent/null filtype → DWG-veien (trygg default, ingen PDF-batch på ukjent)", () => {
    expect(konverteringBanner(null).handling).toBe("provKonverteringIgjen");
    expect(konverteringBanner(undefined).handling).toBe("provKonverteringIgjen");
    expect(konverteringBanner("svg").handling).toBe("provKonverteringIgjen");
  });
});
