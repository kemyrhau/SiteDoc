import { Prisma } from "@sitedoc/db-timer";
import { HISTORIKK_HENDELSE_SLETTET } from "./kortLeser";

/**
 * Radtypene i `sheet_rad_historikk.rad_type` (tekst uten sjekkregel, plan § 4.18 SV4).
 * `utlegg` og `vare` kom med SL1 (S2 ja); D2f bruker de samme for retting.
 */
export type HistorikkRadType = "timer" | "tillegg" | "maskin" | "utlegg" | "vare";

/** Det en historikkpost trenger av raden. Utlegg og vare har ingen `parentRadId` → null. */
export type HistorikkRad = { id: string; sheetId: string; parentRadId?: string | null };

/** Én post i `sheet_rad_historikk`: hele raden i `snapshot` (Decimal → streng, Date → ISO). */
export function byggHistorikkPost(
  radType: HistorikkRadType,
  rad: HistorikkRad,
  erstattetAvUserId: string | null | undefined,
  erstattetVed: Date,
): Prisma.SheetRadHistorikkCreateManyInput {
  return {
    radType,
    originalRadId: rad.id,
    sheetId: rad.sheetId,
    parentRadId: rad.parentRadId ?? null,
    snapshot: JSON.parse(JSON.stringify(rad)) as Prisma.InputJsonValue,
    erstattetAvUserId,
    erstattetVed,
  };
}

/**
 * R1 b3 / SL1 (plan § 4.18): en slettet rad til `sheet_rad_historikk` med markøren
 * `hendelse: "slettet"` i `snapshot`. Sletting er fortsatt lov; leder får sporet.
 */
export function byggSlettePost(
  radType: HistorikkRadType,
  rad: HistorikkRad,
  userId: string,
  ved: Date,
): Prisma.SheetRadHistorikkCreateManyInput {
  const post = byggHistorikkPost(radType, rad, userId, ved);
  return { ...post, snapshot: { ...(post.snapshot as Prisma.JsonObject), hendelse: HISTORIKK_HENDELSE_SLETTET } };
}

/**
 * SL1: skriver slettesporet for radene i én `createMany`. Kalles i samme transaksjon som
 * slettingen og FØR den, så raden og sporet står eller faller sammen. Tom liste → ingen skriving.
 */
export async function skrivSlettespor(
  tx: Pick<Prisma.TransactionClient, "sheetRadHistorikk">,
  rader: readonly { radType: HistorikkRadType; rad: HistorikkRad }[],
  userId: string,
  ved: Date = new Date(),
): Promise<void> {
  if (rader.length === 0) return;
  await tx.sheetRadHistorikk.createMany({
    data: rader.map(({ radType, rad }) => byggSlettePost(radType, rad, userId, ved)),
  });
}

/** Kolonnene i `varelager.vareforbruk` med navnene Prisma-klienten gir, pluss varens navn og enhet. */
export type VareSnapshot = {
  id: string;
  sheetId: string;
  dato: Date;
  projectId: string;
  byggeplassId: string | null;
  externalCostObjectId: string | null;
  vareId: string;
  antall: Prisma.Decimal | string | number;
  registrertAvUserId: string;
  kommentar: string | null;
  sheetTimerId: string | null;
  kortId: string | null;
  createdAt: Date;
  updatedAt: Date;
  varenavn: string | null;
  enhet: string | null;
};

/**
 * SL1 (S2 ja): varelinjene slik sporet lagrer dem, lest med rå SQL på timer-transaksjonen
 * (`varelager` er et annet skjema i samme database, som `slettKortMedAlt`). Varens navn og
 * enhet tas med, så linja kan vises uten raden. `sheetId` = `dagsseddel_id`.
 */
export async function lesVarerForSpor(
  tx: Pick<Prisma.TransactionClient, "$queryRaw">,
  ider: readonly string[],
): Promise<VareSnapshot[]> {
  if (ider.length === 0) return [];
  return tx.$queryRaw<VareSnapshot[]>`
    SELECT f."id", f."dagsseddel_id" AS "sheetId", f."dato", f."project_id" AS "projectId",
           f."byggeplass_id" AS "byggeplassId", f."external_cost_object_id" AS "externalCostObjectId",
           f."vare_id" AS "vareId", f."antall", f."registrert_av_user_id" AS "registrertAvUserId",
           f."kommentar", f."sheet_timer_id" AS "sheetTimerId", f."kort_id" AS "kortId",
           f."created_at" AS "createdAt", f."updated_at" AS "updatedAt",
           v."navn" AS "varenavn", v."enhet"
      FROM "varelager"."vareforbruk" f
      LEFT JOIN "varelager"."varer" v ON v."id" = f."vare_id"
     WHERE f."id" IN (${Prisma.join(ider as string[])}) AND f."dagsseddel_id" IS NOT NULL`;
}
