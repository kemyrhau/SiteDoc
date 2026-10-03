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
  // Frakoblet = ikke bekreftet server-svar OG (uten nett ELLER feilet). Online-venting
  // (på nett, ikke feilet, ikke bekreftet ennå) er bevisst UTE → skjermen spinner.
  const frakoblet = !i.serverBekreftet && (!i.erPaaNettet || i.erFeilet);
  return {
    offlineModus: frakoblet && i.harSpeil,
    offlineIkkeLastet: frakoblet && !i.harSpeil,
  };
}
