/**
 * skriv-mal — lokalt tekstbevis for en eller flere maler, UTEN database, scp, docker eller TTY
 * (ordre malfasit TILLEGG §5, gatet av Kenneth 2026-09-20).
 *
 *   pnpm --filter @sitedoc/db exec tsx prisma/skriv-mal.ts <REF...>
 *
 * Skriver referanse, navn, beskrivelse og alle rader i rekkefølge med sort_order, type, label,
 * alternativer og hjelpetekst — SAMME FORM som §6a-utskriften design gater på (metadata + objekt-
 * rader). Fasen ligger som heading-rader («Kontroll FØR/UNDER/ETTER utførelse»), akkurat som i
 * arkivet. Radene bygges med `byggBibliotekRader` — samme funksjon som seeden og generatoren — så
 * utskriften er per definisjon det seeden ville skrevet. Ingen DB: teksten leses uten å seede.
 *
 * MAL-METODE §8b: innholdsgaten kjøres på DENNE utskriften, låst av malfasiten. SQL mot test kjøres
 * per runde (ikke per mal), og alltid når generer-mal-sql.ts eller byggBibliotekRader er endret.
 *
 * Flere referanser i samme kjøring, i oppgitt rekkefølge. Ukjent referanse: stopp med klartekst.
 */
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { byggBibliotekRader, type BibliotekFeltData } from "@sitedoc/shared";
import { malRegister } from "./generer-mal-sql";

/** Én mals tekstbevis i §6a-form (metadata + rad-tabell). */
export function skrivMal(referanse: string): string {
  const mal = malRegister().get(referanse);
  if (!mal) {
    const kjente = [...malRegister().keys()].join(", ") || "(ingen)";
    throw new Error(`Ukjent referanse «${referanse}». Kjente: ${kjente}`);
  }
  const malInnhold = mal.felter.map((f, i) => ({ ...f, sortOrder: i + 1 })) as BibliotekFeltData[];
  const rader = byggBibliotekRader(malInnhold);

  const ut: string[] = [];
  ut.push(`=== ${mal.referanse} ===`);
  ut.push(`referanse   : ${mal.referanse}`);
  ut.push(`navn        : ${mal.navn}`);
  ut.push(`beskrivelse : ${mal.beskrivelse}`);
  ut.push(`verifisert  : false  (seed-default; version settes i DB)`);
  ut.push("");
  // Én rad per objekt, felt på egne linjer (§6a med \x on). alternativer = config->'options'
  // (JSON-array, som i psql), hjelpetekst = config->>'helpText' (ren tekst). Heading-rader har
  // ingen av delene — som i arkivet.
  for (const r of rader) {
    const cfg = (r.config ?? {}) as Record<string, unknown>;
    const options = cfg.options as string[] | undefined;
    const help = cfg.helpText as string | undefined;
    ut.push(`-[ rad ${r.sortOrder} ]`);
    ut.push(`  type         : ${r.type}`);
    ut.push(`  label        : ${r.label}`);
    if (options && options.length > 0) ut.push(`  alternativer : ${JSON.stringify(options)}`);
    if (help) ut.push(`  hjelpetekst  : ${help}`);
  }
  return ut.join("\n");
}

// CLI — kjør KUN når fila startes direkte (ikke ved import).
const kjørtDirekte =
  process.argv[1] !== undefined &&
  realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

if (kjørtDirekte) {
  const refs = process.argv.slice(2);
  if (refs.length === 0) {
    console.error("Bruk: tsx prisma/skriv-mal.ts <REF...>  (f.eks. «KD1 FD1»)");
    process.exit(1);
  }
  try {
    console.log(refs.map((ref) => skrivMal(ref)).join("\n\n"));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
