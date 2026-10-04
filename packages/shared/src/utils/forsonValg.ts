/**
 * V19 (overlapp PC ↔ mobil) — bygg `forsonDagskort`-input fra arbeiderens valg.
 *
 * Mobil (DagskortSammenligning) og web (arbeiderens valg-seksjon) bygger NØYAKTIG det
 * samme `{ oppdateringer, nyeRader }` fra forslaget på serveren + valget pr. tidsrom, så
 * de to flatene ikke kan divergere. Ren, uten avhengigheter (speiler tidsromValidering).
 *
 * Kilden er ALLTID forslaget på serveren (SheetTimerForslag), ikke lokale rader —
 * telefonen viser og sender det samme som PC-en (spec § 3 A-5(3)).
 *
 * Paring PR. OVERLAPP, ikke eksakt tidsrom (fasit § 6: web 07:00–15:00 og mobil
 * 07:00–15:30 er SAMME slot → «appen» erstatter web-raden IN-PLACE → 8 t, ikke 15,5).
 * Hver forslagsrad pares med den FØRSTE serverraden (sortert på fra-tid) den overlapper
 * og som ikke alt er paret — 1:1 i praksis (én sammenhengende arbeidsdag pr. side).
 *
 * `forsonDagskort`-semantikken (M7, Q3(b)): valgt-forslag på et tidsrom begge hadde →
 * erstatt serverraden in-place på DENS id (`oppdateringer`); forslagsrad uten motpart →
 * opprett (`nyeRader`); valgt-sedel / serverrad uten motpart → no-op (beholdes). Ingen
 * `fjern`-op: en enkeltstående rad kan ikke velges bort (samme forutsetning som
 * `forsonDagskort`-kommentaren rundt :1812).
 */

import { tidsromOverlapper } from "./tidsromValidering";

/** Hvilken side arbeideren valgte for et tidsrom begge hadde. */
export type ForsonSide = "forslag" | "sedel";

/**
 * Minste felles form for en rad på begge sider — serverraden (`SheetTimer`, PC/web) og
 * forslagsraden (`SheetTimerForslag`, mobil). Feltene er de `forsonDagskort` skriver.
 * `id` på en serverrad er sheet_timer-id (målet for in-place-erstatning); `id` på en
 * forslagsrad brukes kun som valg-nøkkel (ikke skrevet videre).
 */
export interface ForsonRad {
  id: string;
  projectId: string;
  byggeplassId?: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string | null;
  tilTid: string | null;
  beskrivelse?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
}

/** En `forsonDagskort.oppdateringer`-rad (erstatt serverrad in-place på dens id). */
export interface ForsonOppdatering {
  id: string;
  projectId: string;
  byggeplassId?: string | null;
  lonnsartId: string;
  aktivitetId: string;
  timer: number;
  fraTid: string;
  tilTid: string;
  beskrivelse?: string | null;
  externalCostObjectId?: string | null;
  vehicleId?: string | null;
}

/** En `forsonDagskort.nyeRader`-rad (opprett — forslagsrad uten motpart). */
export type ForsonNyRad = Omit<ForsonOppdatering, "id">;

export interface ForsonInput {
  oppdateringer: ForsonOppdatering[];
  nyeRader: ForsonNyRad[];
}

function harTid(
  r: ForsonRad,
): r is ForsonRad & { fraTid: string; tilTid: string } {
  return !!r.fraTid && !!r.tilTid;
}

function tilNyRad(f: ForsonRad): ForsonNyRad {
  return {
    projectId: f.projectId,
    byggeplassId: f.byggeplassId ?? null,
    lonnsartId: f.lonnsartId,
    aktivitetId: f.aktivitetId,
    timer: f.timer,
    // forsonDagskort krever fra/til på hver rad (superRefine). Forslag uten tid kan
    // ikke bli en ny rad — hoppes over av kalleren (harTid-filter under).
    fraTid: f.fraTid as string,
    tilTid: f.tilTid as string,
    beskrivelse: f.beskrivelse ?? null,
    externalCostObjectId: f.externalCostObjectId ?? null,
    vehicleId: f.vehicleId ?? null,
  };
}

/**
 * Bygg `forsonDagskort`-input fra serverradene (PC/web), forslaget (mobil) og valget.
 *
 * @param sedelRader serverens timer-rader på sedelen (`SheetTimer`, slik de ligger nå).
 * @param forslag    forslagsradene (`SheetTimerForslag`).
 * @param valg       pr. forslagsrad-id: `"forslag"` (ta mobilens) eller `"sedel"` (behold
 *                   PC). Mangler en nøkkel → `"sedel"` (konservativt: ingen lønnsdata
 *                   overskrives uten et eksplisitt valg). Et «hele dagen»-valg setter
 *                   samme side for alle forslagsrad-id-er (UI-snarvei).
 */
export function byggForsonInputFraValg(
  sedelRader: readonly ForsonRad[],
  forslag: readonly ForsonRad[],
  valg: Readonly<Record<string, ForsonSide>>,
): ForsonInput {
  const oppdateringer: ForsonOppdatering[] = [];
  const nyeRader: ForsonNyRad[] = [];

  // Serverrader sortert på fra-tid for deterministisk 1:1-paring; de uten tid kan
  // aldri pares (ingen overlapp-definisjon) → de står alltid (no-op).
  const serverMedTid = sedelRader
    .filter(harTid)
    .slice()
    .sort((a, b) => (a.fraTid < b.fraTid ? -1 : a.fraTid > b.fraTid ? 1 : 0));
  const brukt = new Set<string>();

  // Behandle forslag i fra-tid-rekkefølge (stabil, speiler visningen).
  const forslagSortert = forslag
    .slice()
    .sort((a, b) => {
      const fa = a.fraTid ?? "";
      const fb = b.fraTid ?? "";
      return fa < fb ? -1 : fa > fb ? 1 : 0;
    });

  for (const f of forslagSortert) {
    // Finn første ledige serverrad f overlapper (1:1 i praksis).
    const motpart = harTid(f)
      ? serverMedTid.find(
          (s) =>
            !brukt.has(s.id) &&
            tidsromOverlapper(f.fraTid, f.tilTid, s.fraTid, s.tilTid),
        )
      : undefined;

    if (motpart) {
      // Tidsrom begge hadde → valget avgjør. Mangler valg → behold PC (konservativt).
      if (valg[f.id] === "forslag") {
        brukt.add(motpart.id);
        oppdateringer.push({ ...tilNyRad(f), id: motpart.id });
      }
      // "sedel" / manglende valg → no-op (serverraden står).
      continue;
    }

    // Forslagsrad uten motpart = kun på mobil-siden → beholdes alltid (opprett),
    // MEN kun hvis den har tid (forsonDagskort krever fra/til). Tid-løst forslag uten
    // motpart hoppes over — det kan ikke uttrykkes som en ny rad og har ingen
    // serverrad å erstatte.
    if (harTid(f)) {
      nyeRader.push(tilNyRad(f));
    }
  }

  return { oppdateringer, nyeRader };
}
