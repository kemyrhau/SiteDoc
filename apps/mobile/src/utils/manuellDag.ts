import { and, eq } from "drizzle-orm";
import { hhmmTilMin } from "@sitedoc/shared";
import { dagsseddelLocal, lonnsartLocal, sheetTimerLocal } from "../db/schema";
import { samleDagsforslagInput, type LokalDb } from "../services/dagsforslagInput";
import { hentArbeidsdagTiderLokalt } from "../services/kalenderKatalog";
import { hentReiseLonnsartId } from "../services/timerKatalog";
import { erReiseRadVisning } from "./reiseRad";
import { bruktAvNorm } from "./overtidMotDognet";
import {
  beregnDagsforslag,
  type BeregnDagsforslagInput,
  type Dagsforslag,
  type DagsforslagRetting,
} from "./dagsforslag";

/**
 * ORDRE 36c — Bekreft dag i MANUELL modus («+»-knappen og «+ Nytt prosjektkort»):
 * samme skjerm som «Start dag», uten GPS og uten arbeidsdag. Kenneth: «Finnes
 * det allerede en dagsseddel den datoen, legges registreringen inn i den.»
 *
 * Tidsrommet utledes så det nye kortet fortsetter der dagen slapp:
 *  - start = seneste `tilTid` på datoens sedel, ellers firmaets starttid;
 *  - slutt = firmaets sluttid, eller start + 1 t når dagen alt er forbi
 *    sluttiden (aldri over midnatt — én dato, én sedel);
 *  - pause = firmaets standard KUN når sedelen ikke bærer matpause fra før
 *    (hodet = Σ radenes pauseMin, matpause-invarianten).
 * Brukeren retter tidene i skjermen som ellers.
 */

export type ManuellGrunnlag = {
  tilTider: (string | null)[];
  hodePauseMin: number;
  /** ORDRE (27b) L1: arbeid som alt står på datoen (alle kort, også overtid; ikke reise, ikke fravær — B8). */
  bruktAvNorm: number;
};

const tilHhmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** REN: tidsrommet og pausen det manuelle forslaget regnes med. */
export function manuellDag(
  dato: string,
  tider: { startTid: string; sluttTid: string; pauseMin: number },
  eksisterende: Pick<ManuellGrunnlag, "tilTider" | "hodePauseMin"> | null,
): { startAt: string; sluttIso: string; pauseMin: number } {
  const seneste = (eksisterende?.tilTider ?? [])
    .filter((t): t is string => !!t)
    .reduce<string | null>((s, t) => (s === null || hhmmTilMin(t) > hhmmTilMin(s) ? t : s), null);
  const startMin = seneste ? hhmmTilMin(seneste) : hhmmTilMin(tider.startTid);
  const firmaSlutt = hhmmTilMin(tider.sluttTid);
  const sluttMin = firmaSlutt > startMin ? firmaSlutt : Math.min(startMin + 60, 23 * 60 + 59);
  const iso = (min: number) => new Date(`${dato}T${tilHhmm(min)}:00`).toISOString();
  return {
    startAt: iso(startMin),
    sluttIso: iso(sluttMin),
    pauseMin: (eksisterende?.hodePauseMin ?? 0) > 0 ? 0 : tider.pauseMin,
  };
}

/**
 * LES: datoens sedel (pause i hodet + radenes sluttider + arbeid som bruker av
 * normen), null = ingen sedel. `reiseLonnsartId` avgjør reise for eldre rader
 * uten `erReise`-flagg (samme regel som dagsoversikten, `erReiseRadVisning`).
 * `erstattet`-rader finnes ikke lokalt (pull filtrerer dem bort på server).
 */
export function lesManuellGrunnlag(
  db: LokalDb,
  userId: string,
  dato: string,
  reiseLonnsartId: string | null = null,
): ManuellGrunnlag | null {
  const sedel = db
    .select({ id: dagsseddelLocal.id, pauseMin: dagsseddelLocal.pauseMin })
    .from(dagsseddelLocal)
    .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.dato, dato)))
    .all()[0];
  if (!sedel) return null;
  const rader = db
    .select({
      tilTid: sheetTimerLocal.tilTid,
      timer: sheetTimerLocal.timer,
      erReise: sheetTimerLocal.erReise,
      lonnsartId: sheetTimerLocal.lonnsartId,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sedel.id))
    .all();
  // ORDRE (28) B8: fravær bruker ikke normen. Lønnsart-id er global, så typen
  // slås opp uten firmafilter.
  const fravaerIder = new Set(
    db
      .select({ id: lonnsartLocal.id })
      .from(lonnsartLocal)
      .where(eq(lonnsartLocal.type, "fravaer"))
      .all()
      .map((l) => l.id),
  );
  return {
    tilTider: rader.map((r) => r.tilTid),
    hodePauseMin: sedel.pauseMin ?? 0,
    bruktAvNorm: bruktAvNorm(
      rader.map((r) => ({
        timer: r.timer,
        erReise: erReiseRadVisning(r.erReise, r.lonnsartId, reiseLonnsartId),
        erFravaer: r.lonnsartId != null && fravaerIder.has(r.lonnsartId),
      })),
    ),
  };
}

/**
 * LES + REGN for manuell modus — samme lese-fase som `forberedBekreftDag`, med
 * en syntetisk dag uten GPS (ingen reise kan foreslås). Ingen skriving.
 * `sisteSegmentKilde: "bruker"`: brukeren har selv valgt å føre tiden, og
 * sluttiden skal kunne utvide sedelens arbeidstidsvindu som ved «Slutt dag».
 */
export function forberedManuellDag(
  db: LokalDb,
  p: {
    userId: string;
    orgId: string;
    dato: string;
    kontekstByggeplassId: string | null;
    aktivtProsjektId: string | null;
    valgtByggeplassId?: string | null;
  },
  retting?: DagsforslagRetting,
): { input: BeregnDagsforslagInput; forslag: Dagsforslag; sluttIso: string } {
  const tider = hentArbeidsdagTiderLokalt(p.orgId, new Date(`${p.dato}T00:00:00`));
  const grunnlag = lesManuellGrunnlag(db, p.userId, p.dato, hentReiseLonnsartId(p.orgId));
  const md = manuellDag(p.dato, tider, grunnlag);
  const lest = samleDagsforslagInput(db, {
    userId: p.userId,
    orgId: p.orgId,
    dag: { startAt: md.startAt, startLat: null, startLng: null, oppmotestedId: null, byggeplassId: null },
    sluttIso: md.sluttIso,
    endLat: null,
    endLng: null,
    kontekstByggeplassId: p.kontekstByggeplassId,
    aktivtProsjektId: p.aktivtProsjektId,
    sisteSegmentKilde: "bruker",
    valgtByggeplassId: p.valgtByggeplassId,
  });
  const dagEff = lest.effektivPerDato[p.dato];
  const medPause: BeregnDagsforslagInput = dagEff
    ? { ...lest, effektivPerDato: { ...lest.effektivPerDato, [p.dato]: { ...dagEff, pauseMin: md.pauseMin } } }
    : lest;
  // ORDRE (27b) L1–L2: kortet regnes mot det som er igjen av normen etter
  // døgnets registrerte arbeid (`klassifiserMotDognet` i `beregnSegment`).
  const eks = medPause.eksisterendeSedelPerDato[p.dato];
  const input: BeregnDagsforslagInput =
    eks && grunnlag
      ? {
          ...medPause,
          eksisterendeSedelPerDato: {
            ...medPause.eksisterendeSedelPerDato,
            [p.dato]: { ...eks, bruktAvNorm: grunnlag.bruktAvNorm },
          },
        }
      : medPause;
  return { input, forslag: beregnDagsforslag({ ...input, retting }), sluttIso: md.sluttIso };
}
