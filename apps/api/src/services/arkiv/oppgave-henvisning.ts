/**
 * PDF-1 (ordre 2026-11-12, Kenneth): oppgaver opprettet fra en sjekkliste i arkiv-PDF-en.
 *
 * Kobling: `Task.checklistId` + `Task.checklistFieldId` = feltets id, eller
 * `${repeaterId}:${_radId}` for en repeater-rad. Henvisningslinja («Oppgaver: BEF-015 Tittel
 * (Status) · …») vises ALLTID under feltet/raden; «Ta med oppgaver» legger i tillegg hver
 * oppgave bakerst som egen del (render.ts).
 *
 * 🔴 Isolasjon: kun oppgaver i SAMME prosjekt som sjekklista (malens prosjekt, eller
 * bestiller-faggruppens prosjekt for mal-løse oppgaver — samme kilde som arkiv-ruten), og kun
 * de brukeren har dokumenttilgang til (`tilgang`, satt av ruten). Slettede utelates.
 */
import type { PrismaClient } from "@sitedoc/db";
import { nb } from "@sitedoc/shared";
import { statusTekst, formaterNummer } from "@sitedoc/pdf";
import { IKKE_SLETTET } from "../../utils/softDelete";

/** Data tilgangssjekken trenger (samme felt som arkiv-ruten sender til verifiserDokumentTilgang). */
export interface OppgaveTilgangData {
  id: string;
  projectId: string;
  bestillerFaggruppeId: string | null;
  utforerFaggruppeId: string | null;
  domain: string | null;
  hmsSynlighet: string | null;
}

export type OppgaveTilgang = (o: OppgaveTilgangData) => Promise<boolean>;

export interface SjekklisteOppgaver {
  /** Oppgavene brukeren ser, i opprettelsesrekkefølge — delene «Ta med oppgaver» legger bakerst. */
  ider: string[];
  /** Feltnøkkel → ferdig henvisningslinje (`PdfConfig.oppgaveHenvisninger`). */
  henvisninger: Record<string, string>;
}

export async function hentSjekklisteOppgaver(
  prisma: PrismaClient,
  checklistId: string,
  projectId: string,
  tilgang?: OppgaveTilgang,
): Promise<SjekklisteOppgaver> {
  const rader = await prisma.task.findMany({
    where: {
      ...IKKE_SLETTET,
      checklistId,
      OR: [{ template: { projectId } }, { templateId: null, bestillerFaggruppe: { projectId } }],
    },
    select: {
      id: true,
      number: true,
      title: true,
      status: true,
      checklistFieldId: true,
      bestillerFaggruppeId: true,
      utforerFaggruppeId: true,
      bestillerFaggruppe: { select: { projectId: true } },
      template: { select: { projectId: true, prefix: true, domain: true, hmsSynlighet: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const ider: string[] = [];
  const perFelt = new Map<string, string[]>();
  for (const o of rader) {
    // Belte og seler: prosjektet utledes på nytt (samme regel som ruten) — en oppgave i et
    // annet prosjekt kommer aldri med, selv om spørringen skulle endres.
    const oppgaveProsjekt = o.template?.projectId ?? o.bestillerFaggruppe?.projectId ?? null;
    if (oppgaveProsjekt !== projectId) continue;
    if (
      tilgang &&
      !(await tilgang({
        id: o.id,
        projectId: oppgaveProsjekt,
        bestillerFaggruppeId: o.bestillerFaggruppeId,
        utforerFaggruppeId: o.utforerFaggruppeId,
        domain: o.template?.domain ?? null,
        hmsSynlighet: o.template?.hmsSynlighet ?? null,
      }))
    ) {
      continue;
    }
    ider.push(o.id);
    if (!o.checklistFieldId) continue;
    const nummer = formaterNummer(o.number, o.template?.prefix);
    const del = `${nummer ? `${nummer} ` : ""}${o.title} (${statusTekst(o.status)})`;
    const liste = perFelt.get(o.checklistFieldId) ?? [];
    liste.push(del);
    perFelt.set(o.checklistFieldId, liste);
  }

  const henvisninger: Record<string, string> = {};
  for (const [nokkel, deler] of perFelt) {
    henvisninger[nokkel] = `${nb["eksport.oppgaverEtikett"]}: ${deler.join(" · ")}`;
  }
  return { ider, henvisninger };
}
