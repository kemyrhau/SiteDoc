import type { Prisma, PrismaClient as PrismaClientTimer } from "@sitedoc/db-timer";

/**
 * Runde 7 (Kenneth 2026-11-27: «Ja, arv timeraden»; vedtak-timer-web.md pkt 7): maskin og
 * vare som er koblet til en timerad, har alltid timeradens underprosjekt — i begge moduser.
 * Serveren utleder (ikke avviser): et annet underprosjekt i input lagres som timeradens, så
 * eldre klienter og telefonens kø aldri mister en registrering. Ukoblet maskin (døgn uten
 * timerad) og ukoblet vare beholder eget valg. Attestert og erstattet står (S5).
 */

type EcoTx = Prisma.TransactionClient | PrismaClientTimer;

/** Timeradens underprosjekt; `undefined` når raden ikke finnes (ingen arv). */
export async function ecoForTimerad(
  prismaTimer: Pick<EcoTx, "sheetTimer">,
  sheetTimerId: string | null | undefined,
): Promise<string | null | undefined> {
  if (!sheetTimerId) return undefined;
  const t = await prismaTimer.sheetTimer.findUnique({
    where: { id: sheetTimerId },
    select: { externalCostObjectId: true },
  });
  return t ? (t.externalCostObjectId ?? null) : undefined;
}

/**
 * Gir de oppgitte maskinene timeradens underprosjekt når de er koblet og har et annet.
 * Kalles i transaksjonen etter at koblingen er avgjort (også `koblMaskinerTilJobb`).
 * Kort-id endres ikke: koblet maskin står alt i timeradens kort (K6).
 * Returnerer maskin-id → underprosjektet den fikk.
 */
export async function arvTimeradEcoForMaskiner(
  tx: EcoTx,
  maskinIder: readonly string[],
): Promise<Map<string, string | null>> {
  const arvet = new Map<string, string | null>();
  if (maskinIder.length === 0) return arvet;
  const maskiner = (
    await tx.sheetMachine.findMany({
      where: { id: { in: [...maskinIder] } },
      select: { id: true, sheetTimerId: true, externalCostObjectId: true, attestertStatus: true },
    })
  ).filter((m) => m.sheetTimerId && m.attestertStatus !== "attestert" && m.attestertStatus !== "erstattet");
  if (maskiner.length === 0) return arvet;
  const timer = await tx.sheetTimer.findMany({
    where: { id: { in: [...new Set(maskiner.map((m) => m.sheetTimerId!))] } },
    select: { id: true, externalCostObjectId: true },
  });
  const ecoPerRad = new Map(timer.map((t) => [t.id, t.externalCostObjectId ?? null]));
  for (const m of maskiner) {
    if (!ecoPerRad.has(m.sheetTimerId!)) continue;
    const eco = ecoPerRad.get(m.sheetTimerId!) ?? null;
    if ((m.externalCostObjectId ?? null) === eco) continue;
    await tx.sheetMachine.update({ where: { id: m.id }, data: { externalCostObjectId: eco } });
    arvet.set(m.id, eco);
  }
  return arvet;
}

/**
 * Runde 7 (C, Kenneth: «Del opp maskin» deler bare timer): maskindelene står på originalens
 * timerad (ordre d2a) og får timeradens underprosjekt når delen er i timeradens prosjekt.
 * Underprosjekt i input for en slik del overskrives. Ukoblet original: delene som de er.
 */
export async function arvTimeradEcoForDeler<D extends { projectId: string; externalCostObjectId?: string | null }>(
  prismaTimer: Pick<EcoTx, "sheetTimer">,
  original: object,
  deler: readonly D[],
): Promise<D[]> {
  const sheetTimerId = (original as { sheetTimerId?: string | null }).sheetTimerId ?? null;
  if (!sheetTimerId) return [...deler];
  const t = await prismaTimer.sheetTimer.findUnique({
    where: { id: sheetTimerId },
    select: { projectId: true, externalCostObjectId: true },
  });
  if (!t) return [...deler];
  return deler.map((d) =>
    d.projectId === t.projectId ? { ...d, externalCostObjectId: t.externalCostObjectId ?? null } : d,
  );
}
