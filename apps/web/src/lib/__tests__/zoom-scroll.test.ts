import { describe, it, expect } from "vitest";
import { ønsketZoomScroll } from "../zoom-scroll";

// Modell av nettleserens scroll-klipping: `scrollLeft` klippes til
// [0, innholdsbredde - viewportbredde]. Ligger i testen, ikke i src — det er
// nettleser-atferd, ikke noe komponenten selv gjør.
function klippScroll(ønsket: number, innholdsbredde: number, viewportbredde: number): number {
  const maks = Math.max(0, innholdsbredde - viewportbredde);
  return Math.max(0, Math.min(ønsket, maks));
}

describe("zoom mot musepeker", () => {
  const viewport = 800;

  it("zoom INN midt i tegningen: verdien som settes er den ønskede, ikke den klippede", () => {
    const gammelZoom = 1;
    const nyZoom = 1.25;
    const skala = nyZoom / gammelZoom;

    // Mus midt i viewporten, ingen scroll fra før.
    const { left } = ønsketZoomScroll({ contentX: 400, contentY: 0, viewX: 400, viewY: 0, skala });
    // ønsket = 400 * 1.25 - 400 = 100
    expect(left).toBe(100);

    const gammelBredde = viewport * gammelZoom; // rAF-timing: bredden ikke oppdatert ennå
    const nyBredde = viewport * nyZoom; //          useLayoutEffect-timing: bredden oppdatert

    // Ønsket scroll overstiger gammelt maksimum (= 0), men ligger innenfor nytt.
    expect(left).toBeGreaterThan(Math.max(0, gammelBredde - viewport));

    // Fiksen (useLayoutEffect): scroll settes etter at bredden er oppdatert → ingen klipping.
    expect(klippScroll(left, nyBredde, viewport)).toBe(left);
    // Feilen (rAF): scroll settes før resize → klippes til gammelt maksimum og mister målet.
    expect(klippScroll(left, gammelBredde, viewport)).toBeLessThan(left);
  });

  it("zoom UT: punktet under musen ligger fast, ingen klipping", () => {
    const gammelZoom = 2;
    const nyZoom = 1.6; // 2 * 0.8
    const skala = nyZoom / gammelZoom;

    // Innzoomet og scrollet inn; mus midt i viewporten.
    const contentX = 400 + 600; // clientX-del + scrollLeft
    const { left } = ønsketZoomScroll({ contentX, contentY: 0, viewX: 400, viewY: 0, skala });
    // ønsket = 1000 * 0.8 - 400 = 400
    expect(left).toBe(400);

    const nyBredde = viewport * nyZoom; // 1280
    // Ligger godt innenfor nytt maksimum (1280 - 800 = 480) → settes uendret.
    expect(klippScroll(left, nyBredde, viewport)).toBe(left);
  });
});
