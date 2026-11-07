import { createContext, useContext } from "react";

/**
 * Prosjektkort L2: satt når timer-seksjonen rendres i prosjektkort-flyten
 * (`timer/[id]/prosjektkort` og `timer/[id]/kort/[projectId]`). Prosjektet er
 * da låst i timer-modalen og byggeplass-arven heter «fra dagen» (ikke «fra
 * dagskortet»). Default false = dagskort-skjermen, uendret.
 *
 * ORDRE 36b: verdien er kortets valg (`KortLaas`) når modalen åpnes fra ett
 * kort — byggeplass og underprosjekt er da også låst (grå) til kortets valg.
 * Retting går kun via «Flytt raden». `true` = prosjektkort-modus uten kortlås.
 */
export type KortLaas = { byggeplassId: string | null; ecoId: string | null };

export const ProsjektkortKontekst = createContext<KortLaas | boolean>(false);

export function useProsjektkortModus(): boolean {
  return useContext(ProsjektkortKontekst) !== false;
}

/** Kortets låste (effektive byggeplass, underprosjekt), eller null utenfor et kort. */
export function useKortLaas(): KortLaas | null {
  const v = useContext(ProsjektkortKontekst);
  return typeof v === "object" ? v : null;
}
