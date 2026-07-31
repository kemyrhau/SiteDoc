/**
 * Flytmodell Fase 3.1 — skygge-fakta-beregning (server).
 *
 * Oversetter dagens status-skriving til posisjonsmodellens FAKTA (aktivPosisjon/retning/
 * terminal/sendt) UTEN å endre atferd: `avledStatus(beregnSkyggeFakta(...))` reproduserer
 * statusen som skrives i dag (unntak: `in_progress`→`received`, Q1-vedtak). Faktaene er
 * skygge-felt i 3.1 (ingen ruting/klient leser dem ennå). `finnPosisjon`/`byggPosisjonsLedd`
 * fra @sitedoc/shared — samme utledning ruting og backfill bruker (ingen divergens).
 */

import { finnPosisjon, byggPosisjonsLedd, type FlytPosisjonLedd, type RaFlytMedlem } from "@sitedoc/shared";
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

/** Last flytens medlemmer og bygg FlytPosisjonLedd[] via delt byggPosisjonsLedd. Tom ved flyt-løst dok. */
export async function hentPosisjonsLedd(
  db: DbKlient,
  dokumentflytId: string | null | undefined,
): Promise<FlytPosisjonLedd[]> {
  if (!dokumentflytId) return [];
  const medlemmer = await db.dokumentflytMedlem.findMany({
    where: { dokumentflytId },
    select: {
      steg: true,
      klassifisering: true,
      kanTerminereUtenBall: true,
      faggruppeId: true,
      groupId: true,
      projectMember: { select: { userId: true } },
    },
  });
  const ra: RaFlytMedlem[] = medlemmer.map((m) => ({
    steg: m.steg,
    klassifisering: m.klassifisering,
    kanTerminereUtenBall: m.kanTerminereUtenBall,
    brukerId: m.projectMember?.userId ?? null,
    gruppeId: m.groupId,
    faggruppeId: m.faggruppeId,
  }));
  return byggPosisjonsLedd(ra);
}
