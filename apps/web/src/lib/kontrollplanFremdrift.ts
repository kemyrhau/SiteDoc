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

// ── Leveranse 2: avledet tilstand (fremdrift × frist) ────────────────────────
//
// ÉN tilstand per punkt, brukt av liste, rutenett OG tegningsmarkør — samme kilde,
// samme visning. `punkt.status` er pensjonert også fra UI-et (L1 pensjonerte den som
// fremdriftskilde; L2 fjerner det siste stedet den ble vist).
//
// To akser som ALDRI slås sammen:
//  - Form (fylt vs. ring) = ER ARBEID STARTET. Print-sikkert i sort/hvitt (sluttrapporten
//    printes) — ring vs. fylt sirkel, ikke fyllgrad av samme farge.
//  - Farge = HASTER DET (kun for ikke-startede punkter, fra frist vs. nå).
// «Uten frist» og «Planlagt» deler grå/ring, men er distinkte tilstander — skilles i
// tekst/tooltip, ikke bare som identiske prikker.

export type PunktTilstand =
  | "godkjent"
  | "pabegynt"
  | "forfalt"
  | "aktuellNaa"
  | "planlagt"
  | "utenFrist";

export interface TilstandVisning {
  tilstand: PunktTilstand;
  farge: string; // hex
  fylt: boolean; // true = arbeid startet (fylt sirkel) · false = ring (hul)
  labelKey: string; // i18n-nøkkel — også skillet mellom Uten frist / Planlagt
}

const GRAA = "#9ca3af";
const TILSTAND: Record<PunktTilstand, TilstandVisning> = {
  godkjent: { tilstand: "godkjent", farge: "#10b981", fylt: true, labelKey: "kontrollplan.tilstandGodkjent" },
  pabegynt: { tilstand: "pabegynt", farge: "#3b82f6", fylt: true, labelKey: "kontrollplan.tilstandPabegynt" },
  forfalt: { tilstand: "forfalt", farge: "#ef4444", fylt: false, labelKey: "kontrollplan.tilstandForfalt" },
  aktuellNaa: { tilstand: "aktuellNaa", farge: "#f59e0b", fylt: false, labelKey: "kontrollplan.tilstandAktuellNaa" },
  planlagt: { tilstand: "planlagt", farge: GRAA, fylt: false, labelKey: "kontrollplan.tilstandPlanlagt" },
  utenFrist: { tilstand: "utenFrist", farge: GRAA, fylt: false, labelKey: "kontrollplan.tilstandUtenFrist" },
};

export interface UkeRef {
  uke: number;
  aar: number;
}

// Mandagen i en ISO-uke. ISO-uke 1 er uken som inneholder 4. januar; uke N teller 7
// dager per uke derfra. Alt i UTC → ingen DST-drift. Håndterer 52/53-ukers-år (f.eks.
// ISO-2026 har 53 uker) korrekt fordi vi regner i faktiske datoer, ikke uke-tall.
function isoUkeMandag(aar: number, uke: number): Date {
  const jan4 = new Date(Date.UTC(aar, 0, 4));
  const jan4Ukedag = jan4.getUTCDay() || 7; // man=1 … søn=7
  const mandagUke1 = new Date(jan4);
  mandagUke1.setUTCDate(jan4.getUTCDate() - jan4Ukedag + 1);
  const mandag = new Date(mandagUke1);
  mandag.setUTCDate(mandagUke1.getUTCDate() + (uke - 1) * 7);
  return mandag;
}

// Antall hele uker fra `naa` til `frist` (negativt = fristen er passert). Beregnes via
// mandagsdatoene, så U52/2026 → U01/2027 og U53-år regnes riktig over årsgrensen.
export function ukerTilFrist(frist: UkeRef, naa: UkeRef): number {
  const ms = isoUkeMandag(frist.aar, frist.uke).getTime() - isoUkeMandag(naa.aar, naa.uke).getTime();
  return Math.round(ms / (7 * 86_400_000));
}

// Dagens ISO-uke/-år fra en dato (kaller sender `new Date()`; ren gitt datoen → testbar).
export function isoUkeRef(dato: Date): UkeRef {
  const d = new Date(Date.UTC(dato.getFullYear(), dato.getMonth(), dato.getDate()));
  const ukedag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - ukedag); // torsdag i samme ISO-uke bestemmer ISO-året
  const aar = d.getUTCFullYear();
  const jan1 = new Date(Date.UTC(aar, 0, 1));
  const uke = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7);
  return { uke, aar };
}

// Avledet tilstand for ett punkt (fremdrift × frist). `naa` injiseres for testbarhet.
export function avledPunktTilstand(
  punkt: {
    status: string;
    sjekkliste?: { status: string } | null;
    fristUke: number | null;
    fristAar: number | null;
    varselUkerFor: number;
  },
  naa: UkeRef,
): TilstandVisning {
  const fremdrift = avledPunktFremdrift(punkt);
  if (fremdrift === "godkjent") return TILSTAND.godkjent;
  // Legacy `utfort` (kun ukoblet, manuelt satt før koble-mekanikken) vises som Påbegynt:
  // utført ≠ godkjent, og modellen har ingen egen «Utført». Treffer kun gammel data —
  // nye punkter når `pagar` kun via koble. Bevisst tap, deklarert.
  if (fremdrift === "pagar" || fremdrift === "utfort") return TILSTAND.pabegynt;
  // Ikke startet (planlagt) → frist-basert.
  if (punkt.fristUke == null || punkt.fristAar == null) return TILSTAND.utenFrist;
  const uker = ukerTilFrist({ uke: punkt.fristUke, aar: punkt.fristAar }, naa);
  if (uker < 0) return TILSTAND.forfalt;
  if (uker <= punkt.varselUkerFor) return TILSTAND.aktuellNaa;
  return TILSTAND.planlagt;
}
