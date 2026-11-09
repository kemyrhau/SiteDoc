import { eq } from "drizzle-orm";
import type { hentDatabase } from "../../../db/database";
import { dagsseddelLocal, sheetMachineLocal, sheetTimerLocal, vareforbrukLocal } from "../../../db/schema";
import { effektivByggeplass, type KortValg, type SedelKortKontekst } from "../../../lib/prosjektkortMobil";
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

/**
 * RETUR 36c-2 P1 (a2): trengs løft før kortet `kort` kan lagres? Ja når kortet
 * er «Uten byggeplass» og en rad uten byggeplass ellers ville arvet sedelens.
 */
export function trengerByggeplassLoft(kort: KortValg, sedel: SedelKortKontekst): boolean {
  return kort.byggeplassId === null && effektivByggeplass(kort.projectId, null, sedel) !== null;
}

/**
 * RETUR 36c-2 P1 (a2): «Uten byggeplass» på en sedel som har byggeplass A —
 * løft arven ut, uten migrering. Arvende timer- og maskinrader (byggeplass
 * NULL, samme prosjekt som A) får A skrevet eksplisitt, og sedelens byggeplass
 * nullstilles. Etterpå betyr NULL på en rad ekte «uten» for server, web og
 * gamle klienter (`rad ?? sedel` = null). Reise-rader har aldri byggeplass og
 * røres ikke. Én transaksjon; kalleren markerer sedelen endret (sync).
 * Ingen arv å løfte → no-op (false).
 */
export function loftByggeplassArv(db: LokalDb, sheetId: string, sedel: SedelKortKontekst): boolean {
  const a = sedel.byggeplass;
  if (!a) return false;
  const arver = (projectId: string | null, byggeplassId: string | null) =>
    !byggeplassId && (projectId ?? sedel.projectId) === a.projectId;
  const naa = Date.now();
  db.transaction((tx) => {
    const timer = tx
      .select({
        id: sheetTimerLocal.id,
        projectId: sheetTimerLocal.projectId,
        byggeplassId: sheetTimerLocal.byggeplassId,
        erReise: sheetTimerLocal.erReise,
      })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all();
    for (const r of timer) {
      if (r.erReise || !arver(r.projectId, r.byggeplassId)) continue;
      tx.update(sheetTimerLocal)
        .set({ byggeplassId: a.id, sistEndretLokalt: naa })
        .where(eq(sheetTimerLocal.id, r.id))
        .run();
    }
    const maskiner = tx
      .select({ id: sheetMachineLocal.id, projectId: sheetMachineLocal.projectId, byggeplassId: sheetMachineLocal.byggeplassId })
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all();
    for (const m of maskiner) {
      if (!arver(m.projectId, m.byggeplassId)) continue;
      tx.update(sheetMachineLocal)
        .set({ byggeplassId: a.id, sistEndretLokalt: naa })
        .where(eq(sheetMachineLocal.id, m.id))
        .run();
    }
    tx.update(dagsseddelLocal)
      .set({ byggeplassId: null, sistEndretLokalt: naa, syncStatus: "pending" })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
  });
  return true;
}
