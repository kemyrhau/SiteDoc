/**
 * Arkivmal — tegningsmarkør-rendering (D2, 2026-08-21).
 *
 * Arkiv-override for `drawing_position` (feltnivå) og dokument-lokasjon
 * (dokumentnivå). `felt.ts` er FROSSET (delt mobil-sti) og utelater begge
 * (`felt.ts:36` → `return ""`); overstyringen skjer her, etter samme mønster
 * som repeater-overriden. Begge GJENBRUKER `byggTegningPosisjon` (`tegning.ts`)
 * — aldri kopi av utsnitts-logikken. Tegningsbildet kommer inlinet som data-URI
 * via `config.tegningsOppslag` (api-sammenstillingen inliner; containeren er
 * nettverksfri — aldri en signert URL som kan utløpe under render).
 *
 * Merk: dokument-«lokasjon» er i datamodellen en TEGNINGSMARKØR
 * (`Checklist.drawingId`+`positionX`+`positionY`), ikke et kart/GPS-punkt —
 * derfor samme renderer og format (14:9) som feltnivå-utsnittet. Koordinat
 * skrives aldri ut (fabel 2026-08-21).
 */

import { byggTegningPosisjon } from "../tegning";
import { esc } from "../hjelpere";
import type { PdfConfig } from "../typer";

/** Feltverdien til et `drawing_position`-felt (`TegningPosisjonVerdi` i shared). */
interface TegningPosisjonVerdi {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  drawingName?: string | null;
}

/**
 * Markør-minimum: tegning + posisjon. Generisk så inn-typen bevares ved narrowing.
 *
 * BESLUTNING (Kenneth 2026-08-21): en tegning uten markør dokumenterer ingenting
 * → skrives IKKE ut, ALDRI, heller ikke når `drawingId` er satt men posisjonen
 * mangler (BEF-001: ukonvertert PDF-tegning, `position_x/y` = NULL). Derfor
 * kreves BÅDE `drawingId` OG `positionX/Y != null` — presiserer ordrens «uten
 * markering utelates seksjonen».
 */
type MarkorFelter = {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
};

/** Har verdien en komplett markør (tegning + posisjon)? */
function harMarkor<T extends MarkorFelter>(
  v: T | null | undefined,
): v is T & { drawingId: string; positionX: number; positionY: number } {
  return !!v && !!v.drawingId && v.positionX != null && v.positionY != null;
}

/**
 * Feltnivå `drawing_position` → oversikt + 4×-detalj via `byggTegningPosisjon`,
 * med tegningsnavn som blokk-tittel. Uten markør eller uten inlinet tegningsbilde
 * → `""` (seksjonen utelates helt — aldri tom tegningsblokk).
 */
export function byggArkivTegningsposisjon(
  verdi: unknown,
  oppslag: PdfConfig["tegningsOppslag"],
): string {
  const v = (verdi ?? null) as TegningPosisjonVerdi | null;
  if (!harMarkor(v)) return "";
  const t = oppslag?.[v.drawingId];
  if (!t?.dataUrl) return "";
  return byggTegningPosisjon({
    tegningBildeUrl: t.dataUrl,
    tegningNavn: v.drawingName ?? t.navn ?? undefined,
    positionX: v.positionX,
    positionY: v.positionY,
    imageWidth: t.imageWidth,
    imageHeight: t.imageHeight,
  });
}

/** Dokument-lokasjonens rå data (fra `Checklist`-raden + oppslag-metadata). */
export interface LokasjonsData {
  drawingId?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  /** Tekstlinje-deler under utsnittet (byggeplass · tegningsnavn). Falsy filtreres bort. */
  byggeplassNavn?: string | null;
  tegningNavn?: string | null;
}

/**
 * Dokumentnivå-lokasjon (D2, øverst side 1). Samme utsnitt-format som
 * feltnivå, men uten tegningsnavn som intern tittel — i stedet en tekstlinje
 * UNDER utsnittet (byggeplass · tegningsnavn). «Punkt satt av hvem/når»
 * utelates (feltet finnes ikke på raden; å utlede fra logg er upålitelig —
 * fabel 2026-08-21). Uten markør/bilde → `""` (aldri tom kartboks).
 */
export function byggLokasjonsblokk(
  data: LokasjonsData,
  oppslag: PdfConfig["tegningsOppslag"],
): string {
  if (!harMarkor(data)) return "";
  const t = oppslag?.[data.drawingId];
  if (!t?.dataUrl) return "";
  const posisjon = byggTegningPosisjon({
    tegningBildeUrl: t.dataUrl,
    positionX: data.positionX,
    positionY: data.positionY,
    imageWidth: t.imageWidth,
    imageHeight: t.imageHeight,
  });
  const metaDeler = [data.byggeplassNavn, data.tegningNavn ?? t.navn]
    .filter((s): s is string => !!s)
    .map(esc);
  const metaLinje = metaDeler.length
    ? `<div style="font-size:10px;color:#6b7280;margin-top:4px;">${metaDeler.join(" · ")}</div>`
    : "";
  return `<div class="ark-lokasjon"><div class="ark-lokasjon-tittel">Lokasjon</div>${posisjon}${metaLinje}</div>`;
}
