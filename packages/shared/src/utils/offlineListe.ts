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
