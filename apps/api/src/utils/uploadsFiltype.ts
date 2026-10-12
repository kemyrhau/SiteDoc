import { extname } from "path";

/**
 * Filtype-politikk for opplasting og servering av `/uploads/`-filer.
 *
 * 🔴 SIKKERHET (hotfix 2026-10-11, lagret XSS via opplastet SVG): to lag som
 * utfyller hverandre.
 *
 * 1) OPPLASTING er en **allowlist** (`ALLOWLIST_ENDELSER`) — bare de endelsene
 *    appen faktisk tar imot. Erstatter den gamle blokklista som slapp `.svg`,
 *    `.html`, `.xml`-med-script osv. gjennom. Listen er MÅLT ut fra alle
 *    `accept`/`ACCEPT` på web + mobil-pickere + endelse-forgrening i api (se
 *    `sikkerhet.md § 8c-2`). `.svg` er bevisst UTE — våre egne SVG-er skrives
 *    direkte til disk av DWG-konverteringen, aldri via `/upload`.
 *
 * 2) SERVERING setter `nosniff` på alt (i `server.ts`) og i tillegg en
 *    sandbox-CSP på alt som IKKE er bilde, PDF eller kjent binær
 *    (`trengerSandboxCsp`). Det nøytraliserer aktivt innhold (script i SVG/XML)
 *    hvis en slik fil likevel ligger på disk (eldre opplasting eller vår egen
 *    konverterte SVG åpnet i ny fane). CSP på svaret påvirker ikke våre egne
 *    SVG-er som hentes med `fetch` og legges inline.
 */

/** Normaliser til «.ext» i små bokstaver. Godtar med/uten punktum og bare filnavn/sti. */
function normaliserEndelse(filnavnEllerEndelse: string): string {
  const raa = filnavnEllerEndelse.includes(".")
    ? extname(filnavnEllerEndelse) || `.${filnavnEllerEndelse.replace(/^\.+/, "")}`
    : `.${filnavnEllerEndelse}`;
  return raa.toLowerCase();
}

/** Rasterbilder (ingen aktivt innhold). SVG er IKKE med — det er hele poenget. */
const BILDE_ENDELSER = [
  ".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp", ".gif", ".bmp", ".tif", ".tiff",
] as const;

/** Opake binære formater (tegning/3D/punktsky/office/arkiv) — ingen in-browser-kjøring. */
const BINÆR_ENDELSER = [
  ".pdf",
  ".dwg", ".dxf", ".ifc",
  ".las", ".laz", ".e57", ".ply",
  ".doc", ".docx", ".xls", ".xlsx",
  ".gab", ".ga1",
  ".zip",
] as const;

/** Tekst-/markup-formater appen tar imot som data (parses, ikke vises som dokument). */
const DATA_TEKST_ENDELSER = [
  ".xml", ".landxml", ".csv",
] as const;

/**
 * ALLOWLIST for opplasting. Målt mot web `accept`/`ACCEPT`, mobil-pickere og
 * api-endelse-forgrening 2026-10-11. En glemt type her avviser en lovlig
 * opplasting — endres kun sammen med måling.
 */
export const ALLOWLIST_ENDELSER: ReadonlySet<string> = new Set<string>([
  ...BILDE_ENDELSER,
  ...BINÆR_ENDELSER,
  ...DATA_TEKST_ENDELSER,
]);

/** True hvis filendelsen er en lovlig opplastingstype. Tom/ukjent → false. */
export function erTillattOpplasting(filnavnEllerEndelse: string): boolean {
  if (!filnavnEllerEndelse) return false;
  const e = normaliserEndelse(filnavnEllerEndelse);
  return e !== "." && ALLOWLIST_ENDELSER.has(e);
}

/**
 * Endelser som er TRYGGE å servere uten sandbox-CSP (bilde, PDF, kjent binær).
 * Alt annet — SVG, XML, CSV, LandXML, ukjent/eldre — får sandbox-CSP.
 */
export const TRYGG_SERVERING_UTEN_CSP: ReadonlySet<string> = new Set<string>([
  ...BILDE_ENDELSER,
  ...BINÆR_ENDELSER,
]);

/**
 * CSP for `/uploads/`-svar som ikke er trygg binær/bilde/PDF. `sandbox` uten
 * `allow-scripts` dreper script/aktivt innhold; `style-src 'unsafe-inline'`
 * beholder våre konverterte SVG-ers inline `<style>` (strektykkelse);
 * `img-src data:` tillater innebygde data-bilder.
 */
export const UPLOADS_SANDBOX_CSP =
  "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:";

/** True hvis den serverte fila bør få sandbox-CSP (ikke bilde/PDF/kjent binær). */
export function trengerSandboxCsp(filsti: string): boolean {
  const e = normaliserEndelse(filsti);
  return !TRYGG_SERVERING_UTEN_CSP.has(e);
}
