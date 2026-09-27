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
 * Maks antall gjenforsøk pr. bilde. 🔴 TRE (var ÉTT — én feilet fornyelse på dårlig
 * 4G ga opp, og med 15 min levetid fornyes en åpen fane ~96 ganger i døgnet, så ett
 * dekningsdropp ødela bildet). Tre forsøk med backoff (se `backoffForsokMs`) lar et
 * enkelt dropp løse seg. Feiler bildet fortsatt etter tredje forsøk, vis en tydelig
 * feiltilstand — ALDRI en løkke mot 401. Et gjenforsøk = én invalidering som gir
 * bildet en fersk signatur via refetch.
 */
export const SIGNERT_BILDE_MAKS_FORSOK = 3;

/**
 * Lenke-klassens (`SignertLenke`) eget gjenforsøks-tak. 🔴 Holdt bevisst på ÉN.
 * Lenke-fornyelse er KLIKK-drevet og åpner et placeholder-vindu pr. forsøk UTEN
 * backoff — en annen mekanikk enn bildets `onError`-løkke, og `forsokRef` nullstilles
 * aldri (ett forsøk pr. hook-levetid). Bildets tak (`SIGNERT_BILDE_MAKS_FORSOK`) ble
 * hevet til 3 med backoff i 4G-reparasjonen 2026-09-28; lenke-klassen ble holdt utenfor
 * den runden — en egen vurdering (placeholder-vindu-oppførsel + backoff) kreves før den
 * eventuelt heves. Se `docs/claude/sikkerhet.md`.
 */
export const SIGNERT_LENKE_MAKS_FORSOK = 1;

/**
 * Backoff-basis mellom gjenforsøk. Forsøk 1 skjer umiddelbart (kun debounce-
 * koalescering, som dagens ett-forsøk); forsøk 2 og 3 venter eksponentielt lenger,
 * så et dekningsdropp får tid til å løse seg uten å hamre serveren.
 */
export const SIGNERT_BILDE_BACKOFF_BASIS_MS = 1000;

/**
 * Ventetid (ms) før gjenforsøk nr. `forsok` (1-indeksert) utløser sin invalidering.
 * forsok 1 → 0 (umiddelbart), forsok 2 → 1000, forsok 3 → 2000. Eksponentiell fra
 * forsøk 2, så de tre forsøkene sprer seg over ~3 s. Delt regel: web og mobil skal
 * bruke NØYAKTIG samme backoff, derav her og ikke i komponenten.
 */
export function backoffForsokMs(forsok: number): number {
  if (forsok <= 1) return 0;
  return SIGNERT_BILDE_BACKOFF_BASIS_MS * 2 ** (forsok - 2);
}

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
