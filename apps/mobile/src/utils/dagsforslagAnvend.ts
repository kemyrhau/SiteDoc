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
import { beskrivelseForRad } from "./beskrivelseKort";
import {
  sheetTimerLocal,
  dagsseddelLocal,
  sheetMachineLocal,
  vareforbrukLocal,
} from "../db/schema";
import { loftByggeplassArv, trengerByggeplassLoft } from "../components/timer-detalj/prosjektkort/kortRadFlytt";
import { kortValgFor } from "../lib/prosjektkortMobil";
import { finnEllerOpprettDagsseddel } from "../services/dagsseddelOpprett";
import type { Dagsforslag, AnvendDagsforslagResultat } from "./dagsforslag";
import { radTilleggNokkel, sedelKontekstForRad, sedelKontekstLokalt, type BekreftDagTillegg, type TilleggPerRad } from "./bekreftDagTillegg";
import { skrivLonnstillegg, skrivUtlegg, type NyttLonnstillegg, type NyttUtlegg } from "../services/tilleggUtleggSkriv";
import type { NyKoOppforing } from "../providers/OpplastingsKoProvider";

/**
 * ORDRE Tillegg/Utlegg i Bekreft dag: lønnstillegg og utlegg holdt i minnet på
 * skjermen. Knyttet til sedel + prosjekt (ikke rad) — skrives på første åpne
 * dato sin sedel (`forsteLagredeSheetId`).
 */
export type LonnUtlegg = { tillegg: NyttLonnstillegg[]; utlegg: NyttUtlegg[] };

export function harLonnUtlegg(l: LonnUtlegg | undefined): l is LonnUtlegg {
  return !!l && (l.tillegg.length > 0 || l.utlegg.length > 0);
}

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
    /**
     * ORDRE 36c: underprosjekt på kortet (manuell Bekreft dag) — settes på
     * arbeidsrader, maskin og varer. Utelatt/null = uten, som før.
     */
    ecoId?: string | null;
    /**
     * RETUR 36c-3: brukeren valgte «Ingen byggeplass» eksplisitt (manuell
     * Bekreft dag). Har en eksisterende sedel byggeplass A, løftes arven
     * (`loftByggeplassArv`) før radene skrives — ellers ville den nye raden
     * arvet A. Utelatt (GPS-veien) = som før.
     */
    utenByggeplassValgt?: boolean;
  },
  /**
   * L3-D + PRESISERING TILLEGG: maskin og varer pr. arbeidsrad fra bekreft-dag
   * (nøkkel `radTilleggNokkel`) — skrives koblet til raden, på radens sedel.
   */
  tilleggPerRad?: TilleggPerRad,
  /** ORDRE Tillegg/Utlegg i Bekreft dag — se `LonnUtlegg`. */
  lonnUtlegg?: LonnUtlegg,
): AnvendDagsforslagResultat {
  let startSheetId: string | null = null;
  let blokkertSendt = false;
  let totalRader = 0;
  let harEksisterendeRader = false;
  const vekForOverlapp: Array<{ fraTid: string; tilTid: string }> = [];
  let manglerLonnsart = false;
  // DEL 5 a: hvilke datoer som ble skrevet og hvilke som var sendt — gir en
  // sann melding ved delvis lagring.
  const lagredeDatoer: string[] = [];
  const blokkerteDatoer: string[] = [];
  let forsteLagredeSheetId: string | null = null;

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
      lagredeDatoer: [],
      blokkerteDatoer: [],
      forsteLagredeSheetId: null,
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
      lagredeDatoer: [],
      blokkerteDatoer: [],
      forsteLagredeSheetId: null,
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
    }

    // Sendt/godkjent → kan ikke appende (ville gi server-konflikt). Recall er UF-4.
    if (
      resultat.eksisterte &&
      resultat.status !== "draft" &&
      resultat.status !== "returned"
    ) {
      blokkertSendt = true;
      blokkerteDatoer.push(d.dato);
      continue;
    }
    lagredeDatoer.push(d.dato);
    forsteLagredeSheetId ??= resultat.id;
    if (d.raderDroppetUtenLonnsart > 0) manglerLonnsart = true;

    // RETUR 36c pkt 1: arbeidsrader arver sedelens byggeplass (null). Fantes
    // sedelen alt med en ANNEN byggeplass enn den valgte, skrives den valgte
    // eksplisitt — ellers havner kortet under sedelens byggeplass. Lik/ny sedel
    // beholder arv, så «Endre ramme» tar radene med som før.
    const eksplisittByggeplassId =
      resultat.eksisterte &&
      d.byggeplassId != null &&
      sedelByggeplass(db, resultat.id) !== d.byggeplassId
        ? d.byggeplassId
        : null;

    // RETUR 36c-3: «Ingen byggeplass» på en eksisterende sedel med A — samme
    // løft som prosjektkort-stien (RETUR 36c-2 P1 a2), FØR radene skrives:
    // arvende rader får A, hodet blir NULL, og den nye raden er ekte «uten».
    if (ctx.utenByggeplassValgt && resultat.eksisterte && d.byggeplassId == null) {
      const sedel = sedelKontekstLokalt(db, resultat.id);
      if (sedel && trengerByggeplassLoft({ projectId: forslag.prosjektId, byggeplassId: null, ecoId: null }, sedel)) {
        loftByggeplassArv(db, resultat.id, sedel);
      }
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
      const radId = ctx.nyId();
      const radEco = rad.erReise ? null : (ctx.ecoId ?? null);
      const radByggeplass = rad.erReise ? rad.byggeplassId : (rad.byggeplassId ?? eksplisittByggeplassId);
      db.insert(sheetTimerLocal)
        .values({
          id: radId,
          dagsseddelId: resultat.id,
          projectId: rad.projectId,
          lonnsartId: rad.lonnsartId,
          aktivitetId: rad.aktivitetId,
          externalCostObjectId: radEco,
          timer: rad.timer,
          fraTid: rad.fraTid,
          tilTid: rad.tilTid,
          // ORDRE 36a/36b: «Hva gjorde du i dag?» fra radens eget kort;
          // reise beskriver seg selv (retning + destinasjon).
          beskrivelse: rad.erReise ? null : beskrivelseForRad(forslag, rad, d),
          pauseMin: rad.pauseMin,
          // B1: reise-sporet (M1 — innsettingen skrev det ikke før). byggeplassId
          // settes nå faktisk (destinasjonen på reise-rader; null → arv på
          // arbeidsrader, unntatt når kortets byggeplass avviker fra en
          // eksisterende sedels — RETUR 36c pkt 1). reiseRegel JSON-stringifies (TEXT-kolonne).
          erReise: rad.erReise,
          reiseRetning: rad.reiseRetning,
          reiseOppmotestedId: rad.reiseOppmotestedId,
          byggeplassId: radByggeplass,
          reiseKjoretidMin: rad.reiseKjoretidMin,
          reiseAvstandM: rad.reiseAvstandM,
          reiseKilde: rad.reiseKilde,
          reiseRegel: rad.reiseRegel ? JSON.stringify(rad.reiseRegel) : null,
          tidKilde: rad.tidKilde,
          sistEndretLokalt: ctx.naa(),
        })
        .run();
      totalRader++;
      const nokkel = radTilleggNokkel(d.dato, rad);
      const tillegg = nokkel ? tilleggPerRad?.[nokkel] : undefined;
      if (tillegg && (tillegg.maskiner.length > 0 || tillegg.varer.length > 0)) {
        skrivTillegg(db, tillegg, {
          ...ctx,
          sheetId: resultat.id,
          dato: d.dato,
          rad: { id: radId, projectId: rad.projectId, byggeplassId: radByggeplass, externalCostObjectId: radEco },
        });
      }
    }
    // ORDRE 34 pkt 3 (#9): hodet = Σ rad.pauseMin også ved append på en
    // eksisterende sedel (speiler serverens PK6 `synkroniserHodePause`).
    synkHodePauseLokalt(db, resultat.id);
    vekForOverlapp.push(...d.vekForOverlapp);
  }

  // ORDRE Tillegg/Utlegg i Bekreft dag: på første åpne dato sin sedel. Ingen
  // åpen sedel (alt ble blokkert under skrivingen) → `lonnUtleggSkrevet` false,
  // kalleren beholder linjene — aldri stille tap.
  let lonnUtleggSkrevet = false;
  const utleggKo: NyKoOppforing[] = [];
  if (harLonnUtlegg(lonnUtlegg) && forsteLagredeSheetId) {
    for (const l of lonnUtlegg.tillegg) skrivLonnstillegg(db, forsteLagredeSheetId, l, ctx.naa());
    for (const u of lonnUtlegg.utlegg) {
      const ko = skrivUtlegg(db, forsteLagredeSheetId, u, ctx.nyId);
      if (ko) utleggKo.push(ko);
    }
    lonnUtleggSkrevet = true;
  }

  return {
    lonnUtleggSkrevet,
    utleggKo,
    startSheetId,
    blokkertSendt,
    ingenRader: totalRader === 0,
    harEksisterendeRader,
    vekForOverlapp,
    prosjektUkjent: false,
    ikkeAnsatt: false,
    manglerLonnsart,
    lagredeDatoer,
    blokkerteDatoer,
    forsteLagredeSheetId,
  };
}

function sedelByggeplass(db: LokalDb, sheetId: string): string | null {
  return (
    db
      .select({ byggeplassId: dagsseddelLocal.byggeplassId })
      .from(dagsseddelLocal)
      .where(eq(dagsseddelLocal.id, sheetId))
      .all()[0]?.byggeplassId ?? null
  );
}

/**
 * Matpause-invarianten (`services/matpause.ts`): `dagsseddel_local.pauseMin =
 * Σ sheet_timer_local.pauseMin`. Uten denne ble hodet stående på en eldre verdi
 * (f.eks. 0) etter append, mens bærer-raden fikk 30 — ramme-linjen viste
 * «pause 0 min» til neste pull. Skriver kun ved avvik.
 */
export function synkHodePauseLokalt(db: LokalDb, sheetId: string): void {
  const sum = db
    .select({ pauseMin: sheetTimerLocal.pauseMin })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all()
    .reduce((s, r) => s + (r.pauseMin ?? 0), 0);
  const sedel = db
    .select({ pauseMin: dagsseddelLocal.pauseMin })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .all()[0];
  if (!sedel || sedel.pauseMin === sum) return;
  db.update(dagsseddelLocal)
    .set({ pauseMin: sum, syncStatus: "pending", sistEndretLokalt: Date.now() })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
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
 * L3-D + PRESISERING TILLEGG (2026-11-12): maskin og varer legges på RADEN de
 * ble registrert på i Bekreft dag — og arver radens prosjekt, effektive
 * byggeplass og underprosjekt (`kortValgFor`). Ingen auto-kobling, ingen
 * tidsmatching. Maskinen har ikke fra–til, bare egne timer (≤ radens — vakten
 * i `bekreftDag`). Varer skrives pending og sendes når sedelen er synket
 * (`planleggVaresending`).
 */
function skrivTillegg(
  db: LokalDb,
  tillegg: BekreftDagTillegg,
  ctx: {
    userId: string; orgId: string; nyId: () => string; naa: () => number; sheetId: string; dato: string;
    /** Radens verdier slik de nettopp ble skrevet — ingen ny lesing (3b). */
    rad: { id: string; projectId: string; byggeplassId: string | null; externalCostObjectId: string | null };
  },
): void {
  // ORDRE Tillegg/Utlegg 3b: ingen gren returnerer stille. Sedel uten prosjekt
  // → radens prosjekt som kontekst (`sedelKontekstForRad`).
  const rad = ctx.rad;
  const sedel = sedelKontekstForRad(db, ctx.sheetId, rad.projectId);
  const kort = kortValgFor(rad, sedel);
  for (const m of tillegg.maskiner) {
    db.insert(sheetMachineLocal)
      .values({
        id: ctx.nyId(),
        dagsseddelId: ctx.sheetId,
        sheetTimerId: rad.id,
        projectId: kort.projectId,
        vehicleId: m.vehicleId,
        externalCostObjectId: kort.ecoId,
        // Lagret som raden (null = arv fra sedelen), som `foelgKobletMaskin`.
        byggeplassId: rad.byggeplassId ?? null,
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
        projectId: kort.projectId,
        dato: ctx.dato,
        vareId: v.vareId,
        vareNavn: v.vareNavn,
        enhet: v.enhet,
        antall: v.antall,
        // Varen bærer byggeplassen eksplisitt (serveren arver ikke) — radens effektive.
        byggeplassId: kort.byggeplassId,
        externalCostObjectId: kort.ecoId,
        sheetTimerId: rad.id,
        syncStatus: "pending",
        feilmelding: null,
        sistEndretLokalt: ctx.naa(),
      })
      .run();
  }
}
