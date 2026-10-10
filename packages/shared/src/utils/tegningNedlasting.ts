/**
 * Filnavn-regel for nedlasting av tegninger (web enkeltfil + api zip).
 *
 * Rene funksjoner — ingen I/O. ÉN sannhetskilde for navneregelen slik at
 * enkeltfil-nedlastingen i web og hver zip-oppføring i api navngir likt.
 *
 * Regel (orkestrator-ordre 2026-10-10): tegningsnummer (fallback tegningens navn)
 * + `_rev<REVISJON>` + filas EKTE endelse hentet fra URL-en (stien er sannhet,
 * ikke `fileType`-etiketten). Navnet saniteres til et trygt filsystem-segment.
 *
 * Kollisjoner (flere tegninger med samme nummer+rev i samme zip) løses
 * deterministisk med `-2`, `-3`, … før endelsen — samme konvensjon som
 * `unikArkivSti` i eksport-arkivet.
 */

// Filsystem-utrygge tegn: mellomrom/kontroll-whitespace (\s), path-separatorer
// (/ \) og Windows-ulovlige tegn (: * ? " < > |) → `_`. BEHOLDER bindestrek,
// punktum og bokstaver (æøå): tegningsnummer som `B3-06-A-20-35-01` er
// bindestrek-separert og må overleve uendret.
const UTRYGGE_TEGN = /[\s/\\:*?"<>|]/g;

/** Filendelse (med punktum, f.eks. `.dwg`) fra en URL/sti. Tom streng hvis ingen gyldig. */
export function filendelseFraUrl(url: string): string {
  const utenQuery = url.split("?")[0] ?? url;
  const punkt = utenQuery.lastIndexOf(".");
  const skrå = utenQuery.lastIndexOf("/");
  // Gyldig endelse: punktum ETTER siste skråstrek og ikke helt sist i stien.
  if (punkt <= skrå || punkt === utenQuery.length - 1) return "";
  return utenQuery.slice(punkt);
}

/** Saniter et navnesegment til et trygt filsystem-segment (se UTRYGGE_TEGN). */
function trygtSegment(navn: string): string {
  const rent = navn.replace(UTRYGGE_TEGN, "_").trim();
  return rent.length > 0 ? rent : "tegning";
}

/**
 * Bygg nedlastingsnavn for én tegning/revisjon.
 * Eksempel: `{ tegningsnummer: "B3-06-A-20-35-01", revisjon: "03", fileUrl: ".../x.dwg" }`
 *   → `B3-06-A-20-35-01_rev03.dwg`.
 * Mangler tegningsnummer → bruk `navn`. Mangler endelse → navn uten suffiks.
 */
export function byggTegningNedlastingsnavn(opts: {
  tegningsnummer?: string | null;
  navn: string;
  revisjon?: string | null;
  fileUrl: string;
}): string {
  const stamme = (opts.tegningsnummer && opts.tegningsnummer.trim()) || opts.navn || "tegning";
  const rev = opts.revisjon && opts.revisjon.trim() ? `_rev${opts.revisjon.trim()}` : "";
  const endelse = filendelseFraUrl(opts.fileUrl);
  return `${trygtSegment(`${stamme}${rev}`)}${endelse}`;
}

/**
 * Gjør et ønsket filnavn unikt innen et `brukt`-sett (muteres). Append `-2`,
 * `-3`, … FØR endelsen ved kollisjon. Deterministisk: samme input-rekkefølge
 * gir samme resultat.
 */
export function unikNedlastingsnavn(ønsket: string, brukt: Set<string>): string {
  const punkt = ønsket.lastIndexOf(".");
  const skrå = ønsket.lastIndexOf("/");
  const harEndelse = punkt > skrå && punkt > 0 && punkt !== ønsket.length - 1;
  const base = harEndelse ? ønsket.slice(0, punkt) : ønsket;
  const ext = harEndelse ? ønsket.slice(punkt) : "";
  let kandidat = ønsket;
  let n = 2;
  while (brukt.has(kandidat)) {
    kandidat = `${base}-${n}${ext}`;
    n++;
  }
  brukt.add(kandidat);
  return kandidat;
}
