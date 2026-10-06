/**
 * Forsonings-skrivelaget (V19-C/V19.9) — den rene/DB-kjernen bak `app/timer/[id].tsx`-
 * bekreftelsen, trukket ut så mobil-harnessen kan feile uten RN montert (samme mønster
 * som `dagskortSammenligning`).
 *
 * To ansvar:
 *  - `byggForsonOverlappKall`: UI-state (sammenlignings-rader + valg) → `forsonDagskort`-
 *    input via den DELTE `byggForsonInputFraValg`. BÆRER `slettinger` (RETUR 1 vilkår 1:
 *    valget «Telefonen slettet raden» må nå serveren, ellers blir raden stående).
 *  - `anvendForsonetLokalt`: speil serverens autoritative forsonede rad-sett til lokal DB
 *    MED `server_versjon` + stempler (RETUR 1 vilkår 2: ellers gir første redigering etter
 *    en løst konflikt R10 = ny falsk konflikt).
 */

import { eq } from "drizzle-orm";
import {
  byggForsonInputFraValg,
  type ForsonRad as DeltForsonRad,
  type ForsonSide,
  type ForsonInput,
} from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import { dagsseddelLocal, sheetTimerLocal } from "../db/schema";
import type { Side, TidsromRad } from "./dagskortSammenligning";

/** Narrow form av server-radene `forsonDagskort` returnerer (unngår dyp tRPC-union / TS2589). */
export type ForsonetServerRad = {
  id: string;
  projectId: string | null;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timer: number | string;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse: string | null;
  pauseMin: number;
  // V19.9 (RETUR 1, vilkår 2): radversjonen serveren skrev (SheetTimer.updatedAt).
  // tRPC kan levere ISO-streng eller Date avhengig av transformer → normaliseres.
  updatedAt: string | Date;
};

/** Normaliser en tRPC-levert tidsverdi (streng/Date) → ISO-ms (= server_versjon-format). */
export function tilIsoVersjon(v: string | Date): string {
  return typeof v === "string" ? v : new Date(v).toISOString();
}

/**
 * V19.9 (RETUR 1, vilkår 1) — bygg `forsonDagskort`-kallet for overlapp-modus fra
 * sammenlignings-radene og det effektive valget. Nøkler valget pr. slot (rad.nokkel =
 * forslagsradens id for parede slots) og oversetter til "forslag"/"sedel", og delegerer
 * til den DELTE `byggForsonInputFraValg` som gir `oppdateringer`/`nyeRader`/`slettinger`.
 * ALLE valgbare slots mappes (også `slettet_pc` med server=null) — ellers låses valget
 * til default.
 */
export function byggForsonOverlappKall(
  rader: readonly TidsromRad[],
  effektivtValg: Readonly<Record<string, Side>>,
  webSedelRader: readonly DeltForsonRad[],
  forslagRader: readonly DeltForsonRad[],
): ForsonInput {
  const valgPerForslag: Record<string, ForsonSide> = {};
  for (const rad of rader) {
    if (rad.valgbar !== false && rad.nokkel) {
      valgPerForslag[rad.nokkel] =
        effektivtValg[rad.nokkel] === "lokal" ? "forslag" : "sedel";
    }
  }
  return byggForsonInputFraValg(webSedelRader, forslagRader, valgPerForslag);
}

/**
 * Speil det autoritative forsonede rad-settet fra serveren til lokal DB: slett sedelens
 * lokale timer-rader og sett inn serverens. Server er sannhet (validerte + skrev i én
 * transaksjon), så lokal kan ikke divergere fra web etter dette.
 *
 * V19.9 (RETUR 1, vilkår 2): hver innsatt rad får `server_versjon = updatedAt` og
 * `sistEndretLokalt = naa`, og sedelen `sistSynkronisert = naa` — ellers ville første
 * redigering etter en løst konflikt se raden som «ukjent versjon» (R10) og gi en NY
 * falsk konflikt. Stemplene gjør `endretLokalt = false` ved neste push (R1/R3).
 *
 * `naa` injiseres av testen (determinisme); produksjon sender `Date.now()`.
 */
export function anvendForsonetLokalt(
  sheetId: string,
  rader: readonly ForsonetServerRad[],
  naa: number = Date.now(),
): void {
  const db = hentDatabase();
  if (!db) return;
  db.delete(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).run();
  for (const r of rader) {
    db.insert(sheetTimerLocal)
      .values({
        id: r.id,
        dagsseddelId: sheetId,
        projectId: r.projectId,
        byggeplassId: r.byggeplassId,
        lonnsartId: r.lonnsartId,
        aktivitetId: r.aktivitetId,
        externalCostObjectId: r.externalCostObjectId,
        timer: Number(r.timer),
        fraTid: r.fraTid,
        tilTid: r.tilTid,
        beskrivelse: r.beskrivelse,
        pauseMin: r.pauseMin ?? 0,
        serverVersjon: tilIsoVersjon(r.updatedAt),
        sistEndretLokalt: naa,
      })
      .run();
  }
  // Sedelen er nå i synk med serverens forsonede sett → stemple sist synket = naa.
  db.update(dagsseddelLocal)
    .set({ sistSynkronisert: naa })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
}
