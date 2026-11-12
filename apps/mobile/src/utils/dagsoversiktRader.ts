/**
 * Radform (Kenneth 2026-11-12, godkjent plan «Dagsoversikt i radform»):
 * dagsoversikten viser én boks pr. timerrad i tidsrekkefølge, med radens egen
 * maskin og varer under. Ren funksjon — ingen DB/UI — så rekkefølge,
 * plassering og «Uten rad» er testbart.
 *
 * Regler:
 * - Én boks pr. rad. Rader slås ALDRI sammen, heller ikke like rader på samme
 *   prosjekt (brukerens oppdeling kan ha fakturagrunn).
 * - Rekkefølge: fra-tid stigende; rader uten fra-tid sist, i innkommende orden.
 * - Maskin/vare havner under raden bare når koblingen (`sheetTimerId`) peker på
 *   en vist rad OG prosjektet stemmer. Alt annet går under «Uten rad» — aldri
 *   skjult, aldri plassert etter skjønn.
 */

export type RadformTimer = {
  id: string;
  projectId: string;
  fraTid: string | null;
  timer: number;
};

export type RadformKoblet = {
  id: string;
  projectId: string;
  sheetTimerId?: string | null;
};

export type RadformBoks<T, M, V> = { rad: T; maskin: M[]; varer: V[] };

export type RadformDag<T, M, V> = {
  rader: RadformBoks<T, M, V>[];
  utenRad: { maskin: M[]; varer: V[] };
};

export function raderForDag<T extends RadformTimer, M extends RadformKoblet, V extends RadformKoblet>(args: {
  timer: T[];
  maskin: M[];
  varer: V[];
}): RadformDag<T, M, V> {
  const sortert = args.timer
    .map((rad, i) => ({ rad, i }))
    .sort((a, b) => {
      const fa = a.rad.fraTid ?? null;
      const fb = b.rad.fraTid ?? null;
      if (fa !== fb) {
        if (fa === null) return 1;
        if (fb === null) return -1;
        return fa < fb ? -1 : 1;
      }
      return a.i - b.i;
    })
    .map((x) => x.rad);

  const bokser = sortert.map((rad) => ({ rad, maskin: [] as M[], varer: [] as V[] }));
  const etterId = new Map(bokser.map((b) => [b.rad.id, b]));
  const utenRad = { maskin: [] as M[], varer: [] as V[] };

  const plasser = <X extends RadformKoblet>(x: X, felt: "maskin" | "varer") => {
    const boks = x.sheetTimerId ? etterId.get(x.sheetTimerId) : undefined;
    const maal = boks && boks.rad.projectId === x.projectId ? boks : utenRad;
    (maal[felt] as unknown as X[]).push(x);
  };
  for (const m of args.maskin) plasser(m, "maskin");
  for (const v of args.varer) plasser(v, "varer");

  return { rader: bokser, utenRad };
}

/**
 * Første rad (i visningsrekkefølge) som mangler beskrivelse — Send sperres og
 * meldingen peker hit (beslutning 3). Reise krever ikke beskrivelse.
 */
export function forsteRadUtenBeskrivelse<T extends { id: string; beskrivelse: string | null; erReise: boolean }>(
  rader: T[],
): T | null {
  return rader.find((r) => !r.erReise && !(r.beskrivelse ?? "").trim()) ?? null;
}
