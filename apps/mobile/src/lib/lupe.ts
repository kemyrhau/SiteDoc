// Lupe-geometri for tegningsvisningen (RETUR 4) — rene, testbare funksjoner.
//
// Lupa er forstørrelsesglasset som vises ved siden av fingeren mens man setter
// eller flytter et målepunkt (sett-ved-slipp). Den FAKTISKE tegningen skjer i
// WebView-en (`TegningsVisning.tsx`), som speiler denne matematikken i injisert
// JS (WebView kan ikke importere TS). Her bor den som rene funksjoner slik at
// posisjon, størrelse og z-rekkefølge kan testes isolert — og slik at en feil i
// geometrien fanges av en test, ikke av at Kenneth ser noe rart på telefonen.
//
// RETUR 4 § 2 (lupe usynlig på enhet): rotårsaken var `position: fixed` i WKWebView
// under pinch-zoom (kjent WebKit-svakhet — fixed-elementer forankres til det
// visuelle viewportet og rendres upålitelig). Fiks: `position: absolute` forankret
// i sidekoordinater (pageX/pageY), som lever i samme lag som tegningen og følger
// både scroll og zoom. Z-rekkefølgen under sikrer at lupa ligger ØVERST.

/** Lupe-mål (punkter). ~100 pt diameter, ~3× forstørrelse, ~80 pt forskyvning. */
export const LUPE_DIAMETER = 100;
export const LUPE_FORSTORRELSE = 3;
export const LUPE_FORSKYVNING = 80;

/**
 * Z-rekkefølge i tegningsvisningen. Lupa MÅ ligge over alt annet, ellers er den
 * «bak bildet» (en av de mistenkte årsakene i RETUR 4 § 2).
 * Rekkefølge (lav → høy): tegning < område < pin < målelag < hint < lupe.
 */
export const Z_TEGNING = 0;
export const Z_OMRADE = 5;
export const Z_PIN = 10;
export const Z_MALELAG = 16;
export const Z_HINT = 30;
export const Z_LUPE = 9999;

/** Er z-rekkefølgen gyldig (lupa øverst, hint over målelag, osv.)? */
export function lupeLiggerOverst(): boolean {
  return Z_LUPE > Z_HINT && Z_HINT > Z_MALELAG && Z_MALELAG > Z_PIN && Z_PIN > Z_OMRADE && Z_OMRADE > Z_TEGNING;
}

export interface LupePlassering {
  left: number;
  top: number;
  /** Hvilken side lupa havnet på (for test/innsikt). */
  side: "høyre" | "venstre";
  over: boolean;
}

/**
 * Plasser lupa forskjøvet OPP og TIL SIDEN for fingeren, og flipp side/retning
 * ved skjermkanten så den aldri havner utenfor synlig område (RETUR 4 § 2-krav).
 *
 * `fingerX/Y` og skjermmålene er i samme koordinatrom (sidekoordinater eller
 * skjermpunkter — kalleren velger, matematikken er den samme).
 */
export function lupePlassering(
  fingerX: number,
  fingerY: number,
  skjermB: number,
  skjermH: number,
  D: number = LUPE_DIAMETER,
  forskyvning: number = LUPE_FORSKYVNING,
): LupePlassering {
  const kant = 4;
  // Standard: til høyre for fingeren.
  let left = fingerX + forskyvning;
  let side: "høyre" | "venstre" = "høyre";
  if (left + D > skjermB - kant) {
    left = fingerX - forskyvning - D; // flipp til venstre
    side = "venstre";
  }
  if (left < kant) left = kant;

  // Standard: over fingeren.
  let top = fingerY - forskyvning - D;
  let over = true;
  if (top < kant) {
    top = fingerY + forskyvning; // under ved toppkanten
    over = false;
  }
  if (top + D > skjermH - kant) top = Math.max(kant, skjermH - D - kant);

  return { left, top, side, over };
}

export interface LupeBakgrunn {
  /** Bakgrunnsbildets størrelse i lupa (background-size), px. */
  bildeB: number;
  bildeH: number;
  /** Bakgrunns-offset (background-position) så punktet havner i lupas senter, px. */
  posX: number;
  posY: number;
}

/**
 * Bakgrunns-crop for lupa: forstørr tegningen `M`× og forskyv slik at punktet
 * (`px`,`py` i prosent) havner i lupas senter (trådkorset). `dispB/dispH` er
 * tegningens VISTE størrelse i px.
 */
export function lupeBakgrunn(
  px_pct: number,
  py_pct: number,
  dispB: number,
  dispH: number,
  M: number = LUPE_FORSTORRELSE,
  D: number = LUPE_DIAMETER,
): LupeBakgrunn {
  const bildeB = dispB * M;
  const bildeH = dispH * M;
  const ix = (px_pct / 100) * bildeB;
  const iy = (py_pct / 100) * bildeH;
  return { bildeB, bildeH, posX: D / 2 - ix, posY: D / 2 - iy };
}

