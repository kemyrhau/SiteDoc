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

import { esc, normaliserOpsjon, formaterDato, formaterDatoTid, bildeOpptakTid } from "../hjelpere";
import { TRAFIKKLYS } from "../konstanter";
import { ARKIV_FARGER } from "./arkiv-css";
import { normaliserRad } from "../typer";
import type { TreObjekt, FeltVerdi, Vedlegg, Rad } from "../typer";

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
function bilderIRad(barn: TreObjekt[], rad: Rad): Vedlegg[] {
  const ut: Vedlegg[] = [];
  const sett = new Set<string>();
  const leggTil = (v: unknown): void => {
    if (erBilde(v) && !sett.has(v.url)) {
      sett.add(v.url);
      ut.push(v);
    }
  };
  for (const b of barn) {
    const felt = rad.felter[b.id] as FeltVerdi | undefined;
    if (!felt) continue;
    if (Array.isArray(felt.vedlegg)) felt.vedlegg.forEach(leggTil);
    if (Array.isArray(felt.verdi)) (felt.verdi as unknown[]).forEach(leggTil);
  }
  return ut;
}

/**
 * Kompakt skalar-cellverdi for én kolonne (repeater-barn): label-fritt, kun verdien.
 * Delt med radkort-formen (radkort.ts) for skalar/beregning/dato/status-felt.
 * Håndterer IKKE drawing_position (radkort eier den) — den grenen er fjernet.
 */
export function skalarCelle(objekt: TreObjekt, felt: FeltVerdi | undefined): string {
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
    // Merk: `drawing_position`/`location` har INGEN case her lenger. En repeater
    // med tegningsposisjon er per definisjon RIK → rendres som radkort (radkort.ts),
    // aldri som tabell. Grenen ble uNÅBAR og er fjernet (Kenneth 2026-08-21) for å
    // unngå død kode. Helskalar repeater (denne tabellformen) har aldri drawing_position.
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
/** F7-merkelinje. Guillemeter «Legg til rad» + intet punktum = fasit-PNG-en
 * (mockup-f7-objektniva-vedtatt.png); PNG går foran ordreteksten ved motstrid,
 * og guillemeter er prosjektets sitat-standard (A3-kvittering 2026-08-22). */
const F7_MERKE = "Registrert utenfor rader — kommentar og vedlegg festet direkte på skjemaet, uten «Legg til rad»";

/**
 * F7 (D1, ordre-arkivmal-f7-objektniva 2026-08-21): innhold festet på repeater-OBJEKTET
 * (kommentar/vedlegg uten «Legg til rad») rendres som egen merket blokk «Registrert utenfor
 * rader» rett OVER tabellen/kortene. Aldri som «rad 0», aldri utelatt — gjelder også når
 * repeateren HAR rader. Objektnivå-bildene står FØRST på siden, så de nummereres FØR
 * radbildene: blokken forbruker bildeNr-telleren først og returnerer `nesteNr` til radene
 * (`b.bildeNr` fra appen har forrang, som ellers). Bilder: 2/rekke, løpenr + tid — samme
 * primitiver som radbildene; ikke-bilde-vedlegg → filteller (aldri base64/JSON-dump).
 * Delt av tabell (repeater.ts) og radkort (radkort.ts).
 */
export function byggUtenforRaderBlokk(
  objektFelt: FeltVerdi | undefined,
  startNr: number,
): { html: string; nesteNr: number } {
  const kommentar = objektFelt?.kommentar?.trim() ?? "";
  const alle = Array.isArray(objektFelt?.vedlegg) ? (objektFelt!.vedlegg as Vedlegg[]) : [];
  const bilder = alle.filter(erBilde);
  const antallIkkeBilder = alle.length - bilder.length;
  if (!kommentar && bilder.length === 0 && antallIkkeBilder === 0) {
    return { html: "", nesteNr: startNr };
  }
  let nr = startNr;
  const celler = bilder.map((b) => {
    const visNr = b.bildeNr ?? nr;
    nr += 1;
    let merke = `Bilde ${String(visNr).padStart(2, "0")}`;
    const tidTekst = bildeOpptakTid(b);
    if (tidTekst) merke += ` · ${esc(tidTekst)}`;
    // A4-kvittering (2026-08-22): IKKE tvungen 4:3-ramme. `.ark-bilde-img` er den DELTE
    // radbilde-primitiven (object-fit:contain, bildeforhold ALLTID bevart, aldri oppskalert
    // — fabels radkort-designlås). Fasitens «Bilde 4:3 (mobilformat)» er en plassholder-
    // etikett, ikke et rammekrav. Ikke «rett» dette til fast 4:3 — det ville brutt designlåsen.
    // A2 (2026-08-22): fasitens «· med tegningsmarkering — se tegningsseksjon» er IKKE med her.
    // Målt: `Vedlegg` (type "bilde"|"fil") har intet markør-felt, «Tegning»-knappen lagrer et
    // vanlig type:"bilde"-screenshot, og markøren er alltid en egen drawing_position-feltverdi —
    // aldri koblet til et bestemt bilde. Suffikset mangler datagrunnlag → fabels sak, ikke bygg.
    return `<div class="ark-bilde"><img class="ark-bilde-img" src="${esc(b.url)}" alt=""><div class="ark-bilde-tekst">${merke}</div></div>`;
  });
  const grid = celler.length ? `<div class="ark-bilde-grid">${celler.join("")}</div>` : "";
  // A1-kvittering (2026-08-22): kommentar i guillemeter «…» = fasit-PNG-en («Testbilde»).
  const kommentarHtml = kommentar ? `<div class="kommentar">«${esc(kommentar)}»</div>` : "";
  const filteller = antallIkkeBilder > 0
    ? `<div class="vedlegg-teller">${antallIkkeBilder} vedlegg uten forhåndsvisning</div>`
    : "";
  const html = `<div class="ark-utenfor-rader"><div class="ark-utenfor-merke">${F7_MERKE}</div>${kommentarHtml}${grid}${filteller}</div>`;
  return { html, nesteNr: nr };
}

export function byggRepeaterTabell(
  objekt: TreObjekt,
  verdi: unknown,
  label: string,
  objektFelt?: FeltVerdi,
): string {
  const barn = objekt.children ?? [];
  // Rad-id (2026-08-22): normaliser gammel/ny radform ved lesing → { _radId, felter }.
  const rader = Array.isArray(verdi) ? (verdi as unknown[]).map(normaliserRad) : [];

  const heading = `<div class="ark-seksjon">${esc(label)}</div>`;
  // F7: objektnivå-blokk FØRST (forbruker bildeNr før radene). Tom blokk → "".
  const blokk = byggUtenforRaderBlokk(objektFelt, 1);

  if (rader.length === 0) {
    // Case (a): objektnivå-innhold + 0 rader → blokk + «Ingen rader registrert».
    return `${heading}${blokk.html}<div class="felt-verdi"><span class="tom">Ingen rader registrert</span></div>`;
  }

  const kolonner = barn.map((b) => `<th>${esc(b.label)}</th>`).join("");
  // «#» + én kolonne per barn — bildecellen spenner hele bredden.
  const kolonnespenn = 1 + barn.length;
  // Løpenummer fortsetter FRA objektnivå-blokken (F7: objektbilder først på siden).
  let bildeNr = blokk.nesteNr;
  const kropp = rader
    .map((rad, idx) => {
      const celler = barn
        .map((b) => {
          const felt = rad.felter[b.id] as FeltVerdi | undefined;
          // Funn (Kenneth 2026-08-21): celle-kommentar ble aldri skrevet ut
          // (felt.ts:217 gjør det for topp-nivå-felt, men repeater-cella droppet
          // den). Samme visuelle form (.kommentar); ingen tom node uten kommentar.
          const kommentar = felt?.kommentar?.trim()
            ? `<div class="kommentar">${esc(felt.kommentar)}</div>`
            : "";
          return `<td>${skalarCelle(b, felt)}${kommentar}</td>`;
        })
        .join("");
      const datarad = `<tr><td class="ark-rad-nr">${idx + 1}</td>${celler}</tr>`;
      const { html, nesteNr } = byggBilderader(bilderIRad(barn, rad), bildeNr, kolonnespenn);
      bildeNr = nesteNr;
      return datarad + html;
    })
    .join("");

  // Case (b): objektnivå-blokk rett OVER tabellen (tom blokk → "").
  return `
${heading}
${blokk.html}
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
 * tidsstempel, i liten tekst (vedtak 2026-08-16: filnavnet er internt og utgår).
 * Nummeret leses fra `bildeNr` (tildelt i appen ved opptak); mangler det, faller
 * vi tilbake til dokumentrekkefølge (`startNr`+). Ingen bilder → ingen rad.
 */
function byggBilderader(
  bilder: Vedlegg[],
  startNr: number,
  kolonnespenn: number,
): { html: string; nesteNr: number } {
  if (bilder.length === 0) return { html: "", nesteNr: startNr };

  let nr = startNr;
  const celler = bilder.map((b) => {
    // Lagret bildeNr fra appen har forrang; ellers dokumentrekkefølge (fallback).
    const visNr = b.bildeNr ?? nr;
    nr += 1;
    let merke = `Bilde ${String(visNr).padStart(2, "0")}`;
    const tidTekst = bildeOpptakTid(b);
    if (tidTekst) merke += ` · ${esc(tidTekst)}`;
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
