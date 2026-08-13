// Delt fremdriftsberegning for kontrollplanpunkter.
//
// Ett sted, brukt av liste, rutenett og fremdriftstelleren — aldri parallelle
// implementasjoner som drifter fra hverandre. Leveranse 2 utvider samme modul med
// fristfarge (planlagt/aktuell/forfalt) beregnet fra fristUke/fristAar.
//
// Kjernen: et koblet punkt teller SJEKKLISTENS status, ikke punktets egen. Det er
// forskjellen Kenneth så — to godkjente sjekklister mens planen viste 0/4, fordi
// punkt.status ikke oppdateres når arbeidet gjøres i sjekklisten.

export type PunktFremdrift = "planlagt" | "pagar" | "utfort" | "godkjent";

const PUNKT_STATUSER: readonly PunktFremdrift[] = ["planlagt", "pagar", "utfort", "godkjent"];

// Checklist-status (dokumentflyt): draft/sent/received/in_progress/responded/
// approved/rejected/closed/cancelled. «Godkjent» = approved eller closed (terminalt
// lukket). Alt annet som eksisterer er påbegynt arbeid → pågår.
export function avledSjekklisteFremdrift(status: string): PunktFremdrift {
  if (status === "approved" || status === "closed") return "godkjent";
  return "pagar";
}

// Fremdrift for ett punkt:
//  - koblet sjekkliste → avledet fra sjekklistens status (kilden til sannhet)
//  - ukoblet → punktets egen status (manuell), default planlagt
export function avledPunktFremdrift(punkt: {
  status: string;
  sjekkliste?: { status: string } | null;
}): PunktFremdrift {
  if (punkt.sjekkliste) return avledSjekklisteFremdrift(punkt.sjekkliste.status);
  return (PUNKT_STATUSER as readonly string[]).includes(punkt.status)
    ? (punkt.status as PunktFremdrift)
    : "planlagt";
}

// Teller godkjente punkter (koblet sjekkliste approved/closed, eller ukoblet punkt
// manuelt godkjent) mot totalen — grunnlaget for «N/M godkjent (X %)».
export function tellGodkjente(
  punkter: Array<{ status: string; sjekkliste?: { status: string } | null }>,
): { godkjent: number; total: number; prosent: number } {
  const total = punkter.length;
  const godkjent = punkter.filter((p) => avledPunktFremdrift(p) === "godkjent").length;
  const prosent = total > 0 ? Math.round((godkjent / total) * 100) : 0;
  return { godkjent, total, prosent };
}
