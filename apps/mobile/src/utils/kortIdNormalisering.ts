import {
  effektivKortByggeplass,
  kortIdNokkel,
  kortPaaSedelFraRader,
  losKortId,
  utledKortId,
} from "@sitedoc/shared";

/* ============================================================================
 *  Kort-id på telefonen (prosjektkort-kortid-spec § 2.4, § 3.3, § 4; Kenneth
 *  2026-11-16, B1 = A: kolonne på radene, vises aldri i UI).
 *
 *  ÉN regel for alle lokale skriveveier (M9), den lokale backfillen (§ 3.3) og
 *  push: `normaliserKortIder` gjør sedelens rader gyldige etter K1–K4/K6 med
 *  shared `losKortId`/`utledKortId` — samme id-er som serverens backfill.
 *
 *   - Reise-timerrad: `kort_id` NULL (§ 2.2).
 *   - Rad med id som ikke lenger har kortets nøkkel (flyttet til annet prosjekt/
 *     byggeplass/underprosjekt): regel 3 på nytt (§ 4.2, «nøkkelen er endret»).
 *     Kortets nøkkel = nøkkelen flest av kortets rader har (likt → eldste rad).
 *   - Koblet maskin/vare (samme prosjekt som timerraden): timerradens id (K6).
 *   - Rad uten id: regel 3 — eldste kort på sedelen med samme nøkkel, ellers
 *     utledet id.
 *  To kort med samme nøkkel (K7) røres ikke. Normaliseringen endrer bare
 *  `kort_id`: ikke `sist_endret_lokalt`, ikke `sync_status` — id-en er intern og
 *  skal ikke i seg selv sende en rad til serveren.
 *
 *  Alder lokalt = rekkefølge (timer, tillegg, utlegg, maskin, vare; innen tabell
 *  `rowid`). Telefonen har ikke radens opprettet-tid.
 * ============================================================================ */

export type LokalKortRadType = "timer" | "tillegg" | "utlegg" | "maskin" | "vare";

export type LokalKortRad = {
  id: string;
  type: LokalKortRadType;
  kortId: string | null;
  /** Radens prosjekt; `null` = legacy-rad som arver sedelens. */
  projectId: string | null;
  byggeplassId: string | null;
  ecoId: string | null;
  /** Bare timer. */
  erReise?: boolean | null;
  /** Bare maskin/vare. */
  sheetTimerId?: string | null;
};

export type LokalKortSedel = {
  userId: string;
  /** YYYY-MM-DD. */
  dato: string;
  projectId: string;
  byggeplass: { id: string; projectId: string } | null;
};

const TYPE_REKKEFOLGE: LokalKortRadType[] = ["timer", "tillegg", "utlegg", "maskin", "vare"];

/**
 * Ren: hvilken `kort_id` hver rad skal ha. Returnerer bare radene som endres
 * (id → ny verdi). `rader` er i alder-rekkefølge innen hver type.
 */
export function normaliserKortIder(
  sedel: LokalKortSedel,
  rader: readonly LokalKortRad[],
): Map<string, string | null> {
  const ordnet = TYPE_REKKEFOLGE.flatMap((t) => rader.filter((r) => r.type === t));
  const alder = new Map(ordnet.map((r, i) => [r.id, i]));
  const prosjekt = (r: LokalKortRad) => r.projectId ?? sedel.projectId;
  const nokkel = (r: LokalKortRad) => {
    const pid = prosjekt(r);
    return kortIdNokkel({
      projectId: pid,
      byggeplassId: effektivKortByggeplass(pid, r.byggeplassId, sedel.byggeplass),
      ecoId: r.ecoId,
    });
  };
  const utledet = (r: LokalKortRad) => {
    const pid = prosjekt(r);
    return utledKortId({
      userId: sedel.userId,
      dato: sedel.dato,
      nokkel: {
        projectId: pid,
        byggeplassId: effektivKortByggeplass(pid, r.byggeplassId, sedel.byggeplass),
        ecoId: r.ecoId,
      },
    });
  };
  const erReise = (r: LokalKortRad) => r.type === "timer" && r.erReise === true;

  // Kortets nøkkel: flest rader, likt → eldste rad.
  const kortNokler = new Map<string, Map<string, { antall: number; eldst: number }>>();
  for (const r of ordnet) {
    if (!r.kortId || erReise(r)) continue;
    const pr = kortNokler.get(r.kortId) ?? new Map<string, { antall: number; eldst: number }>();
    const n = nokkel(r);
    const f = pr.get(n);
    pr.set(n, { antall: (f?.antall ?? 0) + 1, eldst: Math.min(f?.eldst ?? Infinity, alder.get(r.id)!) });
    kortNokler.set(r.kortId, pr);
  }
  const kortetsNokkel = new Map<string, string>();
  for (const [kortId, pr] of kortNokler) {
    const [vinner] = [...pr.entries()].sort(
      (a, b) => b[1].antall - a[1].antall || a[1].eldst - b[1].eldst,
    );
    kortetsNokkel.set(kortId, vinner![0]);
  }

  const ny = new Map<string, string | null>();
  for (const r of ordnet) {
    if (erReise(r)) ny.set(r.id, null);
    else if (r.kortId && kortetsNokkel.get(r.kortId) === nokkel(r)) ny.set(r.id, r.kortId);
    else ny.set(r.id, null); // uten id, eller flyttet → regel 3 under
  }

  const timerKort = (radId: string | null | undefined) =>
    radId ? ordnet.find((t) => t.type === "timer" && t.id === radId) : undefined;
  const kortPaaSedel = () =>
    kortPaaSedelFraRader(
      ordnet
        .filter((r) => ny.get(r.id))
        .map((r) => ({ kortId: ny.get(r.id)!, nokkel: nokkel(r), opprettet: alder.get(r.id)! })),
    );

  for (const r of ordnet) {
    if (erReise(r)) continue;
    const t = r.type === "maskin" || r.type === "vare" ? timerKort(r.sheetTimerId) : undefined;
    if (t && !erReise(t) && prosjekt(t) === prosjekt(r)) {
      // K6: koblet maskin/vare følger timerraden (timer er behandlet først).
      ny.set(r.id, ny.get(t.id) ?? null);
      continue;
    }
    if (ny.get(r.id)) continue;
    ny.set(
      r.id,
      losKortId({ nokkel: nokkel(r), kortPaaSedel: kortPaaSedel(), utledet: utledet(r) }),
    );
  }

  const endret = new Map<string, string | null>();
  for (const r of ordnet) {
    const v = ny.get(r.id) ?? null;
    if (v !== (r.kortId ?? null)) endret.set(r.id, v);
  }
  return endret;
}

// ---------------------------------------------------------------------------
// Rå SQL-adapter: lokal backfill i migreringen (§ 3.3)
// ---------------------------------------------------------------------------

export type RaaSqlite = {
  getAllSync: (sql: string, ...params: unknown[]) => unknown[];
  runSync: (sql: string, ...params: unknown[]) => unknown;
};

type RaaRad = Record<string, unknown>;
const tekst = (v: unknown): string | null => (v == null ? null : String(v));

/**
 * Lokal backfill (§ 3.3): alle sedler med minst én rad uten `kort_id` normaliseres
 * med samme regel som skriveveiene. Idempotent — andre kjøring endrer ingenting.
 */
export function backfillLokalKortId(db: RaaSqlite): number {
  const sedler = db.getAllSync(
    `SELECT DISTINCT d.id AS id, d.user_id AS user_id, d.dato AS dato, d.project_id AS project_id,
            b.id AS bp_id, b.project_id AS bp_project_id
       FROM dagsseddel_local d
       LEFT JOIN byggeplass_local b ON b.id = d.byggeplass_id
      WHERE d.id IN (
        SELECT dagsseddel_id FROM sheet_timer_local WHERE kort_id IS NULL AND coalesce(er_reise, 0) = 0
        UNION SELECT dagsseddel_id FROM sheet_tillegg_local WHERE kort_id IS NULL
        UNION SELECT dagsseddel_id FROM sheet_utlegg_local WHERE kort_id IS NULL
        UNION SELECT dagsseddel_id FROM sheet_machine_local WHERE kort_id IS NULL
        UNION SELECT sheet_id FROM vareforbruk_local WHERE kort_id IS NULL)`,
  ) as RaaRad[];
  let antall = 0;
  const tabell: Record<LokalKortRadType, string> = {
    timer: "sheet_timer_local",
    tillegg: "sheet_tillegg_local",
    utlegg: "sheet_utlegg_local",
    maskin: "sheet_machine_local",
    vare: "vareforbruk_local",
  };
  for (const s of sedler) {
    const id = String(s.id);
    const les = (t: LokalKortRadType, ekstra: string, sedelKol = "dagsseddel_id") =>
      (
        db.getAllSync(
          `SELECT id, kort_id, project_id, byggeplass_id, external_cost_object_id${ekstra}
             FROM ${tabell[t]} WHERE ${sedelKol} = ? ORDER BY rowid`,
          id,
        ) as RaaRad[]
      ).map(
        (r): LokalKortRad => ({
          id: String(r.id),
          type: t,
          kortId: tekst(r.kort_id),
          projectId: tekst(r.project_id),
          byggeplassId: tekst(r.byggeplass_id),
          ecoId: tekst(r.external_cost_object_id),
          erReise: r.er_reise == null ? null : Number(r.er_reise) === 1,
          sheetTimerId: tekst(r.sheet_timer_id),
        }),
      );
    const rader = [
      ...les("timer", ", er_reise"),
      ...les("tillegg", ""),
      ...les("utlegg", ""),
      ...les("maskin", ", sheet_timer_id"),
      ...les("vare", ", sheet_timer_id", "sheet_id"),
    ];
    const endret = normaliserKortIder(
      {
        userId: String(s.user_id),
        dato: String(s.dato),
        projectId: String(s.project_id),
        byggeplass:
          s.bp_id != null ? { id: String(s.bp_id), projectId: String(s.bp_project_id) } : null,
      },
      rader,
    );
    const typeFor = new Map(rader.map((r) => [r.id, r.type]));
    for (const [radId, kortId] of endret) {
      db.runSync(`UPDATE ${tabell[typeFor.get(radId)!]} SET kort_id = ? WHERE id = ?`, kortId, radId);
      antall++;
    }
  }
  return antall;
}
