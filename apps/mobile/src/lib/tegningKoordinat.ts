// Koordinat-transform for tegningsvisningen (RETUR 5) — rene, testbare funksjoner.
//
// 🔴 RETUR 5 § 1 (bare siste punkt flyttes på enhet): rotårsaken er at drag-
// hit-testen i den injiserte WebView-JS-en (`finnPunkt`) regnet i SKJERM-
// koordinater (`clientX`/`getBoundingClientRect`), mens lupa — det ENE som ble
// synlig i RETUR 4 — regnet i SIDE-/DOKUMENT-koordinater (`pageX`/`pageY`).
// Under WKWebView pinch-zoom + pan peker de to rommene på ULIKE steder, og
// avviket vokser med scroll-offset. Resultatet: bare punkter nær der brukeren
// nettopp zoomet (typisk DET SISTE satte punktet) traff treffradiusen.
//
// Fiks: regn ALT i side-/dokumentkoordinater. `pageX`/`pageY` er dokument-
// koordinater (CSS-piksler, upåvirket av pinch-zoom og visuelt-viewport-scroll),
// og bildets boks hentes fra `offsetLeft`/`offsetTop`/`offsetWidth`/`offsetHeight`
// (LAYOUT-piksler, også zoom-invariante). Da ligger finger og punkter i SAMME
// rom uansett zoom/scroll. Den injiserte JS-en speiler denne matematikken; her
// bor den som rene funksjoner slik at en feil fanges av en test — ikke av at
// Kenneth ikke får flyttet punkt nr. 1 på telefonen.

import type { Punkt } from "@sitedoc/shared";

/** Bildets plassering + LAYOUT-størrelse i side-/dokumentkoordinater (alt px, zoom-invariant). */
export interface BildeBoks {
  /** Venstre kant i dokumentkoordinater (sum av offsetLeft opp til dokumentroten). */
  sideLeft: number;
  /** Toppkant i dokumentkoordinater. */
  sideTop: number;
  /** Layout-bredde (offsetWidth). */
  bredde: number;
  /** Layout-høyde (offsetHeight). */
  høyde: number;
}

/** Klem en prosentverdi til 0–100. */
function klem100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Side-/dokumentkoordinat (pageX/pageY) → prosent (0–100) av bildet. Klemt til
 * 0–100 (samme koordinatrom som alle markører/målepunkter).
 */
export function sideTilProsent(pageX: number, pageY: number, boks: BildeBoks): Punkt {
  if (boks.bredde <= 0 || boks.høyde <= 0) return { x: 0, y: 0 };
  return {
    x: klem100(((pageX - boks.sideLeft) / boks.bredde) * 100),
    y: klem100(((pageY - boks.sideTop) / boks.høyde) * 100),
  };
}

/** Prosent-punkt → side-/dokumentkoordinat (px). Omvendt av sideTilProsent. */
export function prosentTilSide(p: Punkt, boks: BildeBoks): { x: number; y: number } {
  return {
    x: boks.sideLeft + (p.x / 100) * boks.bredde,
    y: boks.sideTop + (p.y / 100) * boks.høyde,
  };
}

/**
 * Nærmeste målepunkt til en finger innen `tolSidePx` SIDE-piksler. -1 = ingen
 * treff. ALLE punkter er grabbare, ikke bare det siste (RETUR 2/3/5 § 1) — fordi
 * finger og punkter nå ligger i samme side-koordinatrom. `tolSidePx` er terskelen
 * i side-piksler; kalleren skalerer en skjermterskel med 1/zoom (en side-piksel
 * dekker `zoom` skjermpiksler når bildet er pinch-zoomet).
 */
export function finnNaermesteSidePunkt(
  pageX: number,
  pageY: number,
  boks: BildeBoks,
  punkter: Punkt[],
  tolSidePx: number,
): number {
  if (boks.bredde <= 0 || boks.høyde <= 0) return -1;
  let best = -1;
  let bestAvstand = tolSidePx;
  for (let i = 0; i < punkter.length; i++) {
    const q = prosentTilSide(punkter[i]!, boks);
    const d = Math.hypot(q.x - pageX, q.y - pageY);
    if (d <= bestAvstand) {
      best = i;
      bestAvstand = d;
    }
  }
  return best;
}

/**
 * Finger-posisjon i WebViewens SYNLIGE skjermareal (dp), fra side-koordinat +
 * visuelt viewport. Brukes til å plassere den RN-native lupa (RETUR 5 § 2) rett
 * ved fingeren uansett pinch-zoom: skjerm = (side − viewportOffset) × skala.
 */
export function sideTilSkjerm(
  pageX: number,
  pageY: number,
  vpLeft: number,
  vpTop: number,
  skala: number,
): { x: number; y: number } {
  return { x: (pageX - vpLeft) * skala, y: (pageY - vpTop) * skala };
}
