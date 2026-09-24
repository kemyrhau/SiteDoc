/**
 * Konverterings-banner for tegningssiden: velger tekst OG re-konverter-vei etter filtype.
 *
 * Bakgrunn: PDF→PNG-feil ble vist som «DWG-konvertering feilet» i tre måneder fordi banneret
 * hardkodet DWG-teksten for ALLE konverteringsfeil (page.tsx:883). En feilet PDF beholder
 * `fileType="pdf"` (feilveien flipper ikke typen), så filtypen skiller rent. Denne helperen
 * gjør skillet testbart og låser at:
 *   - PDF-feil → PDF-tekst + `rekonverterPdf` (prosjekt-batch, riktig vei for PDF)
 *   - DWG/annet → DWG-tekst + `provKonverteringIgjen` (én tegning, DWG-veien)
 * En knapp som gjør feil ting rett ved feilmeldingen er verre enn ingen knapp.
 */
export type KonverteringHandling = "rekonverterPdf" | "provKonverteringIgjen";

export interface KonverteringBanner {
  /** i18n-nøkkel for «konverteres»-banneret (pågår) */
  konverteresNokkel: string;
  /** i18n-nøkkel for feil-banneret (tar `{{feil}}`) */
  feiletNokkel: string;
  /** hvilken mutasjon feil-knappen skal kalle */
  handling: KonverteringHandling;
}

export function konverteringBanner(fileType: string | null | undefined): KonverteringBanner {
  const erPdf = (fileType ?? "").toLowerCase() === "pdf";
  return erPdf
    ? {
        konverteresNokkel: "tegninger.pdfKonverteres",
        feiletNokkel: "tegninger.pdfKonverteringFeilet",
        handling: "rekonverterPdf",
      }
    : {
        konverteresNokkel: "tegninger.dwgKonverteres",
        feiletNokkel: "tegninger.dwgKonverteringFeilet",
        handling: "provKonverteringIgjen",
      };
}
