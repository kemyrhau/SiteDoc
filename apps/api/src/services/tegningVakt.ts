import { type Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";

type TxClient = Prisma.TransactionClient;

/**
 * Prosjektisolering for tegnings-referanser (CLAUDE.md — regelen uten unntak): en `drawingId`
 * som skrives på et dokument (oppgave, sjekkliste) eller et kontrollplanpunkt MÅ tilhøre samme
 * prosjekt som objektet. Delt av alle dører som skriver feltet — `oppgave.opprett`/`oppdater`,
 * `sjekkliste.oppdater`, `kontrollplan.settPunktPlassering` — så vakten ikke drifter mellom dem.
 *
 * Sjekker tegningens EGEN `projectId` (ORDRE 20, Kenneth 2026-11-06): en tegning uten byggeplass
 * («løs», vist under «Kart» på mobil) hører like fullt til prosjektet. Tidligere gikk sjekken via
 * `drawing.byggeplass.projectId` og avviste slike tegninger. `null`-tegning (fjerning) er
 * kallerens no-op — trenger ingen isolasjonssjekk.
 */
export async function verifiserTegningIProsjekt(
  db: TxClient,
  drawingId: string,
  projectId: string,
): Promise<void> {
  const drawing = await db.drawing.findUnique({
    where: { id: drawingId },
    select: { projectId: true },
  });
  if (!drawing || drawing.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tegningen hører til et annet prosjekt.",
    });
  }
}
