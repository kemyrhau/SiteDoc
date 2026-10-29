/**
 * Sammenstilling av server-data og lokal (SQLite) tilstand ved init av et
 * skjema (sjekkliste/oppgave) — slik at et vedlegg brukeren har lagt inn ALDRI
 * forsvinner fra visningen fordi det ennå ikke er lastet opp.
 *
 * Bakgrunn (funn 2026-09-04): `utelatFeltMedLokaleVedlegg` holder felt med
 * `file://`-vedlegg utenfor server-payloaden (funn C, `da4d3035`) — riktig, en
 * død lokal sti skal aldri overskrive en god server-URL. Men da mangler feltet
 * på server, og ved init overskrev serverens (tomme) svar det brukeren så. Denne
 * modulen fikser SAMMENSTILLINGEN ved init: server er base, men felt som fortsatt
 * bærer et lokalt vedlegg tas fra lokal tilstand. Utelatelsen ved lagring beholdes.
 */

/** En URL som ennå ikke er lastet opp = lokal fil på enheten (ikke en server-URL). */
export function erLokalVedleggUrl(u: unknown): boolean {
  return typeof u === "string" && (u.startsWith("file://") || u.startsWith("/var/"));
}

/** En server-URL (varig lagret på server), motsatt av en lokal fil på enheten. Enten en
 *  `/uploads/…`-sti (signert eller rå) eller en absolutt `http(s)`-URL. */
export function erServerVedleggUrl(u: unknown): boolean {
  return typeof u === "string" && (u.startsWith("/uploads/") || u.startsWith("http"));
}

/** Samle (id, filnavn) for ETHVERT vedlegg-lignende objekt (har `id` + `url`-streng) hvor enn
 *  det ligger i et felt-tre — topp-nivå ELLER repeater-/attachments-nestet. Samme node-deteksjon
 *  som serverens `settUrlPaaVedlegg`. */
function samleVedleggIdFilnavn(node: unknown, ut: Array<[string, string]>): void {
  if (Array.isArray(node)) {
    for (const n of node) samleVedleggIdFilnavn(n, ut);
    return;
  }
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.id === "string" && typeof o.url === "string") {
      ut.push([o.id, typeof o.filnavn === "string" ? o.filnavn : ""]);
    }
    for (const v of Object.values(o)) samleVedleggIdFilnavn(v, ut);
  }
}

/**
 * Stabil signatur for alle vedlegg i et felt (eller en vedleggsliste) — SETTET av (`id`,
 * `filnavn`), sortert. IKKE `url`: en server-URL får/mister sin `?sig=`-signatur ved re-henting
 * uten at vedlegget er endret, så URL ville gitt falske «endret»-utslag. Rekkefølge ignoreres
 * (sortert) så en ren omstokking ikke slår ut. Annotering bytter alltid `filnavn` (`annotert_…`),
 * sletting fjerner en id, tillegg gir en ny id — alle fanges av id+filnavn-settet. Rekursiv, så
 * den dekker både topp-nivå-vedlegg og repeater-nestede.
 */
export function vedleggSignatur(felt: unknown): string {
  const ut: Array<[string, string]> = [];
  samleVedleggIdFilnavn(felt, ut);
  ut.sort((a, b) => (a[0] + " " + a[1]).localeCompare(b[0] + " " + b[1]));
  return JSON.stringify(ut);
}

/** Er vedleggene i to felt (eller vedleggslister) forskjellige i identitet/filnavn (tillegg,
 *  sletting eller erstatning/annotering)? Brukes server-side til å avvise vedlegg-endring på en
 *  godkjent rapport (Kenneth-vedtak 2026-10-21) uten å slå ut på ren URL-resignering eller
 *  omstokking. */
export function vedleggEndret(gammel: unknown, ny: unknown): boolean {
  return vedleggSignatur(gammel) !== vedleggSignatur(ny);
}

/**
 * Ikke-destruktiv erstatning ved annotering (funn d, Kenneth 2026-10-21): behold den
 * opprinnelige SERVER-URL-en som `originalUrl` første gang et server-vedlegg annoteres, slik at
 * visningen aldri står igjen uten en gyldig kilde om den annoterte URL-en blir utilgjengelig
 * (rå-privat uten signatur, eller lokalfil slettet etter opplasting → «Kunne ikke laste»).
 *
 * - Er `gjeldendeUrl` en lokal fil (originalen ikke lastet opp ennå), bevares INGEN original: en
 *   lokal sti er ikke en trygg reserve, og den annoterte fila inneholder alt originalen har.
 * - Første bevarte original beholdes ved re-annotering (`eksisterendeOriginalUrl` vinner).
 *
 * Returnerer URL-en som skal lagres i `originalUrl` (eller `undefined` når ingen bevares).
 */
export function bevarOriginalUrl(
  eksisterendeOriginalUrl: string | undefined,
  gjeldendeUrl: string,
): string | undefined {
  if (eksisterendeOriginalUrl) return eksisterendeOriginalUrl;
  return erServerVedleggUrl(gjeldendeUrl) ? gjeldendeUrl : undefined;
}

/** Har noden (felt-verdi-tre) minst ett vedlegg med lokal URL? Rekursiv — dekker
 *  topp-nivå-vedlegg OG vedlegg inne i repeater-rader. En lokal `originalUrl` teller også
 *  (redigerbar annotering 2026-10-28: originalen er ikke lastet opp ennå) — en død enhets-sti
 *  skal aldri til server, verken som `url` eller som `originalUrl`. */
export function harLokaltVedlegg(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(harLokaltVedlegg);
  if (node !== null && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (erLokalVedleggUrl(o.url)) return true;
    if (typeof o.url === "string" && erLokalVedleggUrl(o.originalUrl)) return true;
    return Object.values(o).some(harLokaltVedlegg);
  }
  return false;
}

/**
 * Server er base; felt som i `lokal` fortsatt har et lokalt (uleverte) vedlegg
 * overlagres fra `lokal`. Server vinner for alt annet. Returnerer SAMME referanse
 * hvis ingenting ble overlagret (unngår unødvendig state-churn).
 *
 * `lokal` er SQLite-tilstanden (full data, inkl. de lokale vedleggene). `base` er
 * bygget fra serverens svar (der de utelatte feltene mangler eller er tomme).
 */
export function sammenstillMedLokaleVedlegg<T extends Record<string, unknown>>(
  base: T,
  lokal: Record<string, unknown> | null | undefined,
): T {
  if (!lokal) return base;
  let endret = false;
  const ut: Record<string, unknown> = { ...base };
  for (const [feltId, feltVerdi] of Object.entries(lokal)) {
    if (harLokaltVedlegg(feltVerdi)) {
      ut[feltId] = feltVerdi;
      endret = true;
    }
  }
  return endret ? (ut as T) : base;
}

/**
 * Lagrings-siden av funn C: hold felt som fortsatt bærer et lokalt (uleverte)
 * vedlegg UTENFOR server-payloaden. En `file://`/`/var/`-URL er død for alle
 * andre enn denne installasjonen og ville overskrevet den varige
 * `/uploads/privat/…`-URL-en køen skriver via `settVedleggUrl`. Feltet synkes
 * fullt så snart opplastingen gir det en server-URL. SQLite beholder alltid full
 * data (samme-install-visning).
 *
 * `oppdaterData` merger feltvis på server, så et utelatt felt røres ikke der.
 * Motstykket ved init er `sammenstillMedLokaleVedlegg` — de MÅ opptre sammen,
 * ellers overskriver serverens manglende svar det brukeren la inn.
 *
 * Returnerer SAMME referanse hvis ingenting ble utelatt (unngår state-churn).
 */
export function utelatFeltMedLokaleVedlegg<T extends Record<string, unknown>>(
  data: T,
): T {
  let endret = false;
  const ut: Record<string, unknown> = {};
  for (const [feltId, feltVerdi] of Object.entries(data)) {
    if (harLokaltVedlegg(feltVerdi)) {
      endret = true;
      continue;
    }
    ut[feltId] = feltVerdi;
  }
  return endret ? (ut as T) : data;
}
