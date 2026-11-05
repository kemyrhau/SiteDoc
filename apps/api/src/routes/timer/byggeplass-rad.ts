import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";

const FEIL_UTENFOR_PROSJEKT = "Byggeplassen hører ikke til radens prosjekt";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 *
 * `SheetTimer.byggeplassId` og `SheetMachine.byggeplassId` er svake referanser
 * (ingen @relation på tvers av databasene), så prosjekt-grensen MÅ håndheves her:
 * en rad på prosjekt A kan ikke peke på en byggeplass under prosjekt B. `null`/
 * utelatt er gyldig (A.30: byggeplass-NULL er en lovlig tilstand).
 *
 * Gjelder de interaktive rad-mutasjonene (tilfoyTimerRad, oppdaterTimerRad,
 * maskin.tilfoy, maskin.oppdater) og — ordre (12) — forsonDagskort og
 * redigerSedelRader (via `krevByggeplasserIProsjekt`). Mobil-synk (syncBatch)
 * avviser ikke, men vasker med `lagByggeplassVasker`.
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
      message: FEIL_UTENFOR_PROSJEKT,
    });
  }
}

type ByggeplassVasker = (
  byggeplassId: string | null | undefined,
  projectId: string | null | undefined,
) => string | null;

/**
 * Ordre (12): slår opp alle byggeplassene i ÉN spørring og gir en vasker som
 * returnerer byggeplassen hvis den hører til prosjektet, ellers `null`.
 * syncBatch bruker den direkte: en avvist rad ville stoppet mobilens offline-kø
 * for alltid, så raden lagres med byggeplass `null` (prosjektet beholdes).
 */
export async function lagByggeplassVasker(
  byggeplassIder: (string | null | undefined)[],
): Promise<ByggeplassVasker> {
  const ider = Array.from(new Set(byggeplassIder.filter((b): b is string => !!b)));
  if (ider.length === 0) return () => null;
  const treff = await prisma.byggeplass.findMany({
    where: { id: { in: ider } },
    select: { id: true, projectId: true },
  });
  const prosjektFor = new Map(treff.map((b) => [b.id, b.projectId]));
  return (byggeplassId, projectId) =>
    byggeplassId && projectId && prosjektFor.get(byggeplassId) === projectId
      ? byggeplassId
      : null;
}

/**
 * Ordre (12): `krevByggeplassIProsjekt` for mange rader i én spørring —
 * forsonDagskort og redigerSedelRader avviser med samme feil som ordre (10).
 */
export async function krevByggeplasserIProsjekt(
  rader: { byggeplassId?: string | null; projectId: string }[],
): Promise<void> {
  const vask = await lagByggeplassVasker(rader.map((r) => r.byggeplassId));
  if (rader.some((r) => r.byggeplassId && vask(r.byggeplassId, r.projectId) === null)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: FEIL_UTENFOR_PROSJEKT,
    });
  }
}
