/**
 * ORDRE 37 (2026-11-07): varesøket i «Registrer vareforbruk» skal vise treffene
 * over tastaturet. Når søkefeltet har fokus og tastaturet er oppe, rulles
 * dialogen slik at «Vare»-blokka står øverst og treff-lista fyller plassen ned
 * mot tastaturet. Ren logikk — komponenten gir layout-tall og Keyboard-API inn.
 */

/** Rulle-y som legger «Vare»-blokka `marg` pt under toppen. Aldri under 0. */
export function varesokRullMal({
  kortY,
  feltY,
  marg,
}: {
  /** Kortets y i rulleflatens innhold. */
  kortY: number;
  /** «Vare»-blokkas y inne i kortet. */
  feltY: number;
  marg: number;
}): number {
  return Math.max(0, kortY + feltY - marg);
}

type Abonnement = { remove: () => void };

/**
 * Fokus-styring for søkefeltet. Er tastaturet allerede oppe (feltet fikk fokus
 * på nytt etter «hold åpen», eller fokus flyttes fra antall-feltet), rulles det
 * med en gang — da kommer ingen ny `keyboardDidShow`. Ellers lyttes det til
 * `keyboardDidShow` til feltet mister fokus. Lytteren fjernes ved blur og
 * `rydd()` (unmount), og aldri mer enn én om gangen.
 */
export function lagVaresokFokus({
  tastaturSynlig,
  lyttVist,
  rull,
}: {
  tastaturSynlig: () => boolean;
  lyttVist: (fn: () => void) => Abonnement;
  rull: () => void;
}) {
  let abonnement: Abonnement | null = null;
  const fjern = () => {
    abonnement?.remove();
    abonnement = null;
  };
  return {
    onFocus() {
      fjern();
      abonnement = lyttVist(rull);
      if (tastaturSynlig()) rull();
    },
    onBlur: fjern,
    rydd: fjern,
  };
}
