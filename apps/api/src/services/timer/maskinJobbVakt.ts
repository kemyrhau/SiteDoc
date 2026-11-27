import type { TRPCError } from "@trpc/server";
import type { Prisma, PrismaClient as PrismaClientTimer } from "@sitedoc/db-timer";
import { prisma } from "@sitedoc/db";
import {
  beregnJobbMaskinBrudd,
  nyeEllerOkteBrudd,
  type JobbArbeidRad,
  type JobbMaskinRad,
  type MaskinJobbBrudd,
  maskinKreverTimerad,
  erGyldigTimeradKobling,
  velgTimeradForMaskin,
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
export function tallNb(n: number): string {
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

// ============================================================================
//  w9-tillegget (R24, orkestrator 2026-11-19): maskinen kobles til jobbens
//  timerad automatisk. Kalles i transaksjonen etter skrivingen og `sikreKortId`,
//  så nye timerader og ny kort-id er med. Gjelder maskinradene kalleren gir
//  (nye, endrede, eller som mistet koblingen sin): krever maskinen fører og står
//  uten gyldig kobling, settes `sheetTimerId` til raden `velgTimeradForMaskin`
//  velger i samme jobb. Har jobben ikke arbeid, avvises skrivingen. Gir
//  tilbake de nye koblingene (maskin-id → timerad-id).
// ============================================================================

export async function koblMaskinerTilJobb(
  tx: MaskinJobbTx,
  prismaMaskin: MaskinKlientForVakt,
  sheetId: string,
  maskinIder: readonly string[],
): Promise<Map<string, string>> {
  const koblet = new Map<string, string>();
  if (maskinIder.length === 0) return koblet;
  const maskiner = await tx.sheetMachine.findMany({
    where: { id: { in: [...maskinIder] }, sheetId },
    select: { id: true, sheetId: true, kortId: true, sheetTimerId: true, vehicleId: true, fraTid: true, tilTid: true },
  });
  if (maskiner.length === 0) return koblet;
  const utstyr = await hentUtstyrOppslag(prismaMaskin, maskiner.map((m) => m.vehicleId));
  const somKrever = maskiner.filter((m) => maskinKreverTimerad(utstyr.utleieEnhet.get(m.vehicleId) ?? null));
  if (somKrever.length === 0) return koblet;
  const timer = (
    await tx.sheetTimer.findMany({
      where: { sheetId },
      orderBy: [{ fraTid: "asc" }, { createdAt: "asc" }],
      select: { id: true, sheetId: true, kortId: true, projectId: true, timer: true, erReise: true, attestertStatus: true, fraTid: true, tilTid: true },
    })
  ).map((t) => ({ ...t, timer: Number(t.timer) }));
  for (const m of somKrever) {
    if (erGyldigTimeradKobling(m, timer)) continue;
    const valgt = velgTimeradForMaskin(m, timer);
    if (!valgt) {
      const navn = utstyr.navn.get(m.vehicleId) ?? m.vehicleId;
      throw nokkelFeil(
        "BAD_REQUEST",
        `Maskinen «${navn}» kan bare føres der det er ført arbeidstimer på samme prosjekt. Før arbeidstimene først, eller fjern maskinen.`,
        "timer.maskin.utenArbeidAvvist",
        { maskin: navn },
      );
    }
    await tx.sheetMachine.update({ where: { id: m.id }, data: { sheetTimerId: valgt } });
    koblet.set(m.id, valgt);
  }
  return koblet;
}

// ============================================================================
//  A7-vakt (Kenneth 2026-11-27: «La den følge»): når timeradens underprosjekt eller
//  byggeplass endres, følger en førermaskin i samme kort som står uten gyldig
//  kobling, timeraden — den kobles til raden og får radens sted. Hvilken timerad
//  maskinen hører til, avgjør `velgTimeradForMaskin` blant kortets rader FØR
//  endringen (størst overlapp, ellers flest timer). Den følger bare når det er
//  den endrede raden. Døgnmaskin, attestert og erstattet står.
//  Kalles i transaksjonen før timeraden skrives. Gir tilbake maskinene som ble koblet.
// ============================================================================

export async function koblUkobledeForerMaskinerTilRad(
  tx: MaskinJobbTx,
  prismaMaskin: MaskinKlientForVakt,
  rad: { id: string; sheetId: string; kortId: string | null; projectId: string | null },
): Promise<string[]> {
  if (!rad.kortId || !rad.projectId) return [];
  const maskiner = await tx.sheetMachine.findMany({
    where: {
      sheetId: rad.sheetId,
      kortId: rad.kortId,
      projectId: rad.projectId,
      OR: [{ attestertStatus: null }, { attestertStatus: { notIn: ["attestert", "erstattet"] } }],
    },
    select: { id: true, sheetId: true, kortId: true, sheetTimerId: true, vehicleId: true, fraTid: true, tilTid: true },
  });
  if (maskiner.length === 0) return [];
  const timer = (
    await tx.sheetTimer.findMany({
      where: { sheetId: rad.sheetId },
      orderBy: [{ fraTid: "asc" }, { createdAt: "asc" }],
      select: { id: true, sheetId: true, kortId: true, projectId: true, timer: true, erReise: true, attestertStatus: true, fraTid: true, tilTid: true },
    })
  ).map((t) => ({ ...t, timer: Number(t.timer) }));
  const ukoblede = maskiner.filter((m) => !erGyldigTimeradKobling(m, timer));
  if (ukoblede.length === 0) return [];
  const utstyr = await hentUtstyrOppslag(prismaMaskin, ukoblede.map((m) => m.vehicleId));
  const folger = ukoblede.filter(
    (m) => maskinKreverTimerad(utstyr.utleieEnhet.get(m.vehicleId) ?? null) && velgTimeradForMaskin(m, timer) === rad.id,
  );
  if (folger.length === 0) return [];
  const ider = folger.map((m) => m.id);
  await tx.sheetMachine.updateMany({ where: { id: { in: ider } }, data: { sheetTimerId: rad.id } });
  return ider;
}
