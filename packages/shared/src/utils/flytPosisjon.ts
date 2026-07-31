/**
 * Flytmodell Fase 2 — delt posisjonsutledning (@sitedoc/shared).
 *
 * DEN DELTE SANNHETEN all ruting + status skal gå gjennom (server Fase 3, web+mobil Fase 4).
 * Rutingen teller LEDD-POSISJON, aldri rollenavn/historikk. Status AVLEDES fra fakta
 * (aktivPosisjon/retning/terminal/sendt), skrives aldri direkte.
 *
 * Grunnlag: flytmodell-veileder-cowork.md §§ 2.1–2.5 + gate-svar (FLAGG 1–3, Q2–Q4).
 * Erstatter: forventetRolleKandidater (web flyt-ledd.ts + mobil dokumentflyt-ledd.ts) +
 * rolledimensjonen i statusHandlinger.ts. Mater: perspektivEtikett + status-enum-cachen.
 *
 * Fase 2 = BIBLIOTEK + tester + backfill. Ingen server-ruting/klient-konsum rørt ennå.
 */

import type { DocumentStatus } from "../types";

/** Leddets rutings-klassifisering (§ 2.5). Orienteres kan ALDRI holde ballen. */
export type LeddKlassifisering = "kontroll" | "utfor" | "orienteres";

/**
 * Ett ledd i flyten, slik den delte utledningen ser det. Utledes fra DokumentflytMedlem
 * gruppert på `steg` (= posisjon). Bærer alt funksjonene trenger — rutings-felt
 * (klassifisering/kanTerminereUtenBall) OG medlemskap (for posisjon-matching/har-ballen).
 * Medlemskaps-settene kan være tomme når kun rutings-feltene er relevante.
 */
export interface FlytPosisjonLedd {
  posisjon: number; // 1-basert (= DokumentflytMedlem.steg)
  klassifisering: LeddKlassifisering;
  kanTerminereUtenBall: boolean;
  brukerIder: Set<string>;
  gruppeIder: Set<string>;
  faggruppeIder: Set<string>;
}

/** En seer/åpner, uttrykt som medlemskap. */
export interface FlytBruker {
  userId: string;
  gruppeIder: string[];
  faggruppeIder: string[];
  erAdmin: boolean;
}

const sorterStigende = (ledd: FlytPosisjonLedd[]): FlytPosisjonLedd[] =>
  [...ledd].sort((a, b) => a.posisjon - b.posisjon);

const kanHoldeBallen = (l: FlytPosisjonLedd): boolean => l.klassifisering !== "orienteres";

/** Er brukeren medlem av dette leddet (person/gruppe/faggruppe)? */
function erMedlemAvLedd(l: FlytPosisjonLedd, bruker: FlytBruker): boolean {
  return (
    l.brukerIder.has(bruker.userId) ||
    bruker.gruppeIder.some((g) => l.gruppeIder.has(g)) ||
    bruker.faggruppeIder.some((f) => l.faggruppeIder.has(f))
  );
}

/**
 * Send → : neste posisjon fremover som KAN holde ballen (hopper Orienteres).
 * Fra siste ball-ledd finnes ingen neste → null ⇒ handlingen ER «Godkjenn og fullfør»
 * (ingen spesialkode for «bestiller sist»). § 2.2.
 */
export function nesteLedd(ledd: FlytPosisjonLedd[], aktivPosisjon: number): number | null {
  for (const l of sorterStigende(ledd)) {
    if (l.posisjon > aktivPosisjon && kanHoldeBallen(l)) return l.posisjon;
  }
  return null;
}

/**
 * Besvar ← : nærmeste posisjon bakover som kan holde ballen (kontroll ELLER utfor —
 * vedtak 1). Hopper KUN Orienteres. Null hvis ingen bakover. § 2.2.
 * (Navn: «BallLedd» og ikke «KontrollLedd» fordi ← treffer både kontroll og utfor.)
 */
export function forrigeBallLedd(ledd: FlytPosisjonLedd[], aktivPosisjon: number): number | null {
  const bakover = sorterStigende(ledd).reverse();
  for (const l of bakover) {
    if (l.posisjon < aktivPosisjon && kanHoldeBallen(l)) return l.posisjon;
  }
  return null;
}

/** Lagrede fakta avledStatus leser (§ 2.3). Ingen av dem er status-enum. */
export interface AvledStatusFakta {
  aktivPosisjon: number | null;
  retning: string | null; // "frem" | "tilbake" | "paatvers"
  terminal: string | null; // "godkjent" | "avvist" | "lukket" | "avbrutt" | null
  sendt: boolean;
}

/** Avledet visningstype — kaller komponerer «N · X» (ansvarsmerke) fra ledd[aktivPosisjon]. */
export type AvledetVisning = "terminal" | "utkast" | "besvart" | "hos";

// Q3 (cowork-verifisert): avvist → dismissed (den LEVENDE Avvis-statusen), ikke rejected.
const TERMINAL_TIL_STATUS: Record<string, DocumentStatus> = {
  godkjent: "approved",
  avvist: "dismissed",
  lukket: "closed",
  avbrutt: "cancelled",
};

/**
 * avledStatus — ÉN kilde til status-enum-cachen (§ 2.3). Skrives aldri direkte av
 * endepunktene; kun denne funksjonen setter status-cachen (Fase 3).
 *
 *   terminal            → «Terminal-etikett» (status = map(terminal))
 *   !sendt              → «Utkast»
 *   retning = tilbake   → «Besvart — hos N»
 *   ellers              → «Hos N»
 *
 * Q1 (fabel-VEDTATT, A): posisjonsmodellens 4 fakta skiller IKKE received fra in_progress —
 * «hos»-grenen gir status="received". `in_progress` gjeninnføres ALDRI som statusfakta;
 * et evt. «sett/påbegynt»-signal er et VISNINGS-anliggende (perspektivEtikett/lesekvittering),
 * ikke en ny fakta i maskinen. F3-lukk-fra-under-arbeid er bevart via `kanTerminereUtenBall`.
 */
export function avledStatus(fakta: AvledStatusFakta): { status: DocumentStatus; visning: AvledetVisning } {
  if (fakta.terminal) {
    return { status: TERMINAL_TIL_STATUS[fakta.terminal] ?? "dismissed", visning: "terminal" };
  }
  if (!fakta.sendt) {
    return { status: "draft", visning: "utkast" };
  }
  if (fakta.retning === "tilbake") {
    return { status: "responded", visning: "besvart" };
  }
  // Q1 (fabel-vedtatt A): received/in_progress kollapser til «Hos N» = status "received".
  return { status: "received", visning: "hos" };
}

/**
 * har-ballen (Q2): brukeren er medlem av leddet på aktivPosisjon. Erstatter den recipient-
 * identitets-baserte beregnHarBallen (som beholdes til Fase 4 bytter konsumentene).
 */
export function harBallenPosisjon(
  ledd: FlytPosisjonLedd[],
  aktivPosisjon: number | null,
  bruker: FlytBruker,
): boolean {
  if (aktivPosisjon === null) return false;
  const ballLedd = ledd.find((l) => l.posisjon === aktivPosisjon);
  if (!ballLedd) return false;
  return erMedlemAvLedd(ballLedd, bruker);
}

/** Retningsrettigheter for en seer (§ 2.2 + vedtak). `kanVideresende` = H3 inn (admin/override). */
export function retningsrettigheter(input: {
  harBallen: boolean;
  seerLedd: FlytPosisjonLedd | null; // leddet seeren tilhører (for kanTerminereUtenBall)
  kanVideresende: boolean; // H3-mønsteret, avgjøres utenfor
}): { kanSende: boolean; kanBesvare: boolean; kanVideresende: boolean; kanTerminere: boolean } {
  const { harBallen, seerLedd, kanVideresende } = input;
  const erOrienteres = seerLedd?.klassifisering === "orienteres";
  return {
    // Send → og Besvar ← : den som holder ballen (orienteres holder aldri ballen).
    kanSende: harBallen && !erOrienteres,
    kanBesvare: harBallen && !erOrienteres,
    // Videresend ↔ : H3 (admin-nivå + eksplisitt override).
    kanVideresende,
    // Terminere (Lukk): ball-holder, ELLER kontroll-ledd med kanTerminereUtenBall (F3 + HMS).
    kanTerminere: harBallen || (seerLedd?.kanTerminereUtenBall ?? false),
  };
}

/**
 * finnPosisjon — den DELTE matcheren (Q4): mapper dagens eier/recipient til en ledd-posisjon.
 * Brukes av non-terminal backfill (Fase 2) og erstatter finnAktivtIndex sin identitets-logikk
 * (Fase 4). Returnerer posisjon, ikke array-indeks.
 *
 *   !sendt/draft        → laveste posisjon (oppretter, Ledd 1)
 *   recipientUserId     → leddet brukeren er i
 *   recipientGroupId    → leddet gruppen er i
 *   fallback            → oppretter-leddet (bestillerUserId), ellers null
 */
export function finnPosisjon(input: {
  ledd: FlytPosisjonLedd[];
  status: string;
  sendt: boolean;
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  bestillerUserId?: string | null;
}): number | null {
  const { ledd, status, sendt, recipientUserId, recipientGroupId, bestillerUserId } = input;
  const sortert = sorterStigende(ledd);
  const forste = sortert[0];
  if (!forste) return null;

  // Ikke sendt (utkast): ballen hos oppretter = laveste posisjon.
  if (!sendt || status === "draft") {
    return forste.posisjon;
  }
  if (recipientUserId) {
    const l = sortert.find((x) => x.brukerIder.has(recipientUserId));
    if (l) return l.posisjon;
  }
  if (recipientGroupId) {
    const l = sortert.find((x) => x.gruppeIder.has(recipientGroupId));
    if (l) return l.posisjon;
  }
  if (bestillerUserId) {
    const l = sortert.find((x) => x.brukerIder.has(bestillerUserId));
    if (l) return l.posisjon;
  }
  return null;
}

/**
 * Gjenåpne-posisjon (§ 2.4). Terminal-dok gjenåpnes:
 *   1. Ballen går til åpnerens EGET ledd (nærmeste ledd åpner er medlem av, som kan holde ballen).
 *   2. Åpner ikke medlem av leddet dok ligger hos → nærmeste ledd åpner er medlem av
 *      (Orienteres kan ikke motta → hoppes).
 *   3. Åpner utenfor flyten (admin) → gjenåpnes i SAMME boks (aktivPosisjon uendret).
 * Returnerer ny posisjon (eller aktivPosisjon ved regel 3 / null hvis ubestembar).
 */
export function gjenapnePosisjon(input: {
  ledd: FlytPosisjonLedd[];
  aktivPosisjon: number | null;
  aapner: FlytBruker;
}): number | null {
  const { ledd, aktivPosisjon, aapner } = input;
  const sortert = sorterStigende(ledd);

  // Ledd åpner er medlem av OG som kan holde ballen (ikke orienteres).
  const egneLedd = sortert.filter((l) => erMedlemAvLedd(l, aapner) && kanHoldeBallen(l));

  // Regel 3: admin utenfor flyten → samme boks.
  const forsteEget = egneLedd[0];
  if (!forsteEget) {
    return aapner.erAdmin ? aktivPosisjon : null;
  }

  // Regel 1 + 2: nærmeste eget ball-ledd til der dok ligger. Uten aktivPosisjon: laveste.
  if (aktivPosisjon === null) return forsteEget.posisjon;
  return egneLedd.reduce((naermest, l) =>
    Math.abs(l.posisjon - aktivPosisjon) < Math.abs(naermest.posisjon - aktivPosisjon) ? l : naermest,
  ).posisjon;
}
