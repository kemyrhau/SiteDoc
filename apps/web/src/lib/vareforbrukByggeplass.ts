/**
 * ORDRE 29 #8 — vareforbruk følger toppbarens byggeplass. Rene hjelpere for listefilteret og
 * forhåndsvalget i ny rad.
 */

/**
 * Listefilteret. `valgt` = brukerens eget valg (`""` = «Alle»), `null` = ikke valgt ennå → følg
 * toppbarens aktive byggeplass. Den aktive brukes bare når den finnes blant prosjektets
 * byggeplasser (ellers ville filteret gitt tom liste uten synlig grunn).
 */
export function vareforbrukFilter(args: {
  valgt: string | null;
  aktiv: string | null | undefined;
  byggeplassIder: readonly string[] | undefined;
}): string {
  if (args.valgt !== null) return args.valgt;
  return args.aktiv && args.byggeplassIder?.includes(args.aktiv) ? args.aktiv : "";
}

/** Forhåndsvalg i modalen: redigert rad beholder sin egen; ny rad starter på toppbarens. */
export function vareforbrukStartByggeplass(
  rad: { byggeplassId: string | null } | undefined,
  aktiv: string | null | undefined,
): string {
  return rad ? (rad.byggeplassId ?? "") : (aktiv ?? "");
}
