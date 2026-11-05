import { createContext, useContext } from "react";

/**
 * Prosjektkort L2: true når timer-seksjonen rendres på ett prosjektkort
 * (`timer/[id]/kort/[projectId]`). Prosjektet er da låst i timer-modalen og
 * byggeplass-arven heter «fra dagen» (ikke «fra dagskortet»). Default false =
 * dagskort-skjermen, uendret.
 */
export const ProsjektkortKontekst = createContext(false);

export function useProsjektkortModus(): boolean {
  return useContext(ProsjektkortKontekst);
}
