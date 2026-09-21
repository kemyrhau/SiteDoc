import { describe, it, expect } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { malRegister } from "./generer-mal-sql";

/**
 * MALFASIT — låser HELE innholdet i hver eksporterte *_MAL (MAL-METODE §8, ordre malfasit
 * 2026-09-20). Maltestene låser fra før navn, felttype og fase; hjelpetekster og alternativer var
 * bare sjekket negativt (§7b). Denne testen skriver hvert felts type, label, fase, alternativer,
 * hjelpetekst og øvrige config til fasitfilen `mal-fasit.snap.md` og sammenligner ved hver kjøring.
 *
 * REGENERERING (den ENESTE lovlige måten å endre fasiten på):
 *   pnpm --filter @sitedoc/db exec vitest run mal-fasit -u
 *
 * MAL-METODE §8: fasitendring er BARE lov sammen med en designgatet ordre, i SAMME branch som
 * malendringen — aldri i en egen «rett opp testen»-commit. En diff i fasiten uten ordre er et avvik,
 * og design holder merge. Fasiten låser SEEDEN (konstantene), ikke databasen; at arkivet faktisk har
 * samme innhold vises av §6a-tekstbeviset ved hver SQL-kjøring.
 *
 * EGENSKAPER (ordre §1):
 *  - Lesbar diff: én endret hjelpetekst = én endret, selv-identifiserende linje (REF + felt + hva).
 *  - Stabil rekkefølge: maler sorteres på referanse, felt i forfatter-rekkefølge.
 *  - Én kilde: skrevet ut fra malRegister() (samme *_MAL-konstanter som seeden), ikke for hånd.
 *  - Ny mal uten fasit → snapshot-mismatch → RØD (ikke stille forbigåelse).
 */

/** Deterministisk JSON: nøkler sortert, så en urelatert endring ikke flytter linjer. */
function stabilJson(obj: Record<string, unknown>): string {
  const sortert: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) sortert[k] = obj[k];
  return JSON.stringify(sortert);
}

/** Ett felt slik fasiten leser det (speiler seedens FeltDef + del A-tre-nøklene). */
interface FasitFelt {
  label: string;
  type: string;
  fase?: string | null;
  config?: Record<string, unknown> | null;
  ref?: string | null;
  parentRef?: string | null;
}
interface FasitMal {
  referanse: string;
  navn: string;
  beskrivelse: string;
  felter: FasitFelt[];
}

/**
 * Fasit-linjene for ÉN mal (eksportert så del A-testen kan verifisere treet på en testmal uten å
 * legge den i seed-arrayet). Betingede felt (del A): `ref` markerer en forelder, `barn-av` +
 * `vises-når` viser hvilken forelder og hvilke svar som utløser et barn — ellers kan en kobling
 * endres stille. `conditionActive`/`conditionValues` tas UT av det generiske config-dumpet og vises
 * eksplisitt; flate maler har ingen av delene, så fasiten deres er uendret.
 */
export function fasitLinjerForMal(mal: FasitMal): string[] {
  const r = mal.referanse;
  const linjer: string[] = [
    `### ${r}`,
    `${r} navn        = ${mal.navn}`,
    `${r} beskrivelse = ${mal.beskrivelse}`,
  ];
  mal.felter.forEach((f, i) => {
    const nr = String(i + 1).padStart(2, "0");
    const config = { ...(f.config ?? {}) } as Record<string, unknown>;
    const options = config.options as string[] | undefined;
    const helpText = config.helpText as string | undefined;
    const conditionValues = config.conditionValues as string[] | undefined;
    delete config.options;
    delete config.helpText;
    delete config.conditionValues;
    delete config.conditionActive;
    linjer.push(`${r} f${nr} fase  = ${f.fase ?? ""}`);
    linjer.push(`${r} f${nr} type  = ${f.type}`);
    linjer.push(`${r} f${nr} label = ${f.label}`);
    if (options && options.length > 0) linjer.push(`${r} f${nr} alt   = ${options.join(" | ")}`);
    if (helpText) linjer.push(`${r} f${nr} hjelp = ${helpText}`);
    if (f.ref) linjer.push(`${r} f${nr} ref   = ${f.ref}`);
    if (f.parentRef) linjer.push(`${r} f${nr} barn-av = ${f.parentRef}`);
    if (conditionValues && conditionValues.length > 0)
      linjer.push(`${r} f${nr} vises-når = ${conditionValues.join(" | ")}`);
    if (Object.keys(config).length > 0) linjer.push(`${r} f${nr} config = ${stabilJson(config)}`);
  });
  linjer.push("");
  return linjer;
}

/** Serialisér alle eksporterte *_MAL til én deterministisk, selv-identifiserende tekst. */
export function byggFasit(): string {
  const linjer: string[] = [
    "# MALFASIT — låser innholdet i hver *_MAL (MAL-METODE §8).",
    "# Regenerer KUN sammen med en designgatet ordre, i samme branch som malendringen:",
    "#   pnpm --filter @sitedoc/db exec vitest run mal-fasit -u",
    "",
  ];
  const maler = [...malRegister().values()].sort((a, b) => a.referanse.localeCompare(b.referanse, "nb"));
  for (const mal of maler) linjer.push(...fasitLinjerForMal(mal as unknown as FasitMal));
  return linjer.join("\n");
}

describe("malfasit — innholdet i hver *_MAL er låst (MAL-METODE §8)", () => {
  it("matcher fasitfilen (endring krever designgatet ordre + regenerering med -u)", async () => {
    const sti = join(dirname(fileURLToPath(import.meta.url)), "mal-fasit.snap.md");
    await expect(byggFasit()).toMatchFileSnapshot(sti);
  });

  it("dekker alle eksporterte *_MAL (ny mal uten fasit → fanges av snapshot over)", () => {
    // Kontroll: registeret er ikke tomt, og fasiten nevner hver referanse eksplisitt.
    const refs = [...malRegister().keys()];
    expect(refs.length).toBeGreaterThan(0);
    const fasit = byggFasit();
    for (const ref of refs) {
      expect(fasit, `fasiten mangler mal ${ref}`).toContain(`### ${ref}`);
    }
  });
});
