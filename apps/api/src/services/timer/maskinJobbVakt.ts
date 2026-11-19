import type { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient as PrismaClientTimer } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import {
  beregnJobbMaskinBrudd,
  nyeEllerOkteBrudd,
  type JobbArbeidRad,
  type JobbMaskinRad,
  type MaskinJobbBrudd,
} from "@sitedoc/shared";
import { nokkelFeil } from "../../trpc/feilformat";
import { hentUtstyrOppslag } from "./kortLeser";

/**
 * Enhetstestene mocker DB-delen av denne fila (test-harness/kortIdEnhetsmock.ts) — den
 * testes mot ekte Postgres i `routes/maskin-over-arbeid.integration.test.ts`.
 */

// ============================================================================
//  w9 (plan § 4.4, B21 A / B22 A / B23 B, Kenneth 2026-11-19) — maskintimer
//  høyst jobbens arbeidstimer.
//
//  Erstatter T7-4b-vakten (`validerMaskinUnderArbeid`, bøtte + pause, kjørt på
//  en bygd etter-tilstand FØR skrivingen). Nå: les tilstanden i transaksjonen
//  før skrivingen, skriv (inkl. `sikreKortId`), les tilstanden igjen og avvis
//  bare brudd skrivingen lager eller øker (`nyeEllerOkteBrudd`). Avvisningen
//  kaster i transaksjonen, så alt rulles tilbake. En jobb skrivingen ikke
//  rører, er lik før og etter — et gammelt brudd stopper ikke lenger føring
//  i andre jobber (B23 B: det står med merket i attesteringen).
//
//  Regelen bor i @sitedoc/shared (`beregnJobbMaskinBrudd`): pr. kort, arbeid
//  uten reise og uten pause, bare maskiner som krever fører. Eldre rader uten
//  kort beholder bøtteregelen med pausen, uten døgn-maskiner.
// ============================================================================

type MaskinJobbTx = Prisma.TransactionClient | PrismaClientTimer;
type MaskinKlientForVakt = Parameters<typeof hentUtstyrOppslag>[0];

/** Sedelens timer- og maskinrader slik jobb-regelen leser dem (erstattede rader er ute). */
export type MaskinJobbTilstand = {
  timer: JobbArbeidRad[];
  maskin: JobbMaskinRad[];
  pauseMin: number;
};

export async function lesMaskinJobbTilstand(
  tx: MaskinJobbTx,
  prismaMaskin: MaskinKlientForVakt,
  sheetId: string,
): Promise<MaskinJobbTilstand> {
  const [sedel, timer, maskin] = await Promise.all([
    tx.dailySheet.findUnique({ where: { id: sheetId }, select: { pauseMin: true } }),
    tx.sheetTimer.findMany({
      where: { sheetId, attestertStatus: { not: "erstattet" } },
      select: {
        kortId: true,
        projectId: true,
        externalCostObjectId: true,
        timer: true,
        erReise: true,
        attestertStatus: true,
      },
    }),
    tx.sheetMachine.findMany({
      where: { sheetId, attestertStatus: { not: "erstattet" } },
      select: {
        id: true,
        kortId: true,
        projectId: true,
        externalCostObjectId: true,
        timer: true,
        vehicleId: true,
      },
    }),
  ]);
  const utstyr = await hentUtstyrOppslag(prismaMaskin, maskin.map((m) => m.vehicleId));
  return {
    pauseMin: sedel?.pauseMin ?? 0,
    timer: timer.map((t) => ({ ...t, timer: Number(t.timer) })),
    maskin: maskin.map((m) => ({
      id: m.id,
      kortId: m.kortId,
      projectId: m.projectId,
      externalCostObjectId: m.externalCostObjectId,
      timer: Number(m.timer),
      utleieEnhet: utstyr.utleieEnhet.get(m.vehicleId) ?? null,
    })),
  };
}

const bruddAv = (t: MaskinJobbTilstand) => beregnJobbMaskinBrudd(t.timer, t.maskin, t.pauseMin);

/**
 * Kalles SIST i transaksjonen, etter skrivingen og `sikreKortId`. Kaster ved
 * nytt eller økt brudd; transaksjonen rulles da tilbake.
 */
export async function krevIngenNyeMaskinBrudd(
  tx: MaskinJobbTx,
  prismaMaskin: MaskinKlientForVakt,
  sheetId: string,
  foer: MaskinJobbTilstand,
): Promise<void> {
  const etter = await lesMaskinJobbTilstand(tx, prismaMaskin, sheetId);
  const nye = nyeEllerOkteBrudd(bruddAv(foer), bruddAv(etter));
  if (nye.length > 0) throw await maskinOverArbeidFeil(nye);
}

/** Tall som nb-tekst: 7.5 → «7,5», 4 → «4». */
function tallNb(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace(".", ",");
}

/** Jobbens navn i feilteksten: underprosjektet (f.eks. «END-002»), ellers prosjektet. */
async function jobbNavnForBrudd(brudd: readonly MaskinJobbBrudd[]): Promise<Map<string, string>> {
  const pIder = [...new Set(brudd.flatMap((b) => (b.projectId ? [b.projectId] : [])))];
  const eIder = [...new Set(brudd.flatMap((b) => (b.externalCostObjectId ? [b.externalCostObjectId] : [])))];
  const [prosjekter, ecoer] = await Promise.all([
    pIder.length > 0
      ? prisma.project.findMany({ where: { id: { in: pIder } }, select: { id: true, name: true, projectNumber: true } })
      : Promise.resolve([]),
    eIder.length > 0
      ? prisma.externalCostObject.findMany({ where: { id: { in: eIder } }, select: { id: true, proAdmId: true } })
      : Promise.resolve([]),
  ]);
  const pMap = new Map(prosjekter.map((p) => [p.id, `${p.projectNumber ?? ""} ${p.name}`.trim()] as const));
  const eMap = new Map(ecoer.map((e) => [e.id, e.proAdmId] as const));
  return new Map(
    brudd.map((b) => [
      b.nokkel,
      (b.externalCostObjectId && eMap.get(b.externalCostObjectId)) ||
        (b.projectId && pMap.get(b.projectId)) ||
        b.projectId ||
        "",
    ]),
  );
}

/** Feilen ved avvisning: nb-tekst i `message`, nøkkel `timer.maskin.overArbeidAvvist` (S1). */
async function maskinOverArbeidFeil(brudd: readonly MaskinJobbBrudd[]): Promise<TRPCError> {
  const navn = await jobbNavnForBrudd(brudd);
  const forste = brudd[0]!;
  const param = {
    jobb: navn.get(forste.nokkel) ?? "",
    maskin: tallNb(forste.maskinSum),
    arbeid: tallNb(forste.arbeidSum),
  };
  const linje = (b: MaskinJobbBrudd) =>
    `${navn.get(b.nokkel) ?? ""}: maskin ${tallNb(b.maskinSum)} t, arbeid ${tallNb(b.arbeidSum)} t.`;
  const message = `${brudd.map(linje).join(" ")} En maskin med fører kan ikke ha flere timer enn arbeidet på jobben. Rett maskintimene, eller flytt hele jobben.`;
  return nokkelFeil("BAD_REQUEST", message, "timer.maskin.overArbeidAvvist", param);
}
