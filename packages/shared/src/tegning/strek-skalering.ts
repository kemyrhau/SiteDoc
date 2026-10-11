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
