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
//
// Flyttet hit fra `apps/mobile/src/lib/tegningTrykk.ts` (mobil leveranse 3+4,
// "POST: mobil leveranse 3+4, lupe og måling i dxf-viewer"): ren, DOM/RN-fri
// avgjørelse — samme gest-til-handling-logikk gjelder for WebGL-måling i
// `DxfViewerTegning.tsx` (web-komponent, kjøres av BÅDE web-dashbordet og mobil-
// WebView-en), som for SVG-veiens `TegningsVisning.tsx`. Ingen endring i selve
// logikken, kun flyttet for å unngå en duplisert kopi i web.

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
 * Et langt trykk PÅ ET MÅLEPUNKT (Flytt-verktøyet) er ≥ dette (ms) — kortere enn
 * `LANGT_TRYKK_MS` (POST flytte målepunkter, orkestrator 2026-10-18, pkt 3: "langt
 * trykk (~300 ms) på et punkt + dra flytter det"). Egen konstant: de to tersklene
 * har ulik semantikk (her: terskel for å COMMITTE en flytting; `LANGT_TRYKK_MS`:
 * navigering sitt skille mellom hint og opprett) og skal kunne justeres uavhengig.
 */
export const LANGT_TRYKK_PUNKT_MS = 300;

/**
 * Avgjør hva en gest skal gjøre ved slipp, gitt aktivt verktøy.
 *
 * - Knip (≥2 pekere) → `pan` (zoom, aldri commit). 🔴 Rotårsaken til RETUR 3 § 0
 *   (skjermlås + «måling forsvant») var at samme gest betydde fire ting; her er
 *   hvert verktøy entydig.
 * - **Flytt:** nedtrykk på et punkt + (bevegelse ELLER ≥`LANGT_TRYKK_PUNKT_MS`) →
 *   dra det (`draPunkt`). Et KORT trykk uten bevegelse på et punkt → `velgMaling`
 *   (markerer HELE målingen, flytter ikke — POST 2026-10-18 pkt 3: "Kort trykk på
 *   et punkt markerer målingen, ikke objekt under"). Et trykk/dra på et SEGMENT
 *   (ingen punkt-treff) → også `velgMaling` (panorering er uansett deaktivert for
 *   hele gesten når et segment er truffet — se kalleren). Ellers panorér. **Setter
 *   ALDRI nytt punkt.**
 * - **Linjal/Polylinje/Areal:** `settPunkt`. **Drar ALDRI, velger ALDRI.**
 * - **Opprett:** rent trykk → `opprett` (markør + mal); bevegelse → `pan`.
 * - **Navigering:** kort trykk → `hint`, langt → `opprett`, bevegelse → `pan`.
 */
export function avgjorTrykkHandling(verktoy: TegningVerktoy, gest: TrykkGest): TrykkHandling {
  if (gest.antallPekere > 1) return "pan";

  switch (verktoy) {
    case "flytt":
      if (gest.nedPaaPunkt) {
        if (gest.flyttet || gest.varighetMs >= LANGT_TRYKK_PUNKT_MS) return "draPunkt";
        return "velgMaling"; // kort trykk uten bevegelse: velg målingen, ikke dra
      }
      if (gest.traffMaling) return "velgMaling"; // traff et segment (ikke et punkt)
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
