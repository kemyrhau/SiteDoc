/**
 * LAG 0b (2026-10-02) — SKRIVE-fasen for et dagsseddel-forslag.
 *
 * Motstykket til den rene `beregnDagsforslag` (`dagsforslag.ts`): her, og KUN
 * her, skjer DB-skrivingen. `anvendDagsforslag` tar det ferdig-beregnede
 * forslaget og persisterer det — find-or-create av sedel, UF-1-append (utvid
 * arbeidstid-vinduet), blokkert-sendt-vakt og insert av de beregnede radene.
 *
 * 🔴 Den EKSISTERENDE persisteringen fra det gamle `opprettDagsseddelForSegment`
 * er flyttet hit uendret — utregningen er løftet ut, skrivingen er den samme.
 * Funksjonen returnerer utfallet («ble noe faktisk skrevet?») så kalleren kan
 * markere arbeidsdagen `avsluttet` FØRST når skrivingen lyktes (H7).
 */
import { eq } from "drizzle-orm";
import { hentDatabase } from "../db/database";
import { sheetTimerLocal, dagsseddelLocal } from "../db/schema";
import { finnEllerOpprettDagsseddel } from "../services/dagsseddelOpprett";
import type { Dagsforslag, AnvendDagsforslagResultat } from "./dagsforslag";

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export type { AnvendDagsforslagResultat };

/**
 * Anvend et beregnet dagsforslag: skriv sedler + rader. Injiserbare `nyId`/`naa`
 * så funksjonen kan drives i test uten expo-crypto. Kaster videre hvis en
 * DB-skriving feiler — kalleren fanger og lar arbeidsdagen stå `aktiv`.
 */
export function anvendDagsforslag(
  db: LokalDb,
  forslag: Dagsforslag,
  ctx: {
    userId: string;
    orgId: string;
    nyId: () => string;
    naa: () => number;
  },
): AnvendDagsforslagResultat {
  let startSheetId: string | null = null;
  let blokkertSendt = false;
  let totalRader = 0;
  let harEksisterendeRader = false;
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];

  // Ingen utledet prosjekt/aktivitet → ingenting å skrive (manuell flyt).
  if (forslag.prosjektId == null || forslag.aktivitetId == null) {
    return {
      startSheetId: null,
      blokkertSendt: false,
      ingenRader: true,
      harEksisterendeRader: false,
      vekForOverlapp: [],
    };
  }

  for (const d of forslag.datoer) {
    // UF-0/UF-1: sedel-opprettelse + idempotens via delt helper (org-backfill
    // følger med). Skriver KUN sedel-nivå-felt på NY draft; eksisterende røres ikke.
    const resultat = finnEllerOpprettDagsseddel(db, {
      userId: ctx.userId,
      orgId: ctx.orgId,
      dato: d.dato,
      prosjektId: forslag.prosjektId,
      aktivitetId: forslag.aktivitetId,
      byggeplassId: d.byggeplassId,
      startAt: d.segmentStartIso,
      endAt: d.segmentSluttIso,
      pauseMin: d.pauseMin,
      autoGenerert: true,
      deltVedMidnatt: d.deltVedMidnatt,
      sluttTidKilde: d.sluttTidKilde,
    });
    if (d.erStartSegment) startSheetId = resultat.id;

    // Sendt/godkjent → kan ikke appende (ville gi server-konflikt). Recall er UF-4.
    if (
      resultat.eksisterte &&
      resultat.status !== "draft" &&
      resultat.status !== "returned"
    ) {
      blokkertSendt = true;
      continue;
    }

    // Redigerbar draft/returned → append: utvid arbeidstid-vinduet til å dekke
    // den nye økten. Rad-innsettingen under bruker sedel-id → appender rader.
    if (resultat.eksisterte) {
      if (d.harEksisterendeRader) harEksisterendeRader = true;
      utvidArbeidstidsvindu(
        db,
        resultat.id,
        d.segmentStartIso,
        d.segmentSluttIso,
        d.sluttTidKilde,
      );
    }

    for (const rad of d.rader) {
      db.insert(sheetTimerLocal)
        .values({
          id: ctx.nyId(),
          dagsseddelId: resultat.id,
          projectId: rad.projectId,
          lonnsartId: rad.lonnsartId,
          aktivitetId: rad.aktivitetId,
          externalCostObjectId: null,
          timer: rad.timer,
          fraTid: rad.fraTid,
          tilTid: rad.tilTid,
          pauseMin: rad.pauseMin,
          sistEndretLokalt: ctx.naa(),
        })
        .run();
      totalRader++;
    }
    vekForOverlapp.push(...d.vekForOverlapp);
  }

  return {
    startSheetId,
    blokkertSendt,
    ingenRader: totalRader === 0,
    harEksisterendeRader,
    vekForOverlapp,
  };
}

/**
 * UF-1: utvid sedelens arbeidstid-vindu så det dekker en appendet økt.
 * startAt = tidligste, endAt = seneste. Markerer pending for re-sync.
 */
function utvidArbeidstidsvindu(
  db: LokalDb,
  sheetId: string,
  nyStartIso: string,
  nySluttIso: string,
  sluttTidKilde: "bruker" | "midnatt" | "system",
): void {
  const sedel = db
    .select({ startAt: dagsseddelLocal.startAt, endAt: dagsseddelLocal.endAt })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!sedel) return;

  const tidligste =
    sedel.startAt && sedel.startAt < nyStartIso ? sedel.startAt : nyStartIso;
  // F-b (2026-07-13): utvid endAt KUN når slutt-tiden er bruker-BEKREFTET
  // ("bruker"). "system"/"midnatt" er gjettede slutt-tider — de skal IKKE skyve
  // «Arbeidstid i dag»-vinduet ut med fabrikkerte tider.
  const seneste =
    sluttTidKilde === "bruker"
      ? sedel.endAt && sedel.endAt > nySluttIso
        ? sedel.endAt
        : nySluttIso
      : (sedel.endAt ?? nySluttIso);

  db.update(dagsseddelLocal)
    .set({
      startAt: tidligste,
      endAt: seneste,
      syncStatus: "pending",
      sistEndretLokalt: Date.now(),
    })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
}
