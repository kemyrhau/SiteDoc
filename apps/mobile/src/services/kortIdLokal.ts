import { eq, sql } from "drizzle-orm";
import type { hentDatabase } from "../db/database";
import {
  byggeplassLocal,
  dagsseddelLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetTimerLocal,
  sheetUtleggLocal,
  vareforbrukLocal,
} from "../db/schema";
import { normaliserKortIder, type LokalKortRadType } from "../utils/kortIdNormalisering";

// Kort-id på telefonen: regelen står i ../utils/kortIdNormalisering.ts (ren, delt med
// migreringens backfill). Her: lesing/skriving mot den lokale databasen.

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

// ---------------------------------------------------------------------------
// Drizzle-adapter: lokale skriveveier og push
// ---------------------------------------------------------------------------

/**
 * Gjør sedelens lokale rader gyldige (kalles etter hver lokal skriving og før
 * push). Ukjent sedel → ingenting. Returnerer antall rader som fikk ny id.
 */
export function sikreLokalKortId(db: LokalDb, dagsseddelId: string): number {
  const [sedel] = db
    .select({
      userId: dagsseddelLocal.userId,
      dato: dagsseddelLocal.dato,
      projectId: dagsseddelLocal.projectId,
      byggeplassId: dagsseddelLocal.byggeplassId,
    })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, dagsseddelId))
    .all();
  if (!sedel) return 0;
  const [bp] = sedel.byggeplassId
    ? db
        .select({ id: byggeplassLocal.id, projectId: byggeplassLocal.projectId })
        .from(byggeplassLocal)
        .where(eq(byggeplassLocal.id, sedel.byggeplassId))
        .all()
    : [];
  const rowid = sql<number>`rowid`;
  const timer = db
    .select({
      id: sheetTimerLocal.id,
      kortId: sheetTimerLocal.kortId,
      projectId: sheetTimerLocal.projectId,
      byggeplassId: sheetTimerLocal.byggeplassId,
      ecoId: sheetTimerLocal.externalCostObjectId,
      erReise: sheetTimerLocal.erReise,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, dagsseddelId))
    .orderBy(rowid)
    .all();
  const tillegg = db
    .select({
      id: sheetTilleggLocal.id,
      kortId: sheetTilleggLocal.kortId,
      projectId: sheetTilleggLocal.projectId,
      byggeplassId: sheetTilleggLocal.byggeplassId,
      ecoId: sheetTilleggLocal.externalCostObjectId,
    })
    .from(sheetTilleggLocal)
    .where(eq(sheetTilleggLocal.dagsseddelId, dagsseddelId))
    .orderBy(rowid)
    .all();
  const utlegg = db
    .select({
      id: sheetUtleggLocal.id,
      kortId: sheetUtleggLocal.kortId,
      projectId: sheetUtleggLocal.projectId,
      byggeplassId: sheetUtleggLocal.byggeplassId,
      ecoId: sheetUtleggLocal.externalCostObjectId,
    })
    .from(sheetUtleggLocal)
    .where(eq(sheetUtleggLocal.dagsseddelId, dagsseddelId))
    .orderBy(rowid)
    .all();
  const maskin = db
    .select({
      id: sheetMachineLocal.id,
      kortId: sheetMachineLocal.kortId,
      projectId: sheetMachineLocal.projectId,
      byggeplassId: sheetMachineLocal.byggeplassId,
      ecoId: sheetMachineLocal.externalCostObjectId,
      sheetTimerId: sheetMachineLocal.sheetTimerId,
    })
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.dagsseddelId, dagsseddelId))
    .orderBy(rowid)
    .all();
  const vare = db
    .select({
      id: vareforbrukLocal.id,
      kortId: vareforbrukLocal.kortId,
      projectId: vareforbrukLocal.projectId,
      byggeplassId: vareforbrukLocal.byggeplassId,
      ecoId: vareforbrukLocal.externalCostObjectId,
      sheetTimerId: vareforbrukLocal.sheetTimerId,
    })
    .from(vareforbrukLocal)
    .where(eq(vareforbrukLocal.sheetId, dagsseddelId))
    .orderBy(rowid)
    .all();

  const endret = normaliserKortIder(
    {
      userId: sedel.userId,
      dato: sedel.dato,
      projectId: sedel.projectId,
      byggeplass: bp ?? null,
    },
    [
      ...timer.map((r) => ({ ...r, type: "timer" as const })),
      ...tillegg.map((r) => ({ ...r, type: "tillegg" as const })),
      ...utlegg.map((r) => ({ ...r, type: "utlegg" as const })),
      ...maskin.map((r) => ({ ...r, type: "maskin" as const })),
      ...vare.map((r) => ({ ...r, type: "vare" as const })),
    ],
  );
  if (endret.size === 0) return 0;
  const type = new Map<string, LokalKortRadType>([
    ...timer.map((r) => [r.id, "timer"] as const),
    ...tillegg.map((r) => [r.id, "tillegg"] as const),
    ...utlegg.map((r) => [r.id, "utlegg"] as const),
    ...maskin.map((r) => [r.id, "maskin"] as const),
    ...vare.map((r) => [r.id, "vare"] as const),
  ]);
  for (const [id, kortId] of endret) {
    switch (type.get(id)) {
      case "timer":
        db.update(sheetTimerLocal).set({ kortId }).where(eq(sheetTimerLocal.id, id)).run();
        break;
      case "tillegg":
        db.update(sheetTilleggLocal).set({ kortId }).where(eq(sheetTilleggLocal.id, id)).run();
        break;
      case "utlegg":
        db.update(sheetUtleggLocal).set({ kortId }).where(eq(sheetUtleggLocal.id, id)).run();
        break;
      case "maskin":
        db.update(sheetMachineLocal).set({ kortId }).where(eq(sheetMachineLocal.id, id)).run();
        break;
      case "vare":
        db.update(vareforbrukLocal).set({ kortId }).where(eq(vareforbrukLocal.id, id)).run();
        break;
    }
  }
  return endret.size;
}

