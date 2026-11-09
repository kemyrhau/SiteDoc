import { eq } from "drizzle-orm";
import { beregnMaskinBrudd, type MaskinBrudd } from "@sitedoc/shared";
import type { hentDatabase } from "../../../db/database";
import {
  dagsseddelLocal,
  sheetMachineLocal,
  sheetTimerLocal,
  slettedeRaderLocal,
  vareforbrukLocal,
} from "../../../db/schema";
import {
  effektivByggeplass,
  kortNokkel,
  kortNokkelFor,
  lagretByggeplassForKort,
  raderPaaKort,
  vareByggeplassForKort,
  type KortValg,
  type SedelKortKontekst,
} from "../../../lib/prosjektkortMobil";
import { erReiseRadVisning } from "../../../utils/reiseRad";
import type { MaskinRad, TimerRad } from "../../../types/timer-detalj";
import { oppdaterTimerRad, type RadKontekst } from "./radLagring";

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/* ============================================================================
 *  ORDRE 36b: kort-spesifikke skrivinger — «Flytt raden» og kortets
 *  byggeplass på koblet maskin. Ligger UTENFOR `radLagring.ts` med vilje:
 *  radLagring er en kopi av dagskortets skrivesemantikk og holdes lik den av
 *  `radLagring-glue-vakt.test.ts`. Dette er ny atferd som dagskortet ikke har.
 *
 *  Mål-byggeplassen er det som SKAL LAGRES (`lagretByggeplassForKort`):
 *  `null` = arver sedelens byggeplass.
 * ============================================================================ */

export type FlyttMaal = {
  projectId: string;
  byggeplassId: string | null;
  ecoId: string | null;
};

/**
 * Koblet maskin følger timer-raden (Kenneth GO punkt 5): prosjekt, byggeplass
 * og underprosjekt kopieres fra timer-raden. Ingen koblet maskin → no-op.
 */
export function foelgKobletMaskin(db: LokalDb, timerRadId: string): void {
  const rad = db
    .select({
      projectId: sheetTimerLocal.projectId,
      byggeplassId: sheetTimerLocal.byggeplassId,
      externalCostObjectId: sheetTimerLocal.externalCostObjectId,
    })
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.id, timerRadId))
    .all()[0];
  if (!rad) return;
  const maskin = db
    .select()
    .from(sheetMachineLocal)
    .where(eq(sheetMachineLocal.sheetTimerId, timerRadId))
    .all()[0];
  if (!maskin) return;
  if (
    maskin.projectId === rad.projectId &&
    (maskin.byggeplassId ?? null) === (rad.byggeplassId ?? null) &&
    (maskin.externalCostObjectId ?? null) === (rad.externalCostObjectId ?? null)
  ) {
    return;
  }
  db.update(sheetMachineLocal)
    .set({
      projectId: rad.projectId,
      byggeplassId: rad.byggeplassId ?? null,
      externalCostObjectId: rad.externalCostObjectId ?? null,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetMachineLocal.id, maskin.id))
    .run();
}

/**
 * Flytt en timer-rad til et annet kort. Alle andre felt beholdes (tider,
 * lønnsart, aktivitet, beskrivelse, matpause); underprosjektet tas fra
 * målkortet. Koblet maskin følger.
 */
export function flyttTimerRad(db: LokalDb, kontekst: RadKontekst, rad: TimerRad, til: FlyttMaal): void {
  oppdaterTimerRad(db, kontekst, rad.id, {
    projectId: til.projectId,
    byggeplassId: til.byggeplassId,
    lonnsartId: rad.lonnsartId,
    aktivitetId: rad.aktivitetId,
    timer: rad.timer,
    externalCostObjectId: til.ecoId,
    fraTid: rad.fraTid,
    tilTid: rad.tilTid,
    beskrivelse: rad.beskrivelse,
    pauseMin: rad.pauseMin,
  });
  foelgKobletMaskin(db, rad.id);
}

/**
 * Flytt en maskin-rad alene. Er den koblet til en timer-rad, kobles den løs
 * (`sheetTimerId = null`) — ellers ville neste lagring av timer-raden dratt
 * den tilbake. Kapasitetssjekken gjøres av kalleren før flytt.
 */
export function flyttMaskinRad(db: LokalDb, radId: string, til: FlyttMaal): void {
  db.update(sheetMachineLocal)
    .set({
      projectId: til.projectId,
      byggeplassId: til.byggeplassId,
      externalCostObjectId: til.ecoId,
      sheetTimerId: null,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(sheetMachineLocal.id, radId))
    .run();
}

/**
 * Lokal del av vare-flytt. En `pending` linje sendes med de nye verdiene ved
 * neste sync (`vareforbruk.opprett`); en `synced` linje må i tillegg flyttes
 * på server (`vareforbruk.oppdater`) — det gjør kalleren FØR denne kalles.
 * Linjen finnes kanskje ikke lokalt (bare på server) → no-op.
 */
export function flyttVareLokalt(db: LokalDb, vareId: string, til: FlyttMaal): void {
  db.update(vareforbrukLocal)
    .set({
      projectId: til.projectId,
      byggeplassId: til.byggeplassId,
      externalCostObjectId: til.ecoId,
      sistEndretLokalt: Date.now(),
    })
    .where(eq(vareforbrukLocal.id, vareId))
    .run();
}

/**
 * RETUR 36c-2 P1 (a2): trengs løft før kortet `kort` kan lagres? Ja når kortet
 * er «Uten byggeplass» og en rad uten byggeplass ellers ville arvet sedelens.
 */
export function trengerByggeplassLoft(kort: KortValg, sedel: SedelKortKontekst): boolean {
  return kort.byggeplassId === null && effektivByggeplass(kort.projectId, null, sedel) !== null;
}

/**
 * RETUR 36c-2 P1 (a2): «Uten byggeplass» på en sedel som har byggeplass A —
 * løft arven ut, uten migrering. Arvende timer- og maskinrader (byggeplass
 * NULL, samme prosjekt som A) får A skrevet eksplisitt, og sedelens byggeplass
 * nullstilles. Etterpå betyr NULL på en rad ekte «uten» for server, web og
 * gamle klienter (`rad ?? sedel` = null). Reise-rader har aldri byggeplass og
 * røres ikke. Én transaksjon; kalleren markerer sedelen endret (sync).
 * Ingen arv å løfte → no-op (false).
 */
export function loftByggeplassArv(db: LokalDb, sheetId: string, sedel: SedelKortKontekst): boolean {
  const a = sedel.byggeplass;
  if (!a) return false;
  const arver = (projectId: string | null, byggeplassId: string | null) =>
    !byggeplassId && (projectId ?? sedel.projectId) === a.projectId;
  const naa = Date.now();
  db.transaction((tx) => {
    const timer = tx
      .select({
        id: sheetTimerLocal.id,
        projectId: sheetTimerLocal.projectId,
        byggeplassId: sheetTimerLocal.byggeplassId,
        erReise: sheetTimerLocal.erReise,
      })
      .from(sheetTimerLocal)
      .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
      .all();
    for (const r of timer) {
      if (r.erReise || !arver(r.projectId, r.byggeplassId)) continue;
      tx.update(sheetTimerLocal)
        .set({ byggeplassId: a.id, sistEndretLokalt: naa })
        .where(eq(sheetTimerLocal.id, r.id))
        .run();
    }
    const maskiner = tx
      .select({ id: sheetMachineLocal.id, projectId: sheetMachineLocal.projectId, byggeplassId: sheetMachineLocal.byggeplassId })
      .from(sheetMachineLocal)
      .where(eq(sheetMachineLocal.dagsseddelId, sheetId))
      .all();
    for (const m of maskiner) {
      if (!arver(m.projectId, m.byggeplassId)) continue;
      tx.update(sheetMachineLocal)
        .set({ byggeplassId: a.id, sistEndretLokalt: naa })
        .where(eq(sheetMachineLocal.id, m.id))
        .run();
    }
    tx.update(dagsseddelLocal)
      .set({ byggeplassId: null, sistEndretLokalt: naa, syncStatus: "pending" })
      .where(eq(dagsseddelLocal.id, sheetId))
      .run();
  });
  return true;
}

/* ============================================================================
 *  ORDRE 36c-kort (Kenneth OK 2026-11-09): «Endre kort» og «Slett kort» på
 *  kortskjermen. Kortet = (prosjekt, effektiv byggeplass, underprosjekt).
 *  Rekkefølge: redigerbar → brudd-sjekk → nett → server-varer → lokal
 *  transaksjon. Feil før lokal skriving stopper uten å røre timer/maskin.
 *  Reise, tillegg og utlegg hører til dagen og røres ikke.
 *
 *  Sammenslåing (b, «ja foreløpig»): skjer på datanivå — radene får målkortets
 *  nøkkel. Ingen egen visning; kortvisningen kan endres uten å røre dette.
 * ============================================================================ */

export type KortVare = {
  id: string;
  projectId: string;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  syncStatus?: "pending" | "synced" | "avvist";
};

/** Linjen finnes på server (synket, eller bare kjent fra server) → serverkall først. */
export function vareFinnesPaaServer(v: KortVare): boolean {
  return v.syncStatus !== "pending" && v.syncStatus !== "avvist";
}

export type KortInnhold = {
  /** Arbeid på kortet (reise er dagsnivå og tas ikke med). */
  timer: TimerRad[];
  /** Maskin på kortet + maskin koblet (`sheetTimerId`) til kortets timer. */
  maskin: MaskinRad[];
  varer: KortVare[];
};

export function kortInnhold(args: {
  timerRader: readonly TimerRad[];
  maskinRader: readonly MaskinRad[];
  varer: readonly KortVare[];
  sedel: SedelKortKontekst;
  kort: KortValg;
  reiseLonnsartId: string | null;
}): KortInnhold {
  const { sedel, kort } = args;
  const timer = raderPaaKort(args.timerRader, sedel, kort).filter(
    (r) => !erReiseRadVisning(r.erReise, r.lonnsartId, args.reiseLonnsartId),
  );
  const timerIder = new Set(timer.map((r) => r.id));
  const maskin = args.maskinRader.filter(
    (m) =>
      (m.sheetTimerId != null && timerIder.has(m.sheetTimerId)) ||
      kortNokkelFor(m, sedel) === kortNokkel(kort),
  );
  return { timer, maskin, varer: raderPaaKort(args.varer, sedel, kort) };
}

/** Finnes et annet kort med målnøkkelen? Da slås kortene sammen. */
export function kortFinnesFraFor(
  rader: readonly { projectId: string | null; byggeplassId?: string | null; externalCostObjectId?: string | null }[],
  sedel: SedelKortKontekst,
  til: KortValg,
): boolean {
  return raderPaaKort(rader, sedel, til).length > 0;
}

export type KortUtfall =
  | { utfall: "ok" }
  | { utfall: "laast" }
  | { utfall: "uendret" }
  | { utfall: "brudd" }
  | { utfall: "offline" }
  | { utfall: "serverFeil"; melding: string };

/** Dagens rader + statusen — det brudd-sjekken og redigerbar-sperren trenger. */
export type KortDag = {
  sheetId: string;
  organizationId: string;
  status: string;
  pauseMin: number;
  sedel: SedelKortKontekst;
  timerRader: readonly TimerRad[];
  maskinRader: readonly MaskinRad[];
};

function erRedigerbar(status: string): boolean {
  return status === "draft" || status === "returned";
}

const bucket = (b: Pick<MaskinBrudd, "projectId" | "externalCostObjectId">) =>
  `${b.projectId}|${b.externalCostObjectId ?? ""}`;

/**
 * Gir endringen et NYTT maskinbrudd (maskin > arbeid + pause) i en bøtte
 * (prosjekt, underprosjekt)? `til` = null: kortets rader forsvinner (slett).
 * Brudd som fantes fra før blokkerer ikke.
 */
function girNyttBrudd(dag: KortDag, innhold: KortInnhold, til: KortValg | null): boolean {
  const flyttes = new Set([...innhold.timer.map((r) => r.id), ...innhold.maskin.map((m) => m.id)]);
  type R = { id: string; projectId: string | null; externalCostObjectId: string | null; timer: number | null };
  const naa = (r: R) => ({
    projectId: r.projectId ?? dag.sedel.projectId,
    externalCostObjectId: r.externalCostObjectId ?? null,
    timer: r.timer ?? 0,
  });
  const etterpaa = (r: R) =>
    flyttes.has(r.id) && til ? { projectId: til.projectId, externalCostObjectId: til.ecoId, timer: r.timer ?? 0 } : naa(r);
  const for_ = new Set(
    beregnMaskinBrudd(dag.timerRader.map(naa), dag.maskinRader.map(naa), dag.pauseMin).map(bucket),
  );
  const behold = (r: { id: string }) => til !== null || !flyttes.has(r.id);
  const etter = beregnMaskinBrudd(
    dag.timerRader.filter(behold).map(etterpaa),
    dag.maskinRader.filter(behold).map(etterpaa),
    dag.pauseMin,
  );
  return etter.some((b) => !for_.has(bucket(b)));
}

/**
 * «Slett kort»: timer (tombstone med serverVersjon), maskin (også koblet) og
 * varer. Varer har ingen tombstone: en linje som finnes på server slettes der
 * først (`slettVare`); offline med slike linjer → «offline» uten skriving.
 * Sedelen blir stående (tom) — kalleren markerer den endret.
 */
export async function slettKort(
  db: LokalDb,
  dag: KortDag,
  innhold: KortInnhold,
  server: { erPaaNettet: boolean; slettVare: (id: string) => Promise<void> },
): Promise<KortUtfall> {
  if (!erRedigerbar(dag.status)) return { utfall: "laast" };
  if (girNyttBrudd(dag, innhold, null)) return { utfall: "brudd" };
  const serverVarer = innhold.varer.filter(vareFinnesPaaServer);
  if (serverVarer.length > 0 && !server.erPaaNettet) return { utfall: "offline" };
  for (const v of serverVarer) {
    try {
      await server.slettVare(v.id);
    } catch (e) {
      return { utfall: "serverFeil", melding: e instanceof Error ? e.message : String(e) };
    }
  }
  slettKortLokalt(db, dag.sheetId, innhold);
  return { utfall: "ok" };
}

/** Lokal del av «Slett kort», ÉN transaksjon. Kalles etter server-varene. */
export function slettKortLokalt(db: LokalDb, sheetId: string, innhold: KortInnhold): void {
  const naa = Date.now();
  // Leses før tx (som fjernTimerRad): null = ukjent versjon → S4.
  const versjon = new Map(
    innhold.timer.map((r) => [
      r.id,
      db
        .select({ serverVersjon: sheetTimerLocal.serverVersjon })
        .from(sheetTimerLocal)
        .where(eq(sheetTimerLocal.id, r.id))
        .all()[0]?.serverVersjon ?? null,
    ]),
  );
  db.transaction((tx) => {
    for (const r of innhold.timer) {
      tx.delete(sheetTimerLocal).where(eq(sheetTimerLocal.id, r.id)).run();
      tx.insert(slettedeRaderLocal)
        .values({ radId: r.id, dagsseddelId: sheetId, radType: "timer", serverVersjon: versjon.get(r.id) ?? null, slettetVed: naa })
        .onConflictDoNothing()
        .run();
    }
    for (const m of innhold.maskin) {
      tx.delete(sheetMachineLocal).where(eq(sheetMachineLocal.id, m.id)).run();
      tx.insert(slettedeRaderLocal)
        .values({ radId: m.id, dagsseddelId: sheetId, radType: "maskin", slettetVed: naa })
        .onConflictDoNothing()
        .run();
    }
    for (const v of innhold.varer) {
      tx.delete(vareforbrukLocal).where(eq(vareforbrukLocal.id, v.id)).run();
    }
  });
}

/**
 * «Endre kort»: ett mål for alle kortets rader. Timer via `flyttTimerRad`
 * (koblet maskin følger), frie maskiner via `flyttMaskinRad`, varer på server
 * først (`flyttVare`) og så lokalt. «Uten byggeplass» løfter sedelens arv
 * (`loftByggeplassArv`). Finnes målkortet, slås kortene sammen (datanivå).
 */
export async function flyttKort(
  db: LokalDb,
  dag: KortDag,
  innhold: KortInnhold,
  fra: KortValg,
  til: KortValg,
  server: { erPaaNettet: boolean; flyttVare: (id: string, til: FlyttMaal) => Promise<void> },
): Promise<KortUtfall> {
  if (!erRedigerbar(dag.status)) return { utfall: "laast" };
  if (kortNokkel(fra) === kortNokkel(til)) return { utfall: "uendret" };
  if (girNyttBrudd(dag, innhold, til)) return { utfall: "brudd" };
  // Varer har ingen sedel-arv: kortets effektive byggeplass lagres (RETUR 4).
  const vareMaal: FlyttMaal = { projectId: til.projectId, byggeplassId: vareByggeplassForKort(til), ecoId: til.ecoId };
  const serverVarer = innhold.varer.filter(vareFinnesPaaServer);
  if (serverVarer.length > 0 && !server.erPaaNettet) return { utfall: "offline" };
  for (const v of serverVarer) {
    try {
      await server.flyttVare(v.id, vareMaal);
    } catch (e) {
      return { utfall: "serverFeil", melding: e instanceof Error ? e.message : String(e) };
    }
  }
  if (trengerByggeplassLoft(til, dag.sedel)) loftByggeplassArv(db, dag.sheetId, dag.sedel);
  const maal: FlyttMaal = {
    projectId: til.projectId,
    byggeplassId: lagretByggeplassForKort(til, dag.sedel),
    ecoId: til.ecoId,
  };
  const kontekst: RadKontekst = { sheetId: dag.sheetId, organizationId: dag.organizationId };
  const timerIder = new Set(innhold.timer.map((r) => r.id));
  db.transaction((tx) => {
    // tx har samme skrive-API som db; hjelperne åpner ingen egen transaksjon.
    const t = tx as unknown as LokalDb;
    for (const r of innhold.timer) flyttTimerRad(t, kontekst, r, maal);
    for (const m of innhold.maskin) {
      if (m.sheetTimerId != null && timerIder.has(m.sheetTimerId)) continue; // fulgte timer-raden
      flyttMaskinRad(t, m.id, maal);
    }
    for (const v of innhold.varer) flyttVareLokalt(t, v.id, vareMaal);
  });
  return { utfall: "ok" };
}
