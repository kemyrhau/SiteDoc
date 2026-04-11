/**
 * Genererer komplett HTML for oppgave-PDF.
 * Brukes av mobil (expo-print) direkte, og av web som felt-kilde.
 */

import type {
  OppgaveForPdf,
  FeltVerdi,
  ProsjektForPdf,
  Utskriftsinnstillinger,
  PdfConfig,
  TreObjekt,
  RapportObjekt,
} from "./typer";
import { hentCss } from "./css";
import { byggOppgaveHeader, byggMetadataRutenett } from "./header";
import { renderAllefelter } from "./felt";
import { byggTegningPosisjon } from "./tegning";
import { formaterDatoTidKort, formaterNummer } from "./hjelpere";

// ---------------------------------------------------------------------------
//  Bygg objekt-tre (lokal kopi — unngår avhengighet til shared)
// ---------------------------------------------------------------------------

function byggObjektTre(objekter: RapportObjekt[]): TreObjekt[] {
  const map = new Map<string, TreObjekt>();
  const rot: TreObjekt[] = [];

  for (const obj of objekter) {
    map.set(obj.id, { ...obj, children: [] });
  }

  for (const obj of objekter) {
    const node = map.get(obj.id)!;
    if (obj.parentId && map.has(obj.parentId)) {
      map.get(obj.parentId)!.children.push(node);
    } else {
      rot.push(node);
    }
  }

  rot.sort((a, b) => a.sortOrder - b.sortOrder);
  for (const node of map.values()) {
    node.children.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  return rot;
}

// ---------------------------------------------------------------------------
//  Hovedfunksjon
// ---------------------------------------------------------------------------

/**
 * Genererer komplett HTML-dokument for en oppgave.
 */
export function byggOppgaveHtml(
  oppgave: OppgaveForPdf,
  feltVerdier: Record<string, FeltVerdi>,
  prosjekt?: ProsjektForPdf | null,
  innstillinger?: Utskriftsinnstillinger | null,
  config?: Partial<PdfConfig>,
): string {
  const cfg: PdfConfig = {
    bildeBaseUrl: config?.bildeBaseUrl ?? "",
    maksbildeHoyde: config?.maksbildeHoyde ?? 260,
    gjentakendeHeader: config?.gjentakendeHeader ?? false,
    visSidenummer: config?.visSidenummer ?? false,
    tegningBildeUrl: config?.tegningBildeUrl ?? null,
  };

  const css = hentCss(cfg);
  const treObjekter = byggObjektTre(oppgave.template.objects);

  const nummer = formaterNummer(oppgave.number, oppgave.template.prefix);
  const opprettetDatoTid = formaterDatoTidKort(oppgave.createdAt);
  const endretDatoTid = formaterDatoTidKort(oppgave.updatedAt);
  const endretAv = oppgave.changeLog?.[0]?.user?.name ?? "";

  // Tegningsnavn
  const tegningNavn = oppgave.drawing
    ? (oppgave.drawing.drawingNumber
      ? `${oppgave.drawing.drawingNumber} ${oppgave.drawing.name}`
      : oppgave.drawing.name)
    : null;

  // Byggeplass fra tegning
  const byggeplassNavn = oppgave.drawing?.byggeplass?.name ?? null;

  // Header
  const headerHtml = byggOppgaveHeader(
    {
      tittel: oppgave.title,
      nummer,
      status: oppgave.status,
      prioritet: oppgave.priority,
      visPrioritet: oppgave.template.showPriority,
      beskrivelse: oppgave.description,
      bestillerNavn: oppgave.bestiller?.name,
      bestillerEnterprise: oppgave.bestillerEnterprise?.name,
      utforerEnterprise: oppgave.utforerEnterprise?.name,
      byggeplassNavn,
      tegningNavn,
      opprettetDatoTid,
    },
    prosjekt,
    innstillinger,
    cfg,
  );

  // Metadata-rutenett
  const metadataHtml = byggMetadataRutenett({
    prosjektNavn: prosjekt?.name,
    prosjektNr: prosjekt?.projectNumber ?? "",
    bygningNavn: byggeplassNavn ?? "",
    opprettetAv: oppgave.creator?.name ?? "",
    opprettetDatoTid,
    endretAv,
    endretDatoTid,
    status: oppgave.status,
  });

  // Tegningsposisjon
  let tegningHtml = "";
  if (cfg.tegningBildeUrl && oppgave.positionX != null && oppgave.positionY != null) {
    tegningHtml = byggTegningPosisjon({
      tegningBildeUrl: cfg.tegningBildeUrl,
      tegningNavn: tegningNavn ?? undefined,
      positionX: oppgave.positionX,
      positionY: oppgave.positionY,
    });
  }

  // Felter
  const feltHtml = renderAllefelter(treObjekter, feltVerdier, cfg);

  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>

${headerHtml}
${metadataHtml}
${tegningHtml}

<div class="felter">
${feltHtml}
</div>

</body>
</html>`;
}
