/**
 * Generell revisjons-/ny-mal-SQL-generator for sjekklistemaler (MAL-METODE §1b pkt 4).
 *
 * Erstatter engangsgeneratorer per mal. Bygger SQL fra den eksporterte `*_MAL`-konstanten
 * for `<REF>` via `byggBibliotekRader` (@sitedoc/shared) — samme funksjon som seeden bruker,
 * slik at generert SQL og seed ALDRI kan skille lag.
 *
 *   pnpm --filter @sitedoc/db exec tsx prisma/generer-mal-sql.ts <REF> <ny|revisjon>
 *
 * `ny`       — INSERT i `bibliotek_maler` (version=1, verifisert=false, mal_innhold='[]') +
 *              INSERT av objekt-radene. Kapittel slås opp på `bibliotek_kapitler.kode` =
 *              malens `kapittelKode` innenfor standarden NS3420-K. Finnes ikke kapittelet
 *              (f.eks. KM ved KM2), opprettes det i SAMME transaksjon fra `KAPITTEL_DATA_K`
 *              (WHERE NOT EXISTS → gjenbrukes hvis det finnes). Avbryter hvis referansen
 *              allerede finnes.
 * `revisjon` — metadata-UPDATE (`version = version + 1`, Int — IKKE tekstfeltet `versjon`) +
 *              DELETE av malens objekt-rader + INSERT av de nye. Avbryter hvis referansen
 *              ikke finnes. Mønster: `kd1-test.sql` (§6a).
 *
 * Begge: `BEGIN … COMMIT`, og før `COMMIT` full utskrift etter §6a (`\x on`, metadata + alle
 * objekt-rader i rekkefølge). Resultatet skrives til `<ref>-test.sql` i repo-roten.
 *
 * 🔴 Revisjons-/ny-SQL kjøres ÉN gang mot test (§1b pkt 5) — kjøres den på nytt bumpes
 * versjonen igjen. En fil som ligger klar etter kjøring, merkes eller slettes.
 */
import { writeFileSync, realpathSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { byggBibliotekRader, type BibliotekFeltData } from "@sitedoc/shared";
import * as seed from "./seed-bibliotek";

const STANDARD_KODE = "NS3420-K"; // sentralarkivet er NS 3420-K

export interface MalKonstant {
  kapittelKode: string;
  navn: string;
  referanse: string;
  beskrivelse: string;
  felter: BibliotekFeltData[];
}

/** Alle eksporterte `*_MAL`-konstanter, nøklet på `referanse`. */
export function malRegister(): Map<string, MalKonstant> {
  const reg = new Map<string, MalKonstant>();
  for (const [navn, verdi] of Object.entries(seed as Record<string, unknown>)) {
    if (!navn.endsWith("_MAL")) continue;
    const m = verdi as Partial<MalKonstant>;
    if (m && typeof m.referanse === "string" && Array.isArray(m.felter)) {
      reg.set(m.referanse, m as MalKonstant);
    }
  }
  return reg;
}

/** Escape enkelt-fnutt for SQL-strengkonstant. */
function sql(s: string): string {
  return s.replace(/'/g, "''");
}

export function filnavnFor(ref: string): string {
  return `${ref.toLowerCase().replace(/\./g, "")}-test.sql`;
}

/** Kapittel-metadata (navn, sortering) for en kapittelkode, fra seedens KAPITTEL_DATA_K. */
function kapittelMeta(kode: string): { navn: string; sortering: number } {
  const rad = ((seed as { KAPITTEL_DATA_K?: { kode: string; navn: string; sortering: number }[] })
    .KAPITTEL_DATA_K ?? []).find((k) => k.kode === kode);
  if (!rad) {
    throw new Error(`Ukjent kapittelkode «${kode}» — mangler i KAPITTEL_DATA_K (seed-bibliotek.ts).`);
  }
  return { navn: rad.navn, sortering: rad.sortering };
}

/**
 * SQL som oppretter kapittelet hvis det mangler, ellers gjenbruker det. WHERE NOT EXISTS gjør
 * INSERT-en til en no-op når kapittelet finnes (idempotent), slik at den etterfølgende mal-
 * INSERT-en alltid finner et kapittel å henge malen på. Kun for modus `ny` (ordre KM2 §4).
 */
function opprettKapittelSql(mal: MalKonstant): string {
  const { navn, sortering } = kapittelMeta(mal.kapittelKode);
  const kode = sql(mal.kapittelKode);
  return `-- Opprett kapittel ${kode} hvis det mangler (gjenbrukes ellers — WHERE NOT EXISTS).
INSERT INTO bibliotek_kapitler (id, standard_id, kode, navn, sortering)
SELECT gen_random_uuid()::text, s.id, '${kode}', '${sql(navn)}', ${sortering}
FROM bibliotek_standarder s
WHERE s.kode = '${STANDARD_KODE}'
  AND NOT EXISTS (
    SELECT 1 FROM bibliotek_kapitler k WHERE k.standard_id = s.id AND k.kode = '${kode}'
  );`;
}

/** VALUES-radene (heading- + felt-rader) fra mal-konstanten — byte-eksakt via byggBibliotekRader. */
function radVerdier(mal: MalKonstant): string {
  const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 })) as BibliotekFeltData[];
  return byggBibliotekRader(malInnhold)
    .map((r) => {
      const config = sql(JSON.stringify(r.config));
      const translations = sql(JSON.stringify(r.translations));
      return `  ('${r.type}', '${sql(r.label)}', '${config}'::jsonb, '${translations}'::jsonb, ${r.sortOrder}, ${r.required})`;
    })
    .join(",\n");
}

function telling(ref: string): string {
  return `-- Kompakt telling (objektrader / datafelt / headings).
SELECT m.referanse, m.verifisert, m.version,
       count(o.id) AS objektrader,
       count(o.id) FILTER (WHERE o.type <> 'heading') AS datafelt,
       count(o.id) FILTER (WHERE o.type = 'heading') AS headings
FROM bibliotek_maler m
LEFT JOIN bibliotek_mal_objekter o ON o.template_id = m.id
WHERE m.referanse = '${sql(ref)}'
GROUP BY m.referanse, m.verifisert, m.version;`;
}

function tekstbevis(ref: string): string {
  return `-- Full tekstbevis (§6a): metadata + alle objektrader med tekst.
\\x on
SELECT referanse, navn, beskrivelse, version, verifisert
  FROM bibliotek_maler WHERE referanse = '${sql(ref)}';
SELECT o.sort_order, o.type, o.label,
       o.config->'options'    AS alternativer,
       o.config->>'helpText'  AS hjelpetekst
  FROM bibliotek_mal_objekter o
  JOIN bibliotek_maler b ON b.id = o.template_id
 WHERE b.referanse = '${sql(ref)}'
 ORDER BY o.sort_order;`;
}

function genererNy(mal: MalKonstant): string {
  const ref = mal.referanse;
  return `-- ${ref} → arkiv (modus NY). Generert fra ${ref}_MAL via byggBibliotekRader (samme fasit som seeden).
-- INSERT bibliotek_maler (version=1, verifisert=false, mal_innhold='[]') + INSERT objekt-rader.
-- Avbryter hvis ${ref} finnes fra før. Kjøres ÉN gang mot test (MAL-METODE §1b pkt 5).
BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM bibliotek_maler WHERE referanse = '${sql(ref)}') THEN
    RAISE EXCEPTION '${sql(ref)} finnes allerede i arkivet — bruk modus revisjon';
  END IF;
END $$;

${opprettKapittelSql(mal)}

INSERT INTO bibliotek_maler
  (id, kapittel_id, referanse, navn, beskrivelse, prioritet, verifisert, version, mal_innhold)
SELECT gen_random_uuid()::text, k.id, '${sql(ref)}', '${sql(mal.navn)}', '${sql(mal.beskrivelse)}', 1, false, 1, '[]'::jsonb
FROM bibliotek_kapitler k
JOIN bibliotek_standarder s ON s.id = k.standard_id
WHERE k.kode = '${sql(mal.kapittelKode)}' AND s.kode = '${STANDARD_KODE}';

INSERT INTO bibliotek_mal_objekter
  (id, template_id, type, label, config, translations, sort_order, required)
SELECT gen_random_uuid()::text, m.id, r.type, r.label, r.config, r.translations, r.sort_order, r.required
FROM bibliotek_maler m,
(VALUES
${radVerdier(mal)}
) AS r(type, label, config, translations, sort_order, required)
WHERE m.referanse = '${sql(ref)}';

${telling(ref)}

${tekstbevis(ref)}

COMMIT;
`;
}

/**
 * Den muterende kjernen i en revisjon (guard + UPDATE metadata + DELETE objekt-rader + INSERT
 * nye), UTEN BEGIN/COMMIT og uten utskrift. Delt mellom enkel- og fler-revisjon slik at de to
 * veiene aldri kan skille lag.
 */
function revisjonMutasjon(mal: MalKonstant): string {
  const ref = mal.referanse;
  return `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bibliotek_maler WHERE referanse = '${sql(ref)}') THEN
    RAISE EXCEPTION '${sql(ref)} finnes ikke i arkivet — bruk modus ny';
  END IF;
END $$;

UPDATE bibliotek_maler SET
  navn = '${sql(mal.navn)}',
  beskrivelse = '${sql(mal.beskrivelse)}',
  verifisert = false,
  version = version + 1,
  mal_innhold = '[]'::jsonb
WHERE referanse = '${sql(ref)}';

DELETE FROM bibliotek_mal_objekter o
USING bibliotek_maler m
WHERE o.template_id = m.id AND m.referanse = '${sql(ref)}';

INSERT INTO bibliotek_mal_objekter
  (id, template_id, type, label, config, translations, sort_order, required)
SELECT gen_random_uuid()::text, m.id, r.type, r.label, r.config, r.translations, r.sort_order, r.required
FROM bibliotek_maler m,
(VALUES
${radVerdier(mal)}
) AS r(type, label, config, translations, sort_order, required)
WHERE m.referanse = '${sql(ref)}';`;
}

function genererRevisjon(mal: MalKonstant): string {
  const ref = mal.referanse;
  return `-- ${ref}-revisjon → arkiv (modus REVISJON, §6a). Generert fra ${ref}_MAL via byggBibliotekRader.
-- UPDATE metadata (version+1) + DELETE gamle objekt-rader + INSERT nye. verifisert=false.
-- version (Int) bumpes; versjon (String) røres IKKE. Kjøres ÉN gang mot test (§1b pkt 5).
BEGIN;

${revisjonMutasjon(mal)}

${telling(ref)}

${tekstbevis(ref)}

COMMIT;
`;
}

export function byggMalSql(mal: MalKonstant, modus: "ny" | "revisjon"): string {
  return modus === "ny" ? genererNy(mal) : genererRevisjon(mal);
}

/** Filnavn for en samlet fler-revisjon (ordre §7b pkt 4 — én fil, én transaksjon). */
export const FLER_REVISJON_FILNAVN = "7b-retting-test.sql";

/**
 * Fler-revisjon i ÉN transaksjon (ordre §7b pkt 4): alle malene revideres (version+1 hver),
 * så full utskrift av ALLE før COMMIT. Feiler én (f.eks. RAISE fordi referansen mangler),
 * rulles hele transaksjonen tilbake — ingen mal revideres halvveis. Kjøres ÉN gang mot test.
 */
export function byggFlerRevisjonSql(maler: MalKonstant[]): string {
  if (maler.length === 0) throw new Error("byggFlerRevisjonSql: ingen maler oppgitt.");
  const refs = maler.map((m) => m.referanse).join(", ");
  const mutasjoner = maler
    .map((m) => `-- ── ${m.referanse}: ${m.navn} ──\n${revisjonMutasjon(m)}`)
    .join("\n\n");
  const bevis = maler
    .map((m) => `-- ── ${m.referanse} ──\n${telling(m.referanse)}\n\n${tekstbevis(m.referanse)}`)
    .join("\n\n");
  return `-- §7b-retting → arkiv (modus REVISJON, §6a) for ${maler.length} maler: ${refs}.
-- ÉN transaksjon: alle revisjoner (version+1 hver) + full utskrift av alle FØR COMMIT.
-- Feiler én, rulles ALT tilbake. version (Int) bumpes; versjon (String) røres IKKE.
-- Kjøres ÉN gang mot test (MAL-METODE §1b pkt 5).
BEGIN;

${mutasjoner}

-- ══ Full utskrift (§6a) av alle ${maler.length} malene før COMMIT ══
${bevis}

COMMIT;
`;
}

// CLI — kjør KUN når fila startes direkte, ikke ved import (testen importerer byggMalSql).
const kjørtDirekte =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (kjørtDirekte) {
  const args = process.argv.slice(2);
  const modus = args.at(-1);
  const refs = args.slice(0, -1);
  if (refs.length === 0 || (modus !== "ny" && modus !== "revisjon")) {
    console.error("Bruk: tsx prisma/generer-mal-sql.ts <REF...> <ny|revisjon>");
    console.error("  Én REF → <ref>-test.sql. Flere REF (kun revisjon) → 7b-retting-test.sql (én transaksjon).");
    process.exit(1);
  }
  const register = malRegister();
  const maler = refs.map((ref) => {
    const mal = register.get(ref);
    if (!mal) {
      const kjente = [...register.keys()].join(", ") || "(ingen)";
      console.error(`Ukjent referanse «${ref}» — finnes ikke blant de eksporterte *_MAL-konstantene. Kjente: ${kjente}`);
      process.exit(1);
    }
    return mal;
  });
  const repoRot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

  if (maler.length === 1) {
    const mal = maler[0]!;
    const utsti = join(repoRot, filnavnFor(mal.referanse));
    writeFileSync(utsti, byggMalSql(mal, modus), "utf8");
    console.log(`Skrev ${filnavnFor(mal.referanse)} (${mal.felter.length} felt, modus ${modus}).`);
  } else {
    if (modus !== "revisjon") {
      console.error("Flere referanser støttes kun i modus revisjon.");
      process.exit(1);
    }
    const utsti = join(repoRot, FLER_REVISJON_FILNAVN);
    writeFileSync(utsti, byggFlerRevisjonSql(maler), "utf8");
    console.log(`Skrev ${FLER_REVISJON_FILNAVN} (${maler.length} maler: ${maler.map((m) => m.referanse).join(", ")}).`);
  }
}
