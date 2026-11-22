/**
 * Kort-id på serveren (prosjektkort-kortid-spec.md § 2.4, § 4; Kenneth 2026-11-16, B1 = A).
 *
 * Én funksjon alle server-skriveveier kaller etter at radene er skrevet:
 * `sikreKortId(tx, sheetId)` fyller manglende `kort_id` etter regel 3 (eldste kort på sedelen
 * med samme nøkkel, ellers utledet id), setter koblet maskin = timerradens kort (K6), legger
 * reiseraden i jobbens kort etter den delte regelen `velgReiseKort` (w12, B32 B; w15c: byggeplass
 * og valgt underprosjekt er krav, ellers eget kort; attestert eller erstattet reise med kort-id står) og validerer K1–K4/K6 over hele sedelens post-tilstand med
 * den delte `validerKortInvariant` (packages/shared). Regel 1 (oppgitt id) og regel 2 (lagret
 * id ved uendret nøkkel) gjøres av kalleren når raden skrives — se `kortIdForSkriving`.
 *
 * Kort-id-en vises aldri i UI. Oppdateringene går som rå SQL så `updated_at` (radversjonen
 * V19.9 bruker) IKKE bumpes av at feltet fylles.
 */
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import { prismaVarelager } from "@sitedoc/db-varelager";
import {
  effektivKortByggeplass,
  egetReiseKort,
  jobberFraArbeidsrader,
  kortIdNokkel,
  kortPaaSedelFraRader,
  losKortId,
  utledKortId,
  validerKortInvariant,
  velgReiseKort,
  type KortInvariantBrudd,
  type KortInvariantRad,
  type KortNokkelFelt,
} from "@sitedoc/shared";

type Tx = Prisma.TransactionClient;

export type SedelKortKontekst = {
  sheetId: string;
  userId: string;
  /** `YYYY-MM-DD` */
  dato: string;
  byggeplass: { id: string; projectId: string } | null;
};

function datoTekst(d: Date): string {
  // `dato` er @db.Date → midnatt UTC; ISO-dato er dagen.
  return d.toISOString().slice(0, 10);
}

export async function lastSedelKortKontekst(tx: Tx, sheetId: string): Promise<SedelKortKontekst> {
  const sedel = await tx.dailySheet.findUniqueOrThrow({
    where: { id: sheetId },
    select: { id: true, userId: true, dato: true, byggeplassId: true },
  });
  const bp = sedel.byggeplassId
    ? await prisma.byggeplass.findUnique({
        where: { id: sedel.byggeplassId },
        select: { id: true, projectId: true },
      })
    : null;
  return { sheetId: sedel.id, userId: sedel.userId, dato: datoTekst(sedel.dato), byggeplass: bp };
}

/** Nøkkelen (K2–K4) for en rad på sedelen — effektiv byggeplass (M1). */
export function radNokkel(
  kontekst: SedelKortKontekst,
  rad: { projectId: string | null; byggeplassId: string | null; externalCostObjectId: string | null },
): KortNokkelFelt {
  return {
    projectId: rad.projectId,
    byggeplassId: effektivKortByggeplass(rad.projectId, rad.byggeplassId, kontekst.byggeplass),
    ecoId: rad.externalCostObjectId,
  };
}

/**
 * Regel 1 og 2 når en rad skrives: oppgitt id, ellers lagret id hvis nøkkelen er uendret,
 * ellers `null` (regel 3 gjøres samlet av `sikreKortId` etterpå).
 */
export function kortIdForSkriving(
  kontekst: SedelKortKontekst,
  args: {
    oppgittKortId?: string | null;
    lagret?: {
      kortId: string | null;
      projectId: string | null;
      byggeplassId: string | null;
      externalCostObjectId: string | null;
    } | null;
    ny: { projectId: string | null; byggeplassId: string | null; externalCostObjectId: string | null };
  },
): string | null {
  if (args.oppgittKortId) return args.oppgittKortId;
  const l = args.lagret;
  if (!l?.kortId) return null;
  return kortIdNokkel(radNokkel(kontekst, l)) === kortIdNokkel(radNokkel(kontekst, args.ny))
    ? l.kortId
    : null;
}

type Tabell = "sheet_timer" | "sheet_machines" | "sheet_tillegg" | "sheet_utlegg";

async function settKortId(tx: Tx, tabell: Tabell, kortId: string | null, ider: string[]) {
  if (ider.length === 0) return;
  // Rå SQL: `updated_at` røres ikke (Prisma @updatedAt ville bumpet radversjonen).
  await tx.$executeRawUnsafe(
    `UPDATE "timer"."${tabell}" SET "kort_id" = $1 WHERE "id" = ANY($2::text[])`,
    kortId,
    ider,
  );
}

export type LagretKortRad = {
  id: string;
  kortId: string | null;
  projectId: string | null;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  /** Bare timerrader: reise eller arbeid (arbeid↔reise gir regel 3, § 8.22 punkt 3). */
  erReise?: boolean;
};

/**
 * Regel 2 i syncBatch: radenes LAGREDE kort-id og nøkkel, lest før payload-replace sletter dem.
 */
export async function lastLagretKort(
  tx: Tx,
  sheetId: string,
  ider: { timer: string[]; tillegg: string[]; maskin: string[]; utlegg: string[] },
): Promise<Map<string, LagretKortRad>> {
  const select = {
    id: true,
    kortId: true,
    projectId: true,
    byggeplassId: true,
    externalCostObjectId: true,
  } as const;
  const [timer, tillegg, maskin, utlegg] = await Promise.all([
    tx.sheetTimer.findMany({ where: { sheetId, id: { in: ider.timer } }, select: { ...select, erReise: true } }),
    tx.sheetTillegg.findMany({ where: { sheetId, id: { in: ider.tillegg } }, select }),
    tx.sheetMachine.findMany({ where: { sheetId, id: { in: ider.maskin } }, select }),
    tx.sheetUtlegg.findMany({ where: { sheetId, id: { in: ider.utlegg } }, select }),
  ]);
  return new Map([...timer, ...tillegg, ...maskin, ...utlegg].map((r) => [r.id, r]));
}

/**
 * K1 for oppgitte id-er: en kort-id som står på en ANNEN sedel kan ikke brukes (T9 — en klient
 * kan ikke låne en annen brukers kort). Kalles bare med id-er klienten oppga.
 */
export async function kortIdPaaAnnenSedel(
  tx: Tx,
  sheetId: string,
  kortIder: readonly string[],
): Promise<string[]> {
  const unike = [...new Set(kortIder.filter(Boolean))];
  if (unike.length === 0) return [];
  const rader = await tx.$queryRawUnsafe<{ kort_id: string }[]>(
    `SELECT DISTINCT kort_id FROM (
       SELECT kort_id, sheet_id FROM "timer"."sheet_timer" WHERE kort_id = ANY($1::text[])
       UNION ALL SELECT kort_id, sheet_id FROM "timer"."sheet_machines" WHERE kort_id = ANY($1::text[])
       UNION ALL SELECT kort_id, sheet_id FROM "timer"."sheet_tillegg" WHERE kort_id = ANY($1::text[])
       UNION ALL SELECT kort_id, sheet_id FROM "timer"."sheet_utlegg" WHERE kort_id = ANY($1::text[])
       UNION ALL SELECT kort_id, sheet_id FROM "timer"."sheet_timer_forslag" WHERE kort_id = ANY($1::text[])
     ) x WHERE sheet_id <> $2`,
    unike,
    sheetId,
  );
  return rader.map((r) => r.kort_id);
}

/**
 * Fyll og valider kort-id for hele sedelen (post-tilstand). Returnerer bruddene; med
 * `kast: true` kastes BAD_REQUEST `kortUlikeRader` ved brudd (interaktive veier og syncBatch,
 * der transaksjonen da rulles tilbake).
 */
export type SikreKortIdResultat = {
  brudd: KortInvariantBrudd[];
  /** Radens kort-id etter fylling (timer, maskin, tillegg, utlegg). */
  kortIdFor: Map<string, string | null>;
};

export async function sikreKortId(
  tx: Tx,
  sheetId: string,
  opts: { kast?: boolean; oppgitteKortIder?: readonly string[]; kontekst?: SedelKortKontekst } = {},
): Promise<SikreKortIdResultat> {
  const kontekst = opts.kontekst ?? (await lastSedelKortKontekst(tx, sheetId));
  const nokkelSelect = {
    id: true,
    projectId: true,
    byggeplassId: true,
    externalCostObjectId: true,
    kortId: true,
    createdAt: true,
  } as const;
  const [timer, maskiner, tillegg, utlegg] = await Promise.all([
    tx.sheetTimer.findMany({
      where: { sheetId },
      select: {
        ...nokkelSelect,
        erReise: true,
        reiseRetning: true,
        arbeidReiseRetning: true,
        fraTid: true,
        attestertStatus: true,
      },
    }),
    tx.sheetMachine.findMany({ where: { sheetId }, select: { ...nokkelSelect, sheetTimerId: true } }),
    tx.sheetTillegg.findMany({ where: { sheetId }, select: nokkelSelect }),
    tx.sheetUtlegg.findMany({ where: { sheetId }, select: nokkelSelect }),
  ]);

  type R = {
    tabell: Tabell;
    type: KortInvariantRad["type"];
    id: string;
    kortId: string | null;
    nokkel: KortNokkelFelt;
    opprettet: number;
    sheetTimerId?: string | null;
  };
  const somR = (
    tabell: Tabell,
    type: R["type"],
    r: (typeof timer)[number] | (typeof maskiner)[number] | (typeof tillegg)[number],
  ): R => ({
    tabell,
    type,
    id: r.id,
    kortId: r.kortId,
    nokkel: radNokkel(kontekst, r),
    opprettet: r.createdAt.getTime(),
    sheetTimerId: "sheetTimerId" in r ? r.sheetTimerId : undefined,
  });

  const endringer = new Map<Tabell, Map<string | null, string[]>>();
  const endre = (r: R, kortId: string | null) => {
    if (r.kortId === kortId) return;
    r.kortId = kortId;
    let pr = endringer.get(r.tabell);
    if (!pr) endringer.set(r.tabell, (pr = new Map()));
    const l = pr.get(kortId) ?? [];
    l.push(r.id);
    pr.set(kortId, l);
  };

  // O12 pkt 3/16 (vedtak-timer-web § Reisevinduet): en reise ført som arbeidstid
  // (`arbeidReiseRetning`) som står i et kort, står der som en reise — kortet er
  // stedet, også når underprosjektet er et annet. Den valideres som reise (K1/K2) og
  // er ingen jobb. Uten kort-id følger den arbeidsregelen (regel 3) som før.
  const erKortReiseArbeid = (t: (typeof timer)[number]) => !t.erReise && !!t.arbeidReiseRetning && !!t.kortId;
  const arbeidsreise = timer.filter(erKortReiseArbeid).map((t) => somR("sheet_timer", "timer", t));
  const arbeid = timer.filter((t) => !t.erReise && !erKortReiseArbeid(t)).map((t) => somR("sheet_timer", "timer", t));
  const mask = maskiner.map((m) => somR("sheet_machines", "maskin", m));
  const tl = tillegg.map((t) => somR("sheet_tillegg", "tillegg", t));
  const ut = utlegg.map((u) => somR("sheet_utlegg", "utlegg", u));
  const alle = [...arbeid, ...mask, ...tl, ...ut];

  // K6: koblet maskin følger timerraden når den hører til samme prosjekt (som backfill 2).
  const timerById = new Map(arbeid.map((t) => [t.id, t]));
  const kobletFolger = (m: R) => {
    const t = m.sheetTimerId ? timerById.get(m.sheetTimerId) : undefined;
    return t && t.nokkel.projectId === m.nokkel.projectId ? t : undefined;
  };

  // Regel 3 for rader uten id, eldste rad først (eldste kort vinner).
  const kort = () =>
    kortPaaSedelFraRader(alle.map((r) => ({ kortId: r.kortId, nokkel: kortIdNokkel(r.nokkel), opprettet: r.opprettet })));
  const utenId = [...arbeid, ...tl, ...ut, ...mask.filter((m) => !kobletFolger(m))]
    .filter((r) => !r.kortId)
    .sort((a, b) => a.opprettet - b.opprettet || (a.id < b.id ? -1 : 1));
  for (const r of utenId) {
    endre(
      r,
      losKortId({
        nokkel: kortIdNokkel(r.nokkel),
        kortPaaSedel: kort(),
        utledet: utledKortId({ userId: kontekst.userId, dato: kontekst.dato, nokkel: r.nokkel }),
      }),
    );
  }
  for (const m of mask) {
    const t = kobletFolger(m);
    if (t) endre(m, t.kortId);
  }

  // Reise (§ 4.15 del E; § 8.22 punkt 3, Kenneth 2026-11-21): kortet avgjøres bare av reisens
  // egne felt. Regelen (`velgReiseKort`) kjøres bare for reise UTEN kort-id — når den er ny, og
  // når prosjekt, byggeplass eller underprosjekt er rettet (skriveveiene nuller da id-en via
  // `kortIdForSkriving`). En reise med kort-id flyttes aldri av at andre registreringer føres
  // eller slettes. Den kjøres etter arbeidsradene over, så reise og arbeid i samme skriving
  // havner i samme kort. Ingen jobb på stedet → eget kort (`egetReiseKort`). Regelen endrer bare
  // kort-id, aldri prosjekt, underprosjekt eller byggeplass.
  const jobber = jobberFraArbeidsrader(
    timer
      .filter((t) => !t.erReise && !erKortReiseArbeid(t))
      .map((t) => {
        const a = timerById.get(t.id)!;
        return {
          kortId: a.kortId,
          projectId: a.nokkel.projectId,
          ecoId: a.nokkel.ecoId,
          byggeplassId: a.nokkel.byggeplassId,
          fraTid: t.fraTid,
          opprettet: a.opprettet,
          attestertStatus: t.attestertStatus,
        };
      }),
  );
  const jobbKortIder = jobber.map((j) => j.kortId);
  const reise = timer.filter((t) => t.erReise).map((t) => ({ t, r: somR("sheet_timer", "timer", t) }));
  for (const { t, r } of reise) {
    if (r.kortId) continue;
    // Reise uten prosjekt (ugyldig, FA16; sperret av sheet_timer_uten_prosjekt_chk) røres ikke —
    // samme vakt som w15c-utfyllingen (`project_id IS NOT NULL`).
    if (r.nokkel.projectId === null) continue;
    endre(
      r,
      velgReiseKort(
        {
          projectId: r.nokkel.projectId,
          ecoId: r.nokkel.ecoId,
          byggeplassId: r.nokkel.byggeplassId,
          retning: t.reiseRetning,
          fraTid: t.fraTid,
        },
        jobber,
      ) ?? egetReiseKort({ userId: kontekst.userId, dato: kontekst.dato, nokkel: r.nokkel, jobbKortIder }),
    );
  }

  for (const [tabell, pr] of endringer) for (const [kortId, ider] of pr) await settKortId(tx, tabell, kortId, ider);

  // Koblet maskin som følger raden (K6) valideres på radens nøkkel: dens egen byggeplass/
  // underprosjekt kan avvike i eldre data, og det skal ikke gi en ny avvisning i synken
  // (backfill 2 gjør det samme — kobler på prosjekt alene).
  const brudd = validerKortInvariant([
    ...alle.map((r) => ({
      id: r.id,
      type: r.type,
      kortId: r.kortId,
      sheetId,
      nokkel: (r.type === "maskin" && kobletFolger(r)?.nokkel) || r.nokkel,
      // K6 bare der koblingen følger (samme prosjekt) — ellers eget kort som før.
      sheetTimerId: r.type === "maskin" && kobletFolger(r) ? r.sheetTimerId : undefined,
    })),
    // Reise: bare K1 og K2 (samme sedel og prosjekt som kortet), § 2.3.
    ...reise.map(({ r }) => ({ id: r.id, type: r.type, kortId: r.kortId, sheetId, nokkel: r.nokkel, erReise: true })),
    ...arbeidsreise.map((r) => ({ id: r.id, type: r.type, kortId: r.kortId, sheetId, nokkel: r.nokkel, erReise: true })),
  ]);
  if (opts.oppgitteKortIder?.length) {
    for (const k of await kortIdPaaAnnenSedel(tx, sheetId, opts.oppgitteKortIder))
      brudd.push({ kortId: k, grunn: "kortUlikSedel", radId: "" });
  }
  if (opts.kast && brudd.length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "kortUlikeRader" });
  }
  if (brudd.length === 0) {
    await sikreVareKortId(sheetId, kontekst, {
      timerKort: new Map(arbeid.map((t) => [t.id, { kortId: t.kortId, projectId: t.nokkel.projectId }])),
      kort: kort(),
    });
  }
  const kortIdFor = new Map<string, string | null>([...alle, ...reise.map(({ r }) => r), ...arbeidsreise].map((r) => [r.id, r.kortId]));
  return { brudd, kortIdFor };
}

/**
 * Forhåndsvalidering av en oppgitt kort-id for ÉN ny rad (veier som skriver i en array-
 * transaksjon og derfor ikke kan rulle tilbake etter `sikreKortId`): K1 (id-en står ikke
 * på en annen sedel) og K2–K4 (kortets rader på sedelen har samme nøkkel).
 */
export async function validerOppgittKortId(
  tx: Tx,
  kontekst: SedelKortKontekst,
  kortId: string | null | undefined,
  ny: { projectId: string | null; byggeplassId: string | null; externalCostObjectId: string | null },
): Promise<void> {
  if (!kortId) return;
  if ((await kortIdPaaAnnenSedel(tx, kontekst.sheetId, [kortId])).length > 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "kortUlikeRader" });
  }
  const nyNokkel = kortIdNokkel(radNokkel(kontekst, ny));
  const sel = { projectId: true, byggeplassId: true, externalCostObjectId: true } as const;
  const where = { sheetId: kontekst.sheetId, kortId };
  const iKortet = [
    ...(await tx.sheetTimer.findMany({ where: { ...where, erReise: false }, select: sel })),
    ...(await tx.sheetTillegg.findMany({ where, select: sel })),
    ...(await tx.sheetUtlegg.findMany({ where, select: sel })),
  ];
  if (iKortet.some((r) => kortIdNokkel(radNokkel(kontekst, r)) !== nyNokkel)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "kortUlikeRader" });
  }
}

/**
 * Varer på sedelen (db-varelager, egen database — ingen felles transaksjon): koblet vare
 * følger timerraden (K6, samme prosjekt som backfill 1 i varelager-migreringen), vare uten
 * id får regel 3. Kalles av `sikreKortId`, så en timerrad som flyttes tar varen med.
 */
async function sikreVareKortId(
  sheetId: string,
  kontekst: SedelKortKontekst,
  args: { timerKort: Map<string, { kortId: string | null; projectId: string | null }>; kort: { kortId: string; nokkel: string }[] },
): Promise<void> {
  const varer = await prismaVarelager.vareforbruk.findMany({
    where: { dagsseddelId: sheetId },
    select: { id: true, kortId: true, sheetTimerId: true, projectId: true, byggeplassId: true, externalCostObjectId: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const kort = [...args.kort];
  for (const v of varer) {
    const t = v.sheetTimerId ? args.timerKort.get(v.sheetTimerId) : undefined;
    let mal: string | null = v.kortId;
    if (t && t.projectId === v.projectId && t.kortId) mal = t.kortId;
    else if (!v.kortId) {
      const nokkel = radNokkel(kontekst, v);
      mal = losKortId({
        nokkel: kortIdNokkel(nokkel),
        kortPaaSedel: kort,
        utledet: utledKortId({ userId: kontekst.userId, dato: kontekst.dato, nokkel }),
      });
      if (!kort.some((k) => k.kortId === mal)) kort.push({ kortId: mal, nokkel: kortIdNokkel(nokkel) });
    }
    if (mal !== v.kortId) {
      // Rå SQL: `updated_at` røres ikke.
      await prismaVarelager.$executeRawUnsafe(
        `UPDATE "varelager"."vareforbruk" SET "kort_id" = $1 WHERE "id" = $2`,
        mal,
        v.id,
      );
    }
  }
}

/**
 * Kort-id for en vare som skrives (vareforbruk.opprett/oppdater, § 4.3): uten sedel → `null`;
 * koblet vare → timerradens id; oppgitt id → brukes (valideres mot sedelen: K1 og K2–K4);
 * lagret id med uendret nøkkel → står; ellers `null` (regel 3 fylles av `sikreKortId`).
 */
export async function vareKortIdForSkriving(
  prismaTimer: Tx,
  args: {
    dagsseddelId: string | null;
    sheetTimerId: string | null;
    oppgittKortId?: string | null;
    lagret?: { kortId: string | null; projectId: string; byggeplassId: string | null; externalCostObjectId: string | null } | null;
    ny: { projectId: string; byggeplassId: string | null; externalCostObjectId: string | null };
  },
): Promise<string | null> {
  if (!args.dagsseddelId) return null;
  if (args.sheetTimerId) {
    const t = await prismaTimer.sheetTimer.findUnique({
      where: { id: args.sheetTimerId },
      select: { kortId: true, projectId: true, sheetId: true },
    });
    if (t && t.sheetId === args.dagsseddelId && t.projectId === args.ny.projectId && t.kortId) return t.kortId;
  }
  const kontekst = await lastSedelKortKontekst(prismaTimer, args.dagsseddelId);
  if (args.oppgittKortId) {
    if ((await kortIdPaaAnnenSedel(prismaTimer, args.dagsseddelId, [args.oppgittKortId])).length > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "kortUlikeRader" });
    }
    const nyNokkel = kortIdNokkel(radNokkel(kontekst, args.ny));
    const radIKortet = await prismaTimer.sheetTimer.findFirst({
      // Reiseraden i kortet kan ha et annet underprosjekt (B34 B) — bare arbeidsrader avgjør.
      where: { sheetId: args.dagsseddelId, kortId: args.oppgittKortId, erReise: false },
      select: { projectId: true, byggeplassId: true, externalCostObjectId: true },
    });
    if (radIKortet && kortIdNokkel(radNokkel(kontekst, radIKortet)) !== nyNokkel) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "kortUlikeRader" });
    }
    return args.oppgittKortId;
  }
  return kortIdForSkriving(kontekst, { lagret: args.lagret ?? null, ny: args.ny });
}
