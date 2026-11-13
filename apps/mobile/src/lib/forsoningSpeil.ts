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

import { and, eq, inArray } from "drizzle-orm";
import {
  byggForsonInputFraValg,
  planleggLinjeRelink,
  type RelinkPar,
  type ForsonRad as DeltForsonRad,
  type ForsonSide,
  type ForsonInput,
} from "@sitedoc/shared";
import { hentDatabase } from "../db/database";
import {
  dagsseddelLocal,
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetTimerLocal,
  sheetUtleggLocal,
  slettedeRaderLocal,
} from "../db/schema";
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
  // Telefontest B funn 5: forslag-id-er (= telefonens rad-id-er) serveren slo inn i denne
  // raden. Mangler mot eldre API → ingen lokal relink (tåles).
  relinketFra?: string[];
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
  // Telefontest A funn 1: linjer endret/slettet etter siste godtatte push leses FØR
  // relinken (som selv stempler maskinlinjer). Uten dem ville et tidlig overlapp-svar
  // (serveren skrev ingenting) etterlate tillegg/utlegg/maskin usendt bak `synced`.
  const usendt = harUsendteLinjer(db, sheetId);
  // Funn 5: telefonens egne rader (forslagene) leses FØR de slettes — relinken trenger
  // forslagets verdier for likhetsregelen.
  const lokaleFoer = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all();
  relinkLokaleLinjer(db, sheetId, lokaleFoer, rader, naa);
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
  // Usendte linjer → `pending`, så neste push bærer dem (bekreftConflict beholder det).
  db.update(dagsseddelLocal)
    .set({ sistSynkronisert: naa, ...(usendt ? { syncStatus: "pending" as const } : {}) })
    .where(eq(dagsseddelLocal.id, sheetId))
    .run();
}

/**
 * Telefontest A funn 1: har sedelen tillegg-, utlegg- eller maskinlinjer (eller tombstones
 * for dem) endret etter siste godtatte push (`sistSynkronisert`)? Konflikt-grenen lar
 * sist-synket stå når serveren ikke skrev noe (`skrevet: false`); da er alt endret siden
 * forrige ok-push usendt. Timer-radene telles ikke — forsoningen erstatter dem.
 */
function harUsendteLinjer(db: Db, sheetId: string): boolean {
  const sedel = db
    .select({ sistSynkronisert: dagsseddelLocal.sistSynkronisert })
    .from(dagsseddelLocal)
    .where(eq(dagsseddelLocal.id, sheetId))
    .get();
  const forrige = sedel?.sistSynkronisert ?? 0;
  const endret = (t: { sistEndretLokalt: number | null }) => (t.sistEndretLokalt ?? 0) > forrige;
  for (const tabell of [sheetTilleggLocal, sheetUtleggLocal, sheetMachineLocal] as const) {
    const rader = db
      .select({ sistEndretLokalt: tabell.sistEndretLokalt })
      .from(tabell)
      .where(eq(tabell.dagsseddelId, sheetId))
      .all();
    if (rader.some(endret)) return true;
  }
  return db
    .select({ radType: slettedeRaderLocal.radType, slettetVed: slettedeRaderLocal.slettetVed })
    .from(slettedeRaderLocal)
    .where(eq(slettedeRaderLocal.dagsseddelId, sheetId))
    .all()
    .some((t) => t.radType !== "timer" && t.radType !== "sedel" && t.slettetVed > forrige);
}

type Db = NonNullable<ReturnType<typeof hentDatabase>>;
type LokalTimerRad = typeof sheetTimerLocal.$inferSelect;

function lokalTilForsonRad(r: {
  id: string;
  projectId: string | null;
  byggeplassId: string | null;
  lonnsartId: string;
  aktivitetId: string;
  externalCostObjectId: string | null;
  timer: number | string;
  fraTid: string | null;
  tilTid: string | null;
}): DeltForsonRad {
  return {
    id: r.id,
    projectId: r.projectId ?? "",
    byggeplassId: r.byggeplassId,
    lonnsartId: r.lonnsartId,
    aktivitetId: r.aktivitetId,
    externalCostObjectId: r.externalCostObjectId,
    timer: Number(r.timer),
    fraTid: r.fraTid,
    tilTid: r.tilTid,
  };
}

/**
 * Telefontest B funn 5: lokale maskinlinjer som hang på en telefonrad serveren slo inn i
 * en annen rad (`relinketFra`), følger raden som vant — samme delte likhetsregel som
 * serveren (`planleggLinjeRelink`). Uten `relinketFra` (eldre API) skjer ingenting.
 */
function relinkLokaleLinjer(
  db: Db,
  sheetId: string,
  lokaleFoer: readonly LokalTimerRad[],
  rader: readonly ForsonetServerRad[],
  naa: number,
): void {
  const lokalPaaId = new Map(lokaleFoer.map((r) => [r.id, r]));
  const par: RelinkPar[] = [];
  for (const r of rader) {
    for (const fraId of r.relinketFra ?? []) {
      const fra = lokalPaaId.get(fraId);
      if (fra) par.push({ fra: lokalTilForsonRad(fra), tilId: r.id });
    }
  }
  if (par.length === 0) return;
  const linjer = db
    .select()
    .from(sheetMachineLocal)
    .where(
      and(
        eq(sheetMachineLocal.dagsseddelId, sheetId),
        inArray(
          sheetMachineLocal.sheetTimerId,
          par.map((p) => p.fra.id),
        ),
      ),
    )
    .all();
  // Lokal projectId null = arv fra sedelen; normaliseres likt med radene (""), så en
  // linje som arvet sammen med telefonraden også følger raden som vant.
  const plan = planleggLinjeRelink(
    par,
    linjer.map((l) => ({ ...l, projectId: l.projectId ?? "" })),
    rader.map(lokalTilForsonRad),
  );
  for (const p of plan) {
    db.update(sheetMachineLocal)
      .set({ ...p.data, sistEndretLokalt: naa })
      .where(eq(sheetMachineLocal.id, p.id))
      .run();
  }
}
