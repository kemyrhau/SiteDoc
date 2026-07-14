import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { sheetTimerLocal, dagsseddelLocal } from "../db/schema";
import {
  effektiveTimerFraSpenn,
  pauseVinduFra,
  pauseOverlappMin,
  hhmmTilMin,
  pauseMinForDag,
  DEFAULT_PAUSE_ETTER_TIMER,
} from "@sitedoc/shared";
import { hentEffektivArbeidstidLokal } from "./kalenderKatalog";
import { hentOrganizationSettingLokalt } from "./organizationSettingKatalog";

/* ============================================================================
 *  F5 (2026-07-14) — matpause-bærer på timer-rader.
 *
 *  Én matpause per dag (`standardPauseMin`, default 30) bæres av ÉN timer-rad
 *  (`sheet_timer_local.pauseMin > 0`). Kun-én-per-dag håndheves som FLYTT, ikke
 *  radio: å avhuke bæreren flytter pausen til neste kvalifiserte rad; å huke en
 *  annen rad flytter den dit (forrige nulles stille).
 *
 *  Ufravikelig invariant (bevarer maskin-kapasitetsregelen som bruker sedel-nivå
 *  pauseMin): ved HVER endring settes `dagsseddel_local.pauseMin =
 *  Σ(sheet_timer_local.pauseMin)`. sheet_machines / maskinKapasitet.ts urørt.
 *
 *  Rad-timer holdes konsistent via den deployede modellen:
 *      rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, rad.pauseMin)
 *  (pauseMin=0 → fullt spenn; pauseMin>0 → spenn − lunsjoverlapp). «Ikke rør
 *  pause-vindus/terskel-modellen» — vi gjenbruker helperne fra pauseBeregning.
 * ============================================================================ */

type Rad = typeof sheetTimerLocal.$inferSelect;

export type MatpauseResultat =
  /** Bæreren avhuket → flyttet automatisk til neste kvalifiserte rad (vis toast). */
  | { utfall: "flyttet"; tilTidsrom: string }
  /** Pausen satt på en spesifikt valgt rad (forrige nullet stille). */
  | { utfall: "satt" }
  /** Bæreren avhuket, ingen kvalifisert rad å flytte til → kaller viser
   *  bekreftelsesmodal FØR fjerning (AML-varsel). Ingen skriving her. */
  | { utfall: "ingenKvalifisert" }
  /** Pausen fjernet for dagen (etter bekreftelse). */
  | { utfall: "fjernet" }
  /** Ingen endring (ugyldig tilstand). */
  | { utfall: "ingen" };

/** Pausevindu-kontekst for en sedel: hvor lunsjen faller + dens lengde. */
export function matpauseKontekst(
  organizationId: string,
  dato: string,
): { pauseFra: string; standardPauseMin: number } {
  const setting = hentOrganizationSettingLokalt(organizationId);
  const pauseEtterTimer =
    setting?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
  const standardPauseMin = setting?.standardPauseMin ?? 30;
  const skiftStart = hentEffektivArbeidstidLokal(
    organizationId,
    new Date(`${dato}T00:00:00`),
  ).startTid;
  return {
    pauseFra: pauseVinduFra(skiftStart, pauseEtterTimer),
    standardPauseMin,
  };
}

/** Brutto dagstotal (sum av rad-spenn) — grunnlag for 5,5t-terskelen (AML §10-9). */
export function dagsBruttoTimer(rader: Rad[]): number {
  return rader.reduce((sum, r) => {
    if (!r.fraTid || !r.tilTid) return sum;
    const spenn = hhmmTilMin(r.tilTid) - hhmmTilMin(r.fraTid);
    return spenn > 0 ? sum + spenn / 60 : sum;
  }, 0);
}

/**
 * Trigger matpause-regelen for dagen? (dagsbrutto > 5,5t-terskel). Under
 * terskelen trekkes ingen pause → checkboxen skjules helt.
 */
export function matpauseRegelTrigget(
  rader: Rad[],
  standardPauseMin: number,
): boolean {
  return pauseMinForDag(dagsBruttoTimer(rader), standardPauseMin) > 0;
}

/** Krysser raden lunsjvinduet? (kvalifisert til å bære pausen). Reise-rader
 *  (null-tider) kvalifiserer aldri. */
export function radKrysserPause(
  rad: Rad,
  pauseFra: string,
  standardPauseMin: number,
): boolean {
  if (!rad.fraTid || !rad.tilTid) return false;
  return (
    pauseOverlappMin(
      hhmmTilMin(rad.fraTid),
      hhmmTilMin(rad.tilTid),
      hhmmTilMin(pauseFra),
      standardPauseMin,
    ) > 0
  );
}

/** Rad-timer gitt en pauseMin — deployert modell (spenn − lunsjoverlapp). */
function beregnRadTimer(rad: Rad, pauseFra: string, pauseMin: number): number {
  if (!rad.fraTid || !rad.tilTid) return rad.timer;
  return effektiveTimerFraSpenn(rad.fraTid, rad.tilTid, pauseFra, pauseMin);
}

/** Kandidat-bærere (ekskl. gitt rad): krysser vinduet OG har positiv rest-timer
 *  etter fradrag. Sortert lengste-først (samme prioritet som genereringen). */
function kvalifiserteBaerere(
  rader: Rad[],
  ekskluderRadId: string | null,
  pauseFra: string,
  standardPauseMin: number,
): Rad[] {
  return rader
    .filter(
      (r) =>
        r.id !== ekskluderRadId &&
        radKrysserPause(r, pauseFra, standardPauseMin) &&
        beregnRadTimer(r, pauseFra, standardPauseMin) > 0,
    )
    .sort((a, z) => {
      const spennA = hhmmTilMin(a.tilTid!) - hhmmTilMin(a.fraTid!);
      const spennZ = hhmmTilMin(z.tilTid!) - hhmmTilMin(z.fraTid!);
      return spennZ - spennA;
    });
}

/** Skriv rad-pauseMin + recompute timer for de berørte radene, og sett
 *  dagsseddel.pauseMin = Σ(rad.pauseMin) + marker sedelen pending — ALT i én tx. */
function skrivPauseTilstand(
  db: NonNullable<ReturnType<typeof hentDatabase>>,
  sheetId: string,
  pauseFra: string,
  nyPauseMinPerRad: Map<string, number>,
): void {
  const naa = Date.now();
  db.transaction((tx) => {
    let sumPause = 0;
    const rader = tx
      .select()
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all();
    for (const rad of rader) {
      const ny = nyPauseMinPerRad.get(rad.id);
      if (ny === undefined) {
        sumPause += rad.pauseMin;
        continue;
      }
      sumPause += ny;
      tx.update(sheetTimerLocal)
        .set({
          pauseMin: ny,
          timer: beregnRadTimer(rad, pauseFra, ny),
          sistEndretLokalt: naa,
        })
        .where(eq(sheetTimerLocal.id, rad.id))
        .run();
    }
    // Invariant: sedel-nivå pauseMin = Σ rad-pauseMin (maskin-kapasitetsregelen).
    tx.update(dagsseddelLocal)
      .set({
        pauseMin: sumPause,
        syncStatus: "pending",
        sistEndretLokalt: naa,
      })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
  });
}

/**
 * Bruker huket AV på bæreren → flytt pausen til neste kvalifiserte rad. Ingen
 * kvalifisert rad → returner `ingenKvalifisert` UTEN å skrive (kaller viser
 * bekreftelsesmodal først).
 */
export function flyttMatpauseVedAvhuking(
  sheetId: string,
  baererRadId: string,
  organizationId: string,
  dato: string,
): MatpauseResultat {
  const db = hentDatabase();
  if (!db) return { utfall: "ingen" };
  const { pauseFra, standardPauseMin } = matpauseKontekst(organizationId, dato);
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const kandidater = kvalifiserteBaerere(
    rader,
    baererRadId,
    pauseFra,
    standardPauseMin,
  );
  if (kandidater.length === 0) return { utfall: "ingenKvalifisert" };
  const ny = kandidater[0];
  skrivPauseTilstand(
    db,
    sheetId,
    pauseFra,
    new Map([
      [baererRadId, 0],
      [ny.id, standardPauseMin],
    ]),
  );
  return { utfall: "flyttet", tilTidsrom: `${ny.fraTid}–${ny.tilTid}` };
}

/**
 * Bruker huket PÅ en spesifikk rad → sett pausen der, nullstill enhver tidligere
 * bærer stille.
 */
export function settMatpauseBaerer(
  sheetId: string,
  nyBaererRadId: string,
  organizationId: string,
  dato: string,
): MatpauseResultat {
  const db = hentDatabase();
  if (!db) return { utfall: "ingen" };
  const { pauseFra, standardPauseMin } = matpauseKontekst(organizationId, dato);
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const endringer = new Map<string, number>();
  for (const r of rader) {
    if (r.pauseMin > 0 && r.id !== nyBaererRadId) endringer.set(r.id, 0);
  }
  endringer.set(nyBaererRadId, standardPauseMin);
  skrivPauseTilstand(db, sheetId, pauseFra, endringer);
  return { utfall: "satt" };
}

/**
 * Bekreftet fjerning (ingen kvalifisert rad + bruker godtok AML-varselet) →
 * nullstill alle bærere. Σ = 0 → dagsseddel.pauseMin = 0.
 */
export function fjernMatpause(
  sheetId: string,
  organizationId: string,
  dato: string,
): MatpauseResultat {
  const db = hentDatabase();
  if (!db) return { utfall: "ingen" };
  const { pauseFra } = matpauseKontekst(organizationId, dato);
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const endringer = new Map<string, number>();
  for (const r of rader) if (r.pauseMin > 0) endringer.set(r.id, 0);
  if (endringer.size === 0) return { utfall: "ingen" };
  skrivPauseTilstand(db, sheetId, pauseFra, endringer);
  return { utfall: "fjernet" };
}
