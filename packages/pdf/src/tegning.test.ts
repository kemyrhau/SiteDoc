import { describe, it, expect } from "vitest";
import { byggTegningPosisjon, byggDetaljUtsnitt, beregnUtsnittVindu } from "./tegning";

/**
 * Funn #3 (2026-08-22): oversikt og 4×-detalj skal treffe NØYAKTIG samme punkt.
 * Tidligere brukte detaljen `transform-origin:x% y%` på et `object-fit:cover`-bilde
 * med en fast prikk på 50%,50% → markør og prikk sammenfalt kun ved x=y=50, og
 * prosenten ble målt mot boks-aspect (ikke bilde-aspect). Nå croppes detaljen til
 * SAMME vindu som oversiktens ramme, med markøren på samme (cx,cy) → per konstruksjon
 * identisk. Testene under er invarianter, ikke en byte-golden — de vokter regelen,
 * ikke tilfeldig formatering.
 */

/** Hent alle `<circle cx cy>` fra HTML-en (rekkefølge: oversikt så detalj). */
function hentSirkler(html: string): Array<{ cx: number; cy: number }> {
  const treff = [...html.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)];
  return treff.map((m) => ({ cx: parseFloat(m[1]!), cy: parseFloat(m[2]!) }));
}

/** Hent detalj-SVG-ens viewBox ("x y w h") — den andre svg-en i outputen. */
function hentDetaljViewBox(html: string): { x: number; y: number; w: number; h: number } {
  const alle = [...html.matchAll(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/g)];
  const d = alle[1]!; // [0] = oversikt (0 0 vbW vbH), [1] = detalj (rammevinduet)
  return { x: parseFloat(d[1]!), y: parseFloat(d[2]!), w: parseFloat(d[3]!), h: parseFloat(d[4]!) };
}

const INPUT = {
  tegningBildeUrl: "data:img/x",
  tegningNavn: "Z-20-01",
  positionX: 60.65,
  positionY: 75.2,
  imageWidth: 1600,
  imageHeight: 900,
};

describe("byggTegningPosisjon — funn #3: oversikt og detalj deler koordinat", () => {
  it("begge SVG-ene tegner markøren på IDENTISK (cx,cy)", () => {
    const sirkler = hentSirkler(byggTegningPosisjon(INPUT));
    expect(sirkler).toHaveLength(2); // oversikt + detalj
    expect(sirkler[0]!.cx).toBe(sirkler[1]!.cx);
    expect(sirkler[0]!.cy).toBe(sirkler[1]!.cy);
  });

  it("detaljens viewBox INNEHOLDER markøren (croppet rundt (cx,cy), ikke forbi)", () => {
    const html = byggTegningPosisjon(INPUT);
    const { cx, cy } = hentSirkler(html)[1]!;
    const vb = hentDetaljViewBox(html);
    expect(cx).toBeGreaterThanOrEqual(vb.x);
    expect(cx).toBeLessThanOrEqual(vb.x + vb.w);
    expect(cy).toBeGreaterThanOrEqual(vb.y);
    expect(cy).toBeLessThanOrEqual(vb.y + vb.h);
  });

  it("begge SVG-ene bruker SAMME bilde-href og samme bilde-plassering (0,0,vbW,vbH)", () => {
    const html = byggTegningPosisjon(INPUT);
    const bilder = [...html.matchAll(/<image href="([^"]+)" x="0" y="0" width="([\d.]+)"/g)];
    expect(bilder).toHaveLength(2);
    expect(bilder[0]![1]).toBe(bilder[1]![1]); // samme href
    expect(bilder[0]![2]).toBe(bilder[1]![2]); // samme vbW
  });

  it("ikke lenger transform-origin/object-fit-cover-detalj (rotårsaken er borte)", () => {
    const html = byggTegningPosisjon(INPUT);
    expect(html).not.toContain("transform-origin");
    expect(html).not.toContain("object-fit:cover");
  });
});

describe("funn #3 negativ-test — markør MIDT PÅ vs NÆR KANT treffer identisk i begge", () => {
  const base = { tegningBildeUrl: "data:img/x", imageWidth: 1000, imageHeight: 1000 };

  it("MIDT PÅ (50,50): detalj-markøren er sentrert i vinduet", () => {
    const html = byggTegningPosisjon({ ...base, positionX: 50, positionY: 50 });
    const { cx, cy } = hentSirkler(html)[1]!;
    const vb = hentDetaljViewBox(html);
    // relativ posisjon i vinduet ~ 0.5 (ingen klemming midt på)
    expect((cx - vb.x) / vb.w).toBeCloseTo(0.5, 6);
    expect((cy - vb.y) / vb.h).toBeCloseTo(0.5, 6);
    // og oversikt == detalj
    const s = hentSirkler(html);
    expect(s[0]!.cx).toBe(s[1]!.cx);
  });

  it("NÆR KANT (96,96): vinduet klemmes, men oversikt og detalj peker på SAMME punkt", () => {
    const html = byggTegningPosisjon({ ...base, positionX: 96, positionY: 96 });
    const s = hentSirkler(html);
    expect(s[0]!.cx).toBe(s[1]!.cx);
    expect(s[0]!.cy).toBe(s[1]!.cy);
    // markøren er FORSKJØVET fra midten i det klemte vinduet (ikke sentrert) — matcher oversikten
    const vb = hentDetaljViewBox(html);
    expect((s[1]!.cx - vb.x) / vb.w).toBeGreaterThan(0.5);
    // og markøren er fortsatt innenfor vinduet
    expect(s[1]!.cx).toBeLessThanOrEqual(vb.x + vb.w);
  });
});

describe("beregnUtsnittVindu — delt vindu-funksjon (én kilde for rect + crop)", () => {
  it("midt på → ramme sentrert rundt markøren", () => {
    const v = beregnUtsnittVindu(50, 50, 1000, 1000, 4);
    expect(v.cx).toBeCloseTo(50, 6);
    expect(v.rammeX + v.rammeW / 2).toBeCloseTo(v.cx, 6);
    expect(v.rammeY + v.rammeH / 2).toBeCloseTo(v.cy, 6);
  });

  it("nær kant → ramme klemmes innenfor bildet (aldri forbi 0 eller vbW/vbH)", () => {
    const v = beregnUtsnittVindu(98, 98, 1000, 1000, 4);
    expect(v.rammeX).toBeGreaterThanOrEqual(0);
    expect(v.rammeY).toBeGreaterThanOrEqual(0);
    expect(v.rammeX + v.rammeW).toBeLessThanOrEqual(v.vbW + 1e-9);
    expect(v.rammeY + v.rammeH).toBeLessThanOrEqual(v.vbH + 1e-9);
  });

  it("mangler bildedimensjoner → kvadratisk viewBox (100×100)", () => {
    const v = beregnUtsnittVindu(50, 50, null, null, 4);
    expect(v.vbW).toBe(100);
    expect(v.vbH).toBe(100);
  });
});

describe("byggDetaljUtsnitt — parameterisert målstørrelse (radkort-sti, uendret)", () => {
  it("hoydePx og zoom er parametre; radkort bruker denne (server-croppet bilde, sentrert)", () => {
    const arkiv = byggDetaljUtsnitt({ url: "data:img/x", x: 50, y: 50, hoydePx: 96, zoom: 1 });
    expect(arkiv).toContain("height:96px;");
    expect(arkiv).toContain("transform:scale(1);");
    expect(arkiv).toContain("transform-origin:50% 50%;");
    expect(arkiv).not.toMatch(/https?:\/\//);
  });
});
