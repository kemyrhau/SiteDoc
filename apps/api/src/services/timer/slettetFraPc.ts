import type { Prisma } from "@sitedoc/db-timer";

/**
 * O27 SLETTET-ER-SLETTET (Kenneth 2026-11-26): «Når en timerad slettes -> da må den slettes
 * helt». Sporet (`timer.slettet_fra_pc`) for en sedel eller rad som er slettet på PC, så
 * telefonens synk aldri lager den på nytt (`syncBatch`) og telefonen fjerner sin kopi (pull).
 *
 * Skrives i samme transaksjon som slettingen og FØR den (sedelen må finnes for eier/dato).
 * `skipDuplicates`: samme id slettet to ganger gir én post.
 */
export type SlettetFraPcType = "sedel" | "timer" | "tillegg" | "maskin" | "utlegg";

type Tx = Pick<Prisma.TransactionClient, "slettetFraPc" | "dailySheet">;

/** Rader slettet på PC fra én sedel. Tom liste → ingen skriving. */
export async function skrivRaderSlettetFraPc(
  tx: Tx,
  sheetId: string,
  rader: readonly { id: string; type: Exclude<SlettetFraPcType, "sedel"> }[],
  slettetAvUserId: string,
): Promise<void> {
  if (rader.length === 0) return;
  const sedel = await tx.dailySheet.findUniqueOrThrow({
    where: { id: sheetId },
    select: { userId: true, organizationId: true, dato: true },
  });
  await tx.slettetFraPc.createMany({
    data: rader.map((r) => ({ ...r, sheetId, ...sedel, slettetAvUserId })),
    skipDuplicates: true,
  });
}

/**
 * Sedelen slettet på PC. Sporets id = sedelens `clientUuid` (det `syncBatch` slår opp på).
 * Radene trenger ikke eget spor: hele sedelen er sperret.
 */
export async function skrivSedelSlettetFraPc(
  tx: Tx,
  sheetId: string,
  slettetAvUserId: string,
): Promise<void> {
  const sedel = await tx.dailySheet.findUniqueOrThrow({
    where: { id: sheetId },
    select: { clientUuid: true, userId: true, organizationId: true, dato: true },
  });
  const { clientUuid, ...eier } = sedel;
  await tx.slettetFraPc.createMany({
    data: [{ id: clientUuid, type: "sedel", sheetId, ...eier, slettetAvUserId }],
    skipDuplicates: true,
  });
}

/** Hvilke av id-ene har spor? Én spørring for hele batchen. */
export async function lesSlettetFraPc(
  db: Pick<Prisma.TransactionClient, "slettetFraPc">,
  ider: readonly string[],
): Promise<Set<string>> {
  if (ider.length === 0) return new Set();
  const funn = await db.slettetFraPc.findMany({
    where: { id: { in: [...new Set(ider)] } },
    select: { id: true },
  });
  return new Set(funn.map((f) => f.id));
}
