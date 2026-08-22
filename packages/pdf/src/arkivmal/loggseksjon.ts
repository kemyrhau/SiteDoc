/**
 * Arkivmal — loggseksjon (Stage 3). To seksjoner mot omtegnet mockup (c4a62ab4):
 *
 *  1. Dokumenthistorikk (lag 1, ALLTID): DocumentTransfer + TaskComment, kronologisk.
 *     Hver rad: tidspunkt · hvem (+rolle) · handling (semantisk farge) + kommentar
 *     + kryssreferanse-hale «(N feltendringer — se Endringslogg)».
 *  2. Endringslogg (lag 2, når enableChangeLog): feltdiff GRUPPERT per økt
 *     (person · dag), «— N feltendringer i M økter» i overskriften.
 *
 * Plasseres ETTER innhold, FØR signaturblokk. Datalaget (`ArkivLogg`) leverer
 * alt strukturen; dette laget former den mot pikslene.
 */

import { esc, formaterDatoTidPunkt } from "../hjelpere";
import { ARKIV_FARGER } from "./arkiv-css";
import { formaterAktorRolle } from "./rolleEtikett";
import type { ArkivLogg, HendelseRad } from "./typer";

// D4-revisjon (2026-08-22): `segmentHtml` + `datoKort` fjernet — de var kun i endringslogg-
// rendreren, som utgår (endringsloggen skrives aldri i PDF). Ord-diff-segmentene bygges
// fortsatt i api-en for web-UI-verktøyet; kun PDF-rendringen er borte.

/** Semantisk farge på en handling (gjenbruker arkiv-paletten). */
function handlingFarge(handling: string): string | null {
  if (/godkjent|ferdig/i.test(handling)) return ARKIV_FARGER.gronn;
  if (/avvist|returnert/i.test(handling)) return ARKIV_FARGER.rod;
  return null;
}

function hale(n: number): string {
  if (n <= 0) return ""; // 0 → ingen hale (ikke «0 feltendringer»)
  const ord = n === 1 ? "feltendring" : "feltendringer";
  // D4-revisjon (Kenneth-vedtak 2026-08-22): behold tallet, FJERN «— se Endringslogg».
  // Endringsloggen skrives aldri i PDF nå, så henvisningen ville pekt på en seksjon som
  // ikke finnes. Tallet står — det sier at noe ble endret før sending.
  return ` <span class="ark-svak">(${n} ${ord})</span>`;
}

function dokumenthistorikk(hendelser: HendelseRad[]): string {
  if (hendelser.length === 0) return "";
  const rader = hendelser
    .map((h) => {
      // STEG 1: normaliser rå senderRolle (fire former: kjent enum → etikett · posisjonsetikett
      // → rått · ukjent → rått · tom/null → BLANK). Blank ⇒ HELE parentesen utelates — «()» i
      // hver tredje null-rad er støy (Kenneth-presisering 2026-08-20).
      const rolleTekst = formaterAktorRolle(h.aktorRolle);
      const rolle = rolleTekst
        ? ` <span class="ark-svak">(${esc(rolleTekst)})</span>`
        : "";
      const farge = handlingFarge(h.handling);
      const handling = farge
        ? `<span style="color:${farge};font-weight:600">${esc(h.handling)}</span>`
        : esc(h.handling);
      const kommentar = h.kommentar ? ` — «${esc(h.kommentar)}»` : "";
      return `<tr><td class="ark-logg-tid">${esc(formaterDatoTidPunkt(h.tidspunkt))}</td><td>${esc(h.aktor)}${rolle}</td><td>${handling}${kommentar}${hale(h.antallFeltendringer)}</td></tr>`;
    })
    .join("");
  return `<div class="ark-seksjon">Dokumenthistorikk</div><table class="ark-logg"><tbody>${rader}</tbody></table>`;
}

// D4-revisjon (2026-08-22): `endringslogg`-rendreren er FJERNET — endringsloggen skrives aldri
// i PDF (Kenneth-vedtak). Selve endringslogg-DATAEN (ArkivLogg.økter) bygges fortsatt av
// api-en (byggArkivLogg) og brukes av web-UI-verktøyet; kun PDF-seksjonen utgår.

/**
 * Loggseksjon for sjekkliste/oppgave/HMS: KUN Dokumenthistorikk (flytsporet — fra hvem til
 * hvem, med tilhørende kommentar). D4-revisjon (Kenneth-vedtak 2026-08-22): **endringsloggen
 * skrives ALDRI i PDF** — den er et UI-verktøy for å undersøke hva som skjedde i utfyllingen
 * ved konflikt, ikke dokumentasjonsverdi. Dokumenthistorikken skrives ALLTID (den ER en del av
 * dokumentet — ingen «uten historikk»-variant, heller ikke for eksterne mottakere). Dermed
 * finnes bare én PDF-variant og «Med logg / Uten logg»-valget bortfaller.
 */
export function byggLoggseksjon(logg: ArkivLogg): string {
  return dokumenthistorikk(logg.hendelser ?? []);
}

/**
 * Utvetydig, S/H-lesbar merknad om vedlegg som IKKE kom med (cowork-vedtak (c)):
 * et arkivdokument skal aldri kunne leses som komplett når det ikke er det.
 * Rendres i selve dokumentet; api-/container-laget registrerer hvilke som feilet.
 */
export function byggMangelMerknad(manglendeVedlegg: string[]): string {
  if (manglendeVedlegg.length === 0) return "";
  const liste = manglendeVedlegg.map((f) => esc(f)).join(", ");
  return `<div class="ark-mangel">⚠ MANGLENDE VEDLEGG — kunne ikke lastes ved generering: ${liste}. Dette dokumentet er derfor ikke komplett.</div>`;
}
