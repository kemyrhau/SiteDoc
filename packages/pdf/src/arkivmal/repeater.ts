/**
 * Arkivmal — repeater som TABELL (Stage 2, styling-gate 2026-08-13).
 *
 * En repeater ER rader med kolonner; i et byggherre-dokument skal tjue
 * kontrollpunkter være skannbare (les nedover en kolonne for avvikene), ikke en
 * vegg av div-blokker. Kolonnene kommer fra repeaterens EGEN barn-definisjon —
 * ingen antakelse om at den heter «Kontrollpunkt».
 *
 * Overstyrer i arkivmalens vei — `felt.ts`' repeater-case er frosset (mobil-sti
 * til EAS-adopsjon). Cellverdiene gjenbruker de delte primitivene
 * (esc/formatering/TRAFIKKLYS), så ingen logikk dupliseres — kun tabell-formen
 * er arkiv-lokal. Tom repeater → «Ingen rader registrert» (skjules aldri).
 */

import { esc, normaliserOpsjon, formaterDato, formaterDatoTid } from "../hjelpere";
import { TRAFIKKLYS } from "../konstanter";
import { ARKIV_FARGER } from "./arkiv-css";
import type { TreObjekt, FeltVerdi } from "../typer";

const TOM = `<span class="tom">Ikke utfylt</span>`;

/** Kompakt cellverdi for én kolonne (repeater-barn). Gjenbruker delte primitiver. */
function cellVerdi(objekt: TreObjekt, felt: FeltVerdi | undefined): string {
  const verdi = felt?.verdi;
  const tom = verdi === null || verdi === undefined || verdi === "";

  switch (objekt.type) {
    case "list_single": {
      const opsjoner = ((objekt.config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgt = typeof verdi === "string" ? opsjoner.find((o) => o.value === verdi)?.label ?? verdi : null;
      return valgt ? esc(valgt) : TOM;
    }
    case "list_multi": {
      const opsjoner = ((objekt.config.options as unknown[]) ?? []).map(normaliserOpsjon);
      const valgte = Array.isArray(verdi)
        ? (verdi as string[]).map((v) => opsjoner.find((o) => o.value === v)?.label ?? v)
        : [];
      return valgte.length > 0 ? esc(valgte.join(", ")) : TOM;
    }
    case "traffic_light": {
      const tl = typeof verdi === "string" ? TRAFIKKLYS[verdi] : null;
      if (!tl) return TOM;
      return `<span style="color:${tl.farge};font-weight:600">${esc(tl.label)}</span>`;
    }
    case "integer":
    case "decimal":
    case "calculation": {
      const enhet = (objekt.config.enhet as string) ?? (objekt.config.unit as string) ?? "";
      return tom ? TOM : esc(`${verdi}${enhet ? ` ${enhet}` : ""}`);
    }
    case "date":
      return tom ? TOM : esc(formaterDato(verdi));
    case "date_time":
      return tom ? TOM : esc(formaterDatoTid(verdi));
    case "persons":
      return Array.isArray(verdi) && verdi.length > 0 ? esc((verdi as string[]).join(", ")) : TOM;
    default:
      // text_field, person, company, bim/zone/room_property, m.fl.
      return tom ? TOM : esc(typeof verdi === "object" ? JSON.stringify(verdi) : String(verdi));
  }
}

/**
 * Rendrer en repeater som tabell: «#» + én kolonne per barn (barnets label som
 * kolonneoverskrift), én rad per registrert element. Rad-kommentar (felt-nivå)
 * vises under raden når den finnes.
 */
export function byggRepeaterTabell(
  objekt: TreObjekt,
  verdi: unknown,
  label: string,
): string {
  const barn = objekt.children ?? [];
  const rader = Array.isArray(verdi) ? (verdi as Record<string, FeltVerdi>[]) : [];

  const heading = `<div class="ark-seksjon">${esc(label)}</div>`;

  if (rader.length === 0) {
    return `${heading}<div class="felt-verdi"><span class="tom">Ingen rader registrert</span></div>`;
  }

  const kolonner = barn.map((b) => `<th>${esc(b.label)}</th>`).join("");
  const kropp = rader
    .map((rad, idx) => {
      const celler = barn
        .map((b) => `<td>${cellVerdi(b, rad[b.id] as FeltVerdi | undefined)}</td>`)
        .join("");
      return `<tr><td class="ark-rad-nr">${idx + 1}</td>${celler}</tr>`;
    })
    .join("");

  return `
${heading}
<table class="ark-repeater">
  <thead><tr><th class="ark-rad-nr" style="color:${ARKIV_FARGER.navy}">#</th>${kolonner}</tr></thead>
  <tbody>${kropp}</tbody>
</table>`.trim();
}
