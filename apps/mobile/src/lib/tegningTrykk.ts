// Ren avgjørelse for hva et trykk i tegningsvisningen skal gjøre.
//
// Trukket ut av WebView-en (`TegningsVisning.tsx`) slik at logikken kan testes
// uten å mounte WebView-en. WebView-en rapporterer bare den rå gesten (varighet,
// om fingeren flyttet seg, antall samtidige pekere); RN kaller denne funksjonen.
//
// Ordre (mobil tegning, SVAR 2026-10-07): «langt trykk via `avgjorTrykkHandling`
// (ren, testet)». Måling bare når et verktøy er aktivt.

/** Modus tegningsvisningen er i når trykket skjer. */
export type TrykkModus = "navigering" | "plassering" | "maling";

/** Hva WebView-en målte for ett trykk. */
export interface TrykkGest {
  /** Hvor lenge fingeren var nede (ms). */
  varighetMs: number;
  /** Beveget fingeren seg mer enn terskelen? (= pan/scroll, ikke et trykk) */
  flyttet: boolean;
  /** Antall samtidige pekere på et tidspunkt i gesten (≥2 = knip/zoom). */
  antallPekere: number;
  /** Gesten dro et eksisterende målepunkt (TILLEGG RETUR 1) → aldri hint/opprett/nytt punkt. */
  drarPunkt?: boolean;
}

/** Resulterende handling. */
export type TrykkHandling = "ingen" | "hint" | "opprett" | "malepunkt";

/** Et langt trykk er ≥ dette (ms). Under = kort trykk. */
export const LANGT_TRYKK_MS = 500;

/**
 * Avgjør hva et trykk skal gjøre.
 *
 * - Pan (flyttet) eller knip (≥2 pekere) → `ingen` (ikke et trykk).
 * - Målemodus → hvert trykk er et `malepunkt` (og ingenting annet — ordre § 3).
 * - Plasseringsmodus → trykk `opprett`er (dagens oppførsel).
 * - Navigeringsmodus → langt trykk `opprett`er, kort trykk gir `hint`.
 */
export function avgjorTrykkHandling(modus: TrykkModus, gest: TrykkGest): TrykkHandling {
  // Å dra et eksisterende målepunkt er aldri et trykk (TILLEGG RETUR 1).
  if (gest.drarPunkt) return "ingen";
  if (gest.flyttet || gest.antallPekere > 1) return "ingen";
  if (modus === "maling") return "malepunkt";
  if (modus === "plassering") return "opprett";
  // navigering
  return gest.varighetMs >= LANGT_TRYKK_MS ? "opprett" : "hint";
}
