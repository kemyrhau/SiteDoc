import { eq } from "drizzle-orm";
import type { hentDatabase } from "../../../db/database";
import { sheetMachineLocal, sheetTimerLocal, vareforbrukLocal } from "../../../db/schema";
import type { TimerRad } from "../../../types/timer-detalj";
import { oppdaterTimerRad, type RadKontekst } from "./radLagring";

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/* ============================================================================
 *  ORDRE 36b: kort-spesifikke skrivinger — «Flytt raden» og kortets
 *  byggeplass på koblet maskin. Ligger UTENFOR `radLagring.ts` med vilje:
 *  radLagring er en kopi av dagskortets skrivesemantikk og holdes lik den av
 *  `radLagring-glue-vakt.test.ts`. Dette er ny atferd som dagskortet ikke har.
 *
 *  Mål-byggeplassen er det som SKAL LAGRES (`lagretByggeplassForKort`):
 *  `null` = arver sedelens byggeplass.
 * ============================================================================ */

export type FlyttMaal = {
  projectId: string;
  byggeplassId: string | null;
  ecoId: string | null;
};

/**
 * Koblet maskin følger timer-raden (Kenneth GO punkt 5): prosjekt, byggeplass
 * og underprosjekt kopieres fra timer-raden. Ingen koblet maskin → no-op.
 */
export function foelgKobletMaskin(db: LokalDb, timerRadId: string): void {
  const rad = db
    .select({
      projectId: sheetTimerLocal.projectId,
      byggeplassId: sheetTimerLocal.byggeplassId,
      externalCostObjectId: sheetTimerLocal.externalCostObjectId,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, timerRadId))
    .all()[0];
  if (!rad) return;
  const maskin = db
    .select()
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.sheetTimerId, timerRadId))
    .all()[0];
  if (!maskin) return;
  if (
    maskin.projectId === rad.projectId &&
    (maskin.byggeplassId ?? null) === (rad.byggeplassId ?? null) &&
    (maskin.externalCostObjectId ?? null) === (rad.externalCostObjectId ?? null)
  ) {
    return;
  }
  db.update(sheetMachineLocal)
    .set({
      projectId: rad.projectId,
      byggeplassId: rad.byggeplassId ?? null,
      externalCostObjectId: rad.externalCostObjectId ?? null,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetMachineLocal.id, maskin.id))
    .run();
}

/**
 * Flytt en timer-rad til et annet kort. Alle andre felt beholdes (tider,
 * lønnsart, aktivitet, beskrivelse, matpause); underprosjektet tas fra
 * målkortet. Koblet maskin følger.
 */
export function flyttTimerRad(db: LokalDb, kontekst: RadKontekst, rad: TimerRad, til: FlyttMaal): void {
  oppdaterTimerRad(db, kontekst, rad.id, {
    projectId: til.projectId,
    byggeplassId: til.byggeplassId,
    lonnsartId: rad.lonnsartId,
    aktivitetId: rad.aktivitetId,
    timer: rad.timer,
    externalCostObjectId: til.ecoId,
    fraTid: rad.fraTid,
    tilTid: rad.tilTid,
    beskrivelse: rad.beskrivelse,
    pauseMin: rad.pauseMin,
  });
  foelgKobletMaskin(db, rad.id);
}

/**
 * Flytt en maskin-rad alene. Er den koblet til en timer-rad, kobles den løs
 * (`sheetTimerId = null`) — ellers ville neste lagring av timer-raden dratt
 * den tilbake. Kapasitetssjekken gjøres av kalleren før flytt.
 */
export function flyttMaskinRad(db: LokalDb, radId: string, til: FlyttMaal): void {
  db.update(sheetMachineLocal)
    .set({
      projectId: til.projectId,
      byggeplassId: til.byggeplassId,
      externalCostObjectId: til.ecoId,
      sheetTimerId: null,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetMachineLocal.id, radId))
    .run();
}

/**
 * Lokal del av vare-flytt. En `pending` linje sendes med de nye verdiene ved
 * neste sync (`vareforbruk.opprett`); en `synced` linje må i tillegg flyttes
 * på server (`vareforbruk.oppdater`) — det gjør kalleren FØR denne kalles.
 * Linjen finnes kanskje ikke lokalt (bare på server) → no-op.
 */
export function flyttVareLokalt(db: LokalDb, vareId: string, til: FlyttMaal): void {
  db.update(vareforbrukLocal)
    .set({
      projectId: til.projectId,
      byggeplassId: til.byggeplassId,
      externalCostObjectId: til.ecoId,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(vareforbrukLocal.id, vareId))
    .run();
}
