/**
 * Arkiv-bygging for dataeksport.
 *
 * Fase 1: manifest-konvolutt + LES-MEG (pipeline ende-til-ende).
 * Fase 2: fyller pakken med FILENE slik de er lagret (bilder, tegninger,
 *   dokumenter, kvitteringer), og binder hver fil til domeneobjektet sitt i
 *   manifestet. (Timer/utlegg er bevisst ute — Kenneth-vedtak 2026-09-06.)
 * Fase 3 (2026-09-07): rendrer HVERT sjekkliste-/oppgave-/HMS-dokument til PDF
 *   og legger det i pakken. Uten dette manglet ALL kvalitetsdokumentasjon i
 *   arkivet (Kenneth-funn 2026-09-07) — arkivet er forutsetningen for at et
 *   prosjekt kan avsluttes, så det er kjernen, ikke en forbedring. Én PDF pr.
 *   dokument (cowork-vedtak), dokumentnummer i filnavnet — slik kunden leter.
 *
 * Manifestet (fabel-godkjent form): hver fil/dokument bindes til objektet det
 * hører til, `avgrensninger[]` sier eksplisitt hva som bevisst mangler, og et
 * dokument som ikke lot seg rendre markeres i stedet for å felle hele eksporten.
 */
import { stat } from "fs/promises";
import type { Archiver } from "archiver";
import type { PrismaClient } from "@sitedoc/db";
import type { PrismaClient as PrismaTimerClient } from "@sitedoc/db-timer";
import { diskSti } from "./felles";
import { samleProsjektFiler } from "./filer";
import { samleProsjektDokumenter } from "./dokumenter";
import { rendrArkivPdf, genererArkivStempel } from "../arkiv/render";

export interface ArkivStatistikk {
  antallFiler: number;
  antallManglendeFiler: number;
  samletStorrelseBytes: number;
  /** Dokumenter (sjekkliste/oppgave/HMS) som skulle rendres til PDF. */
  antallDokumenter: number;
  /** Dokumenter som kom med som PDF (inkl. dem med manglende vedlegg — de rendret). */
  antallDokumenterFerdig: number;
  /** Dokumenter som IKKE lot seg rendre — notert i manifestet, felte ikke pakken. */
  antallDokumenterFeilet: number;
}

/** Progresjon rapporteres pr. rendret dokument (dokument-render er det tunge steget). */
export type FremdriftCallback = (ferdig: number, totalt: number) => Promise<void>;

interface ManifestFil {
  kategori: string;
  arkivSti: string | null; // null hvis fila mangler på disk
  visningsnavn: string;
  storrelseBytes: number | null;
  opprettet: string;
  tilknyttet: { type: string; id: string; navn: string | null } | null;
  mangler?: true;
}

interface ManifestDokument {
  type: "sjekkliste" | "oppgave";
  id: string;
  tittel: string;
  arkivSti: string | null; // null hvis dokumentet ikke lot seg rendre
  /** Vedlegg dokumentet refererer til, men som ikke kom med i PDF-en. */
  manglendeVedlegg?: string[];
  /** Satt når dokumentet ikke lot seg rendre — kort årsak, resten pakkes. */
  feilet?: string;
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
  onFremdrift?: FremdriftCallback,
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
    samletStorrelseBytes: 0,
    antallDokumenter: 0,
    antallDokumenterFerdig: 0,
    antallDokumenterFeilet: 0,
  };
  const innhold: ManifestFil[] = [];
  const dokumentInnhold: ManifestDokument[] = [];
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

  // Timer og utlegg er BEVISST UTE av prosjektarkivet (Kenneth-vedtak 2026-09-06):
  // arkivet er en prosjekteksport for overlevering, mens timer er en firmamodul med
  // ansattes lønnsdata. En zip gitt til en byggherre skal ikke bære det. Timer/utlegg
  // hentes fra timer-rapporten, som har intern/ekstern-skillet og lever på firmanivå.
  // (Kvitteringer på utlegg BLIR — de er prosjekt-bilag, ikke lønnsdata; se filer.ts.)

  // ── Dokumenter → PDF (fase 3) ──
  // Rendrer hvert sjekkliste-/oppgave-/HMS-dokument til ÉN PDF via samme sti som
  // den interaktive nedlastingen (rendrArkivPdf → pdf-render-containeren). Kall
  // pr. dokument (ikke samle-PDF): kunden slår opp «KA7-003» og finner den.
  // Dokument-render er det tunge steget (~1 s + ~0,09 s/bilde) — derfor bæres
  // progresjonen her, ett steg pr. dokument.
  const dokumenter = await samleProsjektDokumenter(prisma, jobb.projectId);
  statistikk.antallDokumenter = dokumenter.length;
  const generertTekst = genererArkivStempel(new Date());
  const datoForFilnavn = new Date().toISOString().slice(0, 10);
  await onFremdrift?.(0, dokumenter.length);

  for (let i = 0; i < dokumenter.length; i++) {
    const dok = dokumenter[i]!;
    try {
      const resultat = await rendrArkivPdf(prisma, [{ id: dok.id, type: dok.type }], {
        generertTekst,
        datoForFilnavn,
        eksport: true,
      });
      // Arkiv-filnavn = dokumentnummer + tittel (`KA7-003 – Tittel.pdf`). rendrArkivPdf
      // gir nummer-stammen (`KA7-003.pdf`); tittelen legges på så kunden ser hva det er.
      const stamme = resultat.filnavn.replace(/\.pdf$/i, "");
      const arkivSti = unikArkivSti(dok.mappe, `${stamme} – ${dok.tittel}.pdf`, brukteStier);
      archive.append(resultat.pdf, { name: arkivSti });
      statistikk.antallDokumenterFerdig++;
      const manglendeVedlegg = resultat.dokumenter[0]?.manglendeVedlegg ?? [];
      dokumentInnhold.push({
        type: dok.type,
        id: dok.id,
        tittel: dok.tittel,
        arkivSti,
        ...(manglendeVedlegg.length > 0 ? { manglendeVedlegg } : {}),
      });
    } catch (err) {
      // Ett dokument feiler ikke hele arkivet (samme kontrakt som manglende filer):
      // marker i manifestet, tell det, gå videre.
      const arsak = err instanceof Error ? err.message : "Ukjent feil";
      statistikk.antallDokumenterFeilet++;
      dokumentInnhold.push({
        type: dok.type,
        id: dok.id,
        tittel: dok.tittel,
        arkivSti: null,
        feilet: arsak.slice(0, 300),
      });
    }
    await onFremdrift?.(i + 1, dokumenter.length);
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
    dokumenter: dokumentInnhold,
    statistikk,
    avgrensninger: [
      "Timeregistrering og utlegg er IKKE med i denne pakken. De er firmadata (ansattes lønnsopplysninger) og hentes fra timer-rapporten i SiteDoc, som skiller intern og ekstern versjon. Kvitteringer knyttet til utlegg ligger under filer/kvitteringer/ som prosjekt-bilag.",
      "Slettede dokumenter (papirkurv) er ikke med — kun dokumentasjon som var aktiv ved eksport-tidspunktet.",
      "Punktskyer er ikke inkludert i denne pakken — kildefila ligger normalt hos scanne-leverandøren.",
      "Strukturert JSON/CSV-eksport av alt domenedata kommer i en senere versjon (v2).",
      "Filer merket «mangler» var registrert i systemet men fantes ikke på lagringen ved eksport-tidspunktet.",
      ...(statistikk.antallDokumenterFeilet > 0
        ? [
            `${statistikk.antallDokumenterFeilet} dokument(er) lot seg ikke generere til PDF ved eksport-tidspunktet og er merket med «feilet» under "dokumenter". Resten av pakken er komplett.`,
          ]
        : []),
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
    `Denne pakken er en dokumentasjonseksport av prosjektet: kvalitetsdokumentene`,
    `som PDF + filene slik de er lagret i SiteDoc.`,
    ``,
    `Mapper:`,
    `  dokumenter/sjekklister/  Sjekklister som PDF (dokumentnummer i filnavnet)`,
    `  dokumenter/oppgaver/     Oppgaver som PDF`,
    `  dokumenter/hms/          HMS: SJA, avvik og RUH som PDF`,
    `  filer/bilder/            Bilder fra sjekklister og oppgaver`,
    `  filer/dokumenter/        Opplastede dokumenter (notaer, kontrakter, m.m.)`,
    `  filer/kvitteringer/      Kvitteringer for utlegg og tillegg`,
    `  tegninger/               Tegninger, originaler og revisjoner`,
    ``,
    `Hvert dokument er én PDF med dokumentnummeret i filnavnet, slik at du kan`,
    `slå opp et bestemt dokument direkte. Tomme mapper betyr at prosjektet ikke`,
    `hadde dokumenter av den typen.`,
    ``,
    `Fila manifest.json er en innholdsfortegnelse: den lister hvert dokument og`,
    `hver fil i pakken, hva de hører til, og — under "avgrensninger" — hva som`,
    `bevisst IKKE er med, slik at ingenting ser ut til å mangle ved en feil.`,
    ``,
    `Timeregistrering og utlegg er ikke med i denne pakken. Det er firmadata`,
    `(ansattes lønnsopplysninger) og hentes fra timer-rapporten i SiteDoc.`,
    `Kvitteringer knyttet til utlegg ligger likevel under filer/kvitteringer/,`,
    `som bilag til prosjektet.`,
    ``,
  ].join("\n");
}
