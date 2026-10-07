import { DRAWING_TYPES, type DrawingType } from "../validation";

/**
 * Forhåndsutfylling av tegningsnummer og -type ved serieopplasting (R3).
 *
 * Rene funksjoner — ingen I/O. Kalleren samler tekstkilder i prioritert
 * rekkefølge (filnavn, PDF-`Title`, tittelfelt-tekst side 1) og sender dem inn.
 * Reglen er streng: **entydig treff eller tomt.** To ulike treff → `null`, fordi
 * «hvis det er usikkert → ikke fyll ut» (Kenneth 2026-10-06).
 *
 * GATE (spec § 6.1): mønsteret må treffe BÅDE «A-20-101» og «ARK-P-101» (midt-
 * segmentet kan være en bokstav), og det må finne et nummer MIDT i et filnavn
 * («20251001_A-20-101.pdf») eller midt i tittelfelt-tekst — derfor ordgrenser
 * (lookbehind/lookahead på alfanumerisk), ikke `^`-anker.
 */

/**
 * Tegningsnummer-mønsteret (ARK-konvensjon). Bindestrek-separerte segmenter, 3–7
 * stykker, hvert segment 1–4 tegn av STORE bokstaver og/eller sifre:
 *   - 3-segments-formen: «A-20-101» (fag · etasje/løpenr · løpenr) og «ARK-P-101»
 *     (midt-segmentet kan være en bokstav, P=plan i noen konvensjoner)
 *   - lange firma-koder: «B3-06-A-20-31-02» (bygg · etasje · fag · nn · nn · nn) —
 *     Kenneths ekte ARK-filnavn, 6 segmenter (spec § 6.1 «utvides mot ekte filnavn»)
 *
 * Bindestrek kreves mellom segmentene — alle ekte eksempler bruker den, og det
 * stenger falske treff som «PLAN A-20» (mellomrom) i tittelfelt-tekst. KUN store
 * bokstaver (ingen `i`-flagg): småbokstavsord som «Himlingsplan» treffer aldri.
 *
 * Ordgrensene `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` lar nummeret stå HVOR som
 * helst i teksten (ikke bare i starten), men hindrer at det limes sammen med en
 * tilstøtende bokstav/siffer-serie («20251001_A-20-101» → «A-20-101», ikke
 * «1001_A-20-101» eller «A-20-1010»). Understrek er bevisst utenfor klassen, så
 * «_A-20-101» kutter rett før «A».
 *
 * Et rent-sifret treff (dato «2025-10-07») eller et rent-bokstavs treff
 * («AS-IS-X») er IKKE et tegningsnummer — kravet om BÅDE bokstav og siffer
 * håndheves i `finnTegningsnummer` (klarere enn i regexen).
 */
export const TEGNINGSNUMMER_MONSTER =
  /(?<![A-Za-z0-9])[A-Z0-9]{1,4}(?:-[A-Z0-9]{1,4}){2,6}(?![A-Za-z0-9])/g;

/**
 * Finn ETT entydig tegningsnummer på tvers av kildene. Samler alle treff, og
 * returnerer nummeret bare når alle treff er IDENTISKE. 0 treff eller ≥2 ulike
 * → `null` (usikkert = tomt). Et treff må inneholde BÅDE en bokstav og et siffer
 * — ellers er det en dato eller et ord, ikke et tegningsnummer.
 */
export function finnTegningsnummer(tekster: Array<string | null | undefined>): string | null {
  const treff = new Set<string>();
  for (const tekst of tekster) {
    if (!tekst) continue;
    // matchAll med global flagg; hvert treff er allerede store bokstaver + sifre,
    // så den rå strengen er sin egen nøkkel (ingen normalisering trengs).
    for (const m of tekst.matchAll(TEGNINGSNUMMER_MONSTER)) {
      // Både bokstav og siffer kreves: stenger dato (2025-10-07) og rene
      // bokstavs-løp (AS-IS-X) som tilfeldigvis har bindestreker.
      if (!/[A-Z]/.test(m[0]) || !/[0-9]/.test(m[0])) continue;
      treff.add(m[0]);
    }
  }
  return treff.size === 1 ? ([...treff][0] ?? null) : null;
}

/**
 * Finn ÉN entydig tegningstype på tvers av kildene. Ordtreff (hele ord, ikke
 * delstreng) mot `DRAWING_TYPES`-navnene. 0 treff eller ≥2 ulike typer → `null`.
 *
 * Ordgrense `\b` på begge sider så «detalj» ikke treffer «detaljert» og «plan»
 * ikke treffer «planlegging» — heller tomt enn feil (R3).
 */
export function finnTegningstype(tekster: Array<string | null | undefined>): DrawingType | null {
  const treff = new Set<DrawingType>();
  for (const tekst of tekster) {
    if (!tekst) continue;
    for (const type of DRAWING_TYPES) {
      const re = new RegExp(`\\b${type}\\b`, "i");
      if (re.test(tekst)) treff.add(type);
    }
  }
  return treff.size === 1 ? ([...treff][0] ?? null) : null;
}
