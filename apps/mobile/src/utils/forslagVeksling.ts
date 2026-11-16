/**
 * RETUR 36c pkt 2: forslagsknappene under «Hva gjorde du i dag?» legger
 * forslaget TIL det arbeideren har skrevet (« · » mellom leddene), og nytt
 * trykk fjerner bare det leddet igjen. Skrevet tekst overskrives aldri.
 */
export const FORSLAG_SKILLE = " · ";

const ledd = (verdi: string) => verdi.split(FORSLAG_SKILLE);

/** Står forslaget som et eget ledd i teksten? (Knappen vises som valgt.) */
export function harForslag(verdi: string, forslag: string): boolean {
  return ledd(verdi).some((l) => l.trim() === forslag);
}

/** Legg til forslaget, eller fjern bare det leddet om det står der. */
export function vekslForslag(verdi: string, forslag: string): string {
  if (harForslag(verdi, forslag)) {
    return ledd(verdi)
      .filter((l) => l.trim() !== forslag)
      .join(FORSLAG_SKILLE);
  }
  const skrevet = verdi.trimEnd();
  return skrevet ? `${skrevet}${FORSLAG_SKILLE}${forslag}` : forslag;
}
