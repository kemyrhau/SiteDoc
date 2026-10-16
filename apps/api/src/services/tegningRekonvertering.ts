/**
 * Strandet/pågår-mønster for `drawings.conversion_status`, trukket ut etter samme
 * forbilde som `reprosessering.ts` (ftd_documents.processing_state) — orkestrator
 * 2026-10-16: «Livstegn og utløpsgrense for konvertering som henger, som i
 * reprosessering.ts». Tabellen og statusnavnene er ulike (pending/converting her,
 * ikke pending/processing), så funksjonene er egne, men formen er identisk: en rad
 * som står i en «aktiv» status uten fremdrift i `updatedAt` lenge nok regnes som død,
 * ikke evig pågående.
 *
 * Ingen eksplisitt livstegn-skriving er lagt inn her (til forskjell fra
 * `reprosessering.ts`s `lagLivstegn`): en DWG/DXF-konvertering er ÉT bundet async-kall
 * (`konverterDwg`, med sin egen ezdxf-tidsavbrudd på 300 s), ikke en løkke over mange
 * faser a la OCR — det finnes intet naturlig sted å bumpe `updatedAt` midtveis. Grensen
 * (10 min, samme tall som `provKonverteringIgjen` brukte før denne utskillingen) er godt
 * over verste observerte konverteringstid og fungerer alene som utløpsgrense.
 */
export { erRekonverterbarOriginal, TEGNING_MANGLER_ORIGINALFIL_KODE } from "@sitedoc/shared";

export const KONVERTERING_STRANDET_MS = 10 * 60 * 1000;

const AKTIVE_STATUSER = new Set(["pending", "converting"]);

/**
 * True når tegningen står i en aktiv status (pending/converting) uten fremdrift
 * siden `updatedAt` i minst `KONVERTERING_STRANDET_MS` — dvs. prosessen som
 * konverterte den døde (crash/restart) midt i, og raden ville ellers blitt
 * stående «pågår» for alltid.
 */
export function erKonverteringStrandet(
  conversionStatus: string | null,
  updatedAt: Date,
  naa: number = Date.now(),
): boolean {
  if (!conversionStatus || !AKTIVE_STATUSER.has(conversionStatus)) return false;
  return naa - updatedAt.getTime() >= KONVERTERING_STRANDET_MS;
}

/**
 * True når tegningen faktisk er under konvertering AKKURAT NÅ (fersk pending/
 * converting). Strandede rader teller IKKE som pågår — de skal telles som feilet
 * i `rekonverteringStatus`, ellers låses «Oppdater alle tegninger»-knappen evig.
 */
export function erKonverteringPågår(
  conversionStatus: string | null,
  updatedAt: Date,
  naa: number = Date.now(),
): boolean {
  if (!conversionStatus || !AKTIVE_STATUSER.has(conversionStatus)) return false;
  return !erKonverteringStrandet(conversionStatus, updatedAt, naa);
}
