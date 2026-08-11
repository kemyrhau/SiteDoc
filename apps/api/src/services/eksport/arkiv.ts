/**
 * Arkiv-bygging for dataeksport (fase 1 — infrastruktur, 2026-08-11).
 *
 * `byggEksportArkiv` appender innhold til en åpen archiver-strøm. Fase 1 legger
 * KUN manifest-konvolutten + en LES-MEG — nok til at pipelinen (jobb → zip på
 * disk → signert URL) er ende-til-ende og testbar. Fase 2 utvider SAMME funksjon
 * med `innhold[]` + faktiske filer/PDF/CSV, uten å skrive om worker eller levering.
 *
 * Manifestets form er fabel-godkjent: hver fil bindes til domeneobjektet den
 * hører til, og `avgrensninger[]` sier eksplisitt hva som BEVISST mangler — så
 * pakken er forståelig for en som åpner den om ti år.
 */
import type { Archiver } from "archiver";
import type { PrismaClient } from "@sitedoc/db";

export interface ArkivStatistikk {
  antallDokumenter: number;
  antallFiler: number;
  samletStorrelseBytes: number;
}

/**
 * Bygg arkivinnholdet for en prosjekteksport. Returnerer statistikk for
 * jobb-progresjon. Kaster hvis prosjektet ikke finnes.
 */
export async function byggEksportArkiv(
  prisma: PrismaClient,
  jobb: { id: string; projectId: string | null; bestiltAvUserId: string },
  archive: Archiver,
): Promise<ArkivStatistikk> {
  if (!jobb.projectId) {
    throw new Error("Prosjekteksport mangler projectId");
  }

  const prosjekt = await prisma.project.findUnique({
    where: { id: jobb.projectId },
    select: {
      id: true,
      projectNumber: true,
      name: true,
      status: true,
      createdAt: true,
      primaryOrganization: {
        select: { id: true, name: true, organizationNumber: true },
      },
    },
  });
  if (!prosjekt) {
    throw new Error(`Prosjekt ${jobb.projectId} finnes ikke`);
  }

  const org = prosjekt.primaryOrganization;

  // Fase 1: tom innhold-liste og nullstatistikk — fylles i fase 2.
  const statistikk: ArkivStatistikk = {
    antallDokumenter: 0,
    antallFiler: 0,
    samletStorrelseBytes: 0,
  };

  const manifest = {
    eksportVersjon: "1.0",
    generert: {
      tidspunkt: new Date().toISOString(),
      avUserId: jobb.bestiltAvUserId,
    },
    kilde: {
      system: "SiteDoc",
      url: "https://sitedoc.no",
      eksportId: jobb.id,
    },
    firma: org
      ? { id: org.id, navn: org.name, orgnr: org.organizationNumber ?? null }
      : null,
    prosjekt: {
      id: prosjekt.id,
      prosjektnummer: prosjekt.projectNumber,
      navn: prosjekt.name,
      status: prosjekt.status,
      opprettet: prosjekt.createdAt.toISOString(),
    },
    // Fylles i fase 2: hver rad binder en PDF/fil til domeneobjektet sitt.
    innhold: [] as unknown[],
    statistikk,
    avgrensninger: [
      "Punktskyer er ikke inkludert i denne pakken — kildefila ligger normalt hos scanne-leverandøren.",
      "Strukturert JSON/CSV-eksport av domenedata kommer i en senere versjon (v2).",
      "Fase 1: pakken inneholder foreløpig kun manifest og prosjektmetadata. Dokumenter (PDF), filer og timer/utlegg-CSV legges til i fase 2.",
    ],
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
  archive.append(byggLesMeg(prosjekt.projectNumber, prosjekt.name), {
    name: "LES-MEG.txt",
  });

  return statistikk;
}

function byggLesMeg(prosjektnummer: string, navn: string): string {
  return [
    `Dataeksport fra SiteDoc`,
    ``,
    `Prosjekt: ${prosjektnummer} — ${navn}`,
    ``,
    `Denne pakken er en dokumentasjonseksport av prosjektet. manifest.json`,
    `beskriver hele innholdet: hvilke dokumenter og filer som er med, og hva`,
    `hver fil hører til. Feltet "avgrensninger" sier hva som bevisst IKKE er`,
    `inkludert, slik at ingenting ser ut til å mangle ved en feil.`,
    ``,
    `Åpne manifest.json for full oversikt.`,
    ``,
  ].join("\n");
}
