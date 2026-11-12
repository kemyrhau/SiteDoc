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
 * TILLEGG 2026-11-12 regel 4–5: sortering på underprosjekt. Raden eier
 * prosjekt og underprosjekt — hver boks havner HEL (med sine maskiner og varer)
 * i gruppen til RADENS (prosjekt, underprosjekt), uansett hva linjene selv
 * bærer. «Uten rad» (bare gamle, ukoblede linjer) havner i gruppen til linjens
 * egen (prosjekt, underprosjekt). Gruppene står i rekkefølgen til sin første
 * rad (tidsrekkefølge); grupper med bare «Uten rad» kommer sist. Ingenting slås
 * sammen.
 */
export type RadformGruppe<T, M, V> = {
  projectId: string;
  ecoId: string | null;
  rader: RadformBoks<T, M, V>[];
  utenRad: { maskin: M[]; varer: V[] };
};

type MedEco = { externalCostObjectId?: string | null };

export function grupperPaaUnderprosjekt<
  T extends RadformTimer & MedEco,
  M extends RadformKoblet & MedEco,
  V extends RadformKoblet & MedEco,
>(dag: RadformDag<T, M, V>): RadformGruppe<T, M, V>[] {
  const grupper: RadformGruppe<T, M, V>[] = [];
  const etterNokkel = new Map<string, RadformGruppe<T, M, V>>();
  const gruppe = (projectId: string, ecoId: string | null) => {
    const k = `${projectId}|${ecoId ?? ""}`;
    let g = etterNokkel.get(k);
    if (!g) {
      g = { projectId, ecoId, rader: [], utenRad: { maskin: [], varer: [] } };
      etterNokkel.set(k, g);
      grupper.push(g);
    }
    return g;
  };
  for (const boks of dag.rader) gruppe(boks.rad.projectId, boks.rad.externalCostObjectId ?? null).rader.push(boks);
  for (const m of dag.utenRad.maskin) gruppe(m.projectId, m.externalCostObjectId ?? null).utenRad.maskin.push(m);
  for (const v of dag.utenRad.varer) gruppe(v.projectId, v.externalCostObjectId ?? null).utenRad.varer.push(v);
  return grupper;
}

/**
 * Første rad (i visningsrekkefølge) som mangler beskrivelse — Send sperres og
 * meldingen peker hit (beslutning 3). Reise krever ikke beskrivelse.
 */
export function forsteRadUtenBeskrivelse<T extends { id: string; beskrivelse: string | null; erReise: boolean }>(
  rader: T[],
): T | null {
  return rader.find((r) => radManglerBeskrivelse(r.beskrivelse, r.erReise)) ?? null;
}

/**
 * Kenneth 2026-11-12: en arbeidsrad kan ikke lagres uten beskrivelse. Reise er
 * unntatt. Brukes av rad-modalens lagre-sperre og av Send-sperren.
 */
export function radManglerBeskrivelse(beskrivelse: string | null, erReise: boolean): boolean {
  return !erReise && !(beskrivelse ?? "").trim();
}
