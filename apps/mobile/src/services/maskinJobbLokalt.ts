import { eq } from "drizzle-orm";
import {
  beregnJobbMaskinBrudd,
  maskinHoystPerRad,
  nyeEllerOkteBrudd,
  type JobbArbeidRad,
  type JobbMaskinRad,
  type MaskinJobbBrudd,
} from "@sitedoc/shared";
import type { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  externalCostObjectLocal,
  prosjektLocal,
  sheetMachineLocal,
  sheetTimerLocal,
} from "../db/schema";
import { erReiseRadVisning } from "../utils/reiseRad";
import { sikreLokalKortId } from "./kortIdLokal";
import { utleieEnhetLokalt } from "./maskinKoblingLokal";

/* ============================================================================
 *  w9m (plan § 4.4, B21 A / B22 A / B23 B, Kenneth 2026-11-19): telefonen
 *  regner maskinregelen likt med serveren (`krevIngenNyeMaskinBrudd`).
 *
 *  Pr. jobb (`kortId`): maskinene med fører ≤ jobbens arbeid uten reise, uten
 *  pause. Døgn-maskiner har ingen grense. Eldre rader uten jobb: bøtte + pause
 *  (som serveren). Et brudd stopper bare når det er nytt eller har økt
 *  (`nyeEllerOkteBrudd`) — et gammelt brudd i en annen jobb stopper ikke føring.
 *
 *  Den rene kjernen tar lister; `lesJobbGrunnlag` leser sedelen fra SQLite.
 * ============================================================================ */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export type JobbMaskinLokal = JobbMaskinRad & { id: string };
export type JobbArbeidLokal = JobbArbeidRad & { id: string };

/** Sedelens rader i jobb-regelens form. */
export type JobbGrunnlag = {
  timer: JobbArbeidRad[];
  maskin: JobbMaskinLokal[];
  pauseMin: number;
};

/** Grunnlaget slik det leses fra SQLite: timeradene har sin id. */
export type JobbGrunnlagLest = Omit<JobbGrunnlag, "timer"> & { timer: JobbArbeidLokal[] };

/** Id for en maskinrad som ikke er lagret ennå (modalens «ny maskin»). */
export const NY_MASKIN_ID = "__ny-maskin__";

export const TOMT_JOBB_GRUNNLAG: JobbGrunnlag = { timer: [], maskin: [], pauseMin: 0 };

/**
 * Sedelens timer- og maskinrader fra SQLite. En rad uten prosjekt arver
 * sedelens (som serveren ser den etter synk). Ukjent sedel → tomt grunnlag.
 */
export function lesJobbGrunnlag(
  db: LokalDb,
  sheetId: string,
  reiseLonnsartId: string | null,
): JobbGrunnlagLest {
  const [sedel] = db
    .select({ projectId: dagsseddelLocal.projectId, pauseMin: dagsseddelLocal.pauseMin })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all();
  const sedelProsjekt = sedel?.projectId ?? null;
  const timer = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all()
    .map<JobbArbeidLokal>((r) => ({
      id: r.id,
      kortId: r.kortId ?? null,
      projectId: r.projectId ?? sedelProsjekt,
      externalCostObjectId: r.externalCostObjectId ?? null,
      timer: Number(r.timer ?? 0),
      erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
    }));
  const maskin = db
    .select()
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
    .all()
    .map<JobbMaskinLokal>((m) => ({
      id: m.id,
      kortId: m.kortId ?? null,
      projectId: m.projectId ?? sedelProsjekt,
      externalCostObjectId: m.externalCostObjectId ?? null,
      timer: Number(m.timer ?? 0),
      utleieEnhet: utleieEnhetLokalt(db, m.vehicleId),
    }));
  return { timer, maskin, pauseMin: sedel?.pauseMin ?? 0 };
}

/** Grunnlaget med maskinraden lagt inn (samme `id` byttes ut, ellers lagt til). */
export function medMaskin(g: JobbGrunnlag, rad: JobbMaskinLokal): JobbGrunnlag {
  const finnes = g.maskin.some((m) => m.id === rad.id);
  return {
    ...g,
    maskin: finnes ? g.maskin.map((m) => (m.id === rad.id ? rad : m)) : [...g.maskin, rad],
  };
}

/** Bruddene skrivingen (`foer` → `etter`) gir: nye, eller økt overskudd. */
export function nyeMaskinBrudd(foer: JobbGrunnlag, etter: JobbGrunnlag): MaskinJobbBrudd[] {
  return nyeEllerOkteBrudd(
    beregnJobbMaskinBrudd(foer.timer, foer.maskin, foer.pauseMin),
    beregnJobbMaskinBrudd(etter.timer, etter.maskin, etter.pauseMin),
  );
}

/**
 * «Høyst X t» for maskinraden: jobbens arbeid minus de andre førermaskinene på
 * jobben. `null` = døgn-maskin (ingen grense).
 */
export function hoystForMaskin(g: JobbGrunnlag, rad: JobbMaskinLokal): number | null {
  const liste = medMaskin(g, rad).maskin;
  const i = liste.findIndex((m) => m.id === rad.id);
  return maskinHoystPerRad(g.timer, liste, g.pauseMin)[i] ?? null;
}

/** Tall som i serverens tekst: 7.5 → «7,5», 4 → «4». */
export function jobbTall(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

/** Jobbens navn som serveren gir det: underprosjektet, ellers prosjektnummer + navn. */
export function jobbNavnLokalt(
  db: LokalDb,
  b: Pick<MaskinJobbBrudd, "projectId" | "externalCostObjectId">,
): string {
  if (b.externalCostObjectId) {
    const [e] = db
      .select({ proAdmId: externalCostObjectLocal.proAdmId })
      .from(externalCostObjectLocal)
      .where(eq(externalCostObjectLocal.id, b.externalCostObjectId))
      .all();
    if (e?.proAdmId) return e.proAdmId;
  }
  if (!b.projectId) return "";
  const [p] = db
    .select({ name: prosjektLocal.name, projectNumber: prosjektLocal.projectNumber })
    .from(prosjektLocal)
    .where(eq(prosjektLocal.id, b.projectId))
    .all();
  return p ? `${p.projectNumber ?? ""} ${p.name}`.trim() : b.projectId;
}

/** Parametrene til `timer.maskin.overArbeidAvvist` (samme som serveren sender). */
export function bruddParam(
  b: Pick<MaskinJobbBrudd, "maskinSum" | "arbeidSum">,
  jobb: string,
): { jobb: string; maskin: string; arbeid: string } {
  return { jobb, maskin: jobbTall(b.maskinSum), arbeid: jobbTall(b.arbeidSum) };
}

/** Teksten når telefonen stopper et brudd: serverens nøkkel, første brudd. */
export function bruddTekst(
  t: (k: string, p?: Record<string, string>) => string,
  db: LokalDb | null,
  brudd: readonly MaskinJobbBrudd[],
): string {
  const b = brudd[0];
  if (!b) return "";
  const jobb = db ? jobbNavnLokalt(db, b) : (b.projectId ?? "");
  return t("timer.maskin.overArbeidAvvist", bruddParam(b, jobb));
}

/** Intern: ruller skrivingen tilbake når den gir et nytt eller økt brudd. */
class MaskinVaktRull extends Error {
  constructor(readonly brudd: MaskinJobbBrudd[]) {
    super("maskinVakt");
  }
}

/**
 * WM108: skriv, og rull tilbake hvis skrivingen gir et nytt eller økt
 * maskinbrudd — samme før/etter-vakt som serveren, regnet etter at kort-id-en
 * er utledet (`sikreLokalKortId`). Tom liste = skrevet. Ellers er ingenting
 * skrevet, og bruddene forklarer hvorfor.
 */
export function skrivMedMaskinVakt(
  db: LokalDb,
  sheetId: string,
  reiseLonnsartId: string | null,
  skriv: (tx: LokalDb) => void,
): MaskinJobbBrudd[] {
  const foer = lesJobbGrunnlag(db, sheetId, reiseLonnsartId);
  try {
    db.transaction((tx) => {
      const t = tx as unknown as LokalDb;
      skriv(t);
      sikreLokalKortId(t, sheetId);
      const brudd = nyeMaskinBrudd(foer, lesJobbGrunnlag(t, sheetId, reiseLonnsartId));
      if (brudd.length > 0) throw new MaskinVaktRull(brudd);
    });
    return [];
  } catch (e) {
    if (e instanceof MaskinVaktRull) return e.brudd;
    throw e;
  }
}
