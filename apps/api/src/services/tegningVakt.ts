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

/**
 * Prosjektisolering for byggeplass-referanser på dokumenter (ORDRE 21): en `byggeplassId` som
 * skrives på en sjekkliste MÅ tilhøre dokumentets prosjekt. Søster av vakten over, med samme
 * `db`-parameter (kan kjøres i transaksjon). `krevByggeplassIProsjekt` i
 * `routes/timer/byggeplass-rad.ts` gjør det samme for timer-rader, men bruker den globale
 * klienten og bor i firmamodulen — derfor ikke gjenbrukt her.
 */
export async function verifiserByggeplassIProsjekt(
  db: TxClient,
  byggeplassId: string,
  projectId: string,
): Promise<void> {
  const byggeplass = await db.byggeplass.findUnique({
    where: { id: byggeplassId },
    select: { projectId: true },
  });
  if (!byggeplass || byggeplass.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Byggeplassen hører til et annet prosjekt.",
    });
  }
}

/**
 * Prosjektisolering for område-referanser (ORDRE 29 #13): en `omradeId` som skrives på et
 * dokument (oppgave, sjekkliste) eller et kontrollplanpunkt MÅ tilhøre samme prosjekt. Med
 * `byggeplassId` kreves i tillegg at området ligger på den byggeplassen (kontrollplanen er
 * byggeplass-bundet). Oppgave/sjekkliste sjekker bare prosjekt — dokumentets byggeplass kan
 * følge tegningen og sjekkes separat.
 */
export async function verifiserOmradeIProsjekt(
  db: TxClient,
  omradeId: string,
  projectId: string,
  byggeplassId?: string | null,
): Promise<void> {
  const omrade = await db.omrade.findUnique({
    where: { id: omradeId },
    select: { projectId: true, byggeplassId: true },
  });
  if (!omrade || omrade.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Området hører til et annet prosjekt.",
    });
  }
  if (byggeplassId && omrade.byggeplassId !== byggeplassId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Området hører til en annen byggeplass.",
    });
  }
}
