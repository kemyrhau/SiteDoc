import type { DocumentStatus, DokumentflytRolle } from "../types";

export interface StatusHandling {
  tekstNoekkel: string;
  nyStatus: DocumentStatus | "deleted" | "forwarded";
  farge: string;
  aktivFarge: string;
  /** Primærhandling — vises som hovedknapp i kompakt meny */
  erPrimaer?: boolean;
}

/**
 * Hent tilgjengelige statushandlinger for en gitt dokumentstatus.
 * Brukes i sjekkliste- og oppgave-detaljskjermer (mobil + web).
 * `tekstNoekkel` er en i18n-nøkkel — kall `t(handling.tekstNoekkel)` ved rendering.
 * Første handling i listen er primærhandling (erPrimaer=true).
 */
export function hentStatusHandlinger(status: string): StatusHandling[] {
  const handlinger: Record<string, StatusHandling[]> = {
    draft: [
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    sent: [
      { tekstNoekkel: "statushandling.trekkTilbake", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400", erPrimaer: true },
    ],
    received: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    in_progress: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.sendTilbake", nyStatus: "sent", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    responded: [
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.sendTilbakeUtforer", nyStatus: "rejected", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    rejected: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    approved: [
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400", erPrimaer: true },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    cancelled: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400", erPrimaer: true },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
  };
  return handlinger[status] ?? [];
}

/**
 * Rollefiltrert handlingsliste.
 *
 * | Status       | registrator          | bestiller   | utfører                           | godkjenner                        |
 * |--------------|----------------------|-------------|-----------------------------------|-----------------------------------|
 * | draft        | Send, Slett          | Send, Slett | —                                 | —                                 |
 * | sent         | Avbryt               | Avbryt      | —                                 | —                                 |
 * | received     | Besvar, Videres.     | —           | Besvar, Videresend                | —                                 |
 * | in_progress  | Besvar, Tilbake, V   | —           | Besvar, Send tilbake, Videresend  | —                                 |
 * | responded    | Godkjenn, Tilbake, V | —           | —                                 | Godkjenn, Send tilbake, Videresend|
 * | rejected     | Besvar, V, Lukk      | —           | Besvar, Videresend                | —                                 |
 * | approved     | Lukk, Videresend     | Lukk        | —                                 | —                                 |
 * | cancelled    | Gjenåpne, Slett      | Gjenåpne    | —                                 | —                                 |
 */
export function hentRolleFiltrertHandlinger(
  status: string,
  rolle: DokumentflytRolle | null,
): StatusHandling[] {
  if (!rolle) return [];

  const alle = hentStatusHandlinger(status);

  // Registrator ser alle handlinger
  if (rolle === "registrator") return alle;

  // Definer tillatte nyStatus-verdier per rolle per status
  const tillatt = ROLLE_HANDLINGER[rolle]?.[status];
  if (!tillatt) return [];

  return alle.filter((h) => tillatt.has(h.nyStatus));
}

/**
 * Sjekk om en rolle har lov til å utføre en statusovergang.
 * Brukes av backend for API-rollevalidering.
 * Registrator har alltid lov. null-rolle har aldri lov.
 */
export function erTillattForRolle(
  rolle: DokumentflytRolle | null,
  gjeldendStatus: string,
  nyStatus: string,
): boolean {
  if (!rolle) return false;
  if (rolle === "registrator") return true;
  const tillatt = ROLLE_HANDLINGER[rolle]?.[gjeldendStatus];
  if (!tillatt) return false;
  return tillatt.has(nyStatus);
}

/** Roller → status → tillatte nyStatus-verdier */
const ROLLE_HANDLINGER: Record<string, Record<string, Set<string>>> = {
  bestiller: {
    draft: new Set(["sent", "deleted"]),
    sent: new Set(["cancelled"]),
    approved: new Set(["closed"]),
    cancelled: new Set(["draft"]),
  },
  utforer: {
    received: new Set(["responded", "forwarded"]),
    in_progress: new Set(["responded", "sent", "forwarded"]),
    rejected: new Set(["responded", "forwarded"]),
  },
  godkjenner: {
    responded: new Set(["approved", "rejected", "forwarded"]),
  },
};
