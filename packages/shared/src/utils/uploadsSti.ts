/**
 * Delte sti-prefikser for server-serverte opplastede filer (S1 Fase 1b).
 *
 * 🔴 ÉN kilde, delt av tre lag som ellers ville driftet fra hverandre:
 *  - api-gaten + emisjonssigneringen (`apps/api/src/utils/hmac.ts`)
 *  - mobil-resolveren (`apps/mobile/src/utils/signerteUrler.ts`)
 * `apps/api` er ikke importerbar fra mobil, så konstanten MÅTTE hit — ikke en
 * tredje kopi av strengen «/uploads/».
 */

/** Rot-prefiks for alle server-serverte opplastede filer. Hele treet er gatet. */
export const UPLOADS_PREFIKS = "/uploads/";

/** Sensitive filer (signatur-KUN, `Cache-Control: no-store`). Undertre av UPLOADS_PREFIKS. */
export const UPLOADS_PRIVAT_PREFIKS = "/uploads/privat/";

/**
 * Er dette en RÅ (usignert) `/uploads/`-URL som trenger emisjonssignatur for å
 * vises? Delt regel så api og mobil-resolveren aldri svarer ulikt. En URL som alt
 * bærer `sig=` er ferdig signert; `file://`/`http(s)`/`data:` er ikke /uploads/.
 */
export function erRaaUploadsUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(UPLOADS_PREFIKS) && !url.includes("sig=");
}
