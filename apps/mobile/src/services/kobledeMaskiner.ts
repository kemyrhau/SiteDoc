import { eq } from "drizzle-orm";
import { randomUUID } from "expo-crypto";
import type { hentDatabase } from "../db/database";
import { sheetMachineLocal, slettedeRaderLocal } from "../db/schema";

/* ============================================================================
 *  NY BESLUTNING maskinkobling (Kenneth 2026-11-12) — erstatter «én maskin pr
 *  timerad». En timerad har 0, 1 eller flere koblede maskiner
 *  (`sheet_machine.sheet_timer_id` = radens id, ingen unik-indeks). Hver maskin
 *  har EGNE timer: standard = radens timer, kan settes lavere, aldri høyere.
 *
 *  - Maskintimer følger ALDRI radens timer stille. Går en maskin over radens
 *    timer, avvises lagringen (`maskinerOverRad`) — appen retter ikke selv.
 *  - Lagring rører bare maskinlinjene som faktisk sendes inn; koblede maskiner
 *    som ikke er nevnt, blir stående urørt (ikke slettet, ikke endret).
 *  - Felles for dagskortets `TimerSeksjon.oppdater` og prosjektkortets
 *    `radLagring.oppdaterTimerRad` + `settInnTimerRad` (én skrivevei).
 * ============================================================================ */

type LokalDb = NonNullable<ReturnType<typeof hentDatabase>>;

/** Toleranse for flyttall-sammenligning av timer (0,01 t ≈ 36 s). */
const EPS = 1e-6;

/** Ny maskin på en rad (fra rad-modalen). */
export type NyMaskin = {
  vehicleId: string;
  /** Egne timer, ≤ radens. */
  timer: number;
  mengde: number | null;
  enhet: string | null;
};

/** Én maskinlinje i rad-modalen. `id` null = ny linje. */
export type MaskinLinje = NyMaskin & { id: string | null };

/**
 * Maskin-endringer for én rad. Linjer med id oppdateres, linjer uten id settes
 * inn, `fjernede` slettes (med tombstone). Koblede maskiner som ikke er nevnt,
 * røres ikke.
 */
export type MaskinEndringer = { linjer: MaskinLinje[]; fjernede: string[] };

/** Radens felt som en koblet maskin arver (bøtte + tid). */
export type RadForMaskin = {
  projectId: string;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
};

/** Ren: linjene som har flere timer enn raden (tom = gyldig). */
export function maskinerOverRad<T extends { timer: number }>(radTimer: number, linjer: T[]): T[] {
  return linjer.filter((l) => l.timer > radTimer + EPS);
}

/** Koblede maskiner for raden, i lagret rekkefølge. */
export function hentKobledeMaskiner(db: LokalDb, radId: string) {
  return db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.sheetTimerId, radId)).all();
}

/**
 * Timene hver koblet maskin får ETTER en lagring med `endringer` (undefined =
 * maskiner røres ikke). Brukes til å avvise lagring der en maskin ville gått
 * over radens timer — før noe skrives.
 */
export function maskinerOverRadEtterLagring(
  db: LokalDb,
  radId: string,
  radTimer: number,
  endringer: MaskinEndringer | undefined,
): Array<{ id: string | null; vehicleId: string; timer: number }> {
  const koblede = hentKobledeMaskiner(db, radId);
  const fjernet = new Set(endringer?.fjernede ?? []);
  const linjeFor = new Map((endringer?.linjer ?? []).filter((l) => l.id).map((l) => [l.id as string, l]));
  const etter = [
    ...koblede
      .filter((m) => !fjernet.has(m.id))
      .map((m) => {
        const l = linjeFor.get(m.id);
        return { id: m.id, vehicleId: l?.vehicleId ?? m.vehicleId, timer: l?.timer ?? m.timer };
      }),
    ...(endringer?.linjer ?? []).filter((l) => !l.id).map((l) => ({ id: null, vehicleId: l.vehicleId, timer: l.timer })),
  ];
  return maskinerOverRad(radTimer, etter);
}

/**
 * Fra/til for en maskinlinje: full rad (timer = radens) → radens fra/til.
 * Kortere maskin → egne fra/til beholdes når timene er uendret, ellers null
 * (vi gjetter ikke hvilken del av raden maskinen gikk).
 */
function maskinTid(
  rad: RadForMaskin,
  timer: number,
  fra: { timer: number; fraTid: string | null; tilTid: string | null } | null,
): { fraTid: string | null; tilTid: string | null } {
  if (Math.abs(timer - rad.timer) <= EPS) return { fraTid: rad.fraTid, tilTid: rad.tilTid };
  if (fra && Math.abs(fra.timer - timer) <= EPS) return { fraTid: fra.fraTid, tilTid: fra.tilTid };
  return { fraTid: null, tilTid: null };
}

/**
 * Skriv maskin-endringer for raden. Forutsetter at kalleren har avvist
 * `maskinerOverRadEtterLagring` ≠ []. Bare linjer som faktisk endres, får ny
 * `sistEndretLokalt` (ingen støy i sync).
 */
export function skrivKobledeMaskiner(
  db: LokalDb,
  sheetId: string,
  radId: string,
  rad: RadForMaskin,
  endringer: MaskinEndringer,
): void {
  const koblede = new Map(hentKobledeMaskiner(db, radId).map((m) => [m.id, m]));
  db.transaction((tx) => {
    for (const l of endringer.linjer) {
      if (!l.id) {
        tx.insert(sheetMachineLocal)
          .values({
            id: randomUUID(),
            dagsseddelId: sheetId,
            sheetTimerId: radId,
            projectId: rad.projectId,
            byggeplassId: rad.byggeplassId,
            externalCostObjectId: rad.externalCostObjectId,
            vehicleId: l.vehicleId,
            timer: l.timer,
            mengde: l.mengde,
            enhet: l.enhet,
            ...maskinTid(rad, l.timer, null),
            sistEndretLokalt: Date.now(),
          })
          .run();
        continue;
      }
      const m = koblede.get(l.id);
      // Linje som ikke (lenger) er koblet til raden, røres ikke.
      if (!m) continue;
      const ny = {
        projectId: rad.projectId,
        byggeplassId: rad.byggeplassId,
        externalCostObjectId: rad.externalCostObjectId,
        vehicleId: l.vehicleId,
        timer: l.timer,
        mengde: l.mengde,
        enhet: l.enhet,
        ...maskinTid(rad, l.timer, m),
      };
      const uendret = (Object.keys(ny) as Array<keyof typeof ny>).every(
        (k) => (m[k] ?? null) === (ny[k] ?? null),
      );
      if (uendret) continue;
      tx.update(sheetMachineLocal)
        .set({ ...ny, sistEndretLokalt: Date.now() })
        .where(eq(sheetMachineLocal.id, m.id))
        .run();
    }
    for (const id of endringer.fjernede) {
      if (!koblede.has(id)) continue;
      tx.delete(sheetMachineLocal).where(eq(sheetMachineLocal.id, id)).run();
      tx.insert(slettedeRaderLocal)
        .values({ radId: id, dagsseddelId: sheetId, radType: "maskin", slettetVed: Date.now() })
        .onConflictDoNothing()
        .run();
    }
  });
}

/**
 * Bekreft dag (NY BESLUTNING): maskinen kobles til raden med samme prosjekt,
 * byggeplass og ECO der maskinens fra–til ligger innenfor radens fra–til.
 * Mangler tid (maskin eller rad), eller passer mer enn én rad → null
 * («Uten rad»). Ingen gjetting, timene røres aldri.
 */
export function radForMaskin<R extends {
  id: string;
  projectId: string;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  fraTid: string | null;
  tilTid: string | null;
}>(
  maskin: {
    projectId: string;
    byggeplassId: string | null;
    externalCostObjectId: string | null;
    fraTid: string | null;
    tilTid: string | null;
  },
  rader: R[],
): string | null {
  if (!maskin.fraTid || !maskin.tilTid || maskin.fraTid >= maskin.tilTid) return null;
  const treff = rader.filter(
    (r) =>
      r.projectId === maskin.projectId &&
      (r.byggeplassId ?? null) === (maskin.byggeplassId ?? null) &&
      (r.externalCostObjectId ?? null) === (maskin.externalCostObjectId ?? null) &&
      !!r.fraTid &&
      !!r.tilTid &&
      r.fraTid <= maskin.fraTid! &&
      maskin.tilTid! <= r.tilTid,
  );
  return treff.length === 1 ? treff[0]!.id : null;
}
