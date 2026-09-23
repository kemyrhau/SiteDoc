/**
 * Håndhever at ALLE språkfiler har nøyaktig samme nøkkelsett som `nb.json` (fasit).
 *
 * Bakgrunn (mal-Opus-funn 2026-09-15): en runde som legger til `nb`/`en`-nøkler uten å
 * kjøre 13-språk-generatoren etterlater et hull — de trette språkene mangler nøklene,
 * og appen faller tilbake til nøkkelnavnet i UI. Målt tre ganger: 134 nøkler (bbc6cb36),
 * så 7 til (arkiv-søk + Malforvaltning). Ingen test fanget det før denne.
 *
 * Testen feiler ved BEGGE retninger:
 *  - manglende nøkler (glemt generator) → navngis per fil + løsningskommando,
 *  - ekstra nøkler (relikvie etter slettet funksjon) → navngis per fil.
 *
 * Bor som vanlig vitest-test fordi `pnpm test` alt kjøres i `ci.yml` — ingen egen CI-jobb.
 * Leser filene dynamisk fra disk, så et nytt språk dekkes automatisk uten å endre testen.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const I18N_DIR = path.dirname(fileURLToPath(import.meta.url));
const FASIT = "nb"; // referansespråket alle andre måles mot

function nokkelsett(lang: string): Set<string> {
  const rå = JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), "utf8")) as Record<string, unknown>;
  return new Set(Object.keys(rå)); // filene er flate «a.b.c»-nøkkelmaps
}

const spraak = fs
  .readdirSync(I18N_DIR)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""))
  .sort();

describe("i18n-nøkkelsett", () => {
  it(`alle ${spraak.length} språkfiler har identisk nøkkelsett som ${FASIT}.json`, () => {
    const fasit = nokkelsett(FASIT);
    const problemer: string[] = [];
    const alleManglende = new Set<string>();

    for (const lang of spraak.filter((l) => l !== FASIT)) {
      const sett = nokkelsett(lang);
      const mangler = [...fasit].filter((k) => !sett.has(k)).sort();
      const ekstra = [...sett].filter((k) => !fasit.has(k)).sort();
      if (mangler.length) {
        problemer.push(`  ${lang}.json mangler ${mangler.length} nøkler: ${mangler.join(", ")}`);
        mangler.forEach((k) => alleManglende.add(k));
      }
      if (ekstra.length) {
        problemer.push(`  ${lang}.json har ${ekstra.length} ukjente nøkler (finnes ikke i ${FASIT}.json): ${ekstra.join(", ")}`);
      }
    }

    if (problemer.length) {
      const løsning =
        alleManglende.size > 0
          ? `\n\nFyll manglende nøkler slik:\n  cd packages/shared && pnpm dlx tsx src/i18n/generate.ts --only ${[...alleManglende].sort().join(",")}`
          : "";
      const relikvieHint = problemer.some((p) => p.includes("ukjente"))
        ? `\n\nUkjente nøkler er relikvier — slett dem i alle språkfilene (ren sletting, ingen generator).`
        : "";
      throw new Error(
        `i18n-nøkkelsett avviker fra ${FASIT}.json:\n${problemer.join("\n")}${løsning}${relikvieHint}`,
      );
    }

    expect(problemer).toEqual([]);
  });
});
