import type { DocumentStatus } from "../types";

export interface StatusHandling {
  tekstNoekkel: string;
  nyStatus: DocumentStatus | "deleted" | "forwarded";
  farge: string;
  aktivFarge: string;
}

/**
 * Hent tilgjengelige statushandlinger for en gitt dokumentstatus.
 * Brukes i sjekkliste- og oppgave-detaljskjermer (mobil + web).
 * `tekstNoekkel` er en i18n-nøkkel — kall `t(handling.tekstNoekkel)` ved rendering.
 */
export function hentStatusHandlinger(status: string): StatusHandling[] {
  const handlinger: Record<string, StatusHandling[]> = {
    draft: [
      { tekstNoekkel: "handling.send", nyStatus: "sent", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    sent: [
      // "Motta" fjernet — sendt → mottatt skjer automatisk
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    received: [
      { tekstNoekkel: "statushandling.startArbeid", nyStatus: "in_progress", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    in_progress: [
      { tekstNoekkel: "statushandling.besvar", nyStatus: "responded", farge: "bg-purple-600", aktivFarge: "bg-purple-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "cancelled", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
    responded: [
      { tekstNoekkel: "handling.godkjenn", nyStatus: "approved", farge: "bg-green-600", aktivFarge: "bg-green-400" },
      { tekstNoekkel: "handling.avvis", nyStatus: "rejected", farge: "bg-red-600", aktivFarge: "bg-red-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    rejected: [
      { tekstNoekkel: "statushandling.startArbeidIgjen", nyStatus: "in_progress", farge: "bg-amber-500", aktivFarge: "bg-amber-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    approved: [
      { tekstNoekkel: "handling.lukk", nyStatus: "closed", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
      { tekstNoekkel: "statushandling.videresend", nyStatus: "forwarded", farge: "bg-gray-500", aktivFarge: "bg-gray-400" },
    ],
    cancelled: [
      { tekstNoekkel: "statushandling.gjenapne", nyStatus: "draft", farge: "bg-blue-600", aktivFarge: "bg-blue-400" },
      { tekstNoekkel: "handling.slett", nyStatus: "deleted", farge: "bg-red-600", aktivFarge: "bg-red-400" },
    ],
  };
  return handlinger[status] ?? [];
}
