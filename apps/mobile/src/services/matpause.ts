import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { sheetTimerLocal, dagsseddelLocal } from "../db/schema";
import {
  effektiveTimerFraSpenn,
  hhmmTilMin,
  pauseMinForDag,
  avgjorRadPauseMin,
  pauseFraForRad,
  fastPauseFraFor,
  DEFAULT_PAUSE_ETTER_TIMER,
} from "@sitedoc/shared";

// V20/PK2: `avgjorRadPauseMin` er løftet til @sitedoc/shared (web + mobil deler
// ÉN regel). Re-eksporteres her så eksisterende importører (TimerSeksjon +
// matpause.test) er uendret.
export { avgjorRadPauseMin };
import { hentArbeidsdagTiderLokalt } from "./kalenderKatalog";
import { hentOrganizationSettingLokalt } from "./organizationSettingKatalog";
import { hentDagsnormLokalt } from "./arbeidstidSvarKatalog";

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
 *  Rad-timer: rad.timer = effektiveTimerFraSpenn(fra, til, pauseFra, pauseMin)
 *  der pauseFra = `pauseFraFor(rad)` ligger inne i raden → bæreren får
 *  spenn − pause (ORDRE 2026-11-13, pausen etter 4 ARBEIDStimer).
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

/** Det `matpauseKontekst` gir: pauselengde, firmaets grense og pausepunktet
 *  pr. rad (ORDRE 2026-11-13 «pausen trekkes etter 4 ARBEIDStimer»). */
export type MatpauseKontekst = {
  standardPauseMin: number;
  /** Firmaets `standardPauseEtterTimer` (svar-cache → innstilling → 4,0). */
  pauseEtterTimer: number;
  /** Kun `pauseReferanse = "fastStart"`: starttid + grense; ellers null. */
  fastPauseFra: string | null;
  /** Hvor pausen ligger i raden (delt `pauseFraForRad`). `id` utelater raden
   *  selv fra «andre rader»; ny rad sendes uten id. */
  pauseFraFor: (rad: { id?: string | null; fraTid: string; tilTid: string }) => string;
};

/**
 * Pause-kontekst for en sedel. Normen (startTid/pauseEtterTimer/pauseReferanse)
 * leses fra svar-cachen (`hentDagsnormLokalt`, REGNER aldri); mangler den, fall
 * tilbake til kalenderens skiftstart + firma-innstilling. Pausepunktet i en rad =
 * der summert arbeid (dagens rader sortert på fraTid) passerer firmaets grense —
 * samme `pauseFraForRad` som Bekreft dag, web og server. `rader` = dagens rader.
 */
export function matpauseKontekst(
  organizationId: string,
  dato: string,
  rader: readonly { id?: string | null; fraTid?: string | null; tilTid?: string | null }[] = [],
): MatpauseKontekst {
  const setting = hentOrganizationSettingLokalt(organizationId);
  const standardPauseMin = setting?.standardPauseMin ?? 30;
  const norm = hentDagsnormLokalt(organizationId, dato);
  const skiftStart =
    norm?.startTid ??
    hentArbeidsdagTiderLokalt(organizationId, new Date(`${dato}T00:00:00`)).startTid;
  const pauseEtterTimer =
    norm?.pauseEtterTimer ?? setting?.standardPauseEtterTimer ?? DEFAULT_PAUSE_ETTER_TIMER;
  const pauseReferanse = norm?.pauseReferanse ?? "fastStart";
  const fastPauseFra = fastPauseFraFor({ startTid: skiftStart, pauseEtterTimer, pauseReferanse });
  return {
    standardPauseMin,
    pauseEtterTimer,
    fastPauseFra,
    pauseFraFor: (rad) =>
      pauseFraForRad({
        fraTid: rad.fraTid,
        tilTid: rad.tilTid,
        andreRader: rad.id ? rader.filter((r) => r.id !== rad.id) : rader,
        pauseEtterTimer,
        pauseMin: standardPauseMin,
        fastPauseFra,
      }),
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

/** Kan raden bære dagens matpause? Pausen ligger alltid HELT inne i bæreren
 *  (ORDRE 2026-11-13), så kravet er at spennet er lengre enn pausen. Reise-rader
 *  (null-tider) kvalifiserer aldri. Erstatter «krysser lunsjvinduet». */
export function radKanBaerePause(rad: Rad, standardPauseMin: number): boolean {
  if (!rad.fraTid || !rad.tilTid) return false;
  return hhmmTilMin(rad.tilTid) - hhmmTilMin(rad.fraTid) > standardPauseMin;
}

/** Minutter faktisk trukket på raden — utledet av lagret `timer` (gjelder både
 *  gamle vindu-rader med delvis overlapp og nye rader med hel pause). */
export function pauseTrukketMinForRad(rad: {
  fraTid?: string | null;
  tilTid?: string | null;
  timer: number;
  pauseMin: number;
}): number {
  if (!rad.fraTid || !rad.tilTid || rad.pauseMin <= 0) return 0;
  const spenn = hhmmTilMin(rad.tilTid) - hhmmTilMin(rad.fraTid);
  const trukket = Math.round(spenn - rad.timer * 60);
  return Math.min(rad.pauseMin, Math.max(0, trukket));
}

/** Rad-timer gitt en pauseMin — pausen ligger i raden fra `pauseFraFor`. */
function beregnRadTimer(rad: Rad, k: MatpauseKontekst, pauseMin: number): number {
  if (!rad.fraTid || !rad.tilTid) return rad.timer;
  const pauseFra = k.pauseFraFor({ id: rad.id, fraTid: rad.fraTid, tilTid: rad.tilTid });
  return effektiveTimerFraSpenn(rad.fraTid, rad.tilTid, pauseFra, pauseMin);
}

/** Passerer summert arbeid firmaets grense inne i denne raden? */
function radPassererGrensen(rad: Rad, rader: Rad[], pauseEtterTimer: number): boolean {
  if (!rad.fraTid || !rad.tilTid) return false;
  const fra = hhmmTilMin(rad.fraTid);
  const til = hhmmTilMin(rad.tilTid);
  const arbeidFor = rader.reduce((sum, r) => {
    if (r.id === rad.id || !r.fraTid || !r.tilTid) return sum;
    const f = hhmmTilMin(r.fraTid);
    const t = hhmmTilMin(r.tilTid);
    return t > f && f < fra ? sum + (Math.min(t, fra) - f) : sum;
  }, 0);
  const grense = Math.round(pauseEtterTimer * 60);
  return arbeidFor < grense && arbeidFor + (til - fra) > grense;
}

/** Kandidat-bærere (ekskl. gitt rad): lang nok til å bære pausen. Raden der
 *  grensen passeres først, deretter lengste-først. */
function kvalifiserteBaerere(
  rader: Rad[],
  ekskluderRadId: string | null,
  k: MatpauseKontekst,
): Rad[] {
  const spenn = (r: Rad) => hhmmTilMin(r.tilTid!) - hhmmTilMin(r.fraTid!);
  return rader
    .filter((r) => r.id !== ekskluderRadId && radKanBaerePause(r, k.standardPauseMin))
    .sort((a, z) => {
      const ga = radPassererGrensen(a, rader, k.pauseEtterTimer) ? 1 : 0;
      const gz = radPassererGrensen(z, rader, k.pauseEtterTimer) ? 1 : 0;
      return gz - ga || spenn(z) - spenn(a);
    });
}

/** Skriv rad-pauseMin + recompute timer for de berørte radene, og sett
 *  dagsseddel.pauseMin = Σ(rad.pauseMin) + marker sedelen pending — ALT i én tx. */
function skrivPauseTilstand(
  db: NonNullable<ReturnType<typeof hentDatabase>>,
  sheetId: string,
  k: MatpauseKontekst,
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
          timer: beregnRadTimer(rad, k, ny),
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
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const k = matpauseKontekst(organizationId, dato, rader);
  const kandidater = kvalifiserteBaerere(rader, baererRadId, k);
  if (kandidater.length === 0) return { utfall: "ingenKvalifisert" };
  const ny = kandidater[0];
  skrivPauseTilstand(
    db,
    sheetId,
    k,
    new Map([
      [baererRadId, 0],
      [ny.id, k.standardPauseMin],
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
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const k = matpauseKontekst(organizationId, dato, rader);
  const endringer = new Map<string, number>();
  for (const r of rader) {
    if (r.pauseMin > 0 && r.id !== nyBaererRadId) endringer.set(r.id, 0);
  }
  endringer.set(nyBaererRadId, k.standardPauseMin);
  skrivPauseTilstand(db, sheetId, k, endringer);
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
  const rader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  const k = matpauseKontekst(organizationId, dato, rader);
  const endringer = new Map<string, number>();
  for (const r of rader) if (r.pauseMin > 0) endringer.set(r.id, 0);
  if (endringer.size === 0) return { utfall: "ingen" };
  skrivPauseTilstand(db, sheetId, k, endringer);
  return { utfall: "fjernet" };
}
