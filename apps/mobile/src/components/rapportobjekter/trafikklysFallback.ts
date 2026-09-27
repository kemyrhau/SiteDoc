import { TRAFIKKLYS_VALG } from "@sitedoc/shared";

/**
 * Fallback-beslutning for `TrafikklysObjekt`: er den lagrede verdien en ikke-tom streng UTENFOR
 * `TRAFIKKLYS_VALG`, returnér den rå verdien (rendreren viser den som en foreldreløs brikke, så
 * feltet ikke ser ubesvart ut mens databasen har et svar). Kjent verdi / tom / ikke-streng → null.
 *
 * Egen ren fil (ingen react-native) så mobilens node-testmiljø kan importere den. Web speiler
 * beslutningen inline; begge leser samme verdisett (`TRAFIKKLYS_VALG`, @sitedoc/shared), så de
 * kan ikke være uenige om hva som er gyldig.
 */
export function ukjentTrafikklysVerdi(verdi: unknown): string | null {
  if (typeof verdi !== "string" || verdi === "") return null;
  return TRAFIKKLYS_VALG.some((v) => v.value === verdi) ? null : verdi;
}
