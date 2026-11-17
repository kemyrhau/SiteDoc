/**
 * Trykk-tolk for mobil-vieweren med saksen aktiv (ORDRE 3D-mobil 10, 2026-11-17).
 *
 * Før: enkelttrykk gikk på `click` (objektvalg) og dobbelttrykk på nettleserens `dblclick`
 * (snitt). Et dobbelttrykk ga derfor `click` + `click` + `dblclick` — objektet ble valgt
 * to ganger før snittet kom, og `dblclick` avhenger av WebKits egen dobbelttrykk-gjenkjenning.
 * Nå tolkes pekerhendelsene her: et enkelttrykk venter `DOBBELT_VINDU_MS` på et mulig andre
 * trykk før det blir objektvalg; to trykk nær hverandre blir snitt, uten objektvalg.
 * Trykk som starter på snittpilen gir ingen av delene (pilen dras).
 *
 * Ren tilstandsmaskin uten DOM/klokke — tider og posisjoner sendes inn (CSS-px, ms).
 */

/** Maks flytting under ett trykk (px). Over dette er det pan/rotasjon, ikke et trykk. */
export const TRYKK_MAKS_FLYTT_PX = 12;
/** Maks varighet for ett trykk (ms). Lengre er et langt trykk/hold. */
export const TRYKK_MAKS_VARIGHET_MS = 500;
/** Maks tid fra første slipp til andre trykk ned (ms). iOS bruker ~350; litt romsligere for hansker. */
export const DOBBELT_VINDU_MS = 400;
/** Maks avstand mellom de to trykkene i et dobbelttrykk (px). */
export const DOBBELT_MAKS_AVSTAND_PX = 48;

export type TrykkPunkt = { x: number; y: number };

export type TrykkUtfall =
  | { type: "ingen"; grunn: "ukjent finger" | "fingre igjen" | "flere fingre" | "flyttet" | "langt trykk" }
  | { type: "pil" }
  /** Mulig enkelttrykk: kall `utløp` etter `fristMs` */
  | { type: "venter"; x: number; y: number; fristMs: number }
  | { type: "dobbelt"; x: number; y: number; mellomromMs: number };

export type EnkeltTrykk = { type: "enkelt"; x: number; y: number };

const avstand = (a: TrykkPunkt, b: TrykkPunkt) => Math.hypot(a.x - b.x, a.y - b.y);

export function lagTrykkTolk() {
  const aktive = new Set<number>();
  let gest: { x: number; y: number; t: number; ugyldig: boolean } | null = null;
  let venter: { x: number; y: number; slipp: number; andreNede: boolean } | null = null;

  /** Kan neste trykk ned (x, y, t) bli andre halvdel av et dobbelttrykk? */
  const passerMedVenter = (x: number, y: number, t: number) =>
    venter !== null && t - venter.slipp <= DOBBELT_VINDU_MS && avstand(venter, { x, y }) <= DOBBELT_MAKS_AVSTAND_PX;

  return {
    /**
     * Finger/knapp ned. Returnerer et enkelttrykk som må utføres nå hvis et ventende trykk
     * ikke lenger kan bli dobbelt (nytt trykk for sent eller for langt unna).
     */
    ned(id: number, x: number, y: number, t: number): EnkeltTrykk | null {
      let løst: EnkeltTrykk | null = null;
      if (aktive.size === 0) {
        gest = { x, y, t, ugyldig: false };
        if (venter) {
          if (passerMedVenter(x, y, t)) venter.andreNede = true;
          else { løst = { type: "enkelt", x: venter.x, y: venter.y }; venter = null; }
        }
      } else if (gest) {
        gest.ugyldig = true; // to fingre: pinch/pan, ikke et trykk
      }
      aktive.add(id);
      return løst;
    },

    /** Finger/knapp opp. `påPil`: trykket startet på snittpilen (pilen ble grepet). */
    opp(id: number, x: number, y: number, t: number, påPil: boolean): TrykkUtfall {
      if (!aktive.delete(id) || !gest) return { type: "ingen", grunn: "ukjent finger" };
      if (aktive.size > 0) return { type: "ingen", grunn: "fingre igjen" };
      const g = gest;
      gest = null;
      const forrige = venter;
      venter = null;
      if (påPil) return { type: "pil" };
      if (g.ugyldig) return { type: "ingen", grunn: "flere fingre" };
      if (avstand(g, { x, y }) > TRYKK_MAKS_FLYTT_PX) return { type: "ingen", grunn: "flyttet" };
      if (t - g.t > TRYKK_MAKS_VARIGHET_MS) return { type: "ingen", grunn: "langt trykk" };
      if (forrige?.andreNede) {
        return { type: "dobbelt", x: g.x, y: g.y, mellomromMs: Math.round(g.t - forrige.slipp) };
      }
      venter = { x: g.x, y: g.y, slipp: t, andreNede: false };
      return { type: "venter", x: g.x, y: g.y, fristMs: DOBBELT_VINDU_MS };
    },

    /** Gesten ble avbrutt av nettleseren (pointercancel): ikke et trykk. */
    avbryt(id: number) {
      aktive.delete(id);
      if (gest) gest.ugyldig = true;
      if (aktive.size === 0) { gest = null; venter = null; }
    },

    /** Kalles når fristen er ute. Gir enkelttrykket hvis ingen andre finger kom i tide. */
    utløp(t: number): EnkeltTrykk | null {
      if (!venter || venter.andreNede || t - venter.slipp < DOBBELT_VINDU_MS) return null;
      const v = venter;
      venter = null;
      return { type: "enkelt", x: v.x, y: v.y };
    },
  };
}
