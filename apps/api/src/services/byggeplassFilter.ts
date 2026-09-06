import type { Prisma } from "@sitedoc/db";

/**
 * Byggeplass-filter — ÉN kilde for byggeplass-tilhørighetsregelen i lister
 * (dokumentsøk/byggeplass-tilhørighet-runden 2026-09-06).
 *
 * Regelen: «et objekt vises der det gjelder». Et prosjekt-objekt (uten byggeplass)
 * gjelder HELE prosjektet og skal ALDRI forsvinne når en byggeplass velges — det
 * ville skjult et dokument som gjelder. Filteret er derfor MYKT: valgt byggeplass
 * ELLER byggeplass-løst.
 *
 * To former, fordi datamodellen er asymmetrisk:
 * - Form A (`byggeplassFilterViaTegning`): `Task` har INGEN egen `byggeplassId`;
 *   tilhørighet finnes kun via tegningen (`drawing.byggeplassId`). Derfor TRE ledd:
 *   (1) oppgave på valgt byggeplass' tegning, (2) oppgave på en PROSJEKT-tegning
 *   (`drawing.byggeplassId = null`), (3) oppgave uten tegning (`drawingId = null`).
 *   Ledd (2) er det som glapp i ni håndspeilede kopier og skjulte oppgaver på
 *   prosjekt-tegninger — nettopp tilstanden det myke tegningsfilteret skal bevare.
 * - Form B (`byggeplassFilterDirekte`): `Checklist`/`Drawing` har `byggeplassId`
 *   selv. TO ledd: valgt byggeplass ELLER byggeplass-løs.
 *
 * Begge dekker én byggeplass (`string`) og flere (`string[]` → `{ in }`, firma-
 * oversikten). Tom id → `null` slik at kallstedene beholder `...(x ?? {})`.
 *
 * Erstattet ni kopier (fire form A, fem form B). Endres regelen, endres den her —
 * kallstedene bærer ikke egne regel-kommentarer.
 */

type ByggeplassIdMatch = string | { in: string[] };

function erTom(id: string | string[] | null | undefined): boolean {
  // Speiler kallstedenes gamle `input.byggeplassId ? … : {}`: tom streng er falsy
  // → intet filter. `!id` dekker null/undefined/""; array håndteres separat.
  if (Array.isArray(id)) return id.length === 0;
  return !id;
}

function tilMatch(id: string | string[]): ByggeplassIdMatch {
  return Array.isArray(id) ? { in: id } : id;
}

/** Form A — byggeplass via tegning (Task). Tre ledd. `null` når id er tom. */
export function byggeplassFilterViaTegning(
  byggeplassId: string | string[] | null | undefined,
): Prisma.TaskWhereInput | null {
  if (erTom(byggeplassId)) return null;
  const match = tilMatch(byggeplassId!);
  return {
    OR: [
      { drawing: { byggeplassId: match } },
      { drawing: { byggeplassId: null } },
      { drawingId: null },
    ],
  };
}

/**
 * Form B — byggeplass direkte (Checklist/Drawing). To ledd. `null` når id er tom.
 * Nøytral struktur (ikke bundet til én modell) siden begge modellene deler
 * `byggeplassId` — assignerbar til både `ChecklistWhereInput` og `DrawingWhereInput`.
 */
export function byggeplassFilterDirekte(
  byggeplassId: string | string[] | null | undefined,
): { OR: Array<{ byggeplassId: ByggeplassIdMatch | null }> } | null {
  if (erTom(byggeplassId)) return null;
  const match = tilMatch(byggeplassId!);
  return { OR: [{ byggeplassId: match }, { byggeplassId: null }] };
}
