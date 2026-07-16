/**
 * Grenseverdier for tall-felt (`integer`/`decimal`) — delt kilde for
 * MalBygger-editor, utfyllings-rendering (web + mobil) og validering.
 *
 * Bakgrunn (fase M-3a del 2): NS3420-testmalene bærer `min`/`maks`/`toleranse`
 * i `config` (seedet med NORSKE nøkler, se `packages/db/prisma/seed-bibliotek.ts`),
 * men MalBygger-editoren redigerte historisk kun `unit` (engelsk). defaultConfig
 * brukte `min`/`max`/`unit`. Resultat: to nøkkel-populasjoner for samme semantikk.
 *
 * Vedtak 2026-07-16 (Kenneth): NORSK kanonisk (`enhet`/`min`/`maks`/`toleranse`/
 * `desimaler`) skrives fra editoren; ENGELSK (`unit`/`max`/`decimals`) leses som
 * fallback. Denne normaliseren er det ene stedet fallbacken bor — som
 * `normaliserOpsjon` gjør for valg-opsjoner. Ingen seed/testmal røres.
 *
 * Grensene BLOKKERER ikke innsending — et avvik er et gyldig funn. Rendring
 * viser grensen og markerer verdi utenfor visuelt.
 */

export interface Grense {
  /** Nedre grense — verdi < min er «under». */
  min: number | null;
  /** Øvre grense — verdi > maks er «over». */
  maks: number | null;
  /** Toleransebånd rundt 0 — |verdi| > toleranse er «utenfor_toleranse». */
  toleranse: number | null;
  /** Antall desimaler for input-step/formatering (kun decimal). */
  desimaler: number | null;
  /** Enhet vist etter feltet (mm, %, cm …). */
  enhet: string;
}

export type GrenseStatus = "under" | "over" | "utenfor_toleranse" | "ok";

/** Coerce ukjent config-verdi til tall eller null (tolererer tall og tall-streng). */
function tilTall(verdi: unknown): number | null {
  if (typeof verdi === "number") return Number.isFinite(verdi) ? verdi : null;
  if (typeof verdi === "string" && verdi.trim() !== "") {
    const n = parseFloat(verdi.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Normaliser felt-config til et grense-objekt. Norsk nøkkel vinner, engelsk
 * leses som fallback: `maks ?? max`, `enhet ?? unit`, `desimaler ?? decimals`.
 * `min` og `toleranse` har ingen engelsk motpart.
 */
export function normaliserGrense(config: Record<string, unknown>): Grense {
  const maks = config.maks !== undefined ? config.maks : config.max;
  const enhet = config.enhet !== undefined ? config.enhet : config.unit;
  const desimaler =
    config.desimaler !== undefined ? config.desimaler : config.decimals;
  return {
    min: tilTall(config.min),
    maks: tilTall(maks),
    toleranse: tilTall(config.toleranse),
    desimaler: tilTall(desimaler),
    enhet: typeof enhet === "string" ? enhet : "",
  };
}

/** Har feltet minst én aktiv grense (min/maks/toleranse)? */
export function harGrense(grense: Grense): boolean {
  return grense.min !== null || grense.maks !== null || grense.toleranse !== null;
}

/**
 * Status for en verdi mot grensene. Returnerer null når verdien ikke er et tall
 * eller ingen grense finnes. Rekkefølge: under → over → utenfor_toleranse → ok.
 */
export function grenseStatus(
  verdi: unknown,
  grense: Grense,
): GrenseStatus | null {
  const tall = tilTall(verdi);
  if (tall === null || !harGrense(grense)) return null;
  if (grense.min !== null && tall < grense.min) return "under";
  if (grense.maks !== null && tall > grense.maks) return "over";
  if (grense.toleranse !== null && Math.abs(tall) > grense.toleranse)
    return "utenfor_toleranse";
  return "ok";
}

/**
 * Språknøytral grense-etikett for visning ved feltet — symboler + tall + enhet,
 * f.eks. «≥ 2 %», «≤ 2 mm», «± 3 mm», «2–10 mm». Tom streng når ingen grense.
 * Bevisst i18n-fri så web og mobil viser identisk.
 */
export function formaterGrense(grense: Grense): string {
  const e = grense.enhet ? ` ${grense.enhet}` : "";
  const deler: string[] = [];
  if (grense.min !== null && grense.maks !== null) {
    deler.push(`${grense.min}–${grense.maks}${e}`);
  } else if (grense.min !== null) {
    deler.push(`≥ ${grense.min}${e}`);
  } else if (grense.maks !== null) {
    deler.push(`≤ ${grense.maks}${e}`);
  }
  if (grense.toleranse !== null) {
    deler.push(`± ${grense.toleranse}${e}`);
  }
  return deler.join(" · ");
}
