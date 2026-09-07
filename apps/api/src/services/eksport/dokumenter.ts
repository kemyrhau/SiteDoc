/**
 * Dokument-enumerering for dataeksport (fase 3, 2026-09-07).
 *
 * Fase 2 tok kun FILENE på disk; kvalitetsdokumentasjonen (sjekklister, oppgaver,
 * HMS) fantes ikke i pakken i noen form — det motsatte av hva et prosjektarkiv er
 * til for (Kenneth-funn 2026-09-07). Her lister vi hvert dokument som skal rendres
 * til PDF, med mappe og filnavn-referanse; `arkiv.ts` kaller `rendrArkivPdf` én
 * gang pr. dokument (cowork-vedtak: én PDF pr. dokument, ikke én samle-PDF).
 *
 * Samme henteveg som `filer.ts` (reportTemplate → Checklist/Task), men her er
 * dokumentet selv målet, ikke bildene det binder. Papirkurv (`deletedAt`) er
 * bevisst UTE — et slettet dokument er ikke prosjektets dokumentasjon
 * (Kenneth-vedtak 2026-09-07).
 */
import type { PrismaClient } from "@sitedoc/db";
import type { ArkivDokumentType } from "../arkiv/render";

export interface EksportDokument {
  id: string;
  type: ArkivDokumentType;
  /** Undermappe i arkivet — gruppert etter hva kunden tenker på dokumentet SOM. */
  mappe: string;
  /** Dokumenttittel — inngår i arkiv-filnavnet ved siden av dokumentnummeret. */
  tittel: string;
}

/**
 * Mappe etter DOMENE, ikke DB-modell: en SJA er teknisk en `Checklist`, men
 * kunden som leter etter den bryr seg om at den er HMS. Derfor havner alt med
 * `domain="hms"` (SJA-sjekklister + HMS avvik/RUH-oppgaver) under `hms/`, øvrige
 * sjekklister under `sjekklister/`, øvrige oppgaver under `oppgaver/`.
 */
function velgMappe(type: ArkivDokumentType, domain: string | null): string {
  if (domain === "hms") return "dokumenter/hms";
  return type === "sjekkliste" ? "dokumenter/sjekklister" : "dokumenter/oppgaver";
}

export async function samleProsjektDokumenter(
  prisma: PrismaClient,
  projectId: string,
): Promise<EksportDokument[]> {
  const maler = await prisma.reportTemplate.findMany({
    where: { projectId },
    select: { id: true },
  });
  const malIder = maler.map((m) => m.id);

  // Oppgaver hører til prosjektet på TO veier (samme rekkefølge som rendr-ruten):
  //   1) malens prosjekt (template.projectId) — normaltilfellet.
  //   2) template=null → bestiller-faggruppens prosjekt (HMS-avvik/RUH opprettet fra
  //      en sjekkliste har ingen egen mal). Uten vei 2 forsvinner de fra arkivet.
  // Sjekklister har alltid en mal (Checklist.templateId er non-null), så bare vei 1.
  const [sjekklister, oppgaverMedMal, oppgaverUtenMal] = await Promise.all([
    malIder.length > 0
      ? prisma.checklist.findMany({
          where: { templateId: { in: malIder }, deletedAt: null },
          select: { id: true, title: true, number: true, template: { select: { domain: true } } },
          orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
    malIder.length > 0
      ? prisma.task.findMany({
          where: { templateId: { in: malIder }, deletedAt: null },
          select: { id: true, title: true, number: true, template: { select: { domain: true } } },
          orderBy: [{ number: "asc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
    prisma.task.findMany({
      where: { templateId: null, deletedAt: null, bestillerFaggruppe: { projectId } },
      select: { id: true, title: true, number: true },
      orderBy: [{ number: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const dokumenter: EksportDokument[] = [];
  for (const c of sjekklister) {
    dokumenter.push({
      id: c.id,
      type: "sjekkliste",
      mappe: velgMappe("sjekkliste", c.template?.domain ?? null),
      tittel: c.title,
    });
  }
  for (const t of oppgaverMedMal) {
    dokumenter.push({
      id: t.id,
      type: "oppgave",
      mappe: velgMappe("oppgave", t.template?.domain ?? null),
      tittel: t.title,
    });
  }
  for (const t of oppgaverUtenMal) {
    // Ingen mal → ingen domene å rute på; havner under oppgaver/.
    dokumenter.push({ id: t.id, type: "oppgave", mappe: velgMappe("oppgave", null), tittel: t.title });
  }
  return dokumenter;
}
