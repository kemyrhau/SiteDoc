/**
 * (18) Ren valglogikk for den delte prosjekt- og byggeplassvelgeren (mobil `ProsjektVelger.tsx`, web `KontekstChip.tsx`).
 *
 * Prosjektlista øverst, byggeplasslista for det MARKERTE prosjektet under. Et trykk
 * på et prosjekt markerer det bare (ingenting velges). Et trykk på en byggeplass
 * eller på «Hele prosjektet» velger prosjekt + byggeplass og lukker. Et prosjekt med
 * 0 byggeplasser, eller uten kjent liste offline, velges direkte som før (18).
 */

export interface ByggeplassValgRad {
  id: string;
  name: string;
  number: number | null;
}

/**
 * Byggeplasslista for ett prosjekt, slik velgeren kjenner den:
 * - `"laster"`: serverspørringen pågår (på nett).
 * - `"ukjent"`: frakoblet og ingen lokal katalog for prosjektet (`byggeplass_nav_local` tom).
 * - en liste: kjent (server på nett, ellers lokal katalog). Kan være tom (0 byggeplasser).
 */
export type ByggeplassKilde = ByggeplassValgRad[] | "laster" | "ukjent";

/** Velg kilde for ett prosjekts byggeplasser: server når på nett og hentet, ellers lokal katalog. */
export function velgByggeplassKilde(input: {
  erPaaNettet: boolean;
  serverData: ByggeplassValgRad[] | undefined;
  serverLaster: boolean;
  lokale: ByggeplassValgRad[];
}): ByggeplassKilde {
  if (input.erPaaNettet) {
    if (input.serverData) return input.serverData;
    // Mens serveren svarer: vis lokal katalog hvis den finnes, ellers «laster».
    if (input.lokale.length > 0) return input.lokale;
    return input.serverLaster ? "laster" : "ukjent";
  }
  // Frakoblet: lokal katalog. En tom katalog kan bety «ikke hentet» — ikke «0».
  return input.lokale.length > 0 ? input.lokale : "ukjent";
}

/** Antall som vises på prosjektraden; null = ukjent (vises ikke). */
export function antallByggeplasser(kilde: ByggeplassKilde): number | null {
  return Array.isArray(kilde) ? kilde.length : null;
}

export type ProsjektTrykkHandling =
  | { type: "marker"; prosjektId: string }
  | { type: "velgProsjekt"; prosjektId: string };

/**
 * Trykk på en prosjektrad. 0 byggeplasser → velg prosjektet direkte og lukk.
 * Frakoblet uten katalog (`"ukjent"`) → velg direkte som før (18). Ellers kun markering.
 */
export function vedProsjektTrykk(prosjektId: string, kilde: ByggeplassKilde): ProsjektTrykkHandling {
  if (kilde === "laster") return { type: "marker", prosjektId };
  if (kilde === "ukjent" || kilde.length === 0) return { type: "velgProsjekt", prosjektId };
  return { type: "marker", prosjektId };
}

export interface ByggeplassValg {
  /** Prosjektet som blir aktivt. */
  prosjektId: string;
  /** Byggeplassen som lagres på `prosjektId`; null = «Hele prosjektet». */
  byggeplassId: string | null;
}

/**
 * Trykk på en byggeplass (eller «Hele prosjektet» med `byggeplassId = null`) i lista
 * for det markerte prosjektet. Valget lagres alltid på det MARKERTE prosjektet —
 * ikke på prosjektet som var aktivt før velgeren ble åpnet.
 */
export function vedByggeplassTrykk(markertProsjektId: string, byggeplassId: string | null): ByggeplassValg {
  return { prosjektId: markertProsjektId, byggeplassId };
}

/** Avhuking av byggeplass: kun når det markerte prosjektet er det aktive. */
export function erByggeplassAvhuket(input: {
  markertProsjektId: string | null;
  valgtProsjektId: string | null;
  valgtBygningId: string | null;
  erHeleProsjektet: boolean;
  byggeplassId: string | null;
}): boolean {
  if (!input.markertProsjektId || input.markertProsjektId !== input.valgtProsjektId) return false;
  if (input.byggeplassId === null) return input.erHeleProsjektet;
  return input.byggeplassId === input.valgtBygningId;
}

/**
 * Neste `bygningMap` når et valg lagres på `prosjektId`. Brukes av `settBygning` /
 * `velgHeleProsjektet` i `ByggeplassKontekst` — prosjekt-id-en er et parameter, ikke
 * det aktive prosjektet fra closure, så velgeren lagrer på riktig prosjekt selv om
 * prosjektbyttet ikke er gjennomført ennå (18).
 */
export function oppdaterBygningMap(
  prev: Record<string, string>,
  prosjektId: string,
  verdi: string,
): Record<string, string> {
  return { ...prev, [prosjektId]: verdi };
}
