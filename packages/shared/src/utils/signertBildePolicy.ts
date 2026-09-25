/**
 * Delt gjenfornyelses-policy for `SignertBilde` (S1 Fase 1b, del G2).
 *
 * 🔴 Web (`<img>`) og mobil (`<Image>`) kan IKKE dele komponent, men de SKAL dele
 * REGELEN — ellers drifter de fra hverandre og vi får to oppførsler ingen har
 * bestemt. Derfor bor debounce-vinduet, gjenforsøks-taket og 401-vs-404-
 * avgjørelsen her, i @sitedoc/shared, ikke duplisert i to komponenter.
 *
 * Mekanisme (ordre G2): når et signert `/uploads/`-bilde feiler i visning, skal
 * komponenten IKKE kalle en `fil.signer({ sti })`-prosedyre (det ville vært et
 * autorisasjons-orakel — kryssfirma-lekkasje). I stedet **invalideres tRPC-queriene
 * debouncet**, så serveren re-emitterer ferske signaturer gjennom veien som ALT er
 * autorisert. Ingen ny prosedyre, ingen ny autorisasjonsflate, ingen signeringslogikk
 * i klienten.
 */

/**
 * Debounce-vindu for query-invalidering. En side full av utløpte bilder skal utløse
 * ÉN invalidering, ikke femti. Vinduet må dekke spredningen i når 50 samtidige
 * bilde-requests feiler (nettverket serialiserer dem over noen hundre ms), derav et
 * romslig vindu framfor et som lukker mellom to feil i samme burst.
 */
export const SIGNERT_BILDE_DEBOUNCE_MS = 500;

/**
 * Maks antall gjenforsøk pr. bilde. 🔴 ETT. Feiler bildet igjen etter én
 * re-emisjon, vis en tydelig feiltilstand — ALDRI en løkke mot 401. Et
 * gjenforsøk = én invalidering som gir bildet en fersk signatur via refetch.
 */
export const SIGNERT_BILDE_MAKS_FORSOK = 1;

/**
 * Les `exp`-parameteren (utløps-millis) fra en signert `/uploads/`-URL.
 * Returnerer `null` når URL-en mangler `exp`, den ikke er et tall, eller URL-en
 * ikke lar seg parse. Robust mot både absolutte og relative URL-er.
 */
export function lesExpFraUrl(url: string): number | null {
  const q = url.indexOf("?");
  if (q === -1) return null;
  const exp = new URLSearchParams(url.slice(q + 1)).get("exp");
  if (exp === null) return null;
  const n = Number(exp);
  return Number.isFinite(n) ? n : null;
}

/**
 * 🔴 Skill 401 (utløpt signatur — verdt ETT gjenforsøk) fra 404 (slettet fil —
 * et gjenforsøk gir bare en ny 404, evig løkke = selvpåført DoS). `<img onError>`
 * gir ingen HTTP-status, så vi utleder klassen fra URL-en selv UTEN en ekstra
 * nettverksrunde:
 *
 *  - Signaturen er UTLØPT (`exp` i fortiden) → serveren svarte 401 → en refetch
 *    gir en fersk signatur → **fornybar** (true).
 *  - Signaturen er GYLDIG (`exp` i framtiden) men bildet feilet likevel → fila er
 *    borte (404) eller ekte nettverksfeil → en fersk signatur hjelper ikke →
 *    IKKE fornybar (false).
 *  - RÅ `/uploads/`-URL uten signatur → gaten 401-er den, men en refetch VIL
 *    signere den → fornybar (true). (Skal ikke forekomme etter G4, men vi lar
 *    det ene gjenforsøket få prøve framfor å vise feil på en URL som lett rettes.)
 *  - Ikke en `/uploads/`-URL (ekstern, `data:`, `file://`) → ikke vår sak, en
 *    invalidering hjelper ikke → false.
 *
 * Klokkeavvik mellom klient og server flipper ikke klassifiseringen: en
 * fersk-emittert URL har `exp ≈ nå + 15 min`, langt utenfor realistisk avvik, så
 * en 404 med gyldig signatur leses aldri feilaktig som utløpt.
 */
export function erUtloptSignatur(url: string, naa: number = Date.now()): boolean {
  if (typeof url !== "string" || !url.startsWith("/uploads/")) return false;
  const exp = lesExpFraUrl(url);
  if (exp === null) return true; // rå /uploads/ — refetch vil signere
  return exp <= naa; // utløpt → fornybar; gyldig men feilet → 404/ekte feil
}

/**
 * Lag en debouncet trigger som koalescerer mange kall innen `vindu` til ÉN
 * utførelse. Fast-vindu (fyrer `vindu` ms etter FØRSTE kall i en burst), ikke
 * trailing — det gir bundet ventetid før bildene kommer tilbake, og 50 samtidige
 * feil gir uansett bare én invalidering.
 *
 * Plattform-agnostisk (kun `setTimeout`), så web og mobil deler nøyaktig samme
 * koalescerings-oppførsel. Hver plattform lager ÉN modul-nivå-instans som alle
 * komponent-instansene deler.
 */
export function lagInvalideringsDebounce(
  vindu: number = SIGNERT_BILDE_DEBOUNCE_MS,
): (fn: () => void) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sisteFn: (() => void) | null = null;
  return (fn: () => void) => {
    sisteFn = fn;
    if (timer !== null) return; // allerede planlagt i dette vinduet — koalescér
    timer = setTimeout(() => {
      timer = null;
      const f = sisteFn;
      sisteFn = null;
      f?.();
    }, vindu);
  };
}
