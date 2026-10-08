import { describe, it, expect } from "vitest";
import {
  lupePlassering,
  lupeBakgrunn,
  lupeLiggerOverst,
  LUPE_DIAMETER,
  LUPE_FORSTORRELSE,
  Z_LUPE,
  Z_MALELAG,
} from "./lupe";

describe("lupePlassering — forskjøvet opp/side + kant-flipp (RETUR 4 § 2)", () => {
  const B = 430, H = 932, D = LUPE_DIAMETER;

  it("midt på skjermen: til høyre og over fingeren", () => {
    const r = lupePlassering(200, 500, B, H);
    expect(r.side).toBe("høyre");
    expect(r.over).toBe(true);
    expect(r.left).toBeGreaterThan(200); // til høyre
    expect(r.top).toBeLessThan(500); // over
    // Innenfor skjermen.
    expect(r.left + D).toBeLessThanOrEqual(B);
    expect(r.top).toBeGreaterThanOrEqual(0);
  });

  it("nær høyre kant: flipper til venstre", () => {
    const r = lupePlassering(420, 500, B, H);
    expect(r.side).toBe("venstre");
    expect(r.left).toBeLessThan(420);
    expect(r.left).toBeGreaterThanOrEqual(4);
  });

  it("nær toppen: legges under fingeren", () => {
    const r = lupePlassering(200, 20, B, H);
    expect(r.over).toBe(false);
    expect(r.top).toBeGreaterThan(20);
  });

  it("holder seg alltid innenfor skjermen (hjørner)", () => {
    for (const [x, y] of [[0, 0], [430, 0], [0, 932], [430, 932], [215, 466]] as const) {
      const r = lupePlassering(x, y, B, H);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.top).toBeGreaterThanOrEqual(0);
      expect(r.left + D).toBeLessThanOrEqual(B + 1);
      expect(r.top + D).toBeLessThanOrEqual(H + 1);
    }
  });
});

describe("lupeBakgrunn — 3× crop sentrert på punktet", () => {
  it("forstørrer og sentrerer punktet i lupa", () => {
    const dispB = 400, dispH = 300, M = 3, D = 100;
    const r = lupeBakgrunn(50, 50, dispB, dispH, M, D);
    expect(r.bildeB).toBe(1200);
    expect(r.bildeH).toBe(900);
    // Punktet (50%,50%) = (600,450) i forstørret bilde → offset = 50 - 600 = -550.
    expect(r.posX).toBe(D / 2 - 600);
    expect(r.posY).toBe(D / 2 - 450);
  });

  it("punkt i hjørnet (0,0) → offset D/2 (senter på hjørnet)", () => {
    const r = lupeBakgrunn(0, 0, 400, 300, 3, 100);
    expect(r.posX).toBe(50);
    expect(r.posY).toBe(50);
  });
});

describe("lupeBakgrunn — RN-nativ crop-rect (RETUR 5 § 2): trådkorset treffer bildepunktet", () => {
  // Modellerer de ekte RN-lupe-innputtene: dispB/H = bildets VISTE størrelse
  // (layout × zoom), M = LUPE_FORSTORRELSE, D = LUPE_DIAMETER. Trådkorset ligger i
  // lupas senter (D/2, D/2); det forstørrede bildet forskyves så bildepunktet
  // (pctX,pctY) havner nøyaktig der. Dvs. senter − (Image-left) skal lande på
  // bildepunktet i det forstørrede bildet.
  const D = LUPE_DIAMETER;
  const M = LUPE_FORSTORRELSE;

  it("vilkårlig punkt ender under trådkorset uansett zoom", () => {
    // Bilde 1000×700 layout, pinch-zoom 2× → vist 2000×1400.
    const dispB = 1000 * 2, dispH = 700 * 2;
    for (const [px, py] of [[0, 0], [100, 100], [30, 70], [62.5, 12.5]] as const) {
      const r = lupeBakgrunn(px, py, dispB, dispH, M, D);
      // Bildepunktet i det forstørrede utsnittet:
      const bildeX = (px / 100) * r.bildeB;
      const bildeY = (py / 100) * r.bildeH;
      // Image-left = posX → punktets skjermposisjon i lupa = posX + bildeX.
      expect(r.posX + bildeX).toBeCloseTo(D / 2, 6); // trådkors-x
      expect(r.posY + bildeY).toBeCloseTo(D / 2, 6); // trådkors-y
    }
  });

  it("utsnittet er forstørret M× av den viste størrelsen", () => {
    const r = lupeBakgrunn(50, 50, 800, 600, M, D);
    expect(r.bildeB).toBe(800 * M);
    expect(r.bildeH).toBe(600 * M);
  });
});

describe("z-rekkefølge — lupa ligger øverst (RETUR 4 § 2)", () => {
  it("lupe > målelag (lupa aldri bak bildet/målingen)", () => {
    expect(Z_LUPE).toBeGreaterThan(Z_MALELAG);
  });
  it("hele rekkefølgen er stigende og gyldig", () => {
    expect(lupeLiggerOverst()).toBe(true);
  });
});
