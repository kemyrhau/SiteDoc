import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 2: generatoren oversatte interpolasjons-
 * variabelen i ro.json (`{{total}}` i stedet for `{{totalt}}`), så fremdriften
 * ville vist «{{totalt}}» rått på rumensk. Denne vakta FEILER hvis et språk har
 * et ANNET sett `{{variabler}}` enn norsk for de interpolerte reprosess-nøklene.
 */

const SPRAK = [
  "nb", "en", "cs", "de", "et", "fi", "fr", "lt", "lv", "pl", "ro", "ru", "sq", "sv", "uk",
];

// Nøkler med interpolasjon som skal ha identiske {{variabler}} i alle språk.
const INTERPOLERTE_NOKLER = [
  "mapper.reprosessererFremdrift", // {{ferdig}} {{totalt}}
  "mapper.reprosessererFerdig", // {{ok}} {{feilet}}
];

function les(lang: string): Record<string, string> {
  return JSON.parse(
    readFileSync(new URL(`../../../../packages/shared/src/i18n/${lang}.json`, import.meta.url), "utf-8"),
  ) as Record<string, string>;
}

function variabler(tekst: string): string[] {
  return [...tekst.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!).sort();
}

describe("reprosess-i18n — interpolasjonsvariabler er like i alle språk", () => {
  const nb = les("nb");
  const fasit = Object.fromEntries(
    INTERPOLERTE_NOKLER.map((k) => [k, variabler(nb[k] ?? "")]),
  );

  // Sanity: fasiten har faktisk variabler (ellers tester vi ingenting).
  it.each(INTERPOLERTE_NOKLER)("nb har variabler for %s", (k) => {
    expect(fasit[k]!.length).toBeGreaterThan(0);
  });

  for (const lang of SPRAK) {
    const obj = les(lang);
    it.each(INTERPOLERTE_NOKLER)(`${lang}: %s har samme {{variabler}} som nb`, (k) => {
      expect(obj[k], `mangler i ${lang}: ${k}`).toBeTruthy();
      expect(variabler(obj[k]!), `${lang}.${k} = "${obj[k]}"`).toEqual(fasit[k]);
    });
  }
});
