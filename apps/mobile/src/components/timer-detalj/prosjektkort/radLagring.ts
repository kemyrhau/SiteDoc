import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { hentDatabase } from "../../../db/database";
import { sheetTimerLocal, sheetMachineLocal, slettedeRaderLocal } from "../../../db/schema";
import { hentReiseLonnsartId } from "../../../services/timerKatalog";
import { skrivMedMaskinVakt } from "../../../services/maskinJobbLokalt";
import type { MaskinJobbBrudd } from "@sitedoc/shared";
import { settInnTimerRad, type NyRad } from "../../../services/nyTimerRad";
import {
  maskinerOverRadEtterLagring,
  skrivKobledeMaskiner,
  type MaskinEndringer,
  type NyMaskin,
} from "../../../services/kobledeMaskiner";
import { sikreLokalKortId } from "../../../services/kortIdLokal";

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
  /**
   * `null` bare for fraværskortets rader (spec § 11.2). Oppdatering rører aldri
   * `uten_prosjekt`, så en fraværsrad forblir i fraværskortet.
   */
  projectId: string | null;
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
  /** Ordre c (T11): kortets id ved NY rad. `oppdaterTimerRad` rører den aldri. */
  kortId?: string | null;
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
  /** Kort-id d2c-2 (R24): timeraden maskinen står på (null = uten timerad). */
  sheetTimerId: string | null;
}

/** Ny timer-rad (+ 0..n koblede maskiner). Returnerer radens id. */
export function leggTilTimerRad(
  db: LokalDb,
  { sheetId, organizationId }: RadKontekst,
  felt: TimerRadFelt,
  maskiner: NyMaskin[],
  // Ordre (9): terskel/bånd-sporet fra «+ Reise» (kun ny reise-rad).
  reiseSpor?: NyRad["reiseSpor"],
): string {
  return settInnTimerRad(db, sheetId, organizationId, { ...felt, maskiner, reiseSpor });
}

export type OppdaterRadResultat =
  | { ok: true }
  | { ok: false; grunn: "maskinOverRad" }
  | { ok: false; grunn: "maskinOverArbeid"; brudd: MaskinJobbBrudd[] };

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
  kontekst: RadKontekst,
  radId: string,
  felt: TimerRadFelt,
  maskiner?: MaskinEndringer,
): OppdaterRadResultat {
  const { sheetId, organizationId } = kontekst;
  const { timer } = felt;
  // NY BESLUTNING maskinkobling (Kenneth 2026-11-12): maskintimer følger ALDRI
  // raden stille. Ville en koblet maskin fått flere timer enn raden, avvises
  // hele lagringen før noe skrives (rad-modalen sier fra og ber om retting).
  if (maskinerOverRadEtterLagring(db, radId, timer, maskiner).length > 0) {
    return { ok: false as const, grunn: "maskinOverRad" as const };
  }
  // w9m (WM108): senkes arbeidet så en maskin på jobben blir over, stopper
  // lagringen her — samme vakt som serveren, regnet etter kort-id-utledningen.
  const brudd = skrivMedMaskinVakt(db, sheetId, hentReiseLonnsartId(organizationId), (tx) =>
    skrivTimerRadUtenVakt(tx, kontekst, radId, felt, maskiner),
  );
  if (brudd.length > 0) return { ok: false, grunn: "maskinOverArbeid", brudd };
  return { ok: true };
}

/**
 * Selve skrivingen i `oppdaterTimerRad`, uten maskinvakt. KUN for kallere som
 * selv vakter hele skrivingen: «Flytt kort» (`flyttKort` sjekker
 * `girNyttBrudd` på hele flyttet før transaksjonen) — en vakt pr. rad ville sett
 * kortet halvveis flyttet og rullet tilbake.
 */
export function skrivTimerRadUtenVakt(
  tx: LokalDb,
  { sheetId, organizationId }: RadKontekst,
  radId: string,
  felt: TimerRadFelt,
  maskiner?: MaskinEndringer,
): void {
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
  const gammel = tx
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
  // O25: redigering skifter aldri arbeid ↔ reise — radens flagg og reisespor står.
  tx.update(sheetTimerLocal)
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
      ...(tidEndret ? { tidKilde: "manuell" as const } : {}),
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetTimerLocal.id, radId))
    .run();
  // NY BESLUTNING: bare maskinlinjene modalen sender, skrives. Koblede maskiner
  // som ikke er nevnt, røres ikke. undefined = ingen maskin røres.
  if (maskiner !== undefined) {
    // Fraværskortet bærer aldri maskin (K8).
    if (radProjectId !== null)
      skrivKobledeMaskiner(
        tx,
        sheetId,
        radId,
        { projectId: radProjectId, byggeplassId, externalCostObjectId, timer, fraTid, tilTid },
        maskiner,
      );
  }
  // Kort-id (regel 3, K6): utledes etter hver rad-lagring, som før w9m.
  sikreLokalKortId(tx, sheetId);
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
  const { projectId: radProjectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid, sheetTimerId } = felt;
  const id = randomUUID();
  db.insert(sheetMachineLocal)
    .values({
      id,
      dagsseddelId: sheetId,
      sheetTimerId,
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
  // Kort-id (prosjektkort-kortid-spec § 2.4, M9): samme regel som serveren (regel 3, K6).
  sikreLokalKortId(db, sheetId);
  return id;
}

export function oppdaterMaskinRad(db: LokalDb, { sheetId }: RadKontekst, radId: string, felt: MaskinRadFelt): void {
  const { projectId: radProjectId, ecoId, vehicleId, timer, mengde, enhet, fraTid, tilTid, sheetTimerId } = felt;
  db.update(sheetMachineLocal)
    .set({
      sheetTimerId,
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
  // Kort-id: endret nøkkel → regel 3. Koblet maskin får timeradens kort-id (K6).
  sikreLokalKortId(db, sheetId);
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
