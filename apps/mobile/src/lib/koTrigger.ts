/**
 * Telefontest A funn 2: synken vekker opplastingskøen når den har pushet rader, så en
 * kvittering som ventet på at tillegg-/utlegg-raden skulle finnes på serveren, registreres
 * med en gang i stedet for å vente på backoff. Ren pub/sub uten React — timerSync kjører
 * utenfor React-treet.
 */
const lyttere = new Set<() => void>();

export function abonnerKoen(fn: () => void): () => void {
  lyttere.add(fn);
  return () => {
    lyttere.delete(fn);
  };
}

export function varsleKoen(): void {
  for (const fn of lyttere) {
    try {
      fn();
    } catch (e) {
      console.warn("[KØ] Køtrigger feilet:", e);
    }
  }
}
