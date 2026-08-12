/**
 * Arkiv-bygging for dataeksport.
 *
 * Fase 1: manifest-konvolutt + LES-MEG (pipeline ende-til-ende).
 * Fase 2: fyller pakken med FILENE slik de er lagret (bilder, tegninger,
 *   dokumenter, kvitteringer) + timer/utlegg som CSV-rådata, og binder hver fil
 *   til domeneobjektet sitt i manifestet. PDF-genererte dokumenter + PDF-
 *   sammendrag kommer i fase 3 (rendrer).
 *
 * Manifestet (fabel-godkjent form): hver fil bindes til objektet den hører til,
 * `avgrensninger[]` sier eksplisitt hva som bevisst mangler, og manglende filer
 * på disk markeres i stedet for å felle hele eksporten.
 */
import { stat } from "fs/promises";
import type { Archiver } from "archiver";
import type { PrismaClient } from "@sitedoc/db";
import type { PrismaClient as PrismaTimerClient } from "@sitedoc/db-timer";
import { diskSti } from "./felles";
import { samleProsjektFiler } from "./filer";
import { byggTimerCsv, byggUtleggCsv, tellTimerOgUtlegg } from "./csv";

export interface ArkivStatistikk {
  antallFiler: number;
  antallManglendeFiler: number;
  antallTimerRader: number;
  antallUtleggRader: number;
  samletStorrelseBytes: number;
}

interface ManifestFil {
  kategori: string;
  arkivSti: string | null; // null hvis fila mangler på disk
  visningsnavn: string;
  storrelseBytes: number | null;
  opprettet: string;
  tilknyttet: { type: string; id: string; navn: string | null } | null;
  mangler?: true;
}

/** Sanitér et filnavn til trygt arkiv-segment (ingen path-separatorer). */
function trygtNavn(navn: string): string {
  // eslint-disable-next-line no-control-regex -- fjerner bevisst kontrolltegn fra brukerstyrt filnavn
  const rent = navn.replace(/[/\\\u0000-\u001f]/g, "_").trim();
  return rent.length > 0 ? rent : "fil";
}

/** Unik arkiv-sti innen mappa (append -2, -3 ved kollisjon). */
function unikArkivSti(mappe: string, navn: string, brukte: Set<string>): string {
  const rent = trygtNavn(navn);
  const punkt = rent.lastIndexOf(".");
  const base = punkt > 0 ? rent.slice(0, punkt) : rent;
  const ext = punkt > 0 ? rent.slice(punkt) : "";
  let kandidat = `${mappe}/${rent}`;
  let n = 2;
  while (brukte.has(kandidat)) {
    kandidat = `${mappe}/${base}-${n}${ext}`;
    n++;
  }
  brukte.add(kandidat);
  return kandidat;
}

export async function byggEksportArkiv(
  prisma: PrismaClient,
  prismaTimer: PrismaTimerClient,
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
      primaryOrganization: { select: { id: true, name: true, organizationNumber: true } },
    },
  });
  if (!prosjekt) {
    throw new Error(`Prosjekt ${jobb.projectId} finnes ikke`);
  }
  const org = prosjekt.primaryOrganization;

  const statistikk: ArkivStatistikk = {
    antallFiler: 0,
    antallManglendeFiler: 0,
    antallTimerRader: 0,
    antallUtleggRader: 0,
    samletStorrelseBytes: 0,
  };
  const innhold: ManifestFil[] = [];
  const brukteStier = new Set<string>();

  // ── Filer ──
  const filer = await samleProsjektFiler(prisma, prismaTimer, jobb.projectId);
  for (const fil of filer) {
    const disk = diskSti(fil.fileUrl);
    let storrelse = fil.storrelse;
    try {
      const st = await stat(disk);
      if (storrelse === null) storrelse = st.size;
    } catch {
      // Fila er registrert i DB men finnes ikke på disk — marker, ikke fell.
      statistikk.antallManglendeFiler++;
      innhold.push({
        kategori: fil.kategori,
        arkivSti: null,
        visningsnavn: fil.visningsnavn,
        storrelseBytes: fil.storrelse,
        opprettet: fil.opprettet,
        tilknyttet: fil.tilknyttet,
        mangler: true,
      });
      continue;
    }

    const arkivSti = unikArkivSti(fil.mappe, fil.visningsnavn, brukteStier);
    archive.file(disk, { name: arkivSti });
    statistikk.antallFiler++;
    statistikk.samletStorrelseBytes += storrelse ?? 0;
    innhold.push({
      kategori: fil.kategori,
      arkivSti,
      visningsnavn: fil.visningsnavn,
      storrelseBytes: storrelse,
      opprettet: fil.opprettet,
      tilknyttet: fil.tilknyttet,
    });
  }

  // ── Timer/utlegg som CSV-rådata ──
  const csvInnhold: { kategori: string; arkivSti: string; antallRader: number }[] = [];
  const antall = await tellTimerOgUtlegg(prismaTimer, jobb.projectId);
  statistikk.antallTimerRader = antall.timer;
  statistikk.antallUtleggRader = antall.utlegg;
  if (antall.timer > 0) {
    const csv = await byggTimerCsv(prisma, prismaTimer, jobb.projectId);
    const sti = `timer/${prosjekt.projectNumber}-timer.csv`;
    archive.append(csv, { name: sti });
    csvInnhold.push({ kategori: "timer-csv", arkivSti: sti, antallRader: antall.timer });
  }
  if (antall.utlegg > 0) {
    const csv = await byggUtleggCsv(prisma, prismaTimer, jobb.projectId);
    const sti = `utlegg/${prosjekt.projectNumber}-utlegg.csv`;
    archive.append(csv, { name: sti });
    csvInnhold.push({ kategori: "utlegg-csv", arkivSti: sti, antallRader: antall.utlegg });
  }

  // ── Manifest ──
  const manifest = {
    eksportVersjon: "1.0",
    generert: { tidspunkt: new Date().toISOString(), avUserId: jobb.bestiltAvUserId },
    kilde: { system: "SiteDoc", url: "https://sitedoc.no", eksportId: jobb.id },
    firma: org ? { id: org.id, navn: org.name, orgnr: org.organizationNumber ?? null } : null,
    prosjekt: {
      id: prosjekt.id,
      prosjektnummer: prosjekt.projectNumber,
      navn: prosjekt.name,
      status: prosjekt.status,
      opprettet: prosjekt.createdAt.toISOString(),
    },
    innhold,
    csv: csvInnhold,
    statistikk,
    avgrensninger: [
      "Punktskyer er ikke inkludert i denne pakken — kildefila ligger normalt hos scanne-leverandøren.",
      "Dokumenter som PDF (sjekklister, oppgaver, HMS, kontrollplan) + PDF-sammendrag for timer/utlegg kommer i en senere versjon; denne pakken inneholder filene slik de er lagret + timer/utlegg som CSV.",
      "Strukturert JSON/CSV-eksport av alt domenedata kommer i en senere versjon (v2).",
      "Filer merket «mangler» var registrert i systemet men fantes ikke på lagringen ved eksport-tidspunktet.",
    ],
  };

  archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });
  archive.append(byggLesMeg(prosjekt.projectNumber, prosjekt.name), { name: "LES-MEG.txt" });

  return statistikk;
}

function byggLesMeg(prosjektnummer: string, navn: string): string {
  return [
    `Dataeksport fra SiteDoc`,
    ``,
    `Prosjekt: ${prosjektnummer} — ${navn}`,
    ``,
    `Denne pakken er en dokumentasjonseksport av prosjektet. manifest.json`,
    `beskriver hele innholdet: hvilke filer som er med, hva hver fil hører til,`,
    `og timer/utlegg som CSV. Feltet "avgrensninger" sier hva som bevisst IKKE`,
    `er inkludert, slik at ingenting ser ut til å mangle ved en feil.`,
    ``,
    `Mapper:`,
    `  filer/bilder/        Bilder fra sjekklister og oppgaver`,
    `  filer/dokumenter/    Opplastede dokumenter (notaer, kontrakter, m.m.)`,
    `  filer/kvitteringer/  Kvitteringer for utlegg og tillegg`,
    `  tegninger/           Tegninger, originaler og revisjoner`,
    `  timer/               Timeregistrering som CSV`,
    `  utlegg/              Utlegg som CSV`,
    ``,
    `Åpne manifest.json for full oversikt.`,
    ``,
  ].join("\n");
}
