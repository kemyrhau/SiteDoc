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
 * V19-C (C-2 / A-4): en uavklart PC/mobil-overlapp BLOKKERER attestering. Feltet
 * `konfliktVentendeSiden` (DailySheet) er satt ⇔ det finnes et forslag arbeideren
 * ikke har valgt mellom. Delt predikat for begge attesteringsflatene
 * (`AttesteringDetalj` + `SeddelKort`) så UI-blokkeringen har ÉN definisjon.
 * Serveren er sannheten (`krevIngenUavklartOverlapp` kaster `PRECONDITION_FAILED`
 * uansett) — dette gater kun attester-knappen og forklarer hvorfor.
 */
export function overlappBlokkererAttestering(
  konfliktVentendeSiden: Date | string | null | undefined,
): boolean {
  return konfliktVentendeSiden != null;
}

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

/**
 * Én slot i overlapp-sammenligningen. `nokkel` er en stabil, unik valg-/render-nøkkel.
 *  - Paret slot (begge sider + overlapp): `nokkel` = forslagsradens id, `valgbar = true`.
 *  - Forslag kun: `nokkel` = forslagsradens id, `valgbar = false` (beholdes alltid, Q3(b)).
 *  - Sedel kun: `nokkel` = `"sedel:"+sedelradens id`, `valgbar = false` (beholdes alltid).
 */
export interface OverlappSlot {
  nokkel: string;
  /** Forslagsraden (mobil/«appen»), eller null på en sedel-kun-slot. */
  forslag: ForsonRad | null;
  /** Serverraden (PC/web/«sedelen»), eller null på en forslag-kun-slot. */
  sedel: ForsonRad | null;
  /** Kun paret slot (begge sider + overlapp) er valgbar (Q3(b)). */
  valgbar: boolean;
}

/**
 * Par forslagsrader mot serverrader PR. OVERLAPP (ikke eksakt tidsrom) — ÉN kilde både
 * visningen (mobil DagskortSammenligning + web C-1 ForslagValgSeksjon) og
 * `byggForsonInputFraValg` bruker, så skjermen og skriveveien aldri kan pare ulikt. Hver
 * forslagsrad pares med den FØRSTE serverraden (sortert på fra-tid) den overlapper og som
 * ikke alt er paret — 1:1 i praksis.
 */
export function parForslagMotSedel(
  sedelRader: readonly ForsonRad[],
  forslag: readonly ForsonRad[],
): OverlappSlot[] {
  // Serverrader sortert på fra-tid for deterministisk 1:1-paring; de uten tid kan
  // aldri pares (ingen overlapp-definisjon) → de står alltid som sedel-kun (no-op).
  const serverMedTid = sedelRader
    .filter(harTid)
    .slice()
    .sort((a, b) => (a.fraTid < b.fraTid ? -1 : a.fraTid > b.fraTid ? 1 : 0));
  const brukt = new Set<string>();
  const slots: OverlappSlot[] = [];

  // Behandle forslag i fra-tid-rekkefølge (stabil, speiler visningen).
  const forslagSortert = forslag.slice().sort((a, b) => {
    const fa = a.fraTid ?? "";
    const fb = b.fraTid ?? "";
    return fa < fb ? -1 : fa > fb ? 1 : 0;
  });

  for (const f of forslagSortert) {
    const motpart = harTid(f)
      ? serverMedTid.find(
          (s) =>
            !brukt.has(s.id) &&
            tidsromOverlapper(f.fraTid, f.tilTid, s.fraTid, s.tilTid),
        )
      : undefined;
    if (motpart) {
      brukt.add(motpart.id);
      slots.push({ nokkel: f.id, forslag: f, sedel: motpart, valgbar: true });
    } else {
      slots.push({ nokkel: f.id, forslag: f, sedel: null, valgbar: false });
    }
  }

  // Serverrader uten motpart (inkl. alle tid-løse) → sedel-kun-slots, beholdes alltid.
  for (const s of sedelRader) {
    if (!brukt.has(s.id)) {
      slots.push({ nokkel: `sedel:${s.id}`, forslag: null, sedel: s, valgbar: false });
    }
  }

  return slots;
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

  // Samme pr-overlapp-paring som visningen (én kilde: parForslagMotSedel).
  for (const slot of parForslagMotSedel(sedelRader, forslag)) {
    if (slot.valgbar && slot.forslag && slot.sedel) {
      // Tidsrom begge hadde → valget avgjør. Mangler valg → behold PC (konservativt).
      if (valg[slot.forslag.id] === "forslag") {
        oppdateringer.push({ ...tilNyRad(slot.forslag), id: slot.sedel.id });
      }
      continue;
    }
    // Forslagsrad uten motpart = kun på mobil-siden → beholdes alltid (opprett),
    // MEN kun hvis den har tid (forsonDagskort krever fra/til). Tid-løst forslag uten
    // motpart hoppes over. Sedel-kun-slot → no-op (serverraden står).
    if (slot.forslag && !slot.sedel && harTid(slot.forslag)) {
      nyeRader.push(tilNyRad(slot.forslag));
    }
  }

  return { oppdateringer, nyeRader };
}
