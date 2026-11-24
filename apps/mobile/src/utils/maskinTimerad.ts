import { erGyldigTimeradKobling, maskinKreverTimerad } from "@sitedoc/shared";

/* ============================================================================
 *  Kort-id d2c-2 (spec § 12.2 R24, H12, H13, H15 = A): maskin → timerad på
 *  telefonen. Rene funksjoner oppå den delte regelen i
 *  `packages/shared/src/utils/maskinKobling.ts` — ingen egen regel her.
 *
 *  «Arbeidsrad» er en timerad maskinen kan kobles til: samme prosjekt, ikke
 *  reise, ikke fravær uten prosjekt, mer enn 0 timer (`erGyldigTimeradKobling`).
 * ============================================================================ */

/** Timerad slik maskinvinduet ser den. `erReise` er visningens (lønnsart eller flagg). */
export type TimeradKandidat = {
  id: string;
  projectId: string | null;
  kortId: string | null;
  timer: number;
  erReise: boolean;
  fraTid: string | null;
  tilTid: string | null;
};

/** Er raden en arbeidsrad maskinen kan stå på? Kalleren har alt valgt bøtta/kortet. */
export function erArbeidsradForMaskin(r: TimeradKandidat): boolean {
  return erGyldigTimeradKobling(
    { kortId: r.kortId, sheetTimerId: r.id },
    [{ id: r.id, kortId: r.kortId, projectId: r.projectId, timer: r.timer, erReise: r.erReise }],
  );
}

/** Arbeidsradene i bøtta eller kortet, sortert på fra-tid (uten tid sist, ellers ført rekkefølge). */
export function arbeidsraderForMaskin<R extends TimeradKandidat>(rader: readonly R[]): R[] {
  return rader
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => erArbeidsradForMaskin(r))
    .sort((a, b) => {
      if (a.r.fraTid && b.r.fraTid && a.r.fraTid !== b.r.fraTid) return a.r.fraTid < b.r.fraTid ? -1 : 1;
      if (!!a.r.fraTid !== !!b.r.fraTid) return a.r.fraTid ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ r }) => r);
}

/**
 * Forvalgt timerad i vinduet: maskinens egen kobling når den er blant
 * kandidatene, ellers den eneste arbeidsraden, ellers ingen (som PC, d2c-1).
 */
export function forvalgtTimeradId(
  eksisterende: string | null | undefined,
  kandidater: readonly { id: string }[],
): string | null {
  if (eksisterende && kandidater.some((r) => r.id === eksisterende)) return eksisterende;
  return kandidater.length === 1 ? kandidater[0]!.id : null;
}

/** Hvorfor maskinen ikke kan lagres (R24), eller null. */
export type TimeradSperre = "velg" | "ingenArbeidsrad";

/**
 * R24 ved lagring: en maskin som krever timerad (alt unntatt «doegn», også ukjent
 * enhet) lagres bare med en valgt arbeidsrad. En valgt rad må alltid være blant
 * kandidatene — også for døgn-maskin (som serveren, d2c-1).
 */
export function timeradSperre(
  utleieEnhet: string | null | undefined,
  valgtId: string | null,
  kandidater: readonly { id: string }[],
): TimeradSperre | null {
  if (valgtId && kandidater.some((r) => r.id === valgtId)) return null;
  if (!maskinKreverTimerad(utleieEnhet)) return valgtId ? "velg" : null;
  return kandidater.length === 0 ? "ingenArbeidsrad" : "velg";
}
