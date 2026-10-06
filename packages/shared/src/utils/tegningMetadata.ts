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
 * Tegningsnummer-mønsteret (ARK-konvensjon). Tre bindestrek-separerte segmenter:
 *   - fagprefiks: 1–4 store bokstaver (A, ARK, RIB, RIE …)
 *   - midt-segment: én stor bokstav (P=plan, F=fasade i noen konvensjoner) ELLER
 *     1–3 sifre (etasje/løpenummer)
 *   - løpenummer: 1–4 sifre
 *
 * Bindestrek kreves mellom segmentene — alle ekte eksempler bruker den, og det
 * stenger falske treff som «PLAN A-20» (mellomrom) i tittelfelt-tekst.
 *
 * Ordgrensene `(?<![A-Za-z0-9])` / `(?![A-Za-z0-9])` lar nummeret stå HVOR som
 * helst i teksten (ikke bare i starten), men hindrer at det limes sammen med en
 * tilstøtende bokstav/siffer-serie («20251001_A-20-101» → «A-20-101», ikke
 * «1001_A-20-101» eller «A-20-1010»). Understrek er bevisst utenfor klassen, så
 * «_A-20-101» kutter rett før «A».
 */
export const TEGNINGSNUMMER_MONSTER =
  /(?<![A-Za-z0-9])[A-Z]{1,4}-(?:[A-Z]|\d{1,3})-\d{1,4}(?![A-Za-z0-9])/g;

/**
 * Finn ETT entydig tegningsnummer på tvers av kildene. Samler alle treff, og
 * returnerer nummeret bare når alle treff er IDENTISKE. 0 treff eller ≥2 ulike
 * → `null` (usikkert = tomt).
 */
export function finnTegningsnummer(tekster: Array<string | null | undefined>): string | null {
  const treff = new Set<string>();
  for (const tekst of tekster) {
    if (!tekst) continue;
    // matchAll med global flagg; hvert treff er allerede store bokstaver + sifre,
    // så den rå strengen er sin egen nøkkel (ingen normalisering trengs).
    for (const m of tekst.matchAll(TEGNINGSNUMMER_MONSTER)) {
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
