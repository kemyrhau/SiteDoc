// Ren zoom-matematikk for startutsnittet i tegningsvisningen.
// Trukket ut fra `tegninger/page.tsx` slik at den kan testes uten å bygge om
// komponenten. Beregner zoomen som får HELE startutsnittet inn i containeren i
// BEGGE akser (bredde og høyde). Tidligere regnet inline-koden kun bredden og
// antok kvadratisk innerflate (`0.98 / max(su.w, su.h)`), slik at en stående
// tegning sprengte høyden og brukeren måtte scrolle.

export interface StartutsnittZoomInput {
  /** Startutsnittets bredde som andel av innerflaten (0–1). */
  bredde: number;
  /** Startutsnittets høyde som andel av innerflaten (0–1). */
  høyde: number;
  /** Containerens bredde i piksler (`clientWidth`). */
  cw: number;
  /** Containerens høyde i piksler (`clientHeight`). */
  ch: number;
  /**
   * Bildets høyde/bredde-forhold (`imageHeight / imageWidth`), dvs. innerflatens
   * `innerH / innerW`. `null` når forholdet er ukjent — da brukes kun bredde-
   * tilpasningen (aldri kvadratisk gjetning).
   */
  forhold: number | null;
  /** Nedre klemme (STANDARD_ZOOM). */
  minZoom: number;
  /** Øvre klemme (MAKS_ZOOM). */
  maksZoom: number;
}

/**
 * Zoom som får startutsnittet inn i begge akser, klemt til [minZoom, maksZoom].
 *
 * Innerflatens bredde ved zoom `z` er `innerW = cw·z`, høyden `innerH =
 * innerW·forhold`. Utsnittets bredde i piksler er `bredde·innerW`, høyden
 * `høyde·innerH`. For at begge skal få plass (med 2 % luft):
 *   bredde·cw·z ≤ 0.98·cw            → z ≤ 0.98 / bredde
 *   høyde·cw·z·forhold ≤ 0.98·ch     → z ≤ 0.98·ch / (høyde·cw·forhold)
 */
export function beregnStartutsnittZoom({
  bredde,
  høyde,
  cw,
  ch,
  forhold,
  minZoom,
  maksZoom,
}: StartutsnittZoomInput): number {
  const breddeTilpass = 0.98 / bredde;
  const tilpass =
    forhold && forhold > 0
      ? Math.min(breddeTilpass, (0.98 * ch) / (høyde * cw * forhold))
      : breddeTilpass;
  return Math.min(maksZoom, Math.max(minZoom, tilpass));
}

/**
 * Henter innerflatens høyde/bredde-forhold fra SVG-ens `viewBox` når
 * `imageWidth`/`imageHeight` mangler. Returnerer `null` hvis `viewBox` ikke
 * finnes eller er ugyldig — kalleren faller da tilbake til bredde-tilpasning,
 * aldri kvadratisk.
 */
export function svgViewBoxForhold(svg: string | null | undefined): number | null {
  if (!svg) return null;
  const treff = svg.match(/viewBox\s*=\s*["']\s*([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s+([-\d.eE]+)\s*["']/);
  if (!treff || treff[3] === undefined || treff[4] === undefined) return null;
  const vbW = parseFloat(treff[3]);
  const vbH = parseFloat(treff[4]);
  if (!Number.isFinite(vbW) || !Number.isFinite(vbH) || vbW <= 0 || vbH <= 0) return null;
  return vbH / vbW;
}
