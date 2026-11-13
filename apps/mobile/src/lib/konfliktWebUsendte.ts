/**
 * Plan A (Kenneth 2026-11-13) — overlapp-konflikt løst på web: telefonen beholder linjene
 * som aldri nådde serveren.
 *
 * Ved overlapp avviser serveren hele pushen (`skrevet: false`), så tillegg, utlegg og
 * maskiner fra telefonen finnes bare lokalt. Når valget tas på web (`forsonDagskort`),
 * slipper pull konflikten og erstatter sedelens linjer med serverens. Uten dette ble de
 * usendte linjene slettet stille.
 *
 * Regelen hviler på `paa_server` (lokal kolonne): sann = raden er lagt inn av pull eller
 * var med i en push serveren svarte `ok` på. En rad med `paa_server` sann som mangler i
 * serversvaret, er slettet på web og legges ikke tilbake. Alt annet som mangler, legges
 * tilbake — unntatt levende tombstones (S-A KRAV 1).
 *
 * Maskiner og ventende varer som hang på en telefonrad som ikke lenger finnes, kobles til
 * den ene serverraden med samme prosjekt og overlappende tidsrom (delt `planleggLinjeRelink`,
 * samme likhetsregel som funn 5). Ingen eller flere kandidater → `sheetTimerId = null`
 * («Uten rad»), som brukeren retter med Flytt eller Slett. Sendte varer røres ikke.
 *
 * Kun mobil; ingen endring på server.
 */

import { and, eq } from "drizzle-orm";
import {
  planleggLinjeRelink,
  tidsromOverlapper,
  type ForsonRad,
  type RelinkPar,
} from "@sitedoc/shared";
import {
  sheetMachineLocal,
  sheetTilleggLocal,
  sheetTimerLocal,
  sheetUtleggLocal,
  vareforbrukLocal,
} from "../db/schema";
import type { hentDatabase } from "../db/database";

type Db = NonNullable<ReturnType<typeof hentDatabase>>;

export interface LokaltOyeblikksbilde {
  timer: Array<typeof sheetTimerLocal.$inferSelect>;
  tillegg: Array<typeof sheetTilleggLocal.$inferSelect>;
  utlegg: Array<typeof sheetUtleggLocal.$inferSelect>;
  maskiner: Array<typeof sheetMachineLocal.$inferSelect>;
}

/** Les sedelens lokale linjer og timerrader FØR pull sletter dem. */
export function taLokaltOyeblikksbilde(db: Db, sheetId: string): LokaltOyeblikksbilde {
  return {
    timer: db.select().from(sheetTimerLocal).where(eq(sheetTimerLocal.dagsseddelId, sheetId)).all(),
    tillegg: db.select().from(sheetTilleggLocal).where(eq(sheetTilleggLocal.dagsseddelId, sheetId)).all(),
    utlegg: db.select().from(sheetUtleggLocal).where(eq(sheetUtleggLocal.dagsseddelId, sheetId)).all(),
    maskiner: db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
  };
}

function skalLeggesTilbake(
  r: { id: string; paaServer: boolean | null },
  serverIder: ReadonlySet<string>,
  tombstoner: ReadonlySet<string>,
): boolean {
  return r.paaServer !== true && !serverIder.has(r.id) && !tombstoner.has(r.id);
}

function tilForsonRad(
  r: typeof sheetTimerLocal.$inferSelect,
  sedelProjectId: string,
): ForsonRad {
  return {
    id: r.id,
    projectId: r.projectId ?? sedelProjectId,
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
 * Den ene serverraden en telefonrad kan erstattes av: samme prosjekt og overlappende
 * fra–til. Null når telefonraden mangler tid, eller når det er ingen eller flere kandidater.
 */
export function entydigKandidat(
  telefonRad: ForsonRad,
  serverRader: readonly ForsonRad[],
): ForsonRad | null {
  const { fraTid, tilTid } = telefonRad;
  if (!fraTid || !tilTid) return null;
  const kandidater = serverRader.filter(
    (s) =>
      s.projectId === telefonRad.projectId &&
      !!s.fraTid &&
      !!s.tilTid &&
      tidsromOverlapper(fraTid, tilTid, s.fraTid, s.tilTid),
  );
  return kandidater.length === 1 ? kandidater[0]! : null;
}

type KoblingData = {
  sheetTimerId: string | null;
  projectId?: string;
  byggeplassId?: string | null;
  externalCostObjectId?: string | null;
  sistEndretLokalt: number;
};

export interface LeggTilbakeResultat {
  /** Antall tillegg/utlegg/maskiner lagt tilbake. > 0 → sedelen skal sendes på nytt. */
  lagtTilbake: number;
}

/**
 * Kalles ETTER at serverens linjer og timerrader er lagt inn. Legger tilbake usendte
 * linjer fra øyeblikksbildet og kobler maskiner og ventende varer som peker på en
 * telefonrad som ikke lenger finnes.
 */
export function leggTilbakeUsendteLinjer(
  db: Db,
  sheetId: string,
  bilde: LokaltOyeblikksbilde,
  serverIder: ReadonlySet<string>,
  tombstoner: ReadonlySet<string>,
  sedelProjectId: string,
  naa: number,
): LeggTilbakeResultat {
  let lagtTilbake = 0;
  for (const r of bilde.tillegg) {
    if (!skalLeggesTilbake(r, serverIder, tombstoner)) continue;
    db.insert(sheetTilleggLocal).values({ ...r, paaServer: false, sistEndretLokalt: naa }).run();
    lagtTilbake++;
  }
  for (const r of bilde.utlegg) {
    if (!skalLeggesTilbake(r, serverIder, tombstoner)) continue;
    db.insert(sheetUtleggLocal).values({ ...r, paaServer: false, sistEndretLokalt: naa }).run();
    lagtTilbake++;
  }
  const tilbakeMaskiner = bilde.maskiner.filter((r) => skalLeggesTilbake(r, serverIder, tombstoner));
  for (const r of tilbakeMaskiner) {
    db.insert(sheetMachineLocal).values({ ...r, paaServer: false, sistEndretLokalt: naa }).run();
    lagtTilbake++;
  }

  // Ny kobling: linjer som peker på en telefonrad som ikke står på sedelen lenger.
  const naaRader = db
    .select()
    .from(sheetTimerLocal)
    .where(eq(sheetTimerLocal.dagsseddelId, sheetId))
    .all()
    .map((r) => tilForsonRad(r, sedelProjectId));
  const finnes = new Set(naaRader.map((r) => r.id));
  const telefonRadPaaId = new Map(
    bilde.timer.map((r) => [r.id, tilForsonRad(r, sedelProjectId)]),
  );
  const par: RelinkPar[] = [];
  const foreldrelose = new Set<string>();
  for (const [id, tr] of telefonRadPaaId) {
    if (finnes.has(id)) continue;
    foreldrelose.add(id);
    const kandidat = entydigKandidat(tr, naaRader);
    if (kandidat) par.push({ fra: tr, tilId: kandidat.id });
  }
  if (foreldrelose.size === 0) return { lagtTilbake };

  const kobleOm = <
    L extends {
      id: string;
      sheetTimerId: string | null;
      byggeplassId: string | null;
      externalCostObjectId: string | null;
    },
  >(
    linjer: readonly L[],
    projectIdFor: (l: L) => string | null,
    oppdater: (id: string, data: KoblingData) => void,
  ) => {
    const aktuelle = linjer.filter((l) => l.sheetTimerId && foreldrelose.has(l.sheetTimerId));
    const plan = planleggLinjeRelink(
      par,
      aktuelle.map((l) => ({
        id: l.id,
        sheetTimerId: l.sheetTimerId,
        projectId: projectIdFor(l),
        byggeplassId: l.byggeplassId,
        externalCostObjectId: l.externalCostObjectId,
      })),
      naaRader,
    );
    const planlagt = new Set(plan.map((p) => p.id));
    for (const p of plan) oppdater(p.id, { ...p.data, sistEndretLokalt: naa });
    for (const l of aktuelle) {
      if (!planlagt.has(l.id)) oppdater(l.id, { sheetTimerId: null, sistEndretLokalt: naa });
    }
  };

  kobleOm(
    db.select().from(sheetMachineLocal).where(eq(sheetMachineLocal.dagsseddelId, sheetId)).all(),
    // Lokal projectId null = arv fra sedelen.
    (l) => l.projectId ?? sedelProjectId,
    (id, data) => db.update(sheetMachineLocal).set(data).where(eq(sheetMachineLocal.id, id)).run(),
  );
  kobleOm(
    db
      .select()
      .from(vareforbrukLocal)
      .where(and(eq(vareforbrukLocal.sheetId, sheetId), eq(vareforbrukLocal.syncStatus, "pending")))
      .all(),
    (l) => l.projectId,
    (id, data) => db.update(vareforbrukLocal).set(data).where(eq(vareforbrukLocal.id, id)).run(),
  );
  return { lagtTilbake };
}
