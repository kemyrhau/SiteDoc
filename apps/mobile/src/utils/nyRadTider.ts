import { hhmmTilMin } from "@sitedoc/shared";

/**
 * Forslag til fra/til på en NY timerad (M6 bolk (g) prefill-scope):
 *  - fra = SENESTE tilTid over hele sedelen (maks via hhmmTilMin, rekkefølge-
 *    uavhengig), ellers firmaets starttid;
 *  - til = firmaets sluttid — UNNTATT reise (ORDRE 36c del B): en reiserad
 *    er kort og knyttet til når man dro, så sluttiden foreslås ikke. Brukeren
 *    fyller den selv; «Antall» står tomt til da.
 */
export function nyRadTider(input: {
  reise: boolean;
  tilTider: (string | null | undefined)[];
  effektiv: { startTid: string | null; sluttTid: string | null };
}): { fra: string | null; til: string | null } {
  const senesteTil = input.tilTider
    .filter((tid): tid is string => !!tid)
    .reduce<string | null>(
      (senest, tid) => (senest === null || hhmmTilMin(tid) > hhmmTilMin(senest) ? tid : senest),
      null,
    );
  return {
    fra: senesteTil ?? input.effektiv.startTid,
    til: input.reise ? null : input.effektiv.sluttTid,
  };
}
