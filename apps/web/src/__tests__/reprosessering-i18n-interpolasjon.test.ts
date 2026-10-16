import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, it, expect } from "vitest";

/**
 * RETUR 2026-10-15 (Kontrollør) punkt 2: generatoren oversatte interpolasjons-
 * variabelen i ro.json (`{{total}}` i stedet for `{{totalt}}`), så fremdriften
 * ville vist «{{totalt}}» rått på rumensk. RETUR 2026-10-16 (Kontrollør, R1) fant
 * samme feilklasse igjen i `tegninger.oppdatererFremdrift` — vakta dekket den ikke
 * fordi den kun sjekket en håndplukket nøkkelliste.
 *
 * Denne vakta sjekker nå ALLE nøkler i ALLE språk mot nb. Generaliseringen avdekket
 * 221 eksisterende avvik (12 av 13 språk, oversettelsen hadde omskrevet variabelnavnet
 * — f.eks. {{side}}→{{côté}}, {{total}}→{{totalt}} — eller skrevet om setningen uten
 * variabelen). Alle 221 er rettet i fix/i18n-interpolasjon (2026-10-16): variabelnavnene
 * er satt tilbake til nb (fasit), og flythjelp.handling.videresend er regenerert fra en.
 * KJENT_AVVIK er derfor tom og KAN KUN krympe videre: et nytt avvik feiler alltid, og en
 * stale oppføring (rettet, men ikke fjernet fra lista) feiler også.
 */

const I18N_DIR = fileURLToPath(new URL("../../../../packages/shared/src/i18n", import.meta.url));
const FASIT = "nb";

const SPRAK = readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

function les(lang: string): Record<string, string> {
  return JSON.parse(readFileSync(path.join(I18N_DIR, `${lang}.json`), "utf-8")) as Record<string, string>;
}

function variabler(tekst: string): string[] {
  return [...tekst.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!).sort();
}

// Kjent avvik ved generaliseringen 2026-10-16 (RETUR R1-oppfølger). Kun lov å krympe —
// se KJENT_AVVIK-sjekken nederst, som feiler hvis en oppføring her er rettet men ikke fjernet.
const KJENT_AVVIK: Record<string, string[]> = {};

describe("i18n — interpolasjonsvariabler er like i alle språk", () => {
  const nb = les(FASIT);
  const nokler = Object.keys(nb);

  for (const lang of SPRAK.filter((l) => l !== FASIT)) {
    const obj = les(lang);
    const kjent = new Set(KJENT_AVVIK[lang] ?? []);

    it(`${lang}: har samme {{variabler}} som ${FASIT} på alle nøkler (utenom kjent avvik)`, () => {
      const nyeAvvik: string[] = [];
      const staleKjente: string[] = [];
      for (const k of nokler) {
        const nbVerdi = nb[k];
        const langVerdi = obj[k];
        if (nbVerdi === undefined || langVerdi === undefined) continue; // dekkes av nokkelsett.test.ts
        const likt = JSON.stringify(variabler(nbVerdi)) === JSON.stringify(variabler(langVerdi));
        if (kjent.has(k)) {
          if (likt) staleKjente.push(k); // rettet, men ikke fjernet fra KJENT_AVVIK
        } else if (!likt) {
          nyeAvvik.push(`  ${k}: nb=[${variabler(nbVerdi).join(",")}] ${lang}=[${variabler(langVerdi).join(",")}] ("${langVerdi}")`);
        }
      }
      if (nyeAvvik.length) {
        throw new Error(`${lang}.json har ${nyeAvvik.length} NYE nøkler med avvikende {{variabler}} fra nb:\n${nyeAvvik.join("\n")}`);
      }
      if (staleKjente.length) {
        throw new Error(
          `${lang}.json: ${staleKjente.length} nøkler i KJENT_AVVIK er ikke lenger avvikende — fjern dem fra lista (den kan kun krympe): ${staleKjente.join(", ")}`,
        );
      }
      expect(nyeAvvik).toEqual([]);
    });
  }

  // Sanity: fasiten har faktisk interpolerte nøkler (ellers tester vi ingenting).
  it("nb har minst én nøkkel med interpolasjon", () => {
    expect(nokler.some((k) => variabler(nb[k]!).length > 0)).toBe(true);
  });
});
