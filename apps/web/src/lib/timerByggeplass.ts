/**
 * Ordre 2026-11-05 (10) — byggeplass per timer-/maskin-rad i web-dagsseddelen.
 * Rene hjelpere for dialogens adaptive felt (0 = skjult, 1 = auto, 2+ = nedtrekk).
 */

export type ByggeplassValg = { id: string; projectId: string; name: string };

/** Byggeplassene som hører til radens prosjekt — kun disse er gyldige valg. */
export function byggeplasserForProsjekt<T extends { projectId: string }>(
  alle: readonly T[] | undefined,
  projectId: string,
): T[] {
  return (alle ?? []).filter((b) => b.projectId === projectId);
}

/**
 * Forhåndsvalg for en NY rad. Gjeldende verdi beholdes bare hvis den hører til
 * prosjektet (prosjektbytte → nullstilles). Én kandidat velges automatisk;
 * ellers toppbarens byggeplass hvis den hører til prosjektet; ellers tomt.
 */
export function velgStandardByggeplass(args: {
  gjeldende: string | null;
  kandidater: readonly { id: string }[];
  toppbar: string | null;
}): string | null {
  const { gjeldende, kandidater, toppbar } = args;
  const finnes = (id: string | null) =>
    !!id && kandidater.some((k) => k.id === id);
  if (finnes(gjeldende)) return gjeldende;
  if (kandidater.length === 1) return kandidater[0]!.id;
  if (finnes(toppbar)) return toppbar;
  return null;
}

/**
 * Ordre (12) B — «utelatt = urørt». En ny rad sender alltid byggeplassen; en
 * eksisterende rad bare når brukeren har endret den, så en byggeplass satt på mobil
 * ikke overskrives av en web-redigering av et annet felt.
 */
export function byggeplassErEndret(args: {
  erNy: boolean;
  opprinnelig: string | null;
  byggeplassId: string | null;
}): boolean {
  return args.erNy || args.byggeplassId !== args.opprinnelig;
}

/** Feltet i mutasjonens payload: med når endret, ellers utelatt (ikke null). */
export function byggeplassPayload(bp: {
  endret: boolean;
  byggeplassId: string | null;
}): { byggeplassId?: string | null } {
  return bp.endret ? { byggeplassId: bp.byggeplassId } : {};
}

/**
 * V22 — sekundærlinja «Prosjekt · Byggeplass» under timer-raden (web-paritet med
 * mobilens `ByggeplassLinjeTekst`). Radens egen byggeplass vises i vanlig styrke;
 * ellers arves sedelens, nedtonet med «(fra dagskortet)» / «(fra dagen)» i
 * prosjektkort-modus — men bare når den hører til radens prosjekt (sekundær-
 * prosjekt-rader arver ikke). Ingen av delene → «Ingen byggeplass».
 */
export function radByggeplassLinje(args: {
  radByggeplassId: string | null;
  sedelByggeplassId: string | null;
  projectId: string;
  byggeplasser: readonly ByggeplassValg[] | undefined;
  kortModus: boolean;
  t: (nokkel: string) => string;
}): { tekst: string; arvet: boolean; ingen: boolean } {
  const arvet = args.radByggeplassId == null;
  const id = args.radByggeplassId ?? args.sedelByggeplassId;
  const bp = id ? (args.byggeplasser ?? []).find((b) => b.id === id) : undefined;
  if (!bp || (arvet && bp.projectId !== args.projectId)) {
    return { tekst: args.t("timer.byggeplass.ingenValgt"), arvet: false, ingen: true };
  }
  if (!arvet) return { tekst: bp.name, arvet: false, ingen: false };
  const fra = args.kortModus ? "timer.byggeplass.fraDagen" : "timer.byggeplass.fraDagskort";
  return { tekst: `${bp.name} (${args.t(fra)})`, arvet: true, ingen: false };
}
