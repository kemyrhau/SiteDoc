import { type Prisma } from "@sitedoc/db";

type TxClient = Prisma.TransactionClient;

/**
 * Oppgavens byggeplass (ORDRE 28, 2026-11-06). `Task.byggeplassId` er egen kolonne, speilet
 * etter Checklist. Regelen for hva som skrives — ÉN kilde for `oppgave.opprett` og `oppdater`:
 *
 * 1. Har (effektiv) tegning en byggeplass, VINNER den — også over klientens valg. En pin på
 *    HABUs tegning kan ikke samtidig ligge på en annen byggeplass.
 * 2. Ellers (ingen tegning / prosjekt-tegning uten byggeplass): klientens valg når det er sendt
 *    (`null` = eksplisitt «hele prosjektet»).
 * 3. Ellers: arvet fra sjekklisten oppgaven opprettes fra (rad-/felt-oppgave), så dagens verdi.
 *
 * `undefined` betyr «ikke rørt» gjennomgående; `null` er en verdi.
 */
export function velgTaskByggeplass(a: {
  /** Byggeplassen til tegningen oppgaven får/har etter skrivingen; null = ingen/prosjekt-tegning. */
  tegningensByggeplassId: string | null;
  oensket: string | null | undefined;
  arvet?: string | null;
  naavaerende?: string | null;
}): string | null {
  if (a.tegningensByggeplassId) return a.tegningensByggeplassId;
  if (a.oensket !== undefined) return a.oensket;
  return a.arvet ?? a.naavaerende ?? null;
}

/** Tegningens byggeplass (null for prosjekt-tegning eller ukjent tegning). */
export async function hentTegningensByggeplassId(
  db: TxClient,
  drawingId: string | null | undefined,
): Promise<string | null> {
  if (!drawingId) return null;
  const d = await db.drawing.findUnique({ where: { id: drawingId }, select: { byggeplassId: true } });
  return d?.byggeplassId ?? null;
}

/**
 * Sjekklistens byggeplass for en oppgave som opprettes fra den — kun når sjekklisten hører til
 * samme prosjekt (prosjektisolering: en fremmed checklistId skal ikke smugle inn en byggeplass).
 */
export async function hentArvetSjekklisteByggeplassId(
  db: TxClient,
  checklistId: string | null | undefined,
  projectId: string,
): Promise<string | null> {
  if (!checklistId) return null;
  const c = await db.checklist.findUnique({
    where: { id: checklistId },
    select: { byggeplassId: true, template: { select: { projectId: true } } },
  });
  return c && c.template.projectId === projectId ? c.byggeplassId : null;
}
