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
import type { TreObjekt, FeltVerdi, Vedlegg } from "../typer";

const TOM = `<span class="tom">Ikke utfylt</span>`;

/** Bilde-predikat — speiler `ER_BILDE` i sammenstilling.ts (url + type/filnavn). */
function erBilde(v: unknown): v is Vedlegg {
  const b = v as Partial<Vedlegg>;
  return (
    !!b &&
    typeof b === "object" &&
    typeof b.url === "string" &&
    (b.type === "bilde" || /\.(png|jpe?g|gif|webp)$/i.test(b.filnavn ?? ""))
  );
}

/**
 * Radens bilder i FORUTSIGBAR rekkefølge: kolonnerekkefølge (barn-def), og
 * innenfor en celle rekkefølgen de ligger i dataene (`vedlegg` før `verdi`).
 * Bildene er alt inlinet til data-URI av sammenstillingen når dette kjører.
 * Dedup på url (samme bilde kan ligge både i `vedlegg` og `verdi`).
 */
function bilderIRad(barn: TreObjekt[], rad: Record<string, FeltVerdi>): Vedlegg[] {
  const ut: Vedlegg[] = [];
  const sett = new Set<string>();
  const leggTil = (v: unknown): void => {
    if (erBilde(v) && !sett.has(v.url)) {
      sett.add(v.url);
      ut.push(v);
    }
  };
  for (const b of barn) {
    const felt = rad[b.id] as FeltVerdi | undefined;
    if (!felt) continue;
    if (Array.isArray(felt.vedlegg)) felt.vedlegg.forEach(leggTil);
    if (Array.isArray(felt.verdi)) (felt.verdi as unknown[]).forEach(leggTil);
  }
  return ut;
}

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
    case "attachments": {
      // Bildene rendres samlet UNDER tabellen (byggBildeSamling). Cellen viser
      // kun en kort filnavn-referanse — ALDRI det inlinede bilde-arrayet (ellers
      // dumpes hele data-URI-base64 inn i cellen).
      const filer = Array.isArray(verdi)
        ? (verdi as unknown[]).filter(
            (v): v is Vedlegg =>
              !!v && typeof v === "object" && typeof (v as Vedlegg).filnavn === "string",
          )
        : [];
      return filer.length > 0 ? esc(filer.map((f) => f.filnavn).join(", ")) : TOM;
    }
    default: {
      // text_field, person, company, bim/zone/room_property, m.fl.
      if (tom) return TOM;
      // Vakt: en verdi-array kan bære inlinede bilde-objekter (data-URI). Vis
      // filnavn/antall, aldri JSON-dump (ville lagt megabyte base64 i cellen).
      if (Array.isArray(verdi)) {
        const navn = (verdi as unknown[])
          .map((v) => (v && typeof v === "object" && "filnavn" in v ? String((v as Vedlegg).filnavn) : null))
          .filter((n): n is string => !!n);
        return navn.length > 0 ? esc(navn.join(", ")) : esc(`${(verdi as unknown[]).length} element(er)`);
      }
      return esc(typeof verdi === "object" ? JSON.stringify(verdi) : String(verdi));
    }
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

  const tabell = `
${heading}
<table class="ark-repeater">
  <thead><tr><th class="ark-rad-nr" style="color:${ARKIV_FARGER.navy}">#</th>${kolonner}</tr></thead>
  <tbody>${kropp}</tbody>
</table>`.trim();

  return tabell + byggBildeSamling(barn, rader);
}

/**
 * Bilder fra repeater-radene, samlet UNDER tabellen (mockup: ikke thumbnails i
 * celler). Hvert bilde merkes «Bilde — punkt {radnr} ({filnavn})» — radnummeret
 * er koblingen tilbake til tabellraden. Rekkefølge = radrekkefølge, så innenfor
 * raden. Ett kort holdes samlet ved sideskift (`break-inside:avoid` i CSS);
 * samlingen flyter over sider. Ingen bilder → ingen blokk (ikke «tomt» spor).
 */
function byggBildeSamling(barn: TreObjekt[], rader: Record<string, FeltVerdi>[]): string {
  const kort: string[] = [];
  rader.forEach((rad, idx) => {
    for (const bilde of bilderIRad(barn, rad)) {
      const filnavn = bilde.filnavn ? ` (${esc(bilde.filnavn)})` : "";
      kort.push(
        `<div class="ark-bilde-kort">` +
          `<div class="ark-bilde-merke">Bilde — punkt ${idx + 1}${filnavn}</div>` +
          `<img class="bilde-img" src="${esc(bilde.url)}" alt="">` +
          `</div>`,
      );
    }
  });
  return kort.length > 0 ? `<div class="ark-bilde-samling">${kort.join("")}</div>` : "";
}
