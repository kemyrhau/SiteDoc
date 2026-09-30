// Ett sted for å bygge `source`-objektet til en native <Image> som kan peke på en
// server-lagret /uploads/-fil. Mobilen autentiserer ALT med Bearer fra SecureStore
// (lib/trpc.ts, services/auth.ts), men den native bildelasteren i React Native gjør
// en NAKEN GET — den arver verken cookie eller tRPC-headeren. Skrus /uploads/-gaten
// på (krever gyldig innlogging for å hente ethvert objekt), blir hvert bilde en tom
// ramme uten feilmelding om headeren ikke er lagt på her.
//
// 🔴 Motstykket til webs `SignertBilde` (apps/web): der bærer <img> sesjonen via
// cookie hele veien; her må Bearer legges eksplisitt på forespørselen. Legg det ETT
// sted (denne funksjonen + `AutentisertBilde`), aldri på hvert kallsted — sprer man
// headeren utover kallstedene, glemmer neste kallsted den.
import { UPLOADS_PREFIKS } from "@sitedoc/shared";

export interface BildeKilde {
  uri: string;
  headers?: { Authorization: string };
}

/**
 * Skal denne URI-en bære Bearer-token? KUN våre egne /uploads/-URL-er:
 *
 *  - `${AUTH_CONFIG.apiUrl}/uploads/…`         (felt-/timer-vedlegg, api-host)
 *  - `${hentWebUrl()}/api/uploads/…`           (dokument-/infobilde, web-proxy)
 *
 * Begge inneholder `/uploads/` i stien (`UPLOADS_PREFIKS`, delt kilde med api-gaten
 * — ingen ny kopi av regelen). Lokale `file://`/`/var/`-stier og tredjeparts-http
 * (som IKKE er /uploads/) skal ALDRI få headeren: lokale trenger den ikke, og å
 * sende vårt Bearer til en fremmed host ville lekke sesjonen. Derfor både http-krav
 * OG /uploads/-krav.
 */
export function erServerUpload(uri: string): boolean {
  return /^https?:\/\//.test(uri) && uri.includes(UPLOADS_PREFIKS);
}

/**
 * Bygg <Image>-source. Er URI-en en server-/uploads/-fil OG vi har et token, følger
 * `Authorization: Bearer …` med forespørselen. Ellers returneres den nakne URI-en
 * uendret (lokale bilder og tredjeparts-URL-er, eller når token mangler — da er
 * atferden nøyaktig som før denne endringen).
 */
export function byggBildeKilde(uri: string, token: string | null): BildeKilde {
  if (token && erServerUpload(uri)) {
    return { uri, headers: { Authorization: `Bearer ${token}` } };
  }
  return { uri };
}
