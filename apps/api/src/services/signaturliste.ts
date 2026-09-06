import type { Prisma, PrismaClient } from "@sitedoc/db";
import type { SignaturListeData } from "@sitedoc/pdf";
import { beregnSignaturStatus } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";

/**
 * Skal en innholdsendring bumpe dokumentets `innholdsVersjon`? Ja KUN når det
 * finnes en ÅPEN signaturrunde med minst én avgitt signatur (SJA varig arbeid,
 * fabel 2026-09-06). Da har noen signert på et innhold som nå endres, og deres
 * signatur skal vises «signert før endring».
 *
 * Bumper IKKE ved endring før første signatur (ingen har lest noe annet), og
 * kalleren gater allerede på at det FINNES en reell innholdsendring (≥1
 * endringslogg-innslag — tilbehør som kommentar/vedlegg gir ingen). Signatur-/
 * deltaker-aktivitet går aldri via `oppdaterData`, så den treffer aldri her.
 */
export async function harÅpenRundeMedSignatur(
  tx: Prisma.TransactionClient,
  ref: { checklistId: string } | { taskId: string },
): Promise<boolean> {
  const gjeldende = await tx.signaturRunde.findFirst({
    where: ref,
    orderBy: { rundeNr: "desc" },
    select: { avsluttetAt: true, _count: { select: { signaturer: true } } },
  });
  return !!gjeldende && gjeldende.avsluttetAt === null && gjeldende._count.signaturer > 0;
}

/**
 * Serverlås: avvis verdiskriving når dokumentets GJELDENDE (siste) SignaturRunde
 * er avsluttet. En SJA-lås er hele det juridiske poenget — beviset på at innholdet
 * de signerte ikke er rørt etterpå — så den må håndheves på serveren, ikke bare i UI.
 *
 * Gjeldende runde = høyeste `rundeNr` for dokumentet. `avsluttetAt` satt → låst.
 * «Start ny runde» oppretter en ny runde (høyere `rundeNr`, `avsluttetAt=null`) →
 * gjeldende runde er da åpen igjen → låst opp. Vakten rammer derfor ikke den veien.
 *
 * Billig no-op for de aller fleste dokumenter (ingen runder): ett indeksert
 * `findFirst` på `signatur_runder` (dekket av `@@unique([checklistId, rundeNr])`)
 * som returnerer `null`. Kalles ETTER tilgangssjekk, FØR skriving.
 *
 * Etter fabels designlås (2026-09-06) er et dokument med avsluttet runde HELT
 * lukket — også for tilbehør (kommentar/vedlegg). Nye observasjoner hører i
 * avvik/RUH eller en ny runde. Derfor blokkeres hele `oppdaterData`, ikke bare
 * verdi-delen.
 */
export async function verifiserRundeIkkeLaast(
  prisma: PrismaClient,
  ref: { checklistId: string } | { taskId: string },
): Promise<void> {
  const gjeldende = await prisma.signaturRunde.findFirst({
    where: ref,
    orderBy: { rundeNr: "desc" },
    select: { avsluttetAt: true },
  });
  if (gjeldende?.avsluttetAt) {
    const dato = gjeldende.avsluttetAt.toLocaleDateString("nb-NO", {
      timeZone: "Europe/Oslo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Runden ble avsluttet ${dato}. Innholdet er låst — ansvarlig må starte ny runde for å endre.`,
    });
  }
}

/**
 * Bygg signaturliste-data (SJA/HMS-runder) på dokument-PDF-form. Delt kilde for
 * arkiv-sammenstillingen; status regnes med samme `beregnSignaturStatus` som
 * API-routeren og chip-en, så «X av Y» aldri divergerer. Frys-bevisst: avsluttet
 * runde leser frosset antallDeltakere, åpen runde live-tellingen.
 *
 * Returnerer `null` når objektet ikke er tatt i bruk (ingen runder) — rendreren
 * utelater blokken (eller viser «Ingen signaturrunder» under visTommeStrukturer).
 */
export async function hentSignaturListeData(
  prisma: PrismaClient,
  ref: { checklistId: string } | { taskId: string },
): Promise<SignaturListeData | null> {
  const [deltakere, runder, innholdEndretAt, dok] = await Promise.all([
    prisma.dokumentDeltaker.findMany({
      where: ref,
      select: {
        id: true,
        userId: true,
        guestName: true,
        guestCompany: true,
        fjernetAt: true,
        user: { select: { name: true } },
      },
      orderBy: { lagtTilAt: "asc" },
    }),
    prisma.signaturRunde.findMany({
      where: ref,
      orderBy: { rundeNr: "asc" },
      select: {
        rundeNr: true,
        startetAt: true,
        avsluttetAt: true,
        aarsak: true,
        antallDeltakere: true,
        signaturer: {
          select: {
            deltakerId: true,
            hmsKortNr: true,
            harIkkeHmsKort: true,
            completedAt: true,
            signertTidspunkt: true,
            signertVersjon: true,
            nySignaturKrevdAt: true,
          },
        },
      },
    }),
    "checklistId" in ref
      ? prisma.checklistChangeLog.findFirst({ where: { checklistId: ref.checklistId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } })
      : prisma.taskChangeLog.findFirst({ where: { taskId: ref.taskId }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    "checklistId" in ref
      ? prisma.checklist.findUniqueOrThrow({ where: { id: ref.checklistId }, select: { innholdsVersjon: true } })
      : prisma.task.findUniqueOrThrow({ where: { id: ref.taskId }, select: { innholdsVersjon: true } }),
  ]);

  if (runder.length === 0) return null;

  const innholdsVersjon = dok.innholdsVersjon;
  const aktive = deltakere.filter((d) => d.fjernetAt === null).length;
  const gjeldende = runder[runder.length - 1]!; // ikke-tom (guardet over)
  // Krevd-ny teller ikke; av de tellende: hvor mange signerte før siste endring.
  const tellende = gjeldende.signaturer.filter((s) => s.nySignaturKrevdAt === null);
  const status = beregnSignaturStatus(
    {
      rundeNr: gjeldende.rundeNr,
      avsluttet: gjeldende.avsluttetAt !== null,
      antallSignert: tellende.length,
      antallSignertFørEndring: tellende.filter((s) => s.signertVersjon < innholdsVersjon).length,
      antallDeltakere: gjeldende.antallDeltakere,
    },
    aktive,
  );

  return {
    status: { signert: status.signert, av: status.av, rundeNr: status.rundeNr },
    innholdsVersjon,
    innholdEndretAt: innholdEndretAt?.createdAt ? innholdEndretAt.createdAt.toISOString() : null,
    deltakere: deltakere.map((d) => ({
      id: d.id,
      navn: d.user?.name ?? d.guestName ?? "Ukjent",
      firma: d.guestCompany ?? null,
      erGjest: !d.userId,
      aktiv: d.fjernetAt === null,
    })),
    runder: runder.map((r) => ({
      rundeNr: r.rundeNr,
      startetAt: r.startetAt.toISOString(),
      avsluttetAt: r.avsluttetAt ? r.avsluttetAt.toISOString() : null,
      aarsak: r.aarsak,
      erGjeldende: r.rundeNr === gjeldende.rundeNr,
      signaturer: r.signaturer.map((s) => ({
        deltakerId: s.deltakerId,
        hmsKortNr: s.hmsKortNr,
        harIkkeHmsKort: s.harIkkeHmsKort,
        completedAt: s.completedAt ? s.completedAt.toISOString() : null,
        signertTidspunkt: s.signertTidspunkt,
        signertVersjon: s.signertVersjon,
        nySignaturKrevdAt: s.nySignaturKrevdAt ? s.nySignaturKrevdAt.toISOString() : null,
      })),
    })),
  };
}
