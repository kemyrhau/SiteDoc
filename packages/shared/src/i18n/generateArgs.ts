/**
 * Argument-parsing for i18n-generatoren (`generate.ts`).
 *
 * Skilt ut som ren modul så `--only`-logikken kan enhetstestes uten å dra inn
 * generatorens nettverkskall (google-translate) — å importere `generate.ts`
 * ville kjørt `main()`.
 *
 * Bakgrunn (`feat/i18n-generate-only`): `generate.ts` oversetter ALLE manglende
 * nøkler. Ved drift betyr det at et spor som legger to nøkler drar med seg alle
 * pre-eksisterende umanglende nøkler (målt 09-09: 134, hvorav 132 var drift,
 * bl.a. `brukere.*` under aktivt rename). `--only` gjør et spor i stand til å
 * generere KUN sine egne nøkler — feilklassen blir umulig i stedet for en regel
 * hver agent må huske. Se [[feedback_i18n_generate_drift]].
 */

/**
 * Leser `--only <kommaliste>` / `--only=<kommaliste>` fra argv.
 *
 * @returns `null` når flagget ikke er gitt (→ dagens oppførsel: alle manglende).
 *          En (mulig tom) liste med trimmede, ikke-tomme nøkler ellers. Tom liste
 *          betyr «flagget gitt uten brukbar verdi» — kalleren skal feile høyt.
 *
 * Full sti brukes som nøkkel (`seksjon.noekkel`), så filtreringen treffer én
 * nøkkel, ikke en hel seksjon.
 */
export function parseOnlyFlag(argv: string[]): string[] | null {
  const medLikhetstegn = argv.find((a) => a.startsWith("--only="));
  if (medLikhetstegn) {
    return splittNokler(medLikhetstegn.slice("--only=".length));
  }
  const idx = argv.indexOf("--only");
  if (idx === -1) return null;
  const verdi = argv[idx + 1];
  // Manglende verdi eller neste token er et nytt flagg → tom liste (kalleren feiler).
  if (!verdi || verdi.startsWith("--")) return [];
  return splittNokler(verdi);
}

function splittNokler(rå: string): string[] {
  return rå
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Finner `--only`-nøkler som ikke finnes i kildene. En gyldig nøkkel må ligge i
 * `en.json` (kilden det oversettes fra) OG i `nb.json` (rekkefølgen output sorteres
 * etter — en nøkkel utenfor nb ville blitt stille droppet ved sortering).
 *
 * @returns nøkler som mangler, pr. fil. Begge tomme = alt OK.
 */
export function finnUkjenteOnlyNokler(
  only: string[],
  en: Record<string, string>,
  nb: Record<string, string>,
): { manglerEn: string[]; manglerNb: string[] } {
  return {
    manglerEn: only.filter((k) => !(k in en)),
    manglerNb: only.filter((k) => !(k in nb)),
  };
}
