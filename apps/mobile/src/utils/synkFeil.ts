/* ============================================================================
 *  w9m (plan § 5): synkfeil med i18n-nøkkel. Serveren sender `feilNokkel` +
 *  `feilParam` ved siden av nb-teksten (`feilmelding`) når avvisningen bærer en
 *  `NokkelFeil`. Telefonen lagrer alt i den eksisterende kolonnen
 *  `dagsseddel_local.feilmelding` (ingen lokal migrering) som
 *  `nokkel:{"n":…,"p":…,"m":…}`, og viser teksten på brukerens språk.
 *  Ren tekst (eldre server, andre feil) lagres og vises som før.
 * ============================================================================ */

const PREFIKS = "nokkel:";

type Param = Record<string, string | number>;

/** Verdien som lagres i `feilmelding` for et synk-resultat. */
export function kodSynkFeil(
  r: { feilmelding?: string; feilNokkel?: string; feilParam?: Param },
  reserve: string,
): string {
  if (!r.feilNokkel) return r.feilmelding ?? reserve;
  return `${PREFIKS}${JSON.stringify({ n: r.feilNokkel, p: r.feilParam ?? {}, m: r.feilmelding ?? reserve })}`;
}

/** Teksten som vises for en lagret `feilmelding` (null → null). */
export function feilmeldingTekst(
  t: (k: string, p?: Record<string, unknown>) => string,
  lagret: string | null | undefined,
): string | null {
  if (!lagret) return null;
  if (!lagret.startsWith(PREFIKS)) return lagret;
  try {
    const { n, p, m } = JSON.parse(lagret.slice(PREFIKS.length)) as { n?: unknown; p?: unknown; m?: unknown };
    const nb = typeof m === "string" ? m : lagret;
    if (typeof n !== "string") return nb;
    const param = p && typeof p === "object" ? (p as Param) : {};
    return t(n, { ...param, defaultValue: nb });
  } catch {
    return lagret;
  }
}
