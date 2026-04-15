/**
 * Felt-renderer — konverterer et rapportobjekt + verdi til HTML-streng.
 * Støtter alle 23+ felttyper. Brukes av både sjekkliste- og oppgave-PDF.
 */

import type { RapportObjekt, TreObjekt, FeltVerdi, VaerVerdi, PdfConfig } from "./typer";
import { TRAFIKKLYS } from "./konstanter";
import { esc, normaliserOpsjon, formaterDato, formaterDatoTid, fullBildeUrl } from "./hjelpere";

// ---------------------------------------------------------------------------
//  Hovedfunksjon
// ---------------------------------------------------------------------------

/**
 * Renderer et enkelt felt (rapportobjekt + verdi) til HTML-streng.
 * Inkluderer label, verdi, bilder, kommentar og fil-vedlegg.
 */
export function renderFelt(
  objekt: TreObjekt,
  felt: FeltVerdi | undefined,
  config: PdfConfig,
): string {
  const { type, label } = objekt;
  const verdi = felt?.verdi;
  const tom = verdi === null || verdi === undefined || verdi === "";

  // Overskrift/undertittel
  if (type === "heading") {
    return `<div class="heading">${esc(label)}</div>`;
  }
  if (type === "subtitle") {
    return `<div class="subtitle">${esc(label)}</div>`;
  }

  // Skjulte/spesialtyper
  if (type === "location" || type === "drawing_position") return "";
  if (type === "info_text" || type === "info_image" || type === "video" || type === "quiz") return "";

  // Verdi-HTML per type
  let verdiHtml = "";

  switch (type) {
    case "text_field":
      verdiHtml = tom
        ? `<span class="tom">Ikke utfylt</span>`
        : `<span class="tekst-verdi">${esc(String(verdi))}</span>`;
      break;

    case "list_single": {
      const opsjoner = ((objekt.config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgt = typeof verdi === "string" ? opsjoner.find((o) => o.value === verdi)?.label ?? verdi : null;
      verdiHtml = valgt ? esc(valgt) : `<span class="tom">Ikke utfylt</span>`;
      break;
    }

    case "list_multi": {
      const opsjoner = ((objekt.config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgte = Array.isArray(verdi)
        ? (verdi as string[]).map((v) => opsjoner.find((o) => o.value === v)?.label ?? v)
        : [];
      verdiHtml = valgte.length > 0 ? esc(valgte.join(", ")) : `<span class="tom">Ikke utfylt</span>`;
      break;
    }

    case "traffic_light": {
      const tl = typeof verdi === "string" ? TRAFIKKLYS[verdi] : null;
      if (tl) {
        verdiHtml = `<span class="trafikklys" style="background:${tl.farge};"></span> ${esc(tl.label)}`;
      } else {
        verdiHtml = `<span class="tom">Ikke utfylt</span>`;
      }
      break;
    }

    case "integer":
    case "decimal":
    case "calculation": {
      const enhet = (objekt.config.unit as string) ?? "";
      verdiHtml = tom
        ? `<span class="tom">Ikke utfylt</span>`
        : esc(`${verdi}${enhet ? ` ${enhet}` : ""}`);
      break;
    }

    case "date":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(formaterDato(verdi));
      break;

    case "date_time":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(formaterDatoTid(verdi));
      break;

    case "person":
    case "company":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(String(verdi));
      break;

    case "persons":
      verdiHtml = Array.isArray(verdi) && verdi.length > 0
        ? esc((verdi as string[]).join(", "))
        : `<span class="tom">Ikke utfylt</span>`;
      break;

    case "weather": {
      const v = (verdi as VaerVerdi) ?? {};
      const deler: string[] = [];
      if (v.temp) deler.push(v.temp);
      if (v.conditions) deler.push(v.conditions);
      if (v.wind) deler.push(`Vind ${v.wind}`);
      if (v.precipitation && v.precipitation !== "0 mm") deler.push(`Nedbør ${v.precipitation}`);
      verdiHtml = deler.length > 0 ? esc(deler.join(", ")) : `<span class="tom">Ingen værdata</span>`;
      break;
    }

    case "signature":
      if (typeof verdi === "string" && verdi.startsWith("data:")) {
        verdiHtml = `<img src="${verdi}" style="max-height:60px;" />`;
      } else {
        verdiHtml = `<span class="tom">Ikke signert</span>`;
      }
      break;

    case "attachments": {
      // Frittstående vedlegg-felt (ikke per-felt-vedlegg)
      const vedleggListe = Array.isArray(verdi)
        ? (verdi as Array<{ id?: string; url?: string; filnavn?: string; type?: string }>)
        : [];
      if (vedleggListe.length === 0) return "";
      const bilder = vedleggListe.filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn ?? ""));
      const filer = vedleggListe.filter((v) => !bilder.includes(v));
      let html = `<div class="felt-blokk"><div class="felt-label">${esc(label)}</div>`;
      if (bilder.length > 0) {
        html += `<div class="bilde-rutenett">`;
        bilder.forEach((b, idx) => {
          const src = fullBildeUrl(b.url ?? "", config.bildeBaseUrl);
          html += `<div class="bilde-kort"><img src="${esc(src)}" class="bilde-img" /><div class="bilde-nr">${idx + 1}</div></div>`;
        });
        html += `</div>`;
      }
      if (filer.length > 0) {
        html += `<div class="vedlegg-teller">📎 ${filer.length} fil${filer.length > 1 ? "er" : ""}</div>`;
      }
      html += `</div>`;
      return html;
    }

    case "repeater": {
      const rader = Array.isArray(verdi) ? (verdi as Record<string, FeltVerdi>[]) : [];
      if (rader.length === 0) return "";
      const barn = objekt.children ?? [];
      let repeaterHtml = `<div class="felt-blokk"><div class="felt-label">${esc(label)}</div>`;
      rader.forEach((rad, idx) => {
        repeaterHtml += `<div class="repeater-rad"><div class="repeater-nr">${idx + 1}. ${esc(label)}</div>`;
        for (const b of barn) {
          const bFelt = rad[b.id] as FeltVerdi | undefined;
          repeaterHtml += renderFelt(b, bFelt, config);
        }
        repeaterHtml += `</div>`;
      });
      repeaterHtml += `</div>`;
      return repeaterHtml;
    }

    case "bim_property":
    case "zone_property":
    case "room_property":
      verdiHtml = tom ? `<span class="tom">Ikke utfylt</span>` : esc(String(verdi));
      break;

    default:
      verdiHtml = tom
        ? `<span class="tom">Ikke utfylt</span>`
        : esc(typeof verdi === "object" ? JSON.stringify(verdi) : String(verdi));
  }

  // Bygg felt-blokk: label → bilder → verdi → kommentar → filer
  const bilder = (felt?.vedlegg ?? []).filter((v) => v.type === "bilde" || /\.(png|jpg|jpeg|gif|webp)$/i.test(v.filnavn));
  const filer = (felt?.vedlegg ?? []).filter((v) => !bilder.includes(v));
  const maksHoyde = config.maksbildeHoyde ?? 260;

  let html = `<div class="felt-blokk">`;
  html += `<div class="felt-label">${esc(label)}</div>`;

  // Bilder i 2-kolonners rutenett med nummerering
  if (bilder.length > 0) {
    html += `<div class="bilde-rutenett">`;
    bilder.forEach((b, idx) => {
      const src = fullBildeUrl(b.url, config.bildeBaseUrl);
      html += `<div class="bilde-kort">`;
      html += `<img src="${esc(src)}" class="bilde-img" style="max-height:${maksHoyde}px;" />`;
      html += `<div class="bilde-nr">${idx + 1}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // Verdi/tekst
  if (verdiHtml) {
    html += `<div class="felt-verdi">${verdiHtml}</div>`;
  }

  // Kommentar
  if (felt?.kommentar) {
    html += `<div class="kommentar">${esc(felt.kommentar)}</div>`;
  }

  // Fil-vedlegg
  if (filer.length > 0) {
    html += `<div class="vedlegg-teller">📎 ${filer.length} fil${filer.length > 1 ? "er" : ""}</div>`;
  }

  html += `</div>`;
  return html;
}

// ---------------------------------------------------------------------------
//  Render alle felter fra et objekt-tre
// ---------------------------------------------------------------------------

/**
 * Renderer hele objekt-treet til HTML-strenger.
 * Håndterer nesting (barn rendres rekursivt via repeater).
 */
export function renderAllefelter(
  objekter: TreObjekt[],
  feltVerdier: Record<string, FeltVerdi>,
  config: PdfConfig,
): string {
  let html = "";
  for (const objekt of objekter) {
    html += renderFelt(objekt, feltVerdier[objekt.id], config);
  }
  return html;
}
