/**
 * Generell revisjons-/ny-mal-SQL-generator for sjekklistemaler (MAL-METODE §1b pkt 4).
 *
 * Erstatter engangsgeneratorer per mal. Bygger SQL fra den eksporterte `*_MAL`-konstanten
 * for `<REF>` via `byggBibliotekRader` (@sitedoc/shared) — samme funksjon som seeden bruker,
 * slik at generert SQL og seed ALDRI kan skille lag.
 *
 *   pnpm --filter @sitedoc/db exec tsx prisma/generer-mal-sql.ts <REF> <ny|revisjon> [--fra <gammelRef>]
 *
 * Standarden slås opp PER MAL (ordre FD1 §5): kapittelKode i `KAPITTEL_DATA_K` → NS3420-K, i
 * `KAPITTEL_DATA_F` → NS3420-F. K-maler gir byte-lik SQL som før (standarden løses til NS3420-K).
 *
 * `ny`       — INSERT i `bibliotek_maler` (version=1, verifisert=false, mal_innhold='[]') +
 *              INSERT av objekt-radene. Kapittel slås opp på `bibliotek_kapitler.kode` =
 *              malens `kapittelKode` innenfor malens standard. Finnes ikke kapittelet
 *              (f.eks. KM ved KM2), opprettes det i SAMME transaksjon fra KAPITTEL_DATA_K/F
 *              (WHERE NOT EXISTS → gjenbrukes hvis det finnes). Avbryter hvis referansen
 *              allerede finnes.
 * `revisjon` — metadata-UPDATE (`version = version + 1`, Int — IKKE tekstfeltet `versjon`) +
 *              DELETE av malens objekt-rader + INSERT av de nye. Avbryter hvis referansen
 *              ikke finnes. Mønster: `kd1-test.sql` (§6a).
 * `--fra`    — omkoding (ordre FD1 §5): før revisjonen får samme bibliotekrad ny referanse og
 *              nytt kapittel (lånene beholder id-koblingen), og kilde-/målkapittelets navn rettes
 *              til normen. Kun sammen med ÉN REF i modus revisjon (f.eks. `FD1 revisjon --fra FB2`).
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

interface KapittelRad { kode: string; navn: string; sortering: number }

/** Kapittel-arrayene med sin standard-kode. Ordre FD1 §5: standarden slås opp per mal
 *  (K- eller F-arrayet) i stedet for et hardkodet STANDARD_KODE. */
function kapittelArrays(): { standard: string; data: KapittelRad[] }[] {
  const s = seed as { KAPITTEL_DATA_K?: KapittelRad[]; KAPITTEL_DATA_F?: KapittelRad[] };
  return [
    { standard: "NS3420-K", data: s.KAPITTEL_DATA_K ?? [] },
    { standard: "NS3420-F", data: s.KAPITTEL_DATA_F ?? [] },
  ];
}

/** Standarden malen hører til, funnet via kapittelKode i K-/F-arrayet (ordre FD1 §5 pkt 1). */
function standardForMal(mal: MalKonstant): string {
  for (const { standard, data } of kapittelArrays()) {
    if (data.some((k) => k.kode === mal.kapittelKode)) return standard;
  }
  throw new Error(
    `Fant ikke standard for kapittel «${mal.kapittelKode}» — mangler i KAPITTEL_DATA_K/F (seed-bibliotek.ts).`,
  );
}

/** Kapittel-metadata (navn, sortering) for en kapittelkode, fra seedens KAPITTEL_DATA_K/F. */
function kapittelMeta(kode: string): { navn: string; sortering: number } {
  for (const { data } of kapittelArrays()) {
    const rad = data.find((k) => k.kode === kode);
    if (rad) return { navn: rad.navn, sortering: rad.sortering };
  }
  throw new Error(`Ukjent kapittelkode «${kode}» — mangler i KAPITTEL_DATA_K/F (seed-bibliotek.ts).`);
}

/** Finnes kapittelkoden i KAPITTEL_DATA_K/F? Et kildekapittel som er FJERNET (f.eks. FC/FE etter
 *  omkoding) skal ikke navne-rettes — det slettes i stedet. */
function harKapittelMeta(kode: string): boolean {
  return kapittelArrays().some(({ data }) => data.some((k) => k.kode === kode));
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
WHERE s.kode = '${standardForMal(mal)}'
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

/**
 * Den muterende kjernen i en NY mal (guard + opprett kapittel + INSERT mal + INSERT objekt-rader),
 * UTEN BEGIN/COMMIT og uten utskrift. Delt mellom enkel- og fler-mal slik at de to veiene aldri kan
 * skille lag (fler-mal modus `ny` er forberedt for runde B: UM1/UU1).
 */
function nyMutasjon(mal: MalKonstant): string {
  const ref = mal.referanse;
  return `DO $$
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
WHERE k.kode = '${sql(mal.kapittelKode)}' AND s.kode = '${standardForMal(mal)}';

INSERT INTO bibliotek_mal_objekter
  (id, template_id, type, label, config, translations, sort_order, required)
SELECT gen_random_uuid()::text, m.id, r.type, r.label, r.config, r.translations, r.sort_order, r.required
FROM bibliotek_maler m,
(VALUES
${radVerdier(mal)}
) AS r(type, label, config, translations, sort_order, required)
WHERE m.referanse = '${sql(ref)}';`;
}

function genererNy(mal: MalKonstant): string {
  const ref = mal.referanse;
  return `-- ${ref} → arkiv (modus NY). Generert fra ${ref}_MAL via byggBibliotekRader (samme fasit som seeden).
-- INSERT bibliotek_maler (version=1, verifisert=false, mal_innhold='[]') + INSERT objekt-rader.
-- Avbryter hvis ${ref} finnes fra før. Kjøres ÉN gang mot test (MAL-METODE §1b pkt 5).
BEGIN;

${nyMutasjon(mal)}

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

/** Kapittelkoden en referanse hører til = de innledende bokstavene (FB2→FB, FD1→FD, KC3.1→KC). */
function kapittelKodeFor(ref: string): string {
  return ref.match(/^[A-ZÆØÅ]+/)?.[0] ?? "";
}

/**
 * Omkoding (ordre FD1 §5 pkt 2–3, utvidet FS2 §5): samme bibliotekrad får ny referanse og nytt
 * kapittel FØR revisjonen — lånene beholder id-koblingen. Kjøres kun via `--fra <gammelRef>`. Guard
 * avbryter med klartekst hvis den gamle referansen mangler (allerede omkodet) eller den nye finnes.
 * Mangler MÅLKAPITTELET (f.eks. FS ved FS2), opprettes det i samme transaksjon med samme WHERE
 * NOT EXISTS-mekanisme som modus `ny` (no-op hvis det finnes, f.eks. FD ved FD1). Kapittelnavnene
 * for kilde- og målkapittelet rettes til normen (KAPITTEL_DATA_F) — men kun for kapitler som
 * overlever (et fjernet kildekapittel som FC/FE navne-rettes ikke). Til slutt slettes et TOMT
 * kildekapittel (NOT EXISTS-vakt, ordre FH1 §3): FC/FE forsvinner, FB/FD er no-op. Alt scopes til
 * malens standard.
 */
function omkodingSql(mal: MalKonstant, fraRef: string): string {
  const std = standardForMal(mal);
  const nyRef = mal.referanse;
  const tilKap = mal.kapittelKode;
  const fraKap = kapittelKodeFor(fraRef);
  const iStandard = (alias: string) =>
    `${alias} JOIN bibliotek_kapitler k ON k.id = ${alias}.kapittel_id ` +
    `JOIN bibliotek_standarder s ON s.id = k.standard_id`;
  const kapittelId = (kode: string) =>
    `(SELECT k.id FROM bibliotek_kapitler k JOIN bibliotek_standarder s ON s.id = k.standard_id ` +
    `WHERE k.kode = '${sql(kode)}' AND s.kode = '${std}')`;

  // Navne-rett kun kapitler som OVERLEVER (finnes i KAPITTEL_DATA_*). Et kildekapittel som er
  // fjernet fra arrayet (FC/FE etter omkoding) skal ikke rettes — det slettes lenger ned.
  const kapittelKoder = [...new Set([fraKap, tilKap])].filter((k) => k && harKapittelMeta(k));
  const kapittelNavnRetting = kapittelKoder
    .map((kode) => {
      const { navn } = kapittelMeta(kode);
      return `UPDATE bibliotek_kapitler k SET navn = '${sql(navn)}'
FROM bibliotek_standarder s
WHERE s.id = k.standard_id AND s.kode = '${std}' AND k.kode = '${sql(kode)}';`;
    })
    .join("\n");

  return `-- Omkoding ${fraRef} → ${nyRef} (samme bibliotekrad, ny kode + kapittel; lånene beholder id-koblingen).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM bibliotek_maler ${iStandard("m")}
    WHERE m.referanse = '${sql(fraRef)}' AND s.kode = '${std}'
  ) THEN
    RAISE EXCEPTION '${sql(fraRef)} finnes ikke i ${std} — omkoding kan ikke utføres (allerede omkodet?)';
  END IF;
  IF EXISTS (
    SELECT 1 FROM bibliotek_maler ${iStandard("m")}
    WHERE m.referanse = '${sql(nyRef)}' AND s.kode = '${std}'
  ) THEN
    RAISE EXCEPTION '${sql(nyRef)} finnes allerede i ${std} — omkoding ville kollidere';
  END IF;
END $$;

${opprettKapittelSql(mal)}

-- Kapittelnavn rettet til normen (${kapittelKoder.join(", ")}) i ${std}.
${kapittelNavnRetting}

-- ${fraRef} → ${nyRef}: ny referanse + flytt til kapittel ${tilKap} (samme rad, id uendret).
UPDATE bibliotek_maler SET
  referanse = '${sql(nyRef)}',
  kapittel_id = ${kapittelId(tilKap)}
WHERE referanse = '${sql(fraRef)}'
  AND kapittel_id IN (
    SELECT k.id FROM bibliotek_kapitler k JOIN bibliotek_standarder s ON s.id = k.standard_id
    WHERE s.kode = '${std}'
  );

-- Slett tomt kildekapittel ${fraKap} (KUN hvis ingen maler igjen — NOT EXISTS-vakt). No-op når
-- kapittelet fortsatt har maler (f.eks. FB/FD). Trygt: kun bibliotek_maler.kapittel_id peker hit.
DELETE FROM bibliotek_kapitler k
USING bibliotek_standarder s
WHERE k.standard_id = s.id AND s.kode = '${std}' AND k.kode = '${sql(fraKap)}'
  AND NOT EXISTS (SELECT 1 FROM bibliotek_maler m WHERE m.kapittel_id = k.id);`;
}

/** Ekstra utskrift (ordre FD1 §5 pkt 4): kapittelkode og -navn for malen, i tillegg til §6a-beviset. */
function kapittelBevisSql(ref: string): string {
  return `-- Kapittelkode og -navn for malen (ordre FD1 §5 pkt 4).
SELECT m.referanse, k.kode AS kapittel_kode, k.navn AS kapittel_navn
  FROM bibliotek_maler m
  JOIN bibliotek_kapitler k ON k.id = m.kapittel_id
 WHERE m.referanse = '${sql(ref)}';`;
}

/** Utskrift som viser om kildekapittelet fortsatt finnes (forventet borte etter sletting). */
function kildekapittelBevisSql(mal: MalKonstant, fraRef: string): string {
  const std = standardForMal(mal);
  const fraKap = kapittelKodeFor(fraRef);
  return `-- Kildekapittel ${fraKap}: forventet BORTE etter sletting (ingen rad = slettet).
SELECT k.kode AS kildekapittel_finnes_fortsatt
  FROM bibliotek_kapitler k JOIN bibliotek_standarder s ON s.id = k.standard_id
 WHERE s.kode = '${std}' AND k.kode = '${sql(fraKap)}';`;
}

/** Muterende kjerne per mal, UTEN BEGIN/COMMIT/utskrift. `ny` → nyMutasjon; `revisjon` med `fraRef`
 *  → omkoding (guard/kapittel/UPDATE/slett tomt kildekapittel) + revisjonMutasjon; uten `fraRef` →
 *  ren revisjonMutasjon. Delt mellom enkel- og fler-mal-veien. */
function malMutasjon(mal: MalKonstant, modus: "ny" | "revisjon", fraRef?: string): string {
  if (modus === "ny") return nyMutasjon(mal);
  return fraRef ? `${omkodingSql(mal, fraRef)}\n\n${revisjonMutasjon(mal)}` : revisjonMutasjon(mal);
}

/** §6a-utskrift per mal: telling + tekstbevis, og ved omkoding også kapittel- og kildekapittel-bevis. */
function malBevis(mal: MalKonstant, fraRef?: string): string {
  const ref = mal.referanse;
  let b = `${telling(ref)}\n\n${tekstbevis(ref)}`;
  if (fraRef) b += `\n\n${kapittelBevisSql(ref)}\n\n${kildekapittelBevisSql(mal, fraRef)}`;
  return b;
}

function genererRevisjon(mal: MalKonstant, fraRef?: string): string {
  const ref = mal.referanse;
  if (fraRef) {
    return `-- ${ref} → arkiv (modus REVISJON MED OMKODING fra ${fraRef}, §6a + ordre FD1/FH1 §5).
-- Omkoder ${fraRef}→${ref} (samme rad, lån beholdt), retter kapittelnavn, sletter tomt kildekapittel,
-- så revisjon: UPDATE metadata (version+1) + DELETE gamle objekt-rader + INSERT nye. verifisert=false.
-- version (Int) bumpes; versjon (String) røres IKKE. Kjøres ÉN gang mot test (§1b pkt 5).
BEGIN;

${malMutasjon(mal, "revisjon", fraRef)}

${malBevis(mal, fraRef)}

COMMIT;
`;
  }
  return `-- ${ref}-revisjon → arkiv (modus REVISJON, §6a). Generert fra ${ref}_MAL via byggBibliotekRader.
-- UPDATE metadata (version+1) + DELETE gamle objekt-rader + INSERT nye. verifisert=false.
-- version (Int) bumpes; versjon (String) røres IKKE. Kjøres ÉN gang mot test (§1b pkt 5).
BEGIN;

${malMutasjon(mal, "revisjon")}

${malBevis(mal)}

COMMIT;
`;
}

export function byggMalSql(
  mal: MalKonstant,
  modus: "ny" | "revisjon",
  opts: { fraRef?: string } = {},
): string {
  if (modus === "ny") {
    if (opts.fraRef) throw new Error("Omkoding (--fra) støttes kun i modus revisjon.");
    return genererNy(mal);
  }
  return genererRevisjon(mal, opts.fraRef);
}

/** Filnavn for en samlet fler-mal-fil: «<ref1>-<ref2>-…-test.sql» (tillegg samlerunder §4). */
export function flerFilnavn(refs: string[]): string {
  return refs.map((r) => r.toLowerCase().replace(/\./g, "")).join("-") + "-test.sql";
}

/**
 * Fler-mal-revisjon i ÉN transaksjon (tillegg samlerunder §2–3): hver mal revideres (version+1),
 * med per-mal omkoding der `fraMap` gir en gammel referanse (par-form NY=GAMMEL), så full §6a-
 * utskrift PER MAL i rekkefølge FØR COMMIT. Feiler én (RAISE), rulles ALT tilbake — ingen mal
 * revideres halvveis. `fraMap` tom → ren fler-revisjon (som §7b-runden). Kjøres ÉN gang mot test.
 */
export function byggFlerRevisjonSql(
  maler: MalKonstant[],
  fraMap: Map<string, string> = new Map(),
): string {
  if (maler.length === 0) throw new Error("byggFlerRevisjonSql: ingen maler oppgitt.");
  const refs = maler.map((m) => m.referanse).join(", ");
  const mutasjoner = maler
    .map((m) => `-- ── ${m.referanse}: ${m.navn} ──\n${malMutasjon(m, "revisjon", fraMap.get(m.referanse))}`)
    .join("\n\n");
  const bevis = maler
    .map((m) => `-- ── ${m.referanse} ──\n${malBevis(m, fraMap.get(m.referanse))}`)
    .join("\n\n");
  return `-- Fler-mal-revisjon → arkiv (§6a) for ${maler.length} maler: ${refs}.
-- ÉN transaksjon: hver mal revideres (version+1), omkoding der --fra gir par, + full utskrift PER MAL.
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
  const raw = process.argv.slice(2);
  // --fra: omkoding før revisjonen. To former (tillegg samlerunder §2):
  //   bar   «--fra FB2»              — kun med ÉN REF (gammel form).
  //   par   «--fra FH1=FC1,FS3=FE1»  — NY=GAMMEL, komma mellom parene (flere maler).
  let fraRaw: string | undefined;
  const fraIdx = raw.indexOf("--fra");
  let posisjonelle = raw;
  if (fraIdx !== -1) {
    fraRaw = raw[fraIdx + 1];
    if (!fraRaw) {
      console.error("--fra krever et argument: «--fra FB2» eller «--fra NY=GAMMEL,NY2=GAMMEL2».");
      process.exit(1);
    }
    posisjonelle = raw.filter((_, i) => i !== fraIdx && i !== fraIdx + 1);
  }
  const modus = posisjonelle.at(-1);
  const refs = posisjonelle.slice(0, -1);
  if (refs.length === 0 || (modus !== "ny" && modus !== "revisjon")) {
    console.error("Bruk: tsx prisma/generer-mal-sql.ts <REF...> <ny|revisjon> [--fra <par>]");
    console.error("  Én REF → <ref>-test.sql. Flere REF → <ref1>-<ref2>-…-test.sql (én transaksjon).");
    console.error("  --fra: «FB2» (én REF) eller «FH1=FC1,FS3=FE1» (par NY=GAMMEL, kun revisjon).");
    process.exit(1);
  }
  // Bygg fraMap: ref → gammel referanse (omkoding). Kun modus revisjon.
  const fraMap = new Map<string, string>();
  if (fraRaw) {
    if (modus !== "revisjon") {
      console.error("--fra (omkoding) støttes kun i modus revisjon.");
      process.exit(1);
    }
    if (fraRaw.includes("=")) {
      for (const par of fraRaw.split(",")) {
        const [ny, gammel] = par.split("=").map((s) => s?.trim());
        if (!ny || !gammel) {
          console.error(`Ugyldig par «${par}» — forventet NY=GAMMEL.`);
          process.exit(1);
        }
        if (!refs.includes(ny)) {
          console.error(`Par «${par}» viser til en ref som ikke er med i kjøringen: ${ny}.`);
          process.exit(1);
        }
        fraMap.set(ny, gammel);
      }
    } else {
      if (refs.length !== 1) {
        console.error("Bar «--fra <ref>» støttes kun med ÉN REF; bruk par-form NY=GAMMEL for flere.");
        process.exit(1);
      }
      fraMap.set(refs[0]!, fraRaw);
    }
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
    const fraRef = fraMap.get(mal.referanse);
    const utsti = join(repoRot, filnavnFor(mal.referanse));
    writeFileSync(utsti, byggMalSql(mal, modus, { fraRef }), "utf8");
    const omkoding = fraRef ? `, omkoding fra ${fraRef}` : "";
    console.log(`Skrev ${filnavnFor(mal.referanse)} (${mal.felter.length} felt, modus ${modus}${omkoding}).`);
  } else {
    if (modus !== "revisjon") {
      console.error("Flere referanser støttes foreløpig kun i modus revisjon.");
      process.exit(1);
    }
    const filnavn = flerFilnavn(refs);
    writeFileSync(join(repoRot, filnavn), byggFlerRevisjonSql(maler, fraMap), "utf8");
    const omkodinger = [...fraMap.entries()].map(([ny, g]) => `${g}→${ny}`).join(", ") || "ingen";
    console.log(`Skrev ${filnavn} (${maler.length} maler: ${refs.join(", ")}; omkoding: ${omkodinger}).`);
  }
}
