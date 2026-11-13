import { TRPCError } from "@trpc/server";
import { prisma } from "@sitedoc/db";

const FEIL_UTENFOR_PROSJEKT = "Byggeplassen hører ikke til radens prosjekt";

/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 *
 * `SheetTimer.byggeplassId` og `SheetMachine.byggeplassId` er svake referanser
 * (ingen @relation på tvers av databasene), så prosjekt-grensen MÅ håndheves her:
 * en rad på prosjekt A kan ikke peke på en byggeplass under prosjekt B. `null`/
 * utelatt er gyldig (A.30: byggeplass-NULL er en lovlig tilstand).
 *
 * Gjelder de interaktive rad-mutasjonene (tilfoyTimerRad, oppdaterTimerRad,
 * maskin.tilfoy, maskin.oppdater) og — ordre (12) — forsonDagskort og
 * redigerSedelRader (via `krevByggeplasserIProsjekt`). Mobil-synk (syncBatch)
 * avviser ikke, men vasker med `lagByggeplassVasker`.
 */
export async function krevByggeplassIProsjekt(
  byggeplassId: string | null | undefined,
  projectId: string,
): Promise<void> {
  if (!byggeplassId) return;
  const funnet = await prisma.byggeplass.findFirst({
    where: { id: byggeplassId, projectId },
    select: { id: true },
  });
  if (!funnet) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: FEIL_UTENFOR_PROSJEKT,
    });
  }
}

type ByggeplassVasker = (
  byggeplassId: string | null | undefined,
  projectId: string | null | undefined,
) => string | null;

/**
 * Ordre (12): slår opp alle byggeplassene i ÉN spørring og gir en vasker som
 * returnerer byggeplassen hvis den hører til prosjektet, ellers `null`.
 * syncBatch bruker den direkte: en avvist rad ville stoppet mobilens offline-kø
 * for alltid, så raden lagres med byggeplass `null` (prosjektet beholdes).
 */
export async function lagByggeplassVasker(
  byggeplassIder: (string | null | undefined)[],
): Promise<ByggeplassVasker> {
  const ider = Array.from(new Set(byggeplassIder.filter((b): b is string => !!b)));
  if (ider.length === 0) return () => null;
  const treff = await prisma.byggeplass.findMany({
    where: { id: { in: ider } },
    select: { id: true, projectId: true },
  });
  const prosjektFor = new Map(treff.map((b) => [b.id, b.projectId]));
  return (byggeplassId, projectId) =>
    byggeplassId && projectId && prosjektFor.get(byggeplassId) === projectId
      ? byggeplassId
      : null;
}

/**
 * Ordre (12): `krevByggeplassIProsjekt` for mange rader i én spørring —
 * forsonDagskort og redigerSedelRader avviser med samme feil som ordre (10).
 */
export async function krevByggeplasserIProsjekt(
  rader: { byggeplassId?: string | null; projectId: string }[],
): Promise<void> {
  const vask = await lagByggeplassVasker(rader.map((r) => r.byggeplassId));
  if (rader.some((r) => r.byggeplassId && vask(r.byggeplassId, r.projectId) === null)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: FEIL_UTENFOR_PROSJEKT,
    });
  }
}

/**
 * ORDRE 36b: hvilken byggeplass en maskin-rad lagres med i syncBatch.
 * Samme regel som timer-radene: `null`/utelatt = arver sedelhodets
 * byggeplass (mobil lagrer null når raden står på sedelens byggeplass, og
 * eldre klienter sender ikke feltet). En egen verdi gjelder, vasket mot
 * maskin-radens prosjekt — en fremmed byggeplass blir null.
 * `vask` er bundet til maskin-radens prosjekt; oppslaget går alltid på projectId.
 */
export function maskinByggeplassVedSync(
  m: { byggeplassId?: string | null },
  sedelByggeplass: string | null | undefined,
  vask: (byggeplassId: string | null | undefined) => string | null,
): string | null {
  return vask(m.byggeplassId ?? sedelByggeplass);
}

const FEIL_ECO_UTENFOR_PROSJEKT = "Underprosjektet hører ikke til radens prosjekt";

type EcoVasker = (
  externalCostObjectId: string | null | undefined,
  projectId: string | null | undefined,
) => string | null;

/**
 * Tillegg/utlegg på prosjektkortet (spec tillegg-utlegg-prosjektkort § 2.2):
 * underprosjektet (ExternalCostObject, svak FK i kjernen) må høre til radens
 * prosjekt og firmaet, og ikke være slettet. Én spørring for alle rader; vaskeren
 * gir id-en tilbake bare for riktig prosjekt, ellers `null`. Status (aktiv/åpen)
 * sjekkes IKKE her — det er attestantens flytt-sjekk (flyttTimerRadEco); en rad
 * ført mens underprosjektet var åpent skal kunne synkes etter at det stenges.
 */
export async function lagEcoVasker(
  ecoIder: (string | null | undefined)[],
  organizationId: string,
): Promise<EcoVasker> {
  const ider = Array.from(new Set(ecoIder.filter((e): e is string => !!e)));
  if (ider.length === 0) return () => null;
  const treff = await prisma.externalCostObject.findMany({
    where: { id: { in: ider }, organizationId, slettetVed: null },
    select: { id: true, projectId: true },
  });
  const prosjektFor = new Map(treff.map((e) => [e.id, e.projectId]));
  return (ecoId, projectId) =>
    ecoId && projectId && prosjektFor.get(ecoId) === projectId ? ecoId : null;
}

/** Interaktive skriveveier: avvis underprosjekt fra annet prosjekt/firma. */
export async function krevEcoerIProsjekt(
  rader: { externalCostObjectId?: string | null; projectId: string }[],
  organizationId: string,
): Promise<void> {
  const vask = await lagEcoVasker(
    rader.map((r) => r.externalCostObjectId),
    organizationId,
  );
  if (
    rader.some(
      (r) => r.externalCostObjectId && vask(r.externalCostObjectId, r.projectId) === null,
    )
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: FEIL_ECO_UTENFOR_PROSJEKT });
  }
}

/**
 * syncBatch for tillegg/utlegg: kortfeltene vaskes mot radens prosjekt.
 * Utelatt/null = NULL = arver sedelens byggeplass (A.30) — IKKE sedelens verdi
 * skrevet inn som maskin gjør (`maskinByggeplassVedSync`): eldre klienter sender
 * ikke feltene, og raden skal da bety nøyaktig det den betydde før. Fremmed → null.
 */
export function kortFeltVedSync(
  r: { byggeplassId?: string | null; externalCostObjectId?: string | null },
  projectId: string,
  vaskByggeplass: (byggeplassId: string | null | undefined, projectId: string) => string | null,
  vaskEco: (ecoId: string | null | undefined, projectId: string) => string | null,
): { byggeplassId: string | null; externalCostObjectId: string | null } {
  return {
    byggeplassId: vaskByggeplass(r.byggeplassId, projectId),
    externalCostObjectId: vaskEco(r.externalCostObjectId, projectId),
  };
}
