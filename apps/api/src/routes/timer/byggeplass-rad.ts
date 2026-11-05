import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 *
 * `SheetTimer.byggeplassId` og `SheetMachine.byggeplassId` er svake referanser
 * (ingen @relation på tvers av databasene), så prosjekt-grensen MÅ håndheves her:
 * en rad på prosjekt A kan ikke peke på en byggeplass under prosjekt B. `null`/
 * utelatt er gyldig (A.30: byggeplass-NULL er en lovlig tilstand).
 *
 * Gjelder de interaktive rad-mutasjonene (tilfoyTimerRad, oppdaterTimerRad,
 * maskin.tilfoy, maskin.oppdater). Mobil-synk (syncBatch) og attestering
 * (redigerSedelRader) er bevisst urørt — samme atferd som før.
 */
export async function krevByggeplassIProsjekt(
  byggeplassId: string | null | undefined,
  projectId: string,
): Promise<void> {
  if (!byggeplassId) return;
  const funnet = await prisma.byggeplass.findFirst({
    where: { id: byggeplassId, projectId },
    select: { id: true },
  });
  if (!funnet) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Byggeplassen hører ikke til radens prosjekt",
    });
  }
}
