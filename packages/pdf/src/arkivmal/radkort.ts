/**
 * Arkivmal — repeater som RADKORT (mockup 2a, fabel-ratifisert 2026-08-21).
 *
 * En RIK repeater (minst ett rikt barnefelt: bilder/tegningsposisjon/nestet
 * repeater) skrives ikke som tabell (loddrette felt stokket vannrett underkjent
 * av Kenneth), men som radkort: én loddrett blokk per rad. Header = radnr i
 * sirkel + «{label} — rad N» + «markør N på tegningssiden» når raden har markør.
 * Felt i MALBYGGER-rekkefølge, ett per linje, full bredde, også tomme.
 *
 * Helskalar repeater beholder tabellform (`byggRepeaterTabell`, mockup 2b).
 * `felt.ts` frosset; ren HTML-streng.
 *
 * Designlås pkt 4 «bilder hos SITT felt»: bildeblokken rendres rett etter feltet
 * bildene henger på (avviker fra mockupens illustrative plassering i rad 2 — se
 * verifiseringslogg).
 */

import { esc, fullBildeUrl, formaterDatoTidPunkt } from "../hjelpere";
import { byggDetaljUtsnitt } from "../tegning";
import { skalarCelle, byggUtenforRaderBlokk } from "./repeater";
import type { TreObjekt, FeltVerdi, Vedlegg } from "../typer";

/** Detaljutsnittet i radkortet — «kun visuell lokasjon» (~40 mm, Kenneth). 4:3 → ~30 mm høyt. */
const RADKORT_UTSNITT_HOYDE = 113; // ~30 mm

interface MarkorVerdi {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  drawingName?: string | null;
  utsnittDataUrl?: string | null;
}

function harMarkorVerdi(v: unknown): v is MarkorVerdi & { drawingId: string; positionX: number; positionY: number } {
  const m = v as MarkorVerdi | null | undefined;
  return !!m && typeof m === "object" && typeof m.drawingId === "string" && m.positionX != null && m.positionY != null;
}

function prosent(n: number): string {
  return `${n.toLocaleString("nb-NO", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

/** Bilde-predikat (url + type/filnavn). */
function erBilde(v: unknown): v is Vedlegg {
  const b = v as Partial<Vedlegg> | undefined;
  return (
    !!b &&
    typeof b === "object" &&
    typeof b.url === "string" &&
    (b.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(b.filnavn ?? ""))
  );
}

/** En repeater er RIK når minst ett barnefelt er bilder/tegningsposisjon/nestet repeater. */
export function repeaterErRik(objekt: TreObjekt): boolean {
  return (objekt.children ?? []).some(
    (b) => b.type === "attachments" || b.type === "drawing_position" || b.type === "location" || b.type === "repeater",
  );
}

/** Bildeblokk: to og to i full bredde, sideforhold bevart, bildetekst under. */
function byggBildeblokk(vedlegg: Vedlegg[] | undefined): string {
  const bilder = Array.isArray(vedlegg) ? vedlegg.filter(erBilde) : [];
  if (bilder.length === 0) return "";
  const kort = bilder
    .map((b) => {
      const nr = b.bildeNr != null ? `Bilde ${b.bildeNr}` : "Bilde";
      const tid = b.opprettet ? ` · ${formaterDatoTidPunkt(b.opprettet)}` : "";
      const tekst = `${nr} — ${esc(b.filnavn ?? "")}${esc(tid)}`;
      return `<div class="ark-radkort-bilde"><img src="${esc(fullBildeUrl(b.url, ""))}" /><div class="ark-radkort-bildetekst">${tekst}</div></div>`;
    })
    .join("");
  // Egen klasse (ikke .ark-radkort-felt): bildeblokken KAN brytes mellom rekker
  // (Gate pkt 7), mens hvert enkeltbilde holdes samlet (.ark-radkort-bilde).
  return `<div class="ark-radkort-bildefelt"><div class="ark-radkort-label">Bilder</div><div class="ark-radkort-bilder">${kort}</div></div>`;
}

/** Ett felt i radkortet: label + verdi (per type), + ev. bildeblokk hos feltet. */
/**
 * Merknad (felt-kommentar) i radkort — ÉN kilde for regelen (funn #4, 2026-08-22).
 * Tidligere skrev bare `drawing_position`-grenen den ut; skalar-felt tapte kommentaren
 * (`radkort.ts:107-109`). Nå kaller alle relevante grener denne helperen: `drawing_position`
 * injiserer den inline på den DESIGNLÅSTE plassen (mockup 2a pkt 5: kursiv under koordinaten,
 * i tekstkolonnen ved siden av utsnittet), skalar-grenen appender den under verdien.
 */
function byggMerknad(felt: FeltVerdi | undefined): string {
  return felt?.kommentar?.trim()
    ? `<div class="ark-radkort-merknad">Merknad: ${esc(felt.kommentar)}</div>`
    : "";
}

function byggRadkortFelt(barn: TreObjekt, felt: FeltVerdi | undefined, dybde: number): string {
  const label = `<div class="ark-radkort-label">${esc(barn.label)}</div>`;
  let innhold: string;

  if (barn.type === "drawing_position" || barn.type === "location") {
    const m = felt?.verdi;
    if (!harMarkorVerdi(m)) {
      innhold = `<div class="felt-verdi"><span class="tom">Ikke utfylt</span></div>`;
    } else {
      const navn = m.drawingName ?? "Tegning";
      const koord = esc(`${navn} (${prosent(m.positionX)}, ${prosent(m.positionY)})`);
      // Låst plass (mockup 2a): merknaden står inne i posisjon-tekst-kolonnen, under koordinaten.
      const merknad = byggMerknad(felt);
      const utsnitt = m.utsnittDataUrl
        ? `<div class="ark-radkort-utsnitt">${byggDetaljUtsnitt({ url: m.utsnittDataUrl, x: 50, y: 50, hoydePx: RADKORT_UTSNITT_HOYDE, zoom: 1 })}</div>`
        : "";
      innhold = `<div class="ark-radkort-posisjon">${utsnitt}<div class="ark-radkort-posisjon-tekst"><div class="ark-celle-koord">${koord}</div>${merknad}</div></div>`;
    }
  } else if (barn.type === "repeater") {
    // Nestet repeater → rekursivt radkort m/ innrykk; tom → «Ingen rader».
    const rader = Array.isArray(felt?.verdi) ? (felt!.verdi as Record<string, FeltVerdi>[]) : [];
    innhold =
      rader.length === 0
        ? `<div class="felt-verdi"><span class="tom">Ingen rader</span></div>`
        : `<div class="ark-radkort-nested">${byggRadkortRader(barn, rader, dybde + 1)}</div>`;
  } else if (barn.type === "attachments") {
    innhold = ""; // bildene rendres av bildeblokken under
  } else {
    // Skalar/beregning/dato/status → label + verdi (delt med tabellformen) + ev. merknad.
    // Funn #4: skalar-grenen tapte kommentaren; nå appended via samme byggMerknad-kilde.
    innhold = `<div class="felt-verdi">${skalarCelle(barn, felt)}</div>${byggMerknad(felt)}`;
  }

  // Bilder som henger på DETTE feltet (per-felt vedlegg + attachments-verdi).
  const feltBilder = [
    ...(Array.isArray(felt?.vedlegg) ? felt!.vedlegg : []),
    ...(barn.type === "attachments" && Array.isArray(felt?.verdi) ? (felt!.verdi as Vedlegg[]) : []),
  ];
  const bildeblokk = byggBildeblokk(feltBilder);

  return `<div class="ark-radkort-felt">${label}${innhold}</div>${bildeblokk}`;
}

/** Radkortene for én repeater (uten seksjonshode — kalles av byggRadkort + nesting). */
function byggRadkortRader(objekt: TreObjekt, rader: Record<string, FeltVerdi>[], dybde: number): string {
  const barn = objekt.children ?? [];
  return rader
    .map((rad, idx) => {
      const radnr = idx + 1;
      const harMarkor = barn.some((b) => b.type === "drawing_position" && harMarkorVerdi(rad[b.id]?.verdi));
      const markorTekst = harMarkor
        ? `<span class="ark-radkort-markor">markør ${radnr} på tegningssiden</span>`
        : "";
      const header =
        `<div class="ark-radkort-header">` +
        `<span class="ark-radkort-nr">${radnr}</span>` +
        `<span class="ark-radkort-tittel">${esc(objekt.label)} — rad ${radnr}</span>` +
        markorTekst +
        `</div>`;
      const felter = barn.map((b) => byggRadkortFelt(b, rad[b.id] as FeltVerdi | undefined, dybde)).join("");
      return `<div class="ark-radkort">${header}<div class="ark-radkort-kropp">${felter}</div></div>`;
    })
    .join("");
}

/** Rik repeater som radkort (seksjonshode + ett kort per rad). Tom → «Ingen rader registrert». */
export function byggRadkort(objekt: TreObjekt, verdi: unknown, label: string, objektFelt?: FeltVerdi): string {
  const rader = Array.isArray(verdi) ? (verdi as Record<string, FeltVerdi>[]) : [];
  const heading = `<div class="ark-seksjon">${esc(label)}</div>`;
  // F7: objektnivå-blokk «Registrert utenfor rader» rett over kortene (tom → "").
  const blokk = byggUtenforRaderBlokk(objektFelt, 1);
  if (rader.length === 0) {
    return `${heading}${blokk.html}<div class="felt-verdi"><span class="tom">Ingen rader registrert</span></div>`;
  }
  return `${heading}${blokk.html}${byggRadkortRader(objekt, rader, 0)}`;
}
