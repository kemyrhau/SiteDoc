import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import { hentDatabase } from "../db/database";
import {
  aktivitetLocal,
  dagsseddelLocal,
  lonnsartLocal,
  sheetMachineLocal,
  sheetTimerLocal,
} from "../db/schema";
import { finnEllerOpprettDagsseddel } from "./dagsseddelOpprett";
import { erReiseLonnsartLokalt } from "./timerKatalog";
import { maskinerOverRad, skrivKobledeMaskiner, type NyMaskin } from "./kobledeMaskiner";
import {
  SIST_BRUKTE_MASKINER_ANTALL,
  sisteUnikeMaskiner,
  type ManuellReiseSpor,
} from "@sitedoc/shared";

/* ============================================================================
 *  «+» rett til timer-raden (ORDRE 17, 2026-11-06)
 *
 *  Timer-raden åpnes uten sedel (opprettelsesmodus). Sedelen finnes-eller-
 *  opprettes først når raden lagres — Avbryt skriver ingenting. Alt er lokal
 *  SQLite og virker offline; synk sender sedel + rad som før.
 * ============================================================================ */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

export interface Radvalg {
  lonnsartId: string | null;
  aktivitetId: string | null;
}

/**
 * Forhåndsutfylling av lønnsart + aktivitet for ny rad på et prosjekt (Q5):
 *  1. sist brukt på prosjektet — siste rad for (userId, projectId) ordnet på
 *     sedelens dato;
 *  2. ellers firmaets standard-lønnsart (`erStandardvalg`) og aktivitet
 *     «Anleggsarbeid», eller eneste aktive aktivitet;
 *  3. ellers null → brukeren velger.
 * Inaktive verdier fra steg 1 hoppes over (katalogen kan ha endret seg).
 */
export function sistBrukteRadvalg(
  db: LokalDb,
  userId: string,
  projectId: string,
  organizationId: string,
): Radvalg {
  const aktiveLonnsarter = db
    .select({ id: lonnsartLocal.id, erStandardvalg: lonnsartLocal.erStandardvalg })
    .from(lonnsartLocal)
    .where(and(eq(lonnsartLocal.organizationId, organizationId), eq(lonnsartLocal.aktiv, true)))
    .all();
  const aktiveAktiviteter = db
    .select({ id: aktivitetLocal.id, navn: aktivitetLocal.navn })
    .from(aktivitetLocal)
    .where(and(eq(aktivitetLocal.organizationId, organizationId), eq(aktivitetLocal.aktiv, true)))
    .all();

  const siste = db
    .select({ lonnsartId: sheetTimerLocal.lonnsartId, aktivitetId: sheetTimerLocal.aktivitetId })
    .from(sheetTimerLocal)
    .innerJoin(dagsseddelLocal, eq(sheetTimerLocal.dagsseddelId, dagsseddelLocal.id))
    .where(and(eq(dagsseddelLocal.userId, userId), eq(sheetTimerLocal.projectId, projectId)))
    .orderBy(desc(dagsseddelLocal.dato), desc(sheetTimerLocal.sistEndretLokalt))
    .limit(1)
    .all()[0];

  const sistLonnsart =
    siste && aktiveLonnsarter.some((l) => l.id === siste.lonnsartId) ? siste.lonnsartId : null;
  const sistAktivitet =
    siste?.aktivitetId && aktiveAktiviteter.some((a) => a.id === siste.aktivitetId)
      ? siste.aktivitetId
      : null;

  const standardAktivitet =
    aktiveAktiviteter.find((a) => a.navn === "Anleggsarbeid")?.id ??
    (aktiveAktiviteter.length === 1 ? aktiveAktiviteter[0]!.id : null);

  return {
    lonnsartId: sistLonnsart ?? aktiveLonnsarter.find((l) => l.erStandardvalg)?.id ?? null,
    aktivitetId: sistAktivitet ?? standardAktivitet,
  };
}

/** Prosjekt + byggeplass som foreslås for ny rad (ORDRE 29 pkt 1). */
/**
 * ORDRE 29: brukerens sist brukte maskiner i firmaet (nyeste først, unike, N = 5) —
 * løftes øverst i maskinvelgeren. Kun EGNE sedler i firmaet; lokal SQLite, virker offline.
 */
export function sistBrukteMaskiner(
  db: LokalDb,
  userId: string,
  organizationId: string,
  n: number = SIST_BRUKTE_MASKINER_ANTALL,
): string[] {
  const rader = db
    .select({ vehicleId: sheetMachineLocal.vehicleId })
    .from(sheetMachineLocal)
    .innerJoin(dagsseddelLocal, eq(sheetMachineLocal.dagsseddelId, dagsseddelLocal.id))
    .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.organizationId, organizationId)))
    .orderBy(desc(dagsseddelLocal.dato), desc(sheetMachineLocal.sistEndretLokalt))
    .limit(50)
    .all();
  return sisteUnikeMaskiner(
    rader.map((r) => r.vehicleId),
    n,
  );
}

export interface StedValg {
  projectId: string;
  byggeplassId: string | null;
}

interface StedKilder {
  /** Toppbarens prosjekt + byggeplass (innlogget kontekst). */
  innlogget: StedValg | null;
  /** Geofence-treff (`useGeoProsjektForslag`). */
  gps: StedValg | null;
  /** Firmaets byggeplasser — kun byggeplass på radens prosjekt er gyldig. */
  byggeplasser: readonly { id: string; projectId: string }[];
}

/**
 * Byggeplass for ny rad på valgt prosjekt: innlogget byggeplass → GPS-treff →
 * null (arv fra dagskortet). En byggeplass på et annet prosjekt forkastes.
 * Speiler webs `velgStandardByggeplass` (toppbaren vinner når den er gyldig).
 */
export function byggeplassForNyRad(projectId: string, k: StedKilder): string | null {
  const gyldig = (v: StedValg | null) =>
    v?.projectId === projectId &&
    !!v.byggeplassId &&
    k.byggeplasser.some((b) => b.id === v.byggeplassId && b.projectId === projectId)
      ? v.byggeplassId
      : null;
  return gyldig(k.innlogget) ?? gyldig(k.gps);
}

/**
 * «+» uten prosjektliste (Kenneth 2026-11-06: «Jeg er innlogget på prosjekt/
 * byggeplass -> Jeg trykker + for timer -> timer foreslås registrert på denne
 * byggeplass»): innlogget prosjekt i firmaets liste → rett til raden; ellers
 * eneste prosjekt; ellers null = vis lista (GPS-forslag forhåndsvalgt).
 */
export function startvalgForNyRad(
  prosjektIder: readonly string[],
  k: StedKilder,
): StedValg | null {
  const projectId =
    k.innlogget && prosjektIder.includes(k.innlogget.projectId)
      ? k.innlogget.projectId
      : prosjektIder.length === 1
        ? prosjektIder[0]!
        : null;
  return projectId ? { projectId, byggeplassId: byggeplassForNyRad(projectId, k) } : null;
}

export interface DagForDato {
  id: string;
  status: string;
}

/** Brukerens sedel for datoen, om den finnes (samme nøkkel som find-or-create). */
export function finnDagForDato(db: LokalDb, userId: string, dato: string): DagForDato | null {
  return (
    db
      .select({ id: dagsseddelLocal.id, status: dagsseddelLocal.status })
      .from(dagsseddelLocal)
      .where(and(eq(dagsseddelLocal.userId, userId), eq(dagsseddelLocal.dato, dato)))
      .all()[0] ?? null
  );
}

/** Sendt/akseptert dag tar ikke nye rader (Q7) — sjekkes når dialogen åpnes. */
export function erDagLaast(dag: DagForDato | null): boolean {
  return dag?.status === "sent" || dag?.status === "accepted";
}

/** NY BESLUTNING maskinkobling (2026-11-12): flere maskiner pr. rad, egne timer. */
export type { NyMaskin } from "./kobledeMaskiner";

export interface NyRad {
  projectId: string;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  externalCostObjectId: string | null;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse: string | null;
  pauseMin: number;
  /** 0, 1 eller flere koblede maskiner, hver med egne timer ≤ radens. */
  maskiner: NyMaskin[];
  /**
   * Ordre (9): terskel/bånd-sporet fra «+ Reise» (`klassifiserManuellReise`).
   * Satt → erReise/reiseKilde/avstand/oppmøtested/regel herfra (under terskel:
   * erReise false på standard ordinær art). Udefinert → utledes fra lønnsarten.
   */
  reiseSpor?: ManuellReiseSpor;
}

/** Skriv én timer-rad (+ evt. maskin) på en sedel. Delt av sedelen og «+». */
export function settInnTimerRad(
  db: LokalDb,
  sheetId: string,
  organizationId: string,
  rad: NyRad,
): string {
  // NY BESLUTNING maskinkobling: maskin over radens timer avvises FØR noe
  // skrives (rad-modalen sier fra først; dette er siste vern).
  if (maskinerOverRad(rad.timer, rad.maskiner).length > 0) {
    throw new Error("maskinOverRad: maskintimer over radens timer");
  }
  // Del B pkt 1: fang timer-radens id så maskin-raden kan stemples med den.
  const timerRadId = randomUUID();
  // B4 (L2-B, valg A): arbeideren satte tiden selv → tidKilde="manuell".
  // erReise settes EKSPLISITT fra lønnsarten (delt regel, ikke server-gjetting,
  // M3). En manuell reise-rad får reiseKilde="manuell", reiseRetning/avstand/
  // kjøretid/regel null (retning er informasjon, ikke lønn — C2 krever retning
  // KUN for matrise-kilde). Ikke-reise → erReise=false, ingen reise-spor.
  const spor = rad.reiseSpor;
  const manuellErReise = spor
    ? spor.erReise
    : erReiseLonnsartLokalt(organizationId, rad.lonnsartId);
  db.insert(sheetTimerLocal)
    .values({
      id: timerRadId,
      dagsseddelId: sheetId,
      projectId: rad.projectId,
      // F3: per-rad byggeplass. null = arv fra dagskortet (server propagerer
      // sedel-verdien ved sync).
      byggeplassId: rad.byggeplassId,
      lonnsartId: rad.lonnsartId,
      aktivitetId: rad.aktivitetId,
      externalCostObjectId: rad.externalCostObjectId,
      timer: rad.timer,
      fraTid: rad.fraTid,
      tilTid: rad.tilTid,
      beskrivelse: rad.beskrivelse,
      // V20 PK2: radens matpause-bærer (avkrysningen = pauseMin > 0).
      pauseMin: rad.pauseMin,
      erReise: manuellErReise,
      reiseKilde: spor ? spor.reiseKilde : manuellErReise ? "manuell" : null,
      // Ordre (9): ikke-reise-rad bærer aldri avstand/oppmøtested (C2 + DB-CHECK);
      // regelen lagres på begge så klassifiseringen kan etterprøves.
      reiseAvstandM: spor?.erReise ? spor.reiseAvstandM : null,
      reiseOppmotestedId: spor?.erReise ? spor.reiseOppmotestedId : null,
      reiseRegel: spor ? JSON.stringify(spor.reiseRegel) : null,
      tidKilde: "manuell",
      sistEndretLokalt: Date.now(),
    })
    .run();
  // NY BESLUTNING maskinkobling: hver maskin kobles til raden (sheetTimerId)
  // med EGNE timer (≤ radens — rad-modalen avviser ellers). Samme skrivevei
  // som rediger-banen (`skrivKobledeMaskiner`).
  if (rad.maskiner.length > 0) {
    skrivKobledeMaskiner(
      db,
      sheetId,
      timerRadId,
      {
        projectId: rad.projectId,
        byggeplassId: rad.byggeplassId,
        externalCostObjectId: rad.externalCostObjectId,
        timer: rad.timer,
        fraTid: rad.fraTid,
        tilTid: rad.tilTid,
      },
      { linjer: rad.maskiner.map((m) => ({ ...m, id: null })), fjernede: [] },
    );
  }
  return timerRadId;
}

export type LagreNyRadResultat =
  | { ok: true; sheetId: string; eksisterte: boolean }
  | { ok: false; grunn: "dagLaast"; sheetId: string };

/**
 * Lagre fra opprettelsesmodus (§ 3.1): finn-eller-opprett sedelen for datoen,
 * så skriv raden. Sedelens aktivitet = radens (§ 4.3); primærprosjekt og
 * byggeplass = radens på en NY sedel. En sendt/akseptert dag får ingen rad.
 */
export function lagreNyTimerRad(
  db: LokalDb,
  args: { userId: string; organizationId: string; dato: string; rad: NyRad },
): LagreNyRadResultat {
  const fra = finnDagForDato(db, args.userId, args.dato);
  if (fra && erDagLaast(fra)) return { ok: false, grunn: "dagLaast", sheetId: fra.id };
  // Maskin over radens timer: avvis før en tom sedel opprettes.
  if (maskinerOverRad(args.rad.timer, args.rad.maskiner).length > 0) {
    throw new Error("maskinOverRad: maskintimer over radens timer");
  }
  const sedel = finnEllerOpprettDagsseddel(db, {
    userId: args.userId,
    orgId: args.organizationId,
    dato: args.dato,
    prosjektId: args.rad.projectId,
    aktivitetId: args.rad.aktivitetId,
    // ORDRE 29: NY sedel arver radens byggeplass (som primærprosjektet);
    // en eksisterende sedel røres ikke.
    byggeplassId: args.rad.byggeplassId,
    beskrivelse: null,
  });
  settInnTimerRad(db, sedel.id, args.organizationId, args.rad);
  return { ok: true, sheetId: sedel.id, eksisterte: sedel.eksisterte };
}
