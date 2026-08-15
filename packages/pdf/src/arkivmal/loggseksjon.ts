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
import type { ArkivLogg, HendelseRad } from "./typer";

/** HH:MM fra ISO-tidsstempel. */
function klokke(iso: string): string {
  return iso.length >= 16 ? iso.slice(11, 16) : "";
}

/** «2026-08-05» → «05.08.2026» (ren streng — unngår tidssone-skift på dato-økter). */
function datoKort(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}.${m}.${y}` : ymd;
}

/** Semantisk farge på en handling (gjenbruker arkiv-paletten). */
function handlingFarge(handling: string): string | null {
  if (/godkjent|ferdig/i.test(handling)) return ARKIV_FARGER.gronn;
  if (/avvist|returnert/i.test(handling)) return ARKIV_FARGER.rod;
  return null;
}

function hale(n: number): string {
  if (n <= 0) return ""; // 0 → ingen hale (ikke «0 feltendringer»)
  const ord = n === 1 ? "feltendring" : "feltendringer";
  return ` <span class="ark-svak">(${n} ${ord} — se Endringslogg)</span>`;
}

function dokumenthistorikk(hendelser: HendelseRad[]): string {
  if (hendelser.length === 0) return "";
  const rader = hendelser
    .map((h) => {
      const rolle = h.aktorRolle ? ` <span class="ark-svak">(${esc(h.aktorRolle)})</span>` : "";
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

function endringslogg(logg: ArkivLogg): string {
  const økter = logg.økter ?? [];
  // Lag 2 utelates i stillhet når av (lag 1 dekker sporbarhetsminimumet).
  if (!logg.endringsloggAktivert || økter.length === 0) return "";

  const total = økter.reduce((s, ø) => s + ø.rader.length, 0);
  const øktOrd = økter.length === 1 ? "økt" : "økter";
  const note = `<span class="ark-seksjon-note">— ${total} feltendring${total === 1 ? "" : "er"} i ${økter.length} ${øktOrd}</span>`;

  const kropp = økter
    .map((ø) => {
      const n = ø.rader.length;
      const hdr = `<tr><td colspan="3" class="ark-okt">${esc(ø.aktor)} · ${esc(datoKort(ø.dato))} <span class="ark-seksjon-note">— ${n} feltendring${n === 1 ? "" : "er"}</span></td></tr>`;
      const rows = ø.rader
        .map((r) => {
          const fra = `<span class="ark-svak">${r.fraVerdi ? esc(r.fraVerdi) : "Ikke utfylt"}</span>`;
          const til = r.tilVerdi ? esc(r.tilVerdi) : `<span class="ark-svak">Ikke utfylt</span>`;
          return `<tr><td class="ark-logg-tid">${esc(klokke(r.tidspunkt))}</td><td>${esc(r.felt)}</td><td>${fra} → ${til}</td></tr>`;
        })
        .join("");
      return hdr + rows;
    })
    .join("");

  return `<div class="ark-seksjon">Endringslogg ${note}</div><table class="ark-logg"><tbody>${kropp}</tbody></table>`;
}

/**
 * Full loggseksjon for sjekkliste/oppgave/HMS: Dokumenthistorikk (lag 1, ALLTID
 * — sporbarhetsminimum) + Endringslogg (lag 2, økt-gruppert).
 *
 * `taMedEndringslogg` (krav #2, vedtak «logg alltid på, velges ved utskrift»):
 * default true; false utelater lag 2 ved DENNE utskriften — men lag 1 kan aldri
 * velges bort. Kontrollplan «Punkt-historikk» og timer/utlegg «Revisjoner»
 * bygges i det egne datakilde-steget.
 */
export function byggLoggseksjon(logg: ArkivLogg, taMedEndringslogg = true): string {
  const lag2 = taMedEndringslogg ? endringslogg(logg) : "";
  return dokumenthistorikk(logg.hendelser ?? []) + lag2;
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
