/**
 * Oversettelsesscript: nb.json → alle språk via google-translate-api-x
 *
 * Bruk: npx tsx packages/shared/src/i18n/generate.ts
 * Installasjon: pnpm add -D google-translate-api-x --filter @sitedoc/shared
 *
 * Hopper over språk som allerede har manuell oversettelse (en.json).
 * Eksisterende nøkler i målfilen bevares — scriptet fyller kun inn manglende.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamisk import av google-translate-api-x
async function main() {
  const { default: translate } = await import("google-translate-api-x");

  const nbPath = join(__dirname, "nb.json");
  const nb: Record<string, string> = JSON.parse(readFileSync(nbPath, "utf-8"));
  const nøkler = Object.entries(nb);

  // Språk som skal genereres (ekskluder nb som er kilde)
  const SPRAAK = ["en", "sv", "lt", "pl", "uk", "ro", "et", "fi", "cs", "de", "ru", "lv"];

  for (const lang of SPRAAK) {
    const filsti = join(__dirname, `${lang}.json`);

    // Last eksisterende oversettelse hvis den finnes
    let eksisterende: Record<string, string> = {};
    if (existsSync(filsti)) {
      eksisterende = JSON.parse(readFileSync(filsti, "utf-8"));
    }

    // Finn nøkler som mangler
    const manglende = nøkler.filter(([key]) => !eksisterende[key]);

    if (manglende.length === 0) {
      console.log(`${lang}: alle ${nøkler.length} nøkler finnes allerede — hopper over`);
      continue;
    }

    console.log(`${lang}: oversetter ${manglende.length} av ${nøkler.length} nøkler...`);

    const resultat: Record<string, string> = { ...eksisterende };

    // Batch à 50 for å unngå rate-limiting
    for (let i = 0; i < manglende.length; i += 50) {
      const batch = manglende.slice(i, i + 50);
      const tekster = batch.map(([_key, v]) => v);

      try {
        const oversatt = await translate(tekster, { from: "no", to: lang });
        const resultater = Array.isArray(oversatt) ? oversatt : [oversatt];

        batch.forEach(([key], j) => {
          resultat[key] = resultater[j]?.text ?? tekster[j];
        });
      } catch (error) {
        console.error(`  Feil ved batch ${i}-${i + 50} for ${lang}:`, error);
        // Behold norsk som fallback
        batch.forEach(([key], j) => {
          resultat[key] = tekster[j];
        });
      }

      // Vent 1.5s mellom batcher for å unngå rate-limiting
      if (i + 50 < manglende.length) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Sorter nøkler som i nb.json
    const sortert: Record<string, string> = {};
    for (const [key] of nøkler) {
      if (resultat[key]) sortert[key] = resultat[key];
    }

    writeFileSync(filsti, JSON.stringify(sortert, null, 2) + "\n");
    console.log(`${lang}: ${Object.keys(sortert).length} nøkler ferdig`);
  }

  console.log("\nFerdig! Kjør manuell QA på fagtermer.");
}

main().catch(console.error);
