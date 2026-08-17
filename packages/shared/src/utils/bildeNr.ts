/**
 * Løpende bildenummer per dokument (sjekkliste / oppgave / HMS) — Kenneth-vedtak
 * 2026-08-16 (`docs/redesign/arkivpdf-seks-funn-vedtak-fabel-2026-08-16.md`, funn 1).
 *
 * Nummeret tildeles i appen NÅR bildet tas, løpende stigende per dokument på tvers av
 * alle felt OG repeater-rader — slik at feltarbeideren kan referere «se bilde 07» i
 * teksten mens hen står der. Dokgen (`packages/pdf`) leser `Vedlegg.bildeNr` og faller
 * tilbake til dokumentrekkefølge kun når feltet mangler (arkiverte dokumenter).
 *
 * Delt av alle fire skjema-hooks (mobil + web × sjekkliste + oppgave) — samme kilde,
 * ikke kopiert per hook (hooks/CLAUDE.md § «Deler logikk skal ligge i @sitedoc/shared»).
 */

interface VedleggLite {
  type?: string;
  bildeNr?: number;
}

interface FeltVerdiLite {
  verdi?: unknown;
  vedlegg?: VedleggLite[];
}

/** Besøk alle bilde-vedlegg i ett dokument (topp-nivå-felt + repeater-rader). */
function forHvertBilde(
  feltVerdier: Record<string, FeltVerdiLite | undefined>,
  besok: (v: VedleggLite) => void,
): void {
  const tellListe = (vedlegg?: VedleggLite[]) => {
    if (!Array.isArray(vedlegg)) return;
    for (const v of vedlegg) {
      if (v && v.type === "bilde") besok(v);
    }
  };
  for (const felt of Object.values(feltVerdier)) {
    if (!felt) continue;
    tellListe(felt.vedlegg);
    // Repeater: verdi er en array av rader (record barnId -> { vedlegg }).
    if (Array.isArray(felt.verdi)) {
      for (const rad of felt.verdi) {
        if (!rad || typeof rad !== "object") continue;
        for (const barn of Object.values(rad as Record<string, unknown>)) {
          if (barn && typeof barn === "object") {
            tellListe((barn as FeltVerdiLite).vedlegg);
          }
        }
      }
    }
  }
}

/**
 * Neste ledige bildenummer for dokumentet. `max(høyeste tildelte nr, antall bilder) + 1`
 * — monotont stigende og kollisjonsfritt selv om noen eldre bilder mangler nummer.
 */
export function nesteBildeNr(
  feltVerdier: Record<string, FeltVerdiLite | undefined>,
): number {
  let maks = 0;
  let antall = 0;
  forHvertBilde(feltVerdier, (v) => {
    antall += 1;
    if (typeof v.bildeNr === "number" && v.bildeNr > maks) maks = v.bildeNr;
  });
  return Math.max(maks, antall) + 1;
}

/**
 * Tildel løpende bildeNr til bilde-vedlegg i repeater-rader som mangler det, med start
 * på `startNr`. Immutabel: returnerer SAMME referanse hvis ingenting mangler nummer
 * (unngår unødvendig state-churn ved f.eks. tekstredigering i en rad), ellers nye
 * rad-/felt-/vedlegg-objekter kun der et nummer ble satt.
 */
export function nummererRepeaterBilder<T>(rader: T, startNr: number): T {
  if (!Array.isArray(rader)) return rader;

  let neste = startNr;
  let noeEndret = false;

  const nyeRader = rader.map((rad) => {
    if (!rad || typeof rad !== "object") return rad;
    let radEndret = false;
    const nyRad: Record<string, unknown> = { ...(rad as Record<string, unknown>) };

    for (const feltId of Object.keys(nyRad)) {
      const felt = nyRad[feltId] as FeltVerdiLite | undefined;
      if (!felt || !Array.isArray(felt.vedlegg)) continue;
      const manglerNr = felt.vedlegg.some(
        (v) => v && v.type === "bilde" && v.bildeNr == null,
      );
      if (!manglerNr) continue;

      radEndret = true;
      noeEndret = true;
      nyRad[feltId] = {
        ...felt,
        vedlegg: felt.vedlegg.map((v) =>
          v && v.type === "bilde" && v.bildeNr == null
            ? { ...v, bildeNr: neste++ }
            : v,
        ),
      };
    }

    return radEndret ? nyRad : rad;
  });

  return (noeEndret ? nyeRader : rader) as T;
}
