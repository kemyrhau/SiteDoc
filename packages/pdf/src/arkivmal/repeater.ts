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

import { esc, normaliserOpsjon, formaterDato, formaterDatoTid, formaterDatoTidPunkt } from "../hjelpere";
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
      // Bildene rendres i full bredde rett under raden (byggBilderader), hvert
      // med egen merking (filnavn + tid). Cellen gjentar IKKE filnavn — det ville
      // vært en overflødig kryssreferanse (vedtak 2026-08-15). Kun et diskret
      // antall, og ALDRI det inlinede bilde-arrayet (ingen data-URI-base64).
      const filer = Array.isArray(verdi)
        ? (verdi as unknown[]).filter(
            (v): v is Vedlegg =>
              !!v && typeof v === "object" && typeof (v as Vedlegg).filnavn === "string",
          )
        : [];
      return filer.length > 0 ? esc(`${filer.length} vedlegg`) : TOM;
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

/** Bilder per rekke i bilde-gridet (1fr 1fr → 2 stående per rekke). */
const BILDER_PER_REKKE = 2;

/**
 * Rendrer en repeater som tabell: «#» + én kolonne per barn (barnets label som
 * kolonneoverskrift), én rad per registrert element. Radens bilder rendres i
 * full spaltebredde rett under sin egen rad (vedtak 2026-08-15), ikke samlet
 * etter tabellen.
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
  // «#» + én kolonne per barn — bildecellen spenner hele bredden.
  const kolonnespenn = 1 + barn.length;
  // Løpenummer starter på 01 og fortsetter gjennom hele repeateren (= dokumentet;
  // starter på nytt per dokument, aldri videreført på tvers).
  let bildeNr = 1;
  const kropp = rader
    .map((rad, idx) => {
      const celler = barn
        .map((b) => `<td>${cellVerdi(b, rad[b.id] as FeltVerdi | undefined)}</td>`)
        .join("");
      const datarad = `<tr><td class="ark-rad-nr">${idx + 1}</td>${celler}</tr>`;
      const { html, nesteNr } = byggBilderader(bilderIRad(barn, rad), bildeNr, kolonnespenn);
      bildeNr = nesteNr;
      return datarad + html;
    })
    .join("");

  return `
${heading}
<table class="ark-repeater">
  <thead><tr><th class="ark-rad-nr" style="color:${ARKIV_FARGER.navy}">#</th>${kolonner}</tr></thead>
  <tbody>${kropp}</tbody>
</table>`.trim();
}

/**
 * Bilderad(er) for én tabellrad: bildene i full spaltebredde rett under raden,
 * i et 1fr 1fr-grid (2 stående per rekke; siste alene → venstre kolonne, som
 * mockupen). Hver rekke er sin EGEN `<tr>` slik at blokken kan BRYTE mellom
 * rekker ved sideskift — store rader flyter over til neste side mens teksten
 * blir stående med de første (plassutnyttelses-funnet: ingen `break-inside:
 * avoid` som holder hele blokken samlet). Merking under hvert bilde: løpenr +
 * filnavn + tidsstempel, i liten tekst (arkivsporbarhet) — ingen «punkt N»-
 * kryssreferanse (bildet står ved raden sin). Ingen bilder → ingen rad.
 */
function byggBilderader(
  bilder: Vedlegg[],
  startNr: number,
  kolonnespenn: number,
): { html: string; nesteNr: number } {
  if (bilder.length === 0) return { html: "", nesteNr: startNr };

  let nr = startNr;
  const celler = bilder.map((b) => {
    const nummer = String(nr++).padStart(2, "0");
    let merke = `Bilde ${nummer}`;
    if (b.filnavn) merke += ` — ${esc(b.filnavn)}`;
    if (b.opprettet) merke += ` · ${esc(formaterDatoTidPunkt(b.opprettet))}`;
    return (
      `<div class="ark-bilde">` +
        `<img class="ark-bilde-img" src="${esc(b.url)}" alt="">` +
        `<div class="ark-bilde-tekst">${merke}</div>` +
        `</div>`
    );
  });

  const rekker: string[] = [];
  for (let i = 0; i < celler.length; i += BILDER_PER_REKKE) {
    rekker.push(
      `<tr class="ark-bilde-rad"><td class="ark-bilde-celle" colspan="${kolonnespenn}">` +
        `<div class="ark-bilde-grid">${celler.slice(i, i + BILDER_PER_REKKE).join("")}</div>` +
        `</td></tr>`,
    );
  }
  return { html: rekker.join(""), nesteNr: nr };
}
