// Ren avgjørelse for hva en gest i tegningsvisningen skal gjøre.
//
// Trukket ut av WebView-en (`TegningsVisning.tsx`) slik at logikken kan testes
// uten å mounte WebView-en. WebView-en rapporterer bare den rå gesten (hvilket
// verktøy som er aktivt, gest-kontekst: varighet, bevegelse, antall pekere, om
// nedtrykket traff et punkt/en måling); RN kaller denne funksjonen ved SLIPP.
//
// RETUR 3 (2026-10-08): gjetningen «samme trykk betyr fire ting» er erstattet av
// EKSPLISITTE verktøy. Ett verktøy er aktivt om gangen, og verktøyet — ikke hvor/
// hvor lenge fingeren lå — bestemmer hva gesten gjør. Punktet settes ved SLIPP
// (touch-up), ikke ved nedtrykk, så brukeren kan justere mot lupa før slipp.

/** Aktivt verktøy i tegningsvisningen. null-modellen («ingen verktøy») = navigering. */
export type TegningVerktoy =
  | "navigering"
  | "flytt"
  | "linjal"
  | "polylinje"
  | "areal"
  | "opprett";

/** Måleverktøyene som setter punkter. */
export const MALEVERKTOY: readonly TegningVerktoy[] = ["linjal", "polylinje", "areal"];

/** Er verktøyet et måleverktøy (setter punkter)? */
export function erMaleVerktoy(v: TegningVerktoy): v is "linjal" | "polylinje" | "areal" {
  return v === "linjal" || v === "polylinje" || v === "areal";
}

/** Gest-faser. Punktet settes i `opp` (set-on-release); lupa vises i `ned`+`flytt`. */
export type GestFase = "ned" | "flytt" | "opp";

/** Hva WebView-en målte for én gest (ved slipp). */
export interface TrykkGest {
  /** Hvor lenge primærfingeren var nede (ms). */
  varighetMs: number;
  /** Beveget fingeren seg mer enn terskelen? (pan / justering før slipp) */
  flyttet: boolean;
  /** Antall samtidige pekere på et tidspunkt i gesten (≥2 = knip/zoom). */
  antallPekere: number;
  /** Nedtrykket traff et punkt i den AKTIVE målingen (grunnlag for dra i Flytt). */
  nedPaaPunkt?: boolean;
  /** Nedtrykket traff en eksisterende måling (grunnlag for valg i Flytt). */
  traffMaling?: boolean;
}

/** Resulterende handling ved slipp. */
export type TrykkHandling =
  | "ingen"
  | "pan"
  | "hint"
  | "opprett"
  | "settPunkt"
  | "draPunkt"
  | "velgMaling";

/** Et langt trykk er ≥ dette (ms). Under = kort trykk. */
export const LANGT_TRYKK_MS = 500;

/**
 * Avgjør hva en gest skal gjøre ved slipp, gitt aktivt verktøy.
 *
 * - Knip (≥2 pekere) → `pan` (zoom, aldri commit). 🔴 Rotårsaken til RETUR 3 § 0
 *   (skjermlås + «måling forsvant») var at samme gest betydde fire ting; her er
 *   hvert verktøy entydig.
 * - **Flytt:** dra et punkt (`draPunkt`), ellers velg en truffet måling
 *   (`velgMaling`), ellers panorér. **Setter ALDRI punkt.**
 * - **Linjal/Polylinje/Areal:** `settPunkt`. **Drar ALDRI, velger ALDRI.**
 * - **Opprett:** rent trykk → `opprett` (markør + mal); bevegelse → `pan`.
 * - **Navigering:** kort trykk → `hint`, langt → `opprett`, bevegelse → `pan`.
 */
export function avgjorTrykkHandling(verktoy: TegningVerktoy, gest: TrykkGest): TrykkHandling {
  if (gest.antallPekere > 1) return "pan";

  switch (verktoy) {
    case "flytt":
      if (gest.nedPaaPunkt) return "draPunkt";
      if (!gest.flyttet && gest.traffMaling) return "velgMaling";
      return "pan";
    case "linjal":
    case "polylinje":
    case "areal":
      // Måleverktøy: ett rent trykk (med justering før slipp) setter ett punkt.
      // Aldri dra, aldri velg — det er Flytt-verktøyets jobb.
      return "settPunkt";
    case "opprett":
      return gest.flyttet ? "pan" : "opprett";
    case "navigering":
      if (gest.flyttet) return "pan";
      return gest.varighetMs >= LANGT_TRYKK_MS ? "opprett" : "hint";
    default:
      return "ingen";
  }
}

/**
 * Skal lupa vises mens fingeren ligger nede (ned/flytt-fasen)?
 * - Måleverktøy: alltid (brukeren plasserer et punkt → sett-ved-slipp).
 * - Flytt: kun når nedtrykket traff et punkt (da skal det dras).
 * - Ellers: nei (pan/zoom/navigering trenger ingen lupe).
 */
export function visLupeForGest(verktoy: TegningVerktoy, nedPaaPunkt: boolean): boolean {
  if (erMaleVerktoy(verktoy)) return true;
  if (verktoy === "flytt") return nedPaaPunkt;
  return false;
}
