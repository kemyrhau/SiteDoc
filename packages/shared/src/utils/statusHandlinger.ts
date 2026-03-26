import type { DocumentStatus } from "../types";

export interface StatusHandling {
  tekst: string;
  nyStatus: DocumentStatus | "deleted";
  farge: string;
  aktivFarge: string;
}

/**
 * Hent tilgjengelige statushandlinger for en gitt dokumentstatus.
 * Brukes i sjekkliste- og oppgave-detaljskjermer (mobil).
 */
export function hentStatusHandlinger(status: string): StatusHandling[] {
  const handlinger: Record<string, StatusHandling[]> = {
    draft: [
      { tekst: "Send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekst: "Slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    sent: [
      { tekst: "Motta", nyStatus: "received", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekst: "Avbryt", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    received: [
      { tekst: "Start arbeid", nyStatus: "in_progress", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekst: "Avbryt", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    in_progress: [
      { tekst: "Besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400" },
      { tekst: "Avbryt", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    responded: [
      { tekst: "Godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400" },
      { tekst: "Avvis", nyStatus: "rejected", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    rejected: [{ tekst: "Start arbeid igjen", nyStatus: "in_progress", farge: "bg-amber-500", aktivFarge: "bg-amber-400" }],
    approved: [{ tekst: "Lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" }],
    cancelled: [{ tekst: "Slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" }],
  };
  return handlinger[status] ?? [];
}
