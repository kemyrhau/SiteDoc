/**
 * Offline-liste-kildevalg (Offline-sjekklister fase 1, 2026-09-11).
 *
 * ÉN ren avgjørelse for om en dokumentliste skal vise ferske server-rader
 * eller lagrede lokale rader — og hvilken tilstand brukeren skal informeres om.
 * Delt så web/mobil (og fase 2: oppgaver/HMS) har ETT sannhetsbegrep, med test.
 *
 * Prinsipp (krav 6 rad 1 + krav 6 rad 2 + krav 7):
 *  - MED nett og et BEKREFTET server-svar er serveren autoritativ — også når
 *    det er tomt. En online bruker skal se nøyaktig det serveren sier, like
 *    ferskt som før. Da leser vi ALDRI lokalt (unngår stale-fella).
 *  - UTEN et bekreftet server-svar (offline, venter, eller feilet) faller vi
 *    tilbake til lokal cache hvis den finnes. En tom liste som EGENTLIG betyr
 *    «ikke synkronisert ennå» må kunne skilles fra «ingen dokumenter».
 *
 * Skjermen eier fortsatt spinneren: mens server-svaret venter OG lokal cache er
 * tom (`lokal-tom`) vises «laster». Har lokal cache rader, vises de umiddelbart
 * — også om server-spørringen henger (dårlig dekning etter kaldstart).
 */

export type OfflineListeKilde = "server" | "lokal";

export type OfflineListeTilstand =
  /** Online, server svarte med rader — normalveien. */
  | "server"
  /** Online, server BEKREFTET at det ikke finnes rader («ingen dokumenter»). */
  | "server-tom"
  /** Ingen autoritativt server-svar; viser lagrede lokale rader. */
  | "lokal"
  /** Ingen server-svar OG ingen lokal cache («ikke synkronisert ennå» / laster). */
  | "lokal-tom";

export interface OfflineListeInput {
  /** Nettverksstatus fra NettverkProvider. */
  erPaaNettet: boolean;
  /** Har server-spørringen svart (react-query `isSuccess`)? */
  serverBekreftet: boolean;
  /** Antall rader server ga (0 hvis tom eller intet svar). */
  serverAntall: number;
  /** Antall rader i lokal cache for gjeldende scope. */
  lokalAntall: number;
}

export interface OfflineListeValg {
  kilde: OfflineListeKilde;
  tilstand: OfflineListeTilstand;
}

/**
 * Velg kilde (server vs. lokal) og tilstand for en offline-bevisst dokumentliste.
 * Ren funksjon — ingen I/O, trygg å teste.
 */
export function velgOfflineListeKilde(i: OfflineListeInput): OfflineListeValg {
  // Server er autoritativ KUN med nett OG et bekreftet svar. Da leser vi aldri
  // lokalt — heller ikke ved tomt svar (det er da ekte «ingen dokumenter»).
  const serverAutoritativ = i.erPaaNettet && i.serverBekreftet;

  if (serverAutoritativ) {
    return i.serverAntall > 0
      ? { kilde: "server", tilstand: "server" }
      : { kilde: "server", tilstand: "server-tom" };
  }

  // Ikke autoritativt (offline / venter / feilet) → fall tilbake til lokal cache.
  return i.lokalAntall > 0
    ? { kilde: "lokal", tilstand: "lokal" }
    : { kilde: "lokal", tilstand: "lokal-tom" };
}

/**
 * Visningskilde for ÉN dokument-detalj offline (fase 2). Skiller seg fra listenes
 * `velgOfflineListeKilde` på ett avgjørende punkt: **online-venting skal IKKE vise
 * speilet.** En treg spørring (online, `isLoading`) på et dokument som finnes i speilet
 * må gi spinner og la online-atferden være uendret — ikke tvungen lesemodus som bytter
 * til redigerbar når svaret kommer midt i at brukeren leser (AVVIK Q5, orkestrator
 * 2026-10-03). «Frakoblet» gjelder derfor KUN uten nett eller ved feilet query.
 */
export interface DokumentVisningInput {
  /** Nettverksstatus fra NettverkProvider. */
  erPaaNettet: boolean;
  /** Har detalj-spørringen svart (react-query `isSuccess`)? */
  serverBekreftet: boolean;
  /** Feilet detalj-spørringen (react-query `isError`)? */
  erFeilet: boolean;
  /**
   * Er detalj-spørringen `paused` (react-query `fetchStatus === "paused"`)? Under
   * `networkMode: "offlineFirst"` gjør en offline spørring ÉN forsøk, feiler, og PAUSER
   * retry — den blir `paused`, IKKE `error`. Da er `erFeilet` false og `erPaaNettet` kan
   * henge etter (NetInfo-startverdi true + «ingen CHANGE-event»-hull), så uten dette
   * signalet spinner skjermen i et offline-vindu selv om speilet finnes. `paused` er det
   * entydige «server er uråd nå»-signalet, og skiller offline-pause fra online-venting
   * (`fetching`) — som Q5 bevisst holder på spinner.
   */
  erPauset: boolean;
  /** Finnes dokumentet i det bruker-filtrerte speilet? */
  harSpeil: boolean;
}

export interface DokumentVisningValg {
  /** Rendre fra speilet i tvungen lesemodus. */
  offlineModus: boolean;
  /** Vis «ikke lastet ned» (frakoblet uten speil) — ikke evig spinner. */
  offlineIkkeLastet: boolean;
}

export function velgDokumentVisning(i: DokumentVisningInput): DokumentVisningValg {
  // Frakoblet = ikke bekreftet server-svar OG (uten nett ELLER feilet ELLER pauset).
  // `erPauset` fanger offlineFirst-tilstanden der spørringen hverken er feilet eller
  // bekreftet, og lukker racet mot `erPaaNettet` (NetInfo-lag). Online-venting
  // (`fetching`, på nett, ikke pauset/feilet/bekreftet) er fortsatt UTE → skjermen spinner (Q5).
  const frakoblet = !i.serverBekreftet && (!i.erPaaNettet || i.erFeilet || i.erPauset);
  return {
    offlineModus: frakoblet && i.harSpeil,
    offlineIkkeLastet: frakoblet && !i.harSpeil,
  };
}

/* ---------------------------------------------------------------------------
 *  Hjem-inngangen (feltfunn 2026-10-04): Hjem og prosjektvelgeren er den eneste
 *  veien inn til listene (og dermed de offline-lagrede dokumentene). Begge gikk
 *  nett-only og viste en feilside som stengte veien uten nett. Denne funksjonen
 *  avgjør hva Hjem/prosjektvelgeren viser for PROSJEKT-spørringen, med SAMME
 *  pause-regel som `velgDokumentVisning` (frakoblet = uten nett / feilet / pauset).
 * ------------------------------------------------------------------------- */

export type HjemProsjektVisning = "spinner" | "server" | "lokal" | "feil";

export interface HjemProsjektInput {
  /** Nettverksstatus fra NettverkProvider. */
  erPaaNettet: boolean;
  /** Har prosjekt-spørringen svart (react-query `isSuccess`)? */
  serverBekreftet: boolean;
  /** Feilet prosjekt-spørringen (react-query `isError`)? */
  erFeilet: boolean;
  /** Er prosjekt-spørringen `paused` (`fetchStatus === "paused"`)? Samme signal som fase 2. */
  erPauset: boolean;
  /** Finnes prosjekter i lokal cache (`prosjekt_local`) for valgt firma? */
  harLokaleProsjekter: boolean;
}

/**
 * - `server`: autoritativt svar foreligger → bruk det (online-atferd uendret).
 * - `spinner`: online og venter (fetching, ikke pauset/feilet) → spinn som i dag (Q5).
 * - `lokal`: frakoblet (uten nett/feilet/pauset) OG lokale prosjekter finnes → vis dem, ingen feilside.
 * - `feil`: frakoblet OG ingen lokale data → feilside (online-feil med «prøv igjen», offline «ingenting lagret»).
 */
export function velgHjemProsjektVisning(i: HjemProsjektInput): HjemProsjektVisning {
  if (i.serverBekreftet) return "server";
  const frakoblet = !i.erPaaNettet || i.erFeilet || i.erPauset;
  if (frakoblet) return i.harLokaleProsjekter ? "lokal" : "feil";
  return "spinner";
}
