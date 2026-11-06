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
import {
  sheetTimerLocal,
  dagsseddelLocal,
  sheetMachineLocal,
  vareforbrukLocal,
} from "../db/schema";
import { finnEllerOpprettDagsseddel } from "../services/dagsseddelOpprett";
import type { Dagsforslag, AnvendDagsforslagResultat } from "./dagsforslag";
import type { BekreftDagTillegg } from "./bekreftDagTillegg";

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
    /**
     * Ansatt i `orgId`? `false` → ingen sedel skrives (serveren ville nektet den
     * for alltid). `null` = ukjent (aldri hentet) → skriv som før; serveren er porten.
     */
    erAnsatt: boolean | null;
    nyId: () => string;
    naa: () => number;
  },
  /** L3-D: maskin og varer fra bekreft-dag — skrives på start-sedelen (vedtak C). */
  tillegg?: BekreftDagTillegg,
): AnvendDagsforslagResultat {
  let startSheetId: string | null = null;
  let startDato: string | null = null;
  let startBlokkert = false;
  let blokkertSendt = false;
  let totalRader = 0;
  let harEksisterendeRader = false;
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];
  let manglerLonnsart = false;

  if (ctx.erAnsatt === false) {
    return {
      startSheetId: null,
      blokkertSendt: false,
      ingenRader: true,
      harEksisterendeRader: false,
      vekForOverlapp: [],
      prosjektUkjent: false,
      ikkeAnsatt: true,
      manglerLonnsart: false,
    };
  }

  // Ingen utledet prosjekt/aktivitet → ingenting å skrive (manuell flyt).
  // `prosjektUkjent` bæres videre så kalleren skiller «velg prosjekt» fra
  // «db/aktivitet manglet» (begge har startSheetId null).
  if (forslag.prosjektId == null || forslag.aktivitetId == null) {
    return {
      startSheetId: null,
      blokkertSendt: false,
      ingenRader: true,
      harEksisterendeRader: false,
      vekForOverlapp: [],
      prosjektUkjent: forslag.prosjektUkjent,
      ikkeAnsatt: false,
      manglerLonnsart: false,
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
      // B5: norm-kilde/-snapshot skrives på NY draft (sedel-nivå); eksisterende
      // sedel røres ikke (finnEllerOpprettDagsseddel setter kun på ny draft).
      normStatus: d.normStatus,
      normSnapshot: d.normSnapshot,
    });
    if (d.erStartSegment) {
      startSheetId = resultat.id;
      startDato = d.dato;
    }

    // Sendt/godkjent → kan ikke appende (ville gi server-konflikt). Recall er UF-4.
    if (
      resultat.eksisterte &&
      resultat.status !== "draft" &&
      resultat.status !== "returned"
    ) {
      blokkertSendt = true;
      if (d.erStartSegment) startBlokkert = true;
      continue;
    }
    if (d.raderDroppetUtenLonnsart > 0) manglerLonnsart = true;

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
          // B1: reise-sporet (M1 — innsettingen skrev det ikke før). byggeplassId
          // settes nå faktisk (destinasjonen på reise-rader; null → arv på
          // arbeidsrader). reiseRegel JSON-stringifies (TEXT-kolonne).
          erReise: rad.erReise,
          reiseRetning: rad.reiseRetning,
          reiseOppmotestedId: rad.reiseOppmotestedId,
          byggeplassId: rad.byggeplassId,
          reiseKjoretidMin: rad.reiseKjoretidMin,
          reiseAvstandM: rad.reiseAvstandM,
          reiseKilde: rad.reiseKilde,
          reiseRegel: rad.reiseRegel ? JSON.stringify(rad.reiseRegel) : null,
          tidKilde: rad.tidKilde,
          sistEndretLokalt: ctx.naa(),
        })
        .run();
      totalRader++;
    }
    vekForOverlapp.push(...d.vekForOverlapp);
  }

  if (tillegg && startSheetId && startDato && !startBlokkert) {
    skrivTillegg(db, tillegg, { ...ctx, sheetId: startSheetId, dato: startDato });
  }

  return {
    startSheetId,
    blokkertSendt,
    ingenRader: totalRader === 0,
    harEksisterendeRader,
    vekForOverlapp,
    prosjektUkjent: false,
    ikkeAnsatt: false,
    manglerLonnsart,
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

/**
 * L3-D: maskin uten fra/til og uten timerrad-kobling (som «+ Maskin» i kortet),
 * varer som pending — sendes når sedelen er synket (`planleggVaresending`).
 */
function skrivTillegg(
  db: LokalDb,
  tillegg: BekreftDagTillegg,
  ctx: { userId: string; orgId: string; nyId: () => string; naa: () => number; sheetId: string; dato: string },
): void {
  for (const m of tillegg.maskiner) {
    db.insert(sheetMachineLocal)
      .values({
        id: ctx.nyId(),
        dagsseddelId: ctx.sheetId,
        sheetTimerId: null,
        projectId: m.projectId,
        vehicleId: m.vehicleId,
        externalCostObjectId: null,
        timer: m.timer,
        mengde: m.mengde,
        enhet: m.enhet,
        fraTid: null,
        tilTid: null,
        sistEndretLokalt: ctx.naa(),
      })
      .run();
  }
  for (const v of tillegg.varer) {
    db.insert(vareforbrukLocal)
      .values({
        id: ctx.nyId(),
        userId: ctx.userId,
        organizationId: ctx.orgId,
        sheetId: ctx.sheetId,
        projectId: v.projectId,
        dato: ctx.dato,
        vareId: v.vareId,
        vareNavn: v.vareNavn,
        enhet: v.enhet,
        antall: v.antall,
        byggeplassId: v.byggeplassId,
        syncStatus: "pending",
        feilmelding: null,
        sistEndretLokalt: ctx.naa(),
      })
      .run();
  }
}
