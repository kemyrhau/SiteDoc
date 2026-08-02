/**
 * Flytmodell Fase 3.1 — skygge-fakta-beregning (server).
 *
 * Oversetter dagens status-skriving til posisjonsmodellens FAKTA (aktivPosisjon/retning/
 * terminal/sendt) UTEN å endre atferd: `avledStatus(beregnSkyggeFakta(...))` reproduserer
 * statusen som skrives i dag (unntak: `in_progress`→`received`, Q1-vedtak). Faktaene er
 * skygge-felt i 3.1 (ingen ruting/klient leser dem ennå). `finnPosisjon`/`byggPosisjonsLedd`
 * fra @sitedoc/shared — samme utledning ruting og backfill bruker (ingen divergens).
 */

import {
  finnPosisjon,
  byggPosisjonsLedd,
  avledStatus,
  nesteLedd,
  forrigeBallLedd,
  gjenapnePosisjon,
  utledMottakerForPosisjon,
  type FlytPosisjonLedd,
  type RaFlytMedlem,
  type FlytBruker,
  type Mottaker,
  type DocumentStatus,
} from "@sitedoc/shared";
import type { PrismaClient, Prisma } from "@sitedoc/db";

type DbKlient = PrismaClient | Prisma.TransactionClient;

// Terminal-status → åpent terminal-felt. rejected+dismissed → avvist (Q3-kollaps, alt i 1a).
const TERMINAL_FRA_STATUS: Record<string, string> = {
  approved: "godkjent",
  dismissed: "avvist",
  rejected: "avvist",
  closed: "lukket",
  cancelled: "avbrutt",
};

/** Terminal-status → terminal-felt-verdi (eller null hvis ikke-terminal). Delt, én kilde. */
export const terminalFraStatus = (status: string): string | null => TERMINAL_FRA_STATUS[status] ?? null;

/**
 * F3.2: avledet status-enum-cache fra fakta. ÉN kilde til status-skriving (delt avledStatus).
 * aktivPosisjon påvirker ikke status (kun terminal/sendt/retning gjør) → valgfri.
 */
export function avledetStatus(fakta: {
  aktivPosisjon?: number | null;
  retning: string | null;
  terminal: string | null;
  sendt: boolean;
}): DocumentStatus {
  return avledStatus({
    aktivPosisjon: fakta.aktivPosisjon ?? null,
    retning: fakta.retning,
    terminal: fakta.terminal,
    sendt: fakta.sendt,
  }).status;
}

export interface SkyggeFakta {
  aktivPosisjon: number | null;
  retning: string;
  terminal: string | null;
  sendt: boolean;
}

/**
 * Beregn skygge-fakta som avleder samme status som `effektivStatus`.
 * `nyStatusRaw` styrer kun retning (responded→tilbake, forwarded→paatvers, ellers frem).
 * `effektivStatus` er statusen som faktisk skrives (sent er alt mappet til received av kaller).
 */
export function beregnSkyggeFakta(input: {
  effektivStatus: string;
  nyStatusRaw: string;
  ledd: FlytPosisjonLedd[];
  recipientUserId?: string | null;
  recipientGroupId?: string | null;
  bestillerUserId?: string | null;
}): SkyggeFakta {
  const terminal = TERMINAL_FRA_STATUS[input.effektivStatus] ?? null;
  const sendt = input.effektivStatus !== "draft";
  const retning =
    input.nyStatusRaw === "responded" ? "tilbake" : input.nyStatusRaw === "forwarded" ? "paatvers" : "frem";
  const aktivPosisjon = finnPosisjon({
    ledd: input.ledd,
    status: input.effektivStatus,
    sendt,
    recipientUserId: input.recipientUserId,
    recipientGroupId: input.recipientGroupId,
    bestillerUserId: input.bestillerUserId,
  });
  return { aktivPosisjon, retning, terminal, sendt };
}

/** Last flytens rå medlemmer (normalisert RaFlytMedlem). Tom ved flyt-løst dok. */
export async function hentFlytMedlemmer(
  db: DbKlient,
  dokumentflytId: string | null | undefined,
): Promise<RaFlytMedlem[]> {
  if (!dokumentflytId) return [];
  const medlemmer = await db.dokumentflytMedlem.findMany({
    where: { dokumentflytId },
    select: {
      steg: true,
      klassifisering: true,
      kanTerminereUtenBall: true,
      erHovedansvarlig: true,
      faggruppeId: true,
      groupId: true,
      projectMember: { select: { userId: true } },
    },
  });
  return medlemmer.map((m) => ({
    steg: m.steg,
    klassifisering: m.klassifisering,
    kanTerminereUtenBall: m.kanTerminereUtenBall,
    erHovedansvarlig: m.erHovedansvarlig,
    brukerId: m.projectMember?.userId ?? null,
    gruppeId: m.groupId,
    faggruppeId: m.faggruppeId,
  }));
}

/** Last flytens medlemmer og bygg FlytPosisjonLedd[] via delt byggPosisjonsLedd. Tom ved flyt-løst dok. */
export async function hentPosisjonsLedd(
  db: DbKlient,
  dokumentflytId: string | null | undefined,
): Promise<FlytPosisjonLedd[]> {
  return byggPosisjonsLedd(await hentFlytMedlemmer(db, dokumentflytId));
}

export interface RutingResultat {
  aktivPosisjon: number | null;
  retning: string;
  terminal: string | null;
  sendt: boolean;
  status: DocumentStatus;
  /** Ny mottaker fra posisjon, eller null = behold gjeldende (E2/E3 no-op, E5 fallback, terminal/draft). */
  mottaker: Mottaker | null;
}

/**
 * F3.3: POSISJON-basert ruting (Tolkning A, fabel-bindende).
 *   send      → nesteLedd (forover); siste ledd (null) = no-op-flytt (Godkjenn er egen handling, E2)
 *   responded → forrigeBallLedd (retur bakover til kontroll); første ledd (null) = no-op (E3)
 *   draft     → gjenapnePosisjon (§ 2.4, fabel alt. A): gjenåpne/trekk-tilbake lander på handlerens
 *               EGET ledд (krever `aapner`). Trekk-tilbake (fra received) = retning tilbake.
 *   terminal/forwarded → ingen posisjon-/mottaker-endring (aktivPosisjon = der handlingen skjer)
 * Mottaker utledes av delt utledMottakerForPosisjon (E1 null-medlem→bestiller, E5 fallback).
 * Erstatter senderId/erHovedansvarlig/bestillerUserId-hardkodingen. Status avledes.
 */
export function beregnRuting(input: {
  nyStatus: string; // input.nyStatus (rå)
  effektivStatus: string;
  medlemmer: RaFlytMedlem[];
  naaPos: number | null;
  bestillerUserId: string | null;
  /** Fra-status: skiller trekk-tilbake (received→draft) fra gjenåpne (terminal→draft). */
  fraStatus?: string;
  /** Handleren (for §2.4 gjenåpne-landing). Kun nødvendig ved draft-overgang. */
  aapner?: FlytBruker | null;
}): RutingResultat {
  const ledd = byggPosisjonsLedd(input.medlemmer);
  const fra = input.naaPos ?? 0;
  let aktivPosisjon = input.naaPos;
  let mottaker: Mottaker | null = null;
  let retning = "frem";

  if (input.nyStatus === "sent") {
    const nyPos = nesteLedd(ledd, fra);
    if (nyPos !== null) {
      aktivPosisjon = nyPos;
      mottaker = utledMottakerForPosisjon(input.medlemmer, nyPos, input.bestillerUserId);
    }
    // E2: nyPos null (siste ledd) → behold posisjon + mottaker (ingen auto-terminal).
    retning = "frem";
  } else if (input.nyStatus === "responded") {
    const nyPos = forrigeBallLedd(ledd, fra);
    if (nyPos !== null) {
      aktivPosisjon = nyPos;
      mottaker = utledMottakerForPosisjon(input.medlemmer, nyPos, input.bestillerUserId);
    }
    // E3: nyPos null (første ledd) → behold posisjon + mottaker.
    retning = "tilbake";
  } else if (input.nyStatus === "draft" && input.aapner) {
    // § 2.4 (fabel alt. A): gjenåpne (terminal→draft) OG trekk-tilbake (received→draft) lander på
    // handlerens EGET ledд via gjenapnePosisjon (regel 1 åpnerens ledд → 2 nærmeste medlemsledд →
    // 3 admin utenfor flyten = samme boks). Erstatter «behold naaPos»-fall-throughen som lot et
    // gjenåpnet dok beholde terminal-posisjonen (systematisk aktivPosisjon-bug, live-funnet 01.08).
    const nyPos = gjenapnePosisjon({ ledd, aktivPosisjon: input.naaPos, aapner: input.aapner });
    if (nyPos !== null) {
      aktivPosisjon = nyPos;
      mottaker = utledMottakerForPosisjon(input.medlemmer, nyPos, input.bestillerUserId);
    }
    // Trekk-tilbake (fra received) = avsenderen henter tilbake → retning tilbake. Gjenåpne (fra
    // terminal) = ny start hos handleren → frem.
    retning = input.fraStatus === "received" ? "tilbake" : "frem";
  }
  // terminal (approved/dismissed/closed/cancelled) + forwarded: ingen posisjon-/mottaker-endring her.

  const terminal = terminalFraStatus(input.effektivStatus);
  // D + #11 (pilot-fiks 02.08, fabel-bindende): et GJENÅPNET dok (draft-overgang FRA en terminal)
  // HAR forlatt ledд 1 → `sendt=true` (§ 2.3) → avledStatus gir «Hos N», ikke «Utkast». «Gjenåpnet»
  // er en tidslinjehendelse, ingen ny statusfakta. Scoped til gjenåpne (fraStatus ∈ terminaler);
  // trekk-tilbake (received→draft) beholder sendt=false («Utkast») — egen fabel-sak, ikke rørt her.
  const erGjenapne =
    input.nyStatus === "draft" && input.aapner != null && terminalFraStatus(input.fraStatus ?? "") !== null;
  const sendt = erGjenapne ? true : input.effektivStatus !== "draft";
  const status = avledetStatus({ aktivPosisjon, retning, terminal, sendt });
  return { aktivPosisjon, retning, terminal, sendt, status, mottaker };
}
