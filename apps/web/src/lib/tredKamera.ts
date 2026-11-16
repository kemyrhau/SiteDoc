/**
 * Kamera-regler for 3D-vieweren (ren geometri, uten three.js — testbar).
 */

import { ZOOM_MIN_STEG_M, zoomSteg } from "@sitedoc/shared";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Minste dybde (scene-enheter) før pan-target flyttes; matcher «2 enheter foran» for rotasjon. */
export const MIN_PAN_DYBDE = 2;

/**
 * W4 — orbit-target for pan (høyre/midtre museknapp).
 *
 * camera-controls panorerer med fart proporsjonal med avstanden kamera→target. Vieweren
 * legger target 2 enheter foran kamera for rotasjon rundt eget ståsted; da blir pan
 * nesten stillestående på en bygning sett på avstand. For pan legges target i stedet på
 * modellsenterets dybde langs blikkretningen (senteret projisert på blikklinja).
 *
 * Returnerer `null` når target skal beholdes: senteret ligger bak kamera eller nærmere
 * enn `MIN_PAN_DYBDE` langs blikket (f.eks. inne i bygget med ryggen mot senteret).
 *
 * @param retning enhetsvektor for blikkretningen
 */
export function panTargetPaaModellDybde(kamera: Vec3, retning: Vec3, modellSenter: Vec3): Vec3 | null {
  const dybde =
    (modellSenter.x - kamera.x) * retning.x +
    (modellSenter.y - kamera.y) * retning.y +
    (modellSenter.z - kamera.z) * retning.z;
  if (!(dybde > MIN_PAN_DYBDE)) return null;
  return {
    x: kamera.x + retning.x * dybde,
    y: kamera.y + retning.y * dybde,
    z: kamera.z + retning.z * dybde,
  };
}

/**
 * W6 — hjul-zoom flytter kamera og target langs blikkretningen (også loddrett).
 *
 * Før: `ctrl.forward()` i camera-controls flytter langs `camera.up × høyre`, altså
 * vannrett. Sett skrått ned på modellen gled den da ut av bildet nedover ved innzoom.
 *
 * @param retning enhetsvektor for blikkretningen
 * @param avstand positiv = fremover (inn), negativ = bakover (ut)
 */
export function flyttLangsBlikk(punkt: Vec3, retning: Vec3, avstand: number): Vec3 {
  return {
    x: punkt.x + retning.x * avstand,
    y: punkt.y + retning.y * avstand,
    z: punkt.z + retning.z * avstand,
  };
}

/**
 * Hjul-delta → avstand langs blikket; positiv = inn.
 *
 * Farten følger avstanden til flaten midt på skjermen (Kenneth 2026-11-17, § 3b punkt 2):
 * ett hjulhakk (100 deltaY) = `zoomSteg(avstand)` — samme kurve som mobil, rask langt unna,
 * sakte nær.
 */
export function hjulAvstand(deltaY: number, avstandTilMidten: number): number {
  return (-deltaY / 100) * zoomSteg(avstandTilMidten);
}

/**
 * Avstanden til flaten midt på skjermen etter et hjulsteg, før neste raycast har svart.
 * Går aldri under `ZOOM_MIN_STEG_M`, så farten aldri blir null.
 */
export function avstandEtterSteg(avstand: number, steg: number): number {
  return Math.max(avstand - steg, ZOOM_MIN_STEG_M);
}

/**
 * Rotasjon rundt skjermmidten (Kenneth 2026-11-17).
 *
 * Orbit-punktet legges på blikklinja gjennom skjermmidten: på treffets avstand når
 * raycasten fra midten traff modellen, ellers på samme avstand som sist.
 * Punktet ligger alltid på blikklinja, så kameraet snur seg ikke når target settes.
 *
 * @param retning enhetsvektor for blikkretningen
 * @param treffAvstand avstand kamera→treffpunkt, eller `null` når midten ikke traff noe
 */
export function orbitPunkt(
  kamera: Vec3,
  retning: Vec3,
  treffAvstand: number | null,
  sisteAvstand: number,
): { punkt: Vec3; avstand: number } {
  const avstand = treffAvstand !== null && treffAvstand > 0 ? treffAvstand : sisteAvstand;
  return { punkt: flyttLangsBlikk(kamera, retning, avstand), avstand };
}

/* ------------------------------------------------------------------ */
/*  Objekter langt unna bygget (§ 3b punkt 3)                          */
/*  Hvilke objekter som er utliggere avgjør `finnUtliggere` i           */
/*  @sitedoc/shared; her ligger koblingen mot andre skjulekilder.       */
/* ------------------------------------------------------------------ */

/** Objekt-id-er pr. modell (fragments modelId → localId-er). */
export type IderPrModell = Map<string, number[]>;

/** Fordel indekser fra `finnUtliggere` tilbake på modell og localId. */
export function utliggerePrModell(
  utliggere: number[],
  eiere: { modelId: string; localId: number }[],
): IderPrModell {
  const ut: IderPrModell = new Map();
  for (const i of utliggere) {
    const e = eiere[i];
    if (!e) continue;
    const liste = ut.get(e.modelId) ?? [];
    liste.push(e.localId);
    ut.set(e.modelId, liste);
  }
  return ut;
}

/**
 * Utliggerne bryteren «Vis objekter langt unna» kan vise: alle unntatt de som er skjult
 * av en annen grunn (rom/åpninger, filter-chips, enkeltobjekter brukeren har skjult).
 */
export function utliggereSomKanVises(
  utliggere: IderPrModell,
  skjultAvAnnet: Map<string, Set<number>>,
): IderPrModell {
  const ut: IderPrModell = new Map();
  for (const [mid, ids] of utliggere) {
    const unntak = skjultAvAnnet.get(mid);
    const kan = unntak ? ids.filter((id) => !unntak.has(id)) : ids;
    if (kan.length > 0) ut.set(mid, kan);
  }
  return ut;
}

/**
 * Utliggerne blant objekter som nettopp ble vist (filter fjernet, enkeltobjekt vist igjen).
 * Står bryteren av, skal disse skjules på nytt.
 */
export function utliggereBlant(utliggere: IderPrModell, viste: IderPrModell): IderPrModell {
  const ut: IderPrModell = new Map();
  for (const [mid, ids] of viste) {
    const u = utliggere.get(mid);
    if (!u) continue;
    const us = new Set(u);
    const treff = ids.filter((id) => us.has(id));
    if (treff.length > 0) ut.set(mid, treff);
  }
  return ut;
}
