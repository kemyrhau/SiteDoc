/**
 * Filnavn-utledning for opplasting (løftet til @sitedoc/shared 2026-08-24, fra
 * apps/mobile/src/services/opplasting.ts).
 *
 * Rene strengfunksjoner uten plattformavhengighet. Løftet hit fordi mobilens uploadAsync-sti
 * IKKE kan fremtvinge det endelsesløse tilfellet fra UI-et (DocumentPicker bevarer endelsen i
 * cache-URI-en; en fil uten kjent UTI nedtones i velgeren) — grenen lot seg ikke verifisere i
 * simulator. Shared bundles allerede av mobil OG har vitest, så utledningsgrenen bevises her
 * med enhetstest selv om den ikke er UI-nåbar.
 */

/** MIME → filendelse, for filnavn som mangler suffiks (dokument fra Filer, cache-uri). */
export const ENDELSE_FRA_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/heic": ".heic",
  "image/heif": ".heic",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "application/pdf": ".pdf",
};

/** Fjern sti-separatorer/kontrolltegn så navnet trygt kan brukes som cache-filnavn. Tomt → «fil». */
export function saniter(navn: string): string {
  // eslint-disable-next-line no-control-regex
  return navn.replace(/[/\\\x00-\x1f]/g, "_").trim() || "fil";
}

/**
 * Garanter at multipart-filnavnet har en endelse serveren godtar. `uploadAsync` utleder
 * multipart-`filename` fra URI-ens basename (ingen filnavn-opsjon), og `upload.ts:121`
 * avviser tomt suffiks med 400 FØR magic-bytes får korrigert noe. Dokumenter fra Filer har
 * ofte ingen endelse i cache-stien → uten dette byttes 0-byte-bugen mot 400. Har navnet
 * allerede en endelse, beholdes den (serverens magic-sniff retter evt. bilde-uenighet).
 */
export function sikreEndelse(filnavn: string, mimeType: string): string {
  const rent = saniter(filnavn);
  // Ekte endelse = punktum + 1–6 tegn med MINST én bokstav. Et rent numerisk suffiks
  // («Faktura 2026.08» → «.08») er et dato-/versjonsfragment, ikke en endelse → da vinner
  // MIME. (Kjent restgrense: et alfabetisk men ikke-reelt suffiks som «.v2» leses fortsatt
  // som endelse — sjeldnere, og krever en kjent-endelse-liste å skille rent.)
  const m = rent.match(/\.([a-z0-9]{1,6})$/i);
  if (m && m[1] && /[a-z]/i.test(m[1])) return rent;
  return rent + (ENDELSE_FRA_MIME[mimeType.toLowerCase()] ?? "");
}
