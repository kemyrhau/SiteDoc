/**
 * Genererer komplett HTML for sjekkliste-PDF.
 * Brukes av mobil (expo-print) direkte, og av web som felt-kilde.
 */

import type {
  SjekklisteForPdf,
  FeltVerdi,
  ProsjektForPdf,
  Utskriftsinnstillinger,
  PdfConfig,
  TreObjekt,
  RapportObjekt,
} from "./typer";
import { hentCss } from "./css";
import { byggSjekklisteHeader, byggMetadataRutenett } from "./header";
import { renderAllefelter } from "./felt";
import { byggTegningPosisjon } from "./tegning";
import { genererTegningMedScreenshot } from "./tegning-screenshot";
import { formaterDatoTidKort, formaterNummer } from "./hjelpere";

/** Feature-flag: bruk screenshot-bilde i stedet for SVG-posisjon i PDF */
const BRUK_SCREENSHOT_TEGNING = true;

// ---------------------------------------------------------------------------
//  Bygg objekt-tre (lokal implementasjon — unngår avhengighet til shared)
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
//  Vær-tekst ekstraher
// ---------------------------------------------------------------------------

function hentVaerTekst(
  objekter: RapportObjekt[],
  feltVerdier: Record<string, FeltVerdi>,
): string | null {
  const vaerObjekt = objekter.find((o) => o.type === "weather");
  if (!vaerObjekt) return null;
  const vaerData = feltVerdier[vaerObjekt.id]?.verdi as {
    temp?: string;
    conditions?: string;
    wind?: string;
    precipitation?: string;
  } | null;
  if (!vaerData) return null;
  const deler: string[] = [];
  if (vaerData.temp) deler.push(vaerData.temp);
  if (vaerData.conditions) deler.push(vaerData.conditions);
  if (vaerData.wind) deler.push(`Vind ${vaerData.wind}`);
  if (vaerData.precipitation) deler.push(`Nedbør ${vaerData.precipitation}`);
  return deler.length > 0 ? deler.join(", ") : null;
}

// ---------------------------------------------------------------------------
//  Hovedfunksjon
// ---------------------------------------------------------------------------

/**
 * Genererer komplett HTML-dokument for en sjekkliste.
 * Returnerer en streng som kan brukes med expo-print eller injiseres i iframe.
 */
export function byggSjekklisteHtml(
  sjekkliste: SjekklisteForPdf,
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
    tegningScreenshot: config?.tegningScreenshot ?? null,
    tegningDetaljScreenshot: config?.tegningDetaljScreenshot ?? null,
  };

  const css = hentCss(cfg);
  const treObjekter = byggObjektTre(sjekkliste.template.objects);

  // Nummer
  const nummer = formaterNummer(sjekkliste.number, sjekkliste.template.prefix);

  // Dato-strenger
  const opprettetDatoTid = formaterDatoTidKort(sjekkliste.createdAt);
  const endretDatoTid = formaterDatoTidKort(sjekkliste.updatedAt);
  const endretAv = sjekkliste.changeLog?.[0]?.user?.name ?? "";

  // Vær
  const vaerTekst = hentVaerTekst(sjekkliste.template.objects, feltVerdier);

  // Tegningsnavn
  const tegningNavn = sjekkliste.drawing
    ? (sjekkliste.drawing.drawingNumber
      ? `${sjekkliste.drawing.drawingNumber} ${sjekkliste.drawing.name}`
      : sjekkliste.drawing.name)
    : null;

  // Header
  const headerHtml = byggSjekklisteHeader(
    {
      tittel: sjekkliste.title,
      nummer,
      status: sjekkliste.status,
      bestillerNavn: sjekkliste.bestiller?.name,
      bestillerEnterprise: sjekkliste.bestillerEnterprise?.name,
      utforerEnterprise: sjekkliste.utforerEnterprise?.name,
      byggeplassNavn: sjekkliste.building?.name,
      tegningNavn,
      opprettetDatoTid,
      endretDatoTid,
      endretAv,
      opprettetAv: sjekkliste.creator?.name ?? "",
      vaerTekst,
    },
    prosjekt,
    innstillinger,
    cfg,
  );

  // Tegningsposisjon — screenshot eller SVG
  let tegningHtml = "";
  if (BRUK_SCREENSHOT_TEGNING && cfg.tegningScreenshot) {
    tegningHtml = genererTegningMedScreenshot({
      screenshotBase64: cfg.tegningScreenshot,
      detaljBase64: cfg.tegningDetaljScreenshot,
      tegningNavn: tegningNavn ?? undefined,
    });
  } else if (cfg.tegningBildeUrl && sjekkliste.positionX != null && sjekkliste.positionY != null) {
    tegningHtml = byggTegningPosisjon({
      tegningBildeUrl: cfg.tegningBildeUrl,
      tegningNavn: tegningNavn ?? undefined,
      positionX: sjekkliste.positionX,
      positionY: sjekkliste.positionY,
      imageWidth: sjekkliste.drawing?.imageWidth,
      imageHeight: sjekkliste.drawing?.imageHeight,
    });
  }

  // Felter
  const feltHtml = renderAllefelter(treObjekter, feltVerdier, cfg);

  // Innhold (metadata + tegning + felter)
  const innholdHtml = `
${tegningHtml}
<div class="felter">
${feltHtml}
</div>`;

  // Med gjentakende header: bruk <table><thead>/<tfoot> som gjentas på hver side
  const bodyHtml = cfg.gjentakendeHeader
    ? `
<table class="print-tabell"><thead><tr><td>
${headerHtml}
</td></tr></thead>
<tfoot><tr><td><div class="print-footer"></div></td></tr></tfoot>
<tbody><tr><td>
${innholdHtml}
</td></tr></tbody></table>`
    : `${headerHtml}${innholdHtml}`;

  return `<!DOCTYPE html>
<html lang="nb">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>${css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
