/**
 * Carve faktiske fra/til-vinduer for GPS-auto-genererte arbeidstid-rader.
 *
 * Bakgrunn (fabel-vedtak 2026-07-13): fra/til er nå obligatorisk på timer-rader
 * (reverserer a2-valgfritt). GPS-auto-utkastet (`opprettDagsseddelForSegment`)
 * genererte tidligere normaltid/OT-rader UTEN tider — det ville brutt regelen på
 * den mest brukte veien. Løsning: carve FAKTISKE tider fra segmentets reelle
 * vindu (`startIso`/`sluttIso` = ekte GPS Start dag / Slutt dag), aldri
 * fabrikkerte.
 *
 * **Reise er BEVISST unntatt** (håndteres av kalleren, ikke her): reisetiden er
 * en matrise-/GPS-estimat-mengde uten målt klokke-vindu — et `[start, start+reise]`
 * ville vært falske lønnsdata. Reise-raden beholder `fraTid/tilTid: null` og
 * går uansett via syncBatch-legacy-veien (unntatt fra server-håndhevingen).
 * Reisetiden inngår her KUN som forskyvning av arbeids-start (`startTid + reise`),
 * fordi `fordelArbeidstidFradrag` legger reise først i vinduet.
 *
 * Ren, uten avhengigheter utenom pauseBeregning — testbar (se carveArbeidstid.test.ts).
 * Sekvensielle vinduer berører hverandre i endepunkt (a.til = b.fra) og
 * overlapper derfor ALDRI (jf. `tidsromOverlapper` — endepunkt-berøring ≠ overlapp).
 */

import { hhmmTilMin, minTilHhmm, tilFraAntall } from "./pauseBeregning";

/** Klassifisert arbeidstid-segment (fra `klassifiserArbeidstid`). */
export interface CarveSegment {
  overtidsnivaa: number | null;
  timer: number;
}

/** Carvet vindu — segmentet + tildelte klokkeslett. */
export interface CarvetVindu {
  overtidsnivaa: number | null;
  timer: number;
  fraTid: string;
  tilTid: string;
}

/**
 * Legg normaltid/OT-segmentene sekvensielt inn i dag-vinduet fra og med
 * arbeids-start (`startTid` + reise-forskyvning), pause-bevisst via `tilFraAntall`
 * (pausevinduet skyves inn på det segmentet som krysser lunsj — påføres én gang).
 *
 * Segmenter med `timer <= 0` hoppes over (ingen 0-vindu). Returnerer vinduer i
 * samme rekkefølge som `segmenter`.
 */
export function carveArbeidstider(args: {
  /** HH:MM — segmentets reelle start (veggur fra `startIso`). */
  startTid: string;
  /** Reise-timer som forskyver arbeids-start (reise føres på egen rad uten tid). */
  reisetidTimer: number;
  /** HH:MM — pausevindu-start (`pauseVinduFra(skiftStart, standardPauseEtterTimer)`). */
  pauseFra: string;
  /** Pausens lengde i minutter. */
  pauseMin: number;
  segmenter: CarveSegment[];
}): CarvetVindu[] {
  const arbeidStartMin =
    hhmmTilMin(args.startTid) + Math.round(Math.max(0, args.reisetidTimer) * 60);
  let posisjon = minTilHhmm(arbeidStartMin);

  const vinduer: CarvetVindu[] = [];
  for (const seg of args.segmenter) {
    if (seg.timer <= 0) continue;
    const fraTid = posisjon;
    const tilTid = tilFraAntall(fraTid, seg.timer, args.pauseFra, args.pauseMin);
    vinduer.push({
      overtidsnivaa: seg.overtidsnivaa,
      timer: seg.timer,
      fraTid,
      tilTid,
    });
    posisjon = tilTid;
  }
  return vinduer;
}
