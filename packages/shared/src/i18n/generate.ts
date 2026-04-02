/**
 * Oversettelsesscript: en.json → alle språk via google-translate-api-x
 *
 * Bruk:
 *   npx tsx packages/shared/src/i18n/generate.ts          # kun manglende nøkler
 *   npx tsx packages/shared/src/i18n/generate.ts --force   # regenerer alle nøkler
 *
 * Oversetter fra engelsk (en.json) for bedre presisjon på fagtermer.
 * nb.json brukes kun for nøkkelrekkefølge.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const { default: translate } = await import("google-translate-api-x");

  const force = process.argv.includes("--force");

  // Kilde: engelsk (manuelt oversatt, korrekte fagtermer)
  const enPath = join(__dirname, "en.json");
  const en: Record<string, string> = JSON.parse(readFileSync(enPath, "utf-8"));

  // Nøkkelrekkefølge fra nb.json
  const nbPath = join(__dirname, "nb.json");
  const nb: Record<string, string> = JSON.parse(readFileSync(nbPath, "utf-8"));
  const alleNøkler = Object.keys(nb);

  // Språk som skal genereres (ekskluder nb og en)
  const SPRAAK = ["sv", "lt", "pl", "uk", "ro", "et", "fi", "cs", "de", "ru", "lv"];

  for (const lang of SPRAAK) {
    const filsti = join(__dirname, `${lang}.json`);

    // Last eksisterende oversettelse
    let eksisterende: Record<string, string> = {};
    if (!force && existsSync(filsti)) {
      eksisterende = JSON.parse(readFileSync(filsti, "utf-8"));
    }

    // Finn nøkler som skal oversettes
    const åOversette = alleNøkler
      .filter((key) => en[key] && !eksisterende[key])
      .map((key) => [key, en[key]] as [string, string]);

    if (åOversette.length === 0) {
      console.log(`${lang}: alle ${alleNøkler.length} nøkler finnes — hopper over`);
      continue;
    }

    console.log(`${lang}: oversetter ${åOversette.length} av ${alleNøkler.length} nøkler fra engelsk...`);

    const resultat: Record<string, string> = { ...eksisterende };

    // Batch à 50 for å unngå rate-limiting
    for (let i = 0; i < åOversette.length; i += 50) {
      const batch = åOversette.slice(i, i + 50);
      const tekster = batch.map(([_key, v]) => v);

      try {
        const oversatt = await translate(tekster, { from: "en", to: lang });
        const resultater = Array.isArray(oversatt) ? oversatt : [oversatt];

        batch.forEach(([key], j) => {
          resultat[key] = resultater[j]?.text ?? tekster[j];
        });
      } catch (error) {
        console.error(`  Feil ved batch ${i}-${i + 50} for ${lang}:`, error);
        // Behold engelsk som fallback
        batch.forEach(([key], j) => {
          resultat[key] = tekster[j];
        });
      }

      // Vent 1.5s mellom batcher
      if (i + 50 < åOversette.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Sorter nøkler som i nb.json
    const sortert: Record<string, string> = {};
    for (const key of alleNøkler) {
      if (resultat[key]) sortert[key] = resultat[key];
    }

    writeFileSync(filsti, JSON.stringify(sortert, null, 2) + "\n");
    console.log(`${lang}: ${Object.keys(sortert).length} nøkler ferdig`);
  }

  console.log("\nFerdig! Kjør manuell QA på fagtermer.");
}

main().catch(console.error);
