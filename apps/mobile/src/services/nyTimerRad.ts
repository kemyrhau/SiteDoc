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

/** P1 (maskin-i-rad): valgfri maskin fra timerrad-modalens maskin-seksjon. */
export type NyMaskin = {
  vehicleId: string;
  mengde: number | null;
  enhet: string | null;
};

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
  maskin: NyMaskin | null;
}

/** Skriv én timer-rad (+ evt. maskin) på en sedel. Delt av sedelen og «+». */
export function settInnTimerRad(
  db: LokalDb,
  sheetId: string,
  organizationId: string,
  rad: NyRad,
): string {
  // Del B pkt 1: fang timer-radens id så maskin-raden kan stemples med den.
  const timerRadId = randomUUID();
  // B4 (L2-B, valg A): arbeideren satte tiden selv → tidKilde="manuell".
  // erReise settes EKSPLISITT fra lønnsarten (delt regel, ikke server-gjetting,
  // M3). En manuell reise-rad får reiseKilde="manuell", reiseRetning/avstand/
  // kjøretid/regel null (retning er informasjon, ikke lønn — C2 krever retning
  // KUN for matrise-kilde). Ikke-reise → erReise=false, ingen reise-spor.
  const manuellErReise = erReiseLonnsartLokalt(organizationId, rad.lonnsartId);
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
      reiseKilde: manuellErReise ? "manuell" : null,
      tidKilde: "manuell",
      sistEndretLokalt: Date.now(),
    })
    .run();
  // P1 (maskin-i-rad): dual-innsetting. Er maskin valgt, skriv en sheet_machine-
  // rad med timer = timerradens antall (herav-semantikk) i SAMME bucket
  // (projectId + ECO) og med samme fra/til. Del B pkt 1: sheetTimerId = timer-
  // radens id, så rediger-inngangen finner igjen «radens» maskin.
  if (rad.maskin) {
    db.insert(sheetMachineLocal)
      .values({
        id: randomUUID(),
        dagsseddelId: sheetId,
        sheetTimerId: timerRadId,
        projectId: rad.projectId,
        externalCostObjectId: rad.externalCostObjectId,
        vehicleId: rad.maskin.vehicleId,
        timer: rad.timer,
        mengde: rad.maskin.mengde,
        enhet: rad.maskin.enhet,
        fraTid: rad.fraTid,
        tilTid: rad.tilTid,
        sistEndretLokalt: Date.now(),
      })
      .run();
  }
  return timerRadId;
}

export type LagreNyRadResultat =
  | { ok: true; sheetId: string; eksisterte: boolean }
  | { ok: false; grunn: "dagLaast"; sheetId: string };

/**
 * Lagre fra opprettelsesmodus (§ 3.1): finn-eller-opprett sedelen for datoen,
 * så skriv raden. Sedelens aktivitet = radens (§ 4.3); primærprosjekt = radens
 * prosjekt på en NY sedel. En sendt/akseptert dag får ingen rad.
 */
export function lagreNyTimerRad(
  db: LokalDb,
  args: { userId: string; organizationId: string; dato: string; rad: NyRad },
): LagreNyRadResultat {
  const fra = finnDagForDato(db, args.userId, args.dato);
  if (fra && erDagLaast(fra)) return { ok: false, grunn: "dagLaast", sheetId: fra.id };
  const sedel = finnEllerOpprettDagsseddel(db, {
    userId: args.userId,
    orgId: args.organizationId,
    dato: args.dato,
    prosjektId: args.rad.projectId,
    aktivitetId: args.rad.aktivitetId,
    byggeplassId: null,
    beskrivelse: null,
  });
  settInnTimerRad(db, sedel.id, args.organizationId, args.rad);
  return { ok: true, sheetId: sedel.id, eksisterte: sedel.eksisterte };
}
