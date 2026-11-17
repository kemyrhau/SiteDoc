/**
 * Diagnoselinja i mobil-vieweren (ORDRE 8 (iii), 2026-11-17).
 *
 * Usynlig som standard. Slås på med `?diag=1`, eller fra appen uten OTA: appen åpner
 * `/mobil-viewer` uten parametre, så fem raske trykk øverst til venstre slår den av/på,
 * og valget huskes i WebViewens localStorage.
 */

export const DIAG_LAGRINGSNØKKEL = "sitedoc-3d-diag";

/** Trykksonen øverst til venstre (px) og hvor raskt de fem trykkene må komme. */
export const DIAG_SONE_PX = 64;
export const DIAG_ANTALL_TRYKK = 5;
export const DIAG_VINDU_MS = 3000;

/** `?diag=1` slår på; ellers det som er lagret fra sist. */
export function diagFraUrlEllerLager(search: string): boolean {
  if (new URLSearchParams(search).get("diag") === "1") return true;
  try {
    return localStorage.getItem(DIAG_LAGRINGSNØKKEL) === "1";
  } catch {
    return false;
  }
}

/**
 * Teller trykk i sonen øverst til venstre. Kaller `veksle` når det har kommet
 * `DIAG_ANTALL_TRYKK` trykk innenfor `DIAG_VINDU_MS`. Trykk utenfor sonen nullstiller.
 */
export function lagDiagHemmeligTrykk(veksle: () => void) {
  let tider: number[] = [];
  return (x: number, y: number, nå: number) => {
    if (x > DIAG_SONE_PX || y > DIAG_SONE_PX) { tider = []; return; }
    tider = [...tider.filter((t) => nå - t <= DIAG_VINDU_MS), nå];
    if (tider.length >= DIAG_ANTALL_TRYKK) {
      tider = [];
      veksle();
    }
  };
}
