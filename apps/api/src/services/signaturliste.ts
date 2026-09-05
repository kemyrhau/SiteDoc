import type { PrismaClient } from "@sitedoc/db";
import type { SignaturListeData } from "@sitedoc/pdf";
import { beregnSignaturStatus } from "@sitedoc/shared";
import { TRPCError } from "@trpc/server";

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
  const [deltakere, runder] = await Promise.all([
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
          },
        },
      },
    }),
  ]);

  if (runder.length === 0) return null;

  const aktive = deltakere.filter((d) => d.fjernetAt === null).length;
  const gjeldende = runder[runder.length - 1]!; // ikke-tom (guardet over)
  const status = beregnSignaturStatus(
    {
      rundeNr: gjeldende.rundeNr,
      avsluttet: gjeldende.avsluttetAt !== null,
      antallSignert: gjeldende.signaturer.length,
      antallDeltakere: gjeldende.antallDeltakere,
    },
    aktive,
  );

  return {
    status: { signert: status.signert, av: status.av, rundeNr: status.rundeNr },
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
      })),
    })),
  };
}
