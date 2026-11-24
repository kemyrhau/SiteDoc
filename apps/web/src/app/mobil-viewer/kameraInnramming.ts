/**
 * Kamera som følger modellen i mobil-vieweren (M1–M3, § 3b).
 *
 * Innramming tar utgangspunkt i objektboksene uten objekter langt unna bygget (regelen
 * `finnUtliggere` bor i `@sitedoc/shared`) og fyller skjermen. Orbit-punktet er flaten midt på skjermen
 * (`orbitAvstand`), og zoom-farten følger avstanden dit (`dollyFartForAvstand` i shared).
 */

import { dollyFartForAvstand, type Boks3, type Punkt3 } from "@sitedoc/shared/tred";

/** Robust boks og utligger-regelen bor i `@sitedoc/shared` (`finnUtliggere`), felles med web. */
export type Punkt = Punkt3;
export type Boks = Boks3;

export type Innramming = {
  target: Punkt;
  posisjon: Punkt;
  avstand: number;
  near: number;
  far: number;
  minDistance: number;
};

/** Samme skrå blikkretning som før (fra +x, +y, +z mot sentrum). */
const RETNING = (() => {
  const l = Math.sqrt(1 + 0.7 * 0.7 + 1);
  return { x: 1 / l, y: 0.7 / l, z: 1 / l };
})();

/** Margin mot skjermkanten ved innramming, som andel av halve synsvinkelen (ORDRE 8 (v)). */
export const FYLL_MARGIN = 0.05;

function hjørner(b: Boks): Punkt[] {
  const p: Punkt[] = [];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.push({ x, y, z });
  return p;
}

const prikk = (a: Punkt, b: Punkt) => a.x * b.x + a.y * b.y + a.z * b.z;

/**
 * Ramme inn modellen så den fyller skjermen (ORDRE 8 (v), 2026-11-17).
 *
 * Før: hele omsluttende kula i smaleste synsvinkel. Kula er mye større enn det man ser fra
 * skrå vinkel, så E3 ARK fylte ~68 % av bredden (målt). Nå: kameraet plasseres langs samme
 * blikkretning så nær som mulig, slik at alle hjørner av objektboksene (`objektBokser`, uten
 * utliggere — ellers hjørnene av `boks`) havner innenfor synsvinkelen minus `FYLL_MARGIN`,
 * både vertikalt og horisontalt. Løses eksakt: for perspektiv med fast retning er det ett
 * lineært krav pr. hjørne og side. Bildet sentreres på modellens projeksjon, og target ligger
 * på siktelinja i dybden til boksens sentrum.
 *
 * near/far har samme forhold til modellstørrelsen som z-fighting-fiksen 4a356784
 * (near = maks·0,001, far = maks·20). minDistance skaleres med near i stedet for fast 6 m.
 */
export function beregnInnramming(boks: Boks, vfovGrader: number, aspect: number, objektBokser?: Boks[]): Innramming {
  const senter = {
    x: (boks.min.x + boks.max.x) / 2,
    y: (boks.min.y + boks.max.y) / 2,
    z: (boks.min.z + boks.max.z) / 2,
  };
  const dx = boks.max.x - boks.min.x;
  const dy = boks.max.y - boks.min.y;
  const dz = boks.max.z - boks.min.z;
  const maks = Math.max(dx, dy, dz, 0.01);
  const radius = Math.max(Math.sqrt(dx * dx + dy * dy + dz * dz) / 2, 0.005);

  const vfov = (vfovGrader * Math.PI) / 180;
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
  const near = maks * 0.001;
  const minDistance = Math.max(near * 5, 0.05);

  // Kamerabasis: fremover (mot modellen), høyre, opp
  const fram = { x: -RETNING.x, y: -RETNING.y, z: -RETNING.z };
  const hl = Math.hypot(fram.z, fram.x);
  const høyre = { x: -fram.z / hl, y: 0, z: fram.x / hl };
  const opp = {
    x: høyre.y * fram.z - høyre.z * fram.y,
    y: høyre.z * fram.x - høyre.x * fram.z,
    z: høyre.x * fram.y - høyre.y * fram.x,
  };

  const th = Math.tan(hfov / 2) * (1 - FYLL_MARGIN);
  const tv = Math.tan(vfov / 2) * (1 - FYLL_MARGIN);
  // Krav pr. punkt (koordinater u, v, w relativt til senter): |u − cu| ≤ th·(w − cw), tilsvarende v
  let aH = -Infinity, bH = -Infinity, aV = -Infinity, bV = -Infinity;
  const kilder = objektBokser && objektBokser.length > 0 ? objektBokser : [boks];
  for (const b of kilder) {
    for (const p of hjørner(b)) {
      const r = { x: p.x - senter.x, y: p.y - senter.y, z: p.z - senter.z };
      const u = prikk(r, høyre), v = prikk(r, opp), w = prikk(r, fram);
      aH = Math.max(aH, u - th * w); bH = Math.max(bH, -u - th * w);
      aV = Math.max(aV, v - tv * w); bV = Math.max(bV, -v - tv * w);
    }
  }
  const cw = Math.min(-(aH + bH) / (2 * th), -(aV + bV) / (2 * tv));
  const cu = (aH - bH) / 2;
  const cv = (aV - bV) / 2;
  // Avstand fra kamera til target (target i dybden til senter). Degenerert modell: faller
  // tilbake til kula.
  let avstand = -cw;
  let su = cu, sv = cv;
  if (!Number.isFinite(avstand) || avstand < minDistance * 2) {
    avstand = radius / Math.sin(Math.min(vfov, hfov) / 2);
    su = 0; sv = 0;
  }

  const target = {
    x: senter.x + høyre.x * su + opp.x * sv,
    y: senter.y + høyre.y * su + opp.y * sv,
    z: senter.z + høyre.z * su + opp.z * sv,
  };
  const far = Math.max(maks * 20, (avstand + radius) * 2);

  return {
    target,
    posisjon: {
      x: target.x - fram.x * avstand,
      y: target.y - fram.y * avstand,
      z: target.z - fram.z * avstand,
    },
    avstand,
    near,
    far,
    minDistance,
  };
}

/**
 * camera-controls 3.1.2 måler pinch fra fingrenes midtpunkt til den ene fingeren (halve
 * fingeravstanden), med 1/8 enhet pr. piksel. Én dolly-enhet blir dermed 16 px endret
 * fingeravstand, ikke 8 px som zoom-kurven regner med (målt i ORDRE 7). Faktoren 2 gir
 * `zoomSteg` pr. 8 px fingeravstand. Vakt i testen låser premisset mot camera-controls-kilden.
 */
export const PINCH_KOMPENSASJON = 2;

/** `dollySpeed` for mobil: kurven fra shared, doblet mens to fingre er nede (pinch). */
export function dollyFartMobil(radius: number, antallFingre: number): number {
  const fart = dollyFartForAvstand(radius);
  return antallFingre >= 2 ? fart * PINCH_KOMPENSASJON : fart;
}

/**
 * Avstand langs siktelinja (fra kamera gjennom skjermmidten) til orbit-punktet (§ 3b punkt 1).
 * Treff i midten: treffavstanden, men aldri nærmere enn 1,5·minDistance (ellers hopper
 * kameraet bakover). Ingen treff: samme avstand som sist.
 */
export function orbitAvstand(treffAvstand: number | null, sisteAvstand: number, minDistance: number): number {
  const minst = minDistance * 1.5;
  if (treffAvstand != null && Number.isFinite(treffAvstand) && treffAvstand > 0) {
    return Math.max(treffAvstand, minst);
  }
  return Number.isFinite(sisteAvstand) && sisteAvstand > 0 ? Math.max(sisteAvstand, minst) : minst;
}
