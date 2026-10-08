import { describe, it, expect } from "vitest";
import {
  lupePlassering,
  lupeBakgrunn,
  nudgePunkt,
  lupeLiggerOverst,
  LUPE_DIAMETER,
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

describe("nudgePunkt — 1 px finjustering", () => {
  const dispB = 1000, dispH = 500;
  it("flytter 1 px i hver retning (→ prosent av vist størrelse)", () => {
    expect(nudgePunkt({ x: 50, y: 50 }, 1, 0, dispB, dispH).x).toBeCloseTo(50.1, 5); // 1/1000*100
    expect(nudgePunkt({ x: 50, y: 50 }, -1, 0, dispB, dispH).x).toBeCloseTo(49.9, 5);
    expect(nudgePunkt({ x: 50, y: 50 }, 0, 1, dispB, dispH).y).toBeCloseTo(50.2, 5); // 1/500*100
  });
  it("klemmes til 0–100", () => {
    expect(nudgePunkt({ x: 0, y: 0 }, -5, -5, dispB, dispH)).toEqual({ x: 0, y: 0 });
    expect(nudgePunkt({ x: 100, y: 100 }, 50, 50, dispB, dispH)).toEqual({ x: 100, y: 100 });
  });
  it("ugyldig displaystørrelse → uendret", () => {
    expect(nudgePunkt({ x: 50, y: 50 }, 1, 1, 0, 0)).toEqual({ x: 50, y: 50 });
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
