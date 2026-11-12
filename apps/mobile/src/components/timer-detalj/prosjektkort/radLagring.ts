import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { hentDatabase } from "../../../db/database";
import { sheetTimerLocal, sheetMachineLocal, slettedeRaderLocal } from "../../../db/schema";
import { erReiseLonnsartLokalt } from "../../../services/timerKatalog";
import { settInnTimerRad } from "../../../services/nyTimerRad";
import {
  maskinerOverRadEtterLagring,
  skrivKobledeMaskiner,
  type MaskinEndringer,
  type NyMaskin,
} from "../../../services/kobledeMaskiner";

/* ============================================================================
 *  ORDRE 36b (lagring C, Kenneth 2026-11-07): skrivestien for timer- og
 *  maskinrader i prosjektkort-flyten (dagsoversikt + kortskjerm).
 *
 *  KOPI av skrivesemantikken i `TimerSeksjon.tsx` (leggTil/oppdater/
 *  fjern) og `MaskinSeksjon.tsx` (leggTil/oppdater/fjern),
 *  som dagskortet fortsatt bruker urørt. `db` sprøytes inn så kontrakt-testene
 *  kan måle DB-effekten mot ekte SQLite. `radLagring-glue-vakt.test.ts` FEILER
 *  hvis nøkkelsett eller kall i én kopi endres uten den andre — en fiks i én
 *  kopi skal vurderes i den andre (docs/claude/timer.md § Prosjektkort-rute).
 * ============================================================================ */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export interface RadKontekst {
  sheetId: string;
  organizationId: string;
}

/** Feltene timer-modalen lagrer (samme argumenter som TimerSeksjon). */
export interface TimerRadFelt {
  projectId: string;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  externalCostObjectId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse: string | null;
  /** V20 PK2: radens matpause-bærer (0 ellers), avgjort i RadSkjema. */
  pauseMin: number;
}

/** Feltene maskin-modalen lagrer (samme argumenter som MaskinSeksjon). */
export interface MaskinRadFelt {
  projectId: string;
  ecoId: string | null;
  vehicleId: string;
  timer: number;
  mengde: number | null;
  enhet: string | null;
  fraTid: string | null;
  tilTid: string | null;
}

/** Ny timer-rad (+ 0..n koblede maskiner). Returnerer radens id. */
export function leggTilTimerRad(
  db: LokalDb,
  { sheetId, organizationId }: RadKontekst,
  felt: TimerRadFelt,
  maskiner: NyMaskin[],
): string {
  return settInnTimerRad(db, sheetId, organizationId, { ...felt, maskiner });
}

export type OppdaterRadResultat = { ok: true } | { ok: false; grunn: "maskinOverRad" };

/**
 * Oppdater en timer-rad. `maskiner` (NY BESLUTNING maskinkobling 2026-11-12):
 *   undefined = ikke rør maskin-rader,
 *   objekt    = linjer med id oppdateres, linjer uten id settes inn,
 *               `fjernede` slettes; koblede maskiner som ikke er nevnt, røres ikke.
 * Maskintimer settes aldri fra radens timer. Går en koblet maskin over radens
 * timer, skrives ingenting og resultatet er `maskinOverRad`.
 */
export function oppdaterTimerRad(
  db: LokalDb,
  { sheetId, organizationId }: RadKontekst,
  radId: string,
  felt: TimerRadFelt,
  maskiner?: MaskinEndringer,
): OppdaterRadResultat {
  const {
    projectId: radProjectId,
    byggeplassId,
    lonnsartId,
    aktivitetId,
    timer,
    externalCostObjectId,
    fraTid,
    tilTid,
    beskrivelse,
    pauseMin,
  } = felt;
  // B4 (L2-B): tidKilde = manuell kun når fra/til FAKTISK endres.
  const gammel = db
    .select({
      fraTid: sheetTimerLocal.fraTid,
      tilTid: sheetTimerLocal.tilTid,
      reiseKilde: sheetTimerLocal.reiseKilde,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, radId))
    .all()[0];
  const tidEndret =
    gammel != null &&
    ((gammel.fraTid ?? null) !== (fraTid ?? null) ||
      (gammel.tilTid ?? null) !== (tilTid ?? null));
  // B4: re-utled erReise fra (ev. byttet) lønnsart — ikke reise renser sporet,
  // matrise-rad beholder sporet, manuell reise får reiseKilde «manuell».
  const erReise = erReiseLonnsartLokalt(organizationId, lonnsartId);
  const reiseSet = !erReise
    ? {
        erReise: false,
        reiseKilde: null,
        reiseRetning: null,
        reiseKjoretidMin: null,
        reiseAvstandM: null,
        reiseRegel: null,
      }
    : gammel?.reiseKilde === "matrise"
      ? { erReise: true as const }
      : {
          erReise: true as const,
          reiseKilde: "manuell" as const,
          reiseRetning: null,
          reiseKjoretidMin: null,
          reiseAvstandM: null,
          reiseRegel: null,
        };
  // NY BESLUTNING maskinkobling (Kenneth 2026-11-12): maskintimer følger ALDRI
  // raden stille. Ville en koblet maskin fått flere timer enn raden, avvises
  // hele lagringen før noe skrives (rad-modalen sier fra og ber om retting).
  if (maskinerOverRadEtterLagring(db, radId, timer, maskiner).length > 0) {
    return { ok: false as const, grunn: "maskinOverRad" as const };
  }
  db.update(sheetTimerLocal)
    .set({
      projectId: radProjectId,
      byggeplassId,
      lonnsartId,
      aktivitetId,
      timer,
      externalCostObjectId,
      fraTid,
      tilTid,
      beskrivelse,
      pauseMin,
      ...reiseSet,
      ...(tidEndret ? { tidKilde: "manuell" as const } : {}),
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetTimerLocal.id, radId))
    .run();
  // NY BESLUTNING: bare maskinlinjene modalen sender, skrives. Koblede maskiner
  // som ikke er nevnt, røres ikke. undefined = ingen maskin røres.
  if (maskiner !== undefined) {
    skrivKobledeMaskiner(
      db,
      sheetId,
      radId,
      { projectId: radProjectId, byggeplassId, externalCostObjectId, timer, fraTid, tilTid },
      maskiner,
    );
  }
  return { ok: true };
}

/** Slett timer-rad + tombstone med radens serverVersjon, ATOMISK (V19.9.1 / S-A). */
export function fjernTimerRad(db: LokalDb, { sheetId }: RadKontekst, radId: string): void {
  // Leses før tx så verdien finnes når raden er borte. null = ukjent → S4.
  const radForSletting = db
    .select({ serverVersjon: sheetTimerLocal.serverVersjon })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, radId))
    .all()[0];
  db.transaction((tx) => {
    tx.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, radId)).run();
    tx.insert(slettedeRaderLocal)
      .values({
        radId,
        dagsseddelId: sheetId,
        radType: "timer",
        serverVersjon: radForSletting?.serverVersjon ?? null,
        slettetVed: Date.now(),
      })
      .onConflictDoNothing()
      .run();
  });
}

/** Ny frittstående maskin-rad. Returnerer radens id. */
export function leggTilMaskinRad(db: LokalDb, { sheetId }: RadKontekst, felt: MaskinRadFelt): string {
  const { projectId: radProjectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid } = felt;
  const id = randomUUID();
  db.insert(sheetMachineLocal)
    .values({
      id,
      dagsseddelId: sheetId,
      projectId: radProjectId,
      externalCostObjectId: ecoId,
      vehicleId,
      timer,
      mengde,
      enhet,
      fraTid,
      tilTid,
      sistEndretLokalt: Date.now(),
    })
    .run();
  return id;
}

export function oppdaterMaskinRad(db: LokalDb, _kontekst: RadKontekst, radId: string, felt: MaskinRadFelt): void {
  const { projectId: radProjectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid } = felt;
  db.update(sheetMachineLocal)
    .set({
      projectId: radProjectId,
      externalCostObjectId: ecoId,
      vehicleId,
      timer,
      mengde,
      enhet,
      fraTid,
      tilTid,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetMachineLocal.id, radId))
    .run();
}

/** Slett maskin-rad + tombstone ATOMISK (S-A). Maskin-tombstonen har ingen serverVersjon. */
export function fjernMaskinRad(db: LokalDb, { sheetId }: RadKontekst, radId: string): void {
  db.transaction((tx) => {
    tx.delete(sheetMachineLocal)
      .where(eq(sheetMachineLocal.id, radId))
      .run();
    tx.insert(slettedeRaderLocal)
      .values({
        radId,
        dagsseddelId: sheetId,
        radType: "maskin",
        slettetVed: Date.now(),
      })
      .onConflictDoNothing()
      .run();
  });
}
