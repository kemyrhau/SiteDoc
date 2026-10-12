/**
 * Dempet strekskalering for DWG/DXF-visning (ezdxf-SVG).
 *
 * RETUR 1 TILLEGG C1 (Kenneth + orkestrator 2026-10-11): streken skal verken være
 * KONSTANT på skjermen (tynn og tom når man zoomer inn) eller følge tegningen FULLT
 * (grå langt ute, bjelker innzoomet). Den skal vokse LANGSOMMERE enn tegningen:
 *
 *     skjermbredde(px) = lw_px × zoom^k   — klemt til [minPx, maksPx × lw-faktor]
 *
 * SVG-strek i viewBox-enheter skaleres allerede med `zoom` av viseren (bredden er
 * `zoom × 100 %`), så multiplikatoren på `--lw` blir `zoom^(k−1)`. Viseren setter
 * `--strek-skala` i JS pr. zoom-endring — IKKE CSS `pow()`, som WebView-støtten for
 * varierer. CSS-regelen er `stroke-width: calc(var(--lw) * var(--strek-skala))` med klem.
 *
 * Konstantene bor HER (én fil) så Kenneth kan justere `k`/gulv/tak etter test uten å
 * røre to kodebaser. Samme mekanisme brukes på web (`tegninger/page.tsx`) og på mobil
 * (`TegningsVisning`, inline SVG i WebView — C2).
 */
export const STREK_SKALERING = {
  /** Dempings-eksponent. 1 = streken følger tegningen fullt, 0 = konstant på skjerm. */
  k: 0.5,
  /** Gulv på skjermbredde (px) — tynnest synlige strek uansett utzooming. */
  minPx: 0.5,
  /** Tak på skjermbredde (px) PER lw-faktor — tykkest strek ved full innzoom. */
  maksPx: 4,
} as const;

export interface StrekVars {
  /** Multiplikator på `--lw` (viewBox-enheter): `zoom^(k−1)`. */
  strekSkala: number;
  /** Gulv i viewBox-enheter (= `minPx / displayScale`). */
  strekMin: number;
  /** Tak-koeffisient: `tak_vb = var(--lw) × strekMaksK` (= `maksPx / (lwBase × displayScale)`). */
  strekMaksK: number;
}

/**
 * CSS-variablene viseren setter pr. zoom for dempet strekskalering.
 *
 * @param zoom         gjeldende zoom-faktor (1 = standard).
 * @param displayScale rendret SVG-bredde (px) / viewBox-bredde (vb-enheter).
 * @param lwBase       tynneste strek i SVG-en (fra `data-lw-base`) — gir lw-faktor = lw/lwBase.
 */
export function beregnStrekVars(zoom: number, displayScale: number, lwBase: number): StrekVars {
  const { k, minPx, maksPx } = STREK_SKALERING;
  const d = displayScale > 0 ? displayScale : 1;
  const b = lwBase > 0 ? lwBase : 1;
  return {
    strekSkala: Math.pow(Math.max(zoom, 1e-6), k - 1),
    strekMin: minPx / d,
    strekMaksK: maksPx / (b * d),
  };
}

/**
 * Sann når SVG-en bærer C1-formatet (dempet strekskalering): `data-lw-base` på rot-
 * `<svg>` + per-strek `--lw`. KUN da kan viseren beholde SVG-ens egen `<style>` og la
 * {@link beregnStrekVars} dempe streken relativt.
 *
 * RETUR 2 (2026-10-12): en ezdxf-SVG konvertert FØR C1 (Rev. F) har server-markøren
 * `motor: "ezdxf"`, men bærer rå inline `stroke-width` (~173 viewBox-enheter) og verken
 * `data-lw-base` eller `--lw`. Beholdt viseren da SVG-ens stil (fordi markøren sa
 * «ezdxf»), ble de 173 enhetene vist rått — svarte bjelker på web og mobil. Derfor skal
 * motoren ALENE aldri avgjøre: en gammel ezdxf-SVG uten C1-format behandles som «egen»
 * (strip + inject), slik at den aldri vises med rå strektykkelse. Riktig varig løsning
 * for slike filer er re-konvertering med dagens kode (som gir C1).
 *
 * Ren funksjon (ingen DOM) — enhetstestes i node og SPEILES i WebView-JS-en i
 * `TegningsVisning` (kan ikke importeres inn i en inline-`<script>`). `data-lw-base` på
 * roten er den entydige markøren render.py skriver for C1; det holder å sjekke den.
 */
export function svgHarC1Format(svg: string): boolean {
  const rotTagg = svg.match(/<svg[^>]*>/i)?.[0] ?? "";
  return /\bdata-lw-base\s*=/i.test(rotTagg);
}
