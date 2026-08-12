/**
 * Handling-avledning for hendelsesloggen (lag 1).
 * Gjenbruker STATUS_TEKST som fallback — INGEN ny statuslogikk (gatet).
 */

import { STATUS_TEKST } from "../konstanter";

/**
 * Avleder menneskevennlig handling fra en statusovergang
 * (`DocumentTransfer` fromStatus→toStatus).
 *
 * `draft` som mål skilles på fra-status: `received → draft` = trukket tilbake
 * (avsender henter tilbake før mottaker handlet), øvrig → draft = gjenåpnet
 * (admin på terminal). Alt annet mapper direkte på mål-status.
 */
export function avledHandling(fraStatus: string, tilStatus: string): string {
  switch (tilStatus) {
    case "sent":
    case "submitted":
      return "Sendt";
    case "received":
      return "Mottatt";
    case "responded":
      return "Besvart";
    case "approved":
      return "Godkjent";
    case "rejected":
      return "Avvist";
    case "completed":
      return "Ferdig";
    case "closed":
      return "Lukket";
    case "cancelled":
      return "Avbrutt";
    case "draft":
      return fraStatus === "received" ? "Trukket tilbake" : "Gjenåpnet";
    default:
      return STATUS_TEKST[tilStatus] ?? tilStatus;
  }
}
