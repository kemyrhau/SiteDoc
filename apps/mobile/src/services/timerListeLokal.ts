import { and, desc, eq, gte, lte } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetTimerLocal,
  sheetTilleggLocal,
  sheetMachineLocal,
} from "../db/schema";
import { dedupPerDato, velgEldsteKonflikt, type DedupRad } from "../utils/dagsseddelListeVisning";

/**
 * Lokale lesinger for timer-lista, ukesummen og statusbaren.
 *
 * POST 2026-11-15 (14) punkt 1: alle filtreres på VALGT firma
 * (`organizationId = orgId`). En bruker har dagssedler kun i firmaet hen er
 * aktivt ansatt i (Kenneth 2026-11-15); i et annet valgt firma blir lista tom,
 * og en sedel fra et annet firma kan ikke åpnes fra lista. `orgId` mangler
 * (ingen firma valgt) → ingenting vises. Testet i `timerListeLokal.test.ts`.
 */

export interface DagsseddelRad extends DedupRad {
  id: string;
  status: string;
  beskrivelse: string | null;
  totaltimer: number;
  antallRader: number;
}

export function lesDagssedlerLokalt(
  userId: string,
  orgId: string | null | undefined,
): DagsseddelRad[] {
  const db = hentDatabase();
  if (!db || !orgId) return [];

  const sedler = db
    .select()
    .from(dagsseddelLocal)
    .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.organizationId, orgId)))
    .orderBy(desc(dagsseddelLocal.dato))
    .all();

  const rader = sedler.map((s) => {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    // Innhold = timer- ELLER tillegg- ELLER maskin-rader. Tillegg/maskin telles
    // for at en sedel som kun bærer tillegg/maskin ikke feilklassifiseres som tom.
    const antallTillegg = db
      .select({ id: sheetTilleggLocal.id })
      .from(sheetTilleggLocal)
      .where(eq(sheetTilleggLocal.dagsseddelId, s.id))
      .all().length;
    const antallMaskin = db
      .select({ id: sheetMachineLocal.id })
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, s.id))
      .all().length;
    return {
      id: s.id,
      dato: s.dato,
      status: s.status,
      syncStatus: s.syncStatus,
      beskrivelse: s.beskrivelse,
      totaltimer: timer.reduce((acc, t) => acc + t.timer, 0),
      antallRader: timer.length,
      harInnhold: timer.length > 0 || antallTillegg > 0 || antallMaskin > 0,
    };
  });

  return dedupPerDato(rader);
}

function ukestart(dato: Date): Date {
  const d = new Date(dato);
  const dag = d.getDay(); // 0 = Sun
  const offset = dag === 0 ? -6 : 1 - dag; // mandag som ukestart
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isoUkenummer(dato: Date): number {
  const d = new Date(dato);
  const torsdag = new Date(d);
  torsdag.setDate(d.getDate() + 3);
  const aar = torsdag.getFullYear();
  const start = new Date(aar, 0, 1);
  const dager = Math.floor((torsdag.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.ceil((dager + start.getDay() + 1) / 7);
}

/** Innværende ukes totalsum for valgt firma (UkeTotalBanner). */
export function lesUkeTotalLokalt(
  userId: string,
  orgId: string | null | undefined,
  naa: Date = new Date(),
): { totalt: number; antall: number; ukeNr: number } {
  const start = ukestart(naa);
  const ukeNr = isoUkenummer(start);
  const db = hentDatabase();
  if (!db || !orgId) return { totalt: 0, antall: 0, ukeNr };

  const slutt = new Date(start);
  slutt.setDate(slutt.getDate() + 6);

  const sedler = db
    .select()
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.organizationId, orgId),
        gte(dagsseddelLocal.dato, formatIso(start)),
        lte(dagsseddelLocal.dato, formatIso(slutt)),
      ),
    )
    .all();

  let totalt = 0;
  for (const s of sedler) {
    const timer = db
      .select({ timer: sheetTimerLocal.timer })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, s.id))
      .all();
    totalt += timer.reduce((acc, t) => acc + t.timer, 0);
  }
  return { totalt, antall: sedler.length, ukeNr };
}

/** Eldste konflikt-sedel i valgt firma — statusbaren åpner den. */
export function finnEldsteKonfliktSedelId(
  userId: string | undefined,
  orgId: string | null | undefined,
): string | null {
  const db = hentDatabase();
  if (!db || !userId || !orgId) return null;
  const sedler = db
    .select({
      id: dagsseddelLocal.id,
      dato: dagsseddelLocal.dato,
      syncStatus: dagsseddelLocal.syncStatus,
    })
    .from(dagsseddelLocal)
    .where(
      and(
        eq(dagsseddelLocal.userId, userId),
        eq(dagsseddelLocal.organizationId, orgId),
        eq(dagsseddelLocal.syncStatus, "conflict"),
      ),
    )
    .all();
  return velgEldsteKonflikt(sedler);
}
