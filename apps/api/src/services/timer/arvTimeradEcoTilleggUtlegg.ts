import type { Prisma, PrismaClient as PrismaClientTimer } from "@sitedoc/db-timer";

/**
 * Retur 1 runde 6 (Kenneth 2026-11-27: «Ja, arv timeraden»): tillegg og utlegg som er koblet
 * til en timerad (bare dagskort — prosjektkort lagrer aldri kobling), har alltid timeradens
 * underprosjekt. Serveren utleder (ikke avviser): et annet underprosjekt i input lagres som
 * timeradens. Ukoblede rader (eldre data, prosjektkort) beholder eget valg. Attestert og
 * erstattet tillegg står (S5). Samme mønster som runde 7 for maskin og vare
 * (`arvTimeradEco.ts` på `fix/timer-r7`); slås sammen etter begge merger.
 */

type EcoTx = Prisma.TransactionClient | PrismaClientTimer;

/** Timeradens underprosjekt; `undefined` når raden ikke finnes eller ikke er oppgitt (ingen arv). */
export async function ecoForTimeradTilleggUtlegg(
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
 * Gir alle koblede tillegg og utlegg på sedelen timeradens underprosjekt der det avviker.
 * Kalles i transaksjonen etter skrivingen og FØR `sikreKortId`: kort-id nulles på radene
 * som endres, så regel 3 legger dem i kortet som passer det nye underprosjektet.
 * Returnerer antall rader som ble endret.
 */
export async function arvTimeradEcoForTilleggUtlegg(tx: EcoTx, sheetId: string): Promise<number> {
  const koblet = { sheetId, sheetTimerId: { not: null } };
  const [tillegg, utlegg] = await Promise.all([
    tx.sheetTillegg.findMany({
      where: koblet,
      select: { id: true, sheetTimerId: true, externalCostObjectId: true, attestertStatus: true },
    }),
    tx.sheetUtlegg.findMany({ where: koblet, select: { id: true, sheetTimerId: true, externalCostObjectId: true } }),
  ]);
  const aapneTillegg = tillegg.filter((r) => r.attestertStatus !== "attestert" && r.attestertStatus !== "erstattet");
  if (aapneTillegg.length === 0 && utlegg.length === 0) return 0;
  const timer = await tx.sheetTimer.findMany({
    where: { id: { in: [...new Set([...aapneTillegg, ...utlegg].map((r) => r.sheetTimerId!))] } },
    select: { id: true, externalCostObjectId: true },
  });
  const ecoPerRad = new Map(timer.map((t) => [t.id, t.externalCostObjectId ?? null]));
  const avvik = (r: { sheetTimerId: string | null; externalCostObjectId: string | null }) =>
    ecoPerRad.has(r.sheetTimerId!) && (r.externalCostObjectId ?? null) !== ecoPerRad.get(r.sheetTimerId!);
  let endret = 0;
  for (const r of aapneTillegg.filter(avvik)) {
    await tx.sheetTillegg.update({
      where: { id: r.id },
      data: { externalCostObjectId: ecoPerRad.get(r.sheetTimerId!) ?? null, kortId: null },
    });
    endret++;
  }
  for (const r of utlegg.filter(avvik)) {
    await tx.sheetUtlegg.update({
      where: { id: r.id },
      data: { externalCostObjectId: ecoPerRad.get(r.sheetTimerId!) ?? null, kortId: null },
    });
    endret++;
  }
  return endret;
}
