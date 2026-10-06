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
import {
  UPLOADS_PREFIKS,
  SIGNERT_BILDE_MAKS_FORSOK,
  backoffForsokMs,
  erUtloptSignatur,
} from "@sitedoc/shared";
import { AUTH_CONFIG, hentWebUrl } from "../config/auth";

export interface BildeKilde {
  uri: string;
  headers?: { Authorization: string };
}

/**
 * Origin (scheme + host[:port]) fra en base-URL — resten (sti som `/trpc`) kuttes.
 * `hentWebUrl()` strippet allerede `/trpc`, men `AUTH_CONFIG.apiUrl` kan bære en
 * sti, så vi forankrer på origin, ikke på hele basen.
 *
 * 🔴 Returnerer `null` for en base uten `http(s)://…host`. Det er en TOKEN-VAKT:
 * en ugyldig base skal aldri kunne bli en match. Særlig tom streng —
 * `AUTH_CONFIG.apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001"`
 * fanger `null`/`undefined`, men IKKE `""` (settes `EXPO_PUBLIC_API_URL=""` i en
 * EAS-profil blir apiUrl tom). Uten null-retur ble vakten `uri.startsWith("/")`, og
 * en protokoll-relativ `//fremmed.example/uploads/x.jpg` ville passert MED tokenet.
 * Funksjonen skal feile LUKKET på tom base, ikke åpent.
 */
export function origin(base: string): string | null {
  const m = base.match(/^https?:\/\/[^/]+/);
  return m ? m[0] : null;
}

/**
 * Skal denne URI-en bære Bearer-token? KUN våre egne /uploads/-URL-er:
 *
 *  - `${AUTH_CONFIG.apiUrl}/uploads/…`         (felt-/timer-vedlegg, api-host)
 *  - `${hentWebUrl()}/api/uploads/…`           (dokument-/infobilde, web-proxy)
 *
 * To krav, begge må holde:
 *  1. **HOST** — URI-en må ligge under en av VÅRE to kjente verter (api-host eller
 *     web-proxy). `origin(base) + "/"` sikrer at grensen treffer et sti-skille, så
 *     en fremmed host som utvider vår (`https://api-test.sitedoc.no.fremmed.example/…`)
 *     IKKE passerer. Uten dette gikk tokenet til enhver host med `/uploads/` i URI-en.
 *  2. **STI** — URI-en må inneholde `/uploads/` (`UPLOADS_PREFIKS`, delt kilde med
 *     api-gaten). Våre verter serverer også andre stier (tRPC m.m.) som ikke skal
 *     ha headeren.
 *
 * Lokale `file://`/`/var/`-stier og tredjeparts-http skal ALDRI få headeren: lokale
 * trenger den ikke, og å sende vårt Bearer til en fremmed host ville lekke sesjonen.
 */
export function erServerUpload(uri: string): boolean {
  if (!uri.includes(UPLOADS_PREFIKS)) return false;
  const våreVerter = [origin(AUTH_CONFIG.apiUrl), origin(hentWebUrl())];
  return våreVerter.some((vert) => vert !== null && uri.startsWith(`${vert}/`));
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

/**
 * Reduser en full server-/uploads/-URI til den `/uploads/`-formen `erUtloptSignatur`
 * forventer. Mobilen bygger to former, begge med VÅR origin foran:
 *
 *  - api-host:  `https://api-host/uploads/…?exp=…&sig=…`
 *  - web-proxy: `https://web-host/api/uploads/…?exp=…&sig=…`
 *
 * VÅR origin strippes (samme host-forankring som `erServerUpload`), deretter et
 * ledende `/api`. `erUtloptSignatur` krever `/uploads/`-prefiks; en full URL med host
 * ville aldri regnes som utløpt → ingen selvfornyelse.
 *
 * 🔴 Query-strengen (`?exp=&sig=`) BEHOLDES. `erUtloptSignatur` leser `exp` for å
 * skille 401 (utløpt signatur → fornybar) fra 404 (gyldig signatur, borte fil →
 * terminal). Forveksle IKKE med `@sitedoc/shared`s `raaUploadsSti`, som DROPPER hele
 * queryen (skrive-vei-vaksine) — brukt her ville den visket ut `exp`, gjort hver feil
 * til «utløpt» og revet ned 404-vakten.
 *
 * Ikke-server-URI-er (lokal `file://`, tredjeparts, `data:`) slipper uendret gjennom:
 * de starter ikke med `/uploads/`, så `erUtloptSignatur` svarer false (ikke fornybar).
 */
export function stiForFornyelse(uri: string): string {
  for (const vert of [origin(AUTH_CONFIG.apiUrl), origin(hentWebUrl())]) {
    if (vert !== null && uri.startsWith(`${vert}/`)) {
      const sti = uri.slice(vert.length); // beholder ledende «/» + hele queryen
      return sti.startsWith("/api/") ? sti.slice(4) : sti;
    }
  }
  return uri;
}

/**
 * Ren beslutning for selvfornyelse av ETT bilde etter en visningsfeil (`<Image onError>`).
 * `AutentisertBilde` eier tellingen (`forsok`) og timerne; regelen selv bor her, delt
 * med webs `SignertBilde` gjennom `@sitedoc/shared` — samme tak, samme backoff, samme
 * 401-vs-404-skille. Ekstrahert hit (ikke inline i komponenten som på web) fordi mobil-
 * harness kun kjører ren TS: RN-komponenter render-testes ikke, så beslutningen må være
 * en ren funksjon for at KRAV (c)-testene skal kunne feile uten fiksen.
 *
 *  - `gi-opp`  → taket (`SIGNERT_BILDE_MAKS_FORSOK`) er nådd ELLER feilen er ikke en
 *    utløpt signatur (404/ekte feil). Vis en terminal tilstand, ALDRI en løkke mot 401.
 *  - `forny`   → planlegg en debouncet invalidering om `ventMs` (0 for forsøk 1, deretter
 *    voksende backoff). En invalidering gir serveren en runde til å re-emittere en fersk
 *    signatur gjennom veien som alt er autorisert — ingen ny signeringsprosedyre i klienten.
 */
export type BildeFornyelse =
  | { type: "gi-opp" }
  | { type: "forny"; nyttForsok: number; ventMs: number };

export function vurderBildeFornyelse(
  uri: string,
  forsok: number,
  naa: number = Date.now(),
): BildeFornyelse {
  if (forsok >= SIGNERT_BILDE_MAKS_FORSOK || !erUtloptSignatur(stiForFornyelse(uri), naa)) {
    return { type: "gi-opp" };
  }
  const nyttForsok = forsok + 1;
  return { type: "forny", nyttForsok, ventMs: backoffForsokMs(nyttForsok) };
}

/**
 * Hva skal `AutentisertBilde` rendre? 🔴 «laster» og «terminal» er IKKE det samme,
 * og å slå dem sammen er fella i fallback-oppgaven:
 *
 *  - `laster`   → token-hentingen pågår (`kilde` er null, ingen feil ennå). Varer noen
 *    hundre ms på HVERT server-bilde. Rendres som `null` — ALDRI fallbacken, ellers
 *    blinker «vedlegget kunne ikke lastes» på hvert bilde før det vises.
 *  - `terminal` → `feilet` (taket nådd eller 404). KUN her hører fallbacken hjemme.
 *  - `vis`      → en kilde finnes og ingen feil → vis <Image>.
 *
 * `feilet` vinner over manglende kilde: i praksis er `kilde` alltid satt når et bilde
 * rekker å feile, men rekkefølgen gjør regelen entydig uansett.
 */
export type BildeRenderTilstand = "laster" | "terminal" | "vis";

export function bildeRenderTilstand(harKilde: boolean, feilet: boolean): BildeRenderTilstand {
  if (feilet) return "terminal";
  if (!harKilde) return "laster";
  return "vis";
}
