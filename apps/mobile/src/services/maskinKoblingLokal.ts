import { eq } from "drizzle-orm";
import { maskinKreverTimerad } from "@sitedoc/shared";
import type { hentDatabase } from "../db/database";
import { equipmentLocal, sheetMachineLocal, sheetTimerLocal } from "../db/schema";
import { erReiseRadVisning } from "../utils/reiseRad";
import { arbeidsraderForMaskin, type TimeradKandidat } from "../utils/maskinTimerad";

/* ============================================================================
 *  Kort-id d2c-2 (spec § 12.2 R24): oppslag i den lokale databasen for
 *  koblingen maskin → timerad. Virker uten nett — alt leses fra SQLite.
 *  Enheten kommer fra `equipment_local.utleie_enhet` (fylt av maskinlista);
 *  ukjent maskin eller ukjent enhet krever timerad (H15 = A).
 * ============================================================================ */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/** Maskinens utleieenhet fra den lokale maskinlista (null = ukjent). */
export function utleieEnhetLokalt(db: LokalDb, vehicleId: string): string | null {
  const [e] = db
    .select({ utleieEnhet: equipmentLocal.utleieEnhet })
    .from(equipmentLocal)
    .where(eq(equipmentLocal.id, vehicleId))
    .all();
  return e?.utleieEnhet ?? null;
}

/** Visningsnavn som ellers i appen: merke + modell, ellers internt navn, ellers id. */
export function maskinNavnLokalt(db: LokalDb, vehicleId: string): string {
  const [e] = db.select().from(equipmentLocal).where(eq(equipmentLocal.id, vehicleId)).all();
  if (!e) return vehicleId;
  return `${e.merke ?? ""} ${e.modell ?? ""}`.trim() || e.internNavn || vehicleId;
}

/** Sedelens timerader som kandidater for maskinvinduet (reise etter visningsregelen). */
export function timeradKandidaterLokalt(
  db: LokalDb,
  sheetId: string,
  reiseLonnsartId: string | null,
): Array<TimeradKandidat & { externalCostObjectId: string | null; utenProsjekt: boolean }> {
  return db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all()
    .map((r) => ({
      id: r.id,
      projectId: r.utenProsjekt ? null : r.projectId,
      kortId: r.kortId ?? null,
      timer: r.timer,
      erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
      fraTid: r.fraTid,
      tilTid: r.tilTid,
      externalCostObjectId: r.externalCostObjectId ?? null,
      utenProsjekt: !!r.utenProsjekt,
    }));
}

/**
 * Dagskort-modus: bøttas arbeidsrader (prosjekt + underprosjekt), som maskin-taket.
 * En rad uten prosjekt arver sedelens (`sedelProjectId`), som i dagskortet ellers.
 */
export function arbeidsraderIBotteLokalt(
  db: LokalDb,
  sheetId: string,
  botte: { projectId: string; ecoId: string | null; sedelProjectId: string },
  reiseLonnsartId: string | null,
): TimeradKandidat[] {
  return arbeidsraderForMaskin(
    timeradKandidaterLokalt(db, sheetId, reiseLonnsartId)
      .filter((r) => !r.utenProsjekt)
      .map((r) => ({ ...r, projectId: r.projectId ?? botte.sedelProjectId }))
      .filter((r) => r.projectId === botte.projectId && r.externalCostObjectId === (botte.ecoId ?? null)),
  );
}

/**
 * Maskinene på raden som krever timerad (R24), med navn, i ført rekkefølge.
 * Døgn-maskiner gis ikke tilbake — de kan stå uten timerad.
 */
export function maskinerSomKreverRadenLokalt(
  db: LokalDb,
  radId: string,
): Array<{ id: string; vehicleId: string; navn: string }> {
  return db
    .select()
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.sheetTimerId, radId))
    .all()
    .filter((m) => maskinKreverTimerad(utleieEnhetLokalt(db, m.vehicleId)))
    .map((m) => ({ id: m.id, vehicleId: m.vehicleId, navn: maskinNavnLokalt(db, m.vehicleId) }));
}
