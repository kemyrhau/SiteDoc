import type { DokumentRad } from "./dokumentlisteFilter";

/**
 * HMS-lista (filter-hms 2026-11-03): samme filterark, sortering og søk som oppgave- og
 * sjekklistelista, med to HMS-særtrekk som holdes rene her:
 *  - prioritet finnes bare på avvik/RUH (Task). SJA (Checklist) har ingen.
 *  - `hms.hentDokumenter` sender `recipientGroup.id`, ikke `recipientGroupId`.
 */

export type HmsFane = "avvik" | "sja" | "ruh";

/** Prioritet vises og filtreres bare i fanene som er Task. */
export function harPrioritet(fane: HmsFane): boolean {
  return fane !== "sja";
}

/**
 * Filteret som faktisk gjelder i fanen. Søk, filter og sortering beholdes ved fanebytte,
 * men et prioritetsfilter satt i avvik/RUH kan ikke gjelde i SJA — der ville det tømt
 * lista stille (SJA-radene har ingen prioritet). Det står igjen og gjelder igjen når
 * man går tilbake.
 */
export function filterForFane(
  filterVerdier: Record<string, string>,
  fane: HmsFane,
): Record<string, string> {
  if (harPrioritet(fane) || !filterVerdier.prioritet) return filterVerdier;
  const { prioritet: _prioritet, ...rest } = filterVerdier;
  return rest;
}

/** Server-/lokalrad slik HMS-lista får den (alle felt valgfrie — eldre API mangler noen). */
export interface HmsRad extends DokumentRad {
  recipientGroup?: { id?: string; name: string | null } | null;
}

/**
 * Fyller `recipientGroupId` fra `recipientGroup.id` så «ballen hos meg» virker for
 * gruppemottakere. Lokale rader har ingen id og forblir uten (ballen er da skjult).
 */
export function tilHmsDokumentRad(rad: HmsRad): HmsRad {
  if (rad.recipientGroupId != null || !rad.recipientGroup?.id) return rad;
  return { ...rad, recipientGroupId: rad.recipientGroup.id };
}
