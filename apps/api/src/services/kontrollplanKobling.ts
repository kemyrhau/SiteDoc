import { type Prisma } from "@sitedoc/db";
import { TRPCError } from "@trpc/server";

type TxClient = Prisma.TransactionClient;

/**
 * Kobler et kontrollplanpunkt til en sjekkliste (fyller `KontrollplanPunkt.sjekklisteId`).
 *
 * Delt av to veier — begge atomiske fordi kalleren eier transaksjonen:
 *  - «Start»: `sjekkliste.opprett` med `kontrollplanPunktId` (ny sjekkliste, kilde "startet")
 *  - «Koble eksisterende»: `kontrollplan.koblePunkt` (kilde "koblet") — dekker de foreldreløse
 *    sjekklistene som ble laget før koblingen fantes.
 *
 * Regler:
 *  - Malen må matche: sjekklistens `templateId` === punktets `sjekklisteMalId`.
 *  - Punktet må være ukoblet. Guarden er en `updateMany` med `sjekklisteId: null` i WHERE
 *    slik at to samtidige «Start» på samme punkt ikke gir duplikat — taperen får count 0
 *    og hele transaksjonen (inkl. en nyopprettet sjekkliste) rulles tilbake.
 *  - Status løftes kun `planlagt → pagar`. Startet/utført/godkjent arbeid røres aldri
 *    (samme prinsipp som at en frist-endring aldri rører en sjekkliste med utført arbeid).
 */
export async function koblePunktTilSjekkliste(
  tx: TxClient,
  args: { punktId: string; sjekklisteId: string; brukerId: string; kilde: "startet" | "koblet" },
): Promise<void> {
  const punkt = await tx.kontrollplanPunkt.findUniqueOrThrow({
    where: { id: args.punktId },
    select: {
      id: true,
      sjekklisteMalId: true,
      sjekklisteId: true,
      status: true,
      // Kenneth-vedtak 28.08: Start arver punktets TEGNING (aldri pin). Les drawingId +
      // tegningens byggeplass så den nye sjekklisten åpner med planens tegning valgt.
      drawingId: true,
      drawing: { select: { byggeplassId: true } },
      kontrollplan: { select: { projectId: true } },
    },
  });
  if (punkt.sjekklisteId) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Kontrollpunktet er allerede koblet til en sjekkliste.",
    });
  }

  const sjekkliste = await tx.checklist.findUniqueOrThrow({
    where: { id: args.sjekklisteId },
    select: {
      id: true,
      templateId: true,
      kontrollplanPunkt: { select: { id: true } },
      template: { select: { projectId: true } },
    },
  });

  // Prosjektisolering (CLAUDE.md — regelen uten unntak): punkt og sjekkliste MÅ høre til
  // samme prosjekt. I dag følger det av mal-matchen (malen er prosjekt-spesifikk), men
  // ReportTemplate → OrganizationTemplate (firma-delte maler, se migrering-reporttemplate.md)
  // vil bryte den impliserte invarianten stille. `kontrollplanPunktId` kommer fra klienten
  // på sjekkliste.opprett-veien og valideres ikke der — sjekken hører derfor her, i den delte
  // hjelperen begge inngangene arver.
  if (punkt.kontrollplan.projectId !== sjekkliste.template.projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sjekklisten hører til et annet prosjekt enn kontrollpunktet, og kan ikke kobles.",
    });
  }

  if (sjekkliste.templateId !== punkt.sjekklisteMalId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Sjekklisten bruker en annen mal enn kontrollpunktet, og kan ikke kobles.",
    });
  }
  if (sjekkliste.kontrollplanPunkt) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Sjekklisten er allerede koblet til et annet kontrollpunkt.",
    });
  }

  const løftStatus = punkt.status === "planlagt";
  const oppdatert = await tx.kontrollplanPunkt.updateMany({
    where: { id: args.punktId, sjekklisteId: null },
    data: {
      sjekklisteId: args.sjekklisteId,
      ...(løftStatus ? { status: "pagar" } : {}),
    },
  });
  if (oppdatert.count === 0) {
    // Noen andre koblet punktet mellom lesningen og skrivingen — rull tilbake.
    throw new TRPCError({
      code: "CONFLICT",
      message: "Kontrollpunktet ble koblet av noen andre. Last siden på nytt.",
    });
  }

  await tx.kontrollplanHistorikk.create({
    data: { punktId: args.punktId, brukerId: args.brukerId, handling: args.kilde },
  });

  // Kenneth-vedtak 28.08: en kontroll startet fra et plassert punkt ARVER punktets TEGNING
  // som utgangspunkt — ALDRI pin. Punktet er planleggerens omtrentlige plassering;
  // sjekklisten dokumenterer faktisk utførelse, så utføreren setter sin egen markør (og kan
  // bytte tegning som et bevisst valg). Byggeplassen følger tegningen, så lokasjonsvelgeren
  // åpner konsistent. Kun ved «startet» (fersk, tom sjekkliste) — «koblet» rører aldri en
  // eksisterende sjekklistes lokasjon.
  if (args.kilde === "startet" && punkt.drawingId) {
    await tx.checklist.update({
      where: { id: args.sjekklisteId },
      data: { drawingId: punkt.drawingId, byggeplassId: punkt.drawing?.byggeplassId ?? undefined },
    });
  }
}

/**
 * Prosjektisolering for tegnings-referanser (CLAUDE.md — regelen uten unntak): en `drawingId`
 * som skrives på et kontrollplanpunkt eller en koblet sjekkliste MÅ tilhøre samme prosjekt som
 * objektet. To dører skriver samme felt — `kontrollplan.settPunktPlassering` og
 * `sjekkliste.oppdater` — så vakten bor her, i den delte hjelperen begge arver, og kan ikke
 * drifte fra hverandre. Kalles med `null`-tegning som no-op-ansvar hos kalleren (fjerning av
 * tegning trenger ingen isolasjonssjekk).
 */
export async function verifiserTegningIProsjekt(
  db: TxClient,
  drawingId: string,
  projectId: string,
): Promise<void> {
  const drawing = await db.drawing.findUnique({
    where: { id: drawingId },
    select: { byggeplass: { select: { projectId: true } } },
  });
  if (!drawing?.byggeplass || drawing.byggeplass.projectId !== projectId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Tegningen hører til et annet prosjekt.",
    });
  }
}
