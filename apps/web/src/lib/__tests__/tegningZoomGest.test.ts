import { describe, it, expect } from "vitest";
import {
  klassifiserWheel,
  anvendZoomFaktor,
  knipFaktor,
  hjulFaktor,
} from "../tegningZoomGest";

// Modell av nettleserens scroll-klipping (nettleser-atferd, ikke komponentens).
function klipp(ønsket: number, innholdsbredde: number, viewport: number): number {
  return Math.max(0, Math.min(ønsket, Math.max(0, innholdsbredde - viewport)));
}

describe("klassifiserWheel — skiller mus, knip og styreflate-scroll", () => {
  it("ctrlKey ⇒ knip (styreflate-knip og ctrl+hjul)", () => {
    expect(klassifiserWheel({ ctrlKey: true, deltaX: 0, deltaY: -4.2, deltaMode: 0 })).toBe("knip");
    expect(klassifiserWheel({ ctrlKey: true, deltaX: 0, deltaY: 120, deltaMode: 0 })).toBe("knip");
  });

  it("linje-/sidemodus ⇒ hjul (tradisjonelt musehjul)", () => {
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: 3, deltaMode: 1 })).toBe("hjul");
  });

  it("rent vertikalt pikseldelta ⇒ hjul (uansett størrelse/presisjon)", () => {
    // Notchet musehjul: store hele hakk.
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: 120, deltaMode: 0 })).toBe("hjul");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: -120, deltaMode: 0 })).toBe("hjul");
  });

  // 🔴 RETUR 3 § A: Kenneths mus ga desimale/små `deltaY` og ble feilaktig tolket
  // som styreflate-scroll (panorerte). «Ved tvil → zoom» — rent vertikalt hjul,
  // også smått og desimalt, skal ALLTID zoome.
  it("desimalt/lite rent vertikalt pikseldelta ⇒ hjul (ingen regresjon)", () => {
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: 4.5, deltaMode: 0 })).toBe("hjul");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: -1.3, deltaMode: 0 })).toBe("hjul");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: 10, deltaMode: 0 })).toBe("hjul");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 0, deltaY: 53.2, deltaMode: 0 })).toBe("hjul");
  });

  it("horisontal komponent ⇒ styreflate-scroll (eneste entydige pan-signatur)", () => {
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 12, deltaY: 2, deltaMode: 0 })).toBe("styreflate-scroll");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: -8, deltaY: 0, deltaMode: 0 })).toBe("styreflate-scroll");
    expect(klassifiserWheel({ ctrlKey: false, deltaX: 3.5, deltaY: 9.1, deltaMode: 0 })).toBe("styreflate-scroll");
  });
});

describe("anvendZoomFaktor — bildepunktet under pekeren ligger fast (±2 px)", () => {
  const viewport = 800;
  const grenser = { min: 0.25, maks: 50 };

  // Bildefraksjonen (0–1) under pekeren = (scroll + viewX) / innholdsbredde.
  function fraksjonUnderPeker(zoom: number, scroll: number, viewX: number): number {
    return (scroll + viewX) / (viewport * zoom);
  }

  it("ett knip-trinn holder punktet fast, uten klipping", () => {
    const z0 = 1;
    const viewX = 500;
    const s0 = 0;
    const før = fraksjonUnderPeker(z0, s0, viewX);

    const { zoom, scroll } = anvendZoomFaktor(z0, knipFaktor(-30), grenser, {
      viewX,
      viewY: 0,
      scrollLeft: s0,
      scrollTop: 0,
    });
    // Scrollen settes etter resize (useLayoutEffect) → ingen klipping.
    const satt = klipp(scroll.left, viewport * zoom, viewport);
    expect(satt).toBe(scroll.left);
    const etter = fraksjonUnderPeker(zoom, satt, viewX);

    // Samme bildefraksjon → samme punkt under pekeren. I piksler på bildet:
    const avvikPx = Math.abs(etter - før) * (viewport * zoom);
    expect(avvikPx).toBeLessThanOrEqual(2);
  });

  it("et helt knip (mange rammer) holder punktet fast gjennom hele forløpet", () => {
    let zoom = 1;
    let scroll = 0;
    const viewX = 620;
    const startFraksjon = fraksjonUnderPeker(zoom, scroll, viewX);

    // Åtte animasjonsrammer med akkumulert knip-delta (som et knip inn).
    for (let i = 0; i < 8; i++) {
      const res = anvendZoomFaktor(zoom, knipFaktor(-18), grenser, {
        viewX,
        viewY: 0,
        scrollLeft: scroll,
        scrollTop: 0,
      });
      zoom = res.zoom;
      scroll = klipp(res.scroll.left, viewport * zoom, viewport);
      const avvikPx = Math.abs(fraksjonUnderPeker(zoom, scroll, viewX) - startFraksjon) * (viewport * zoom);
      expect(avvikPx).toBeLessThanOrEqual(2);
    }
    // Zoomen har faktisk endret seg vesentlig (sømløs akkumulering).
    expect(zoom).toBeGreaterThan(1.3);
  });
});

describe("knip vs. dagens musehjul-trinn — dagens oppførsel er feil for knip", () => {
  it("et knip av mange små delta blir villt med trinn-faktoren, mildt med exp-faktoren", () => {
    // Dagens kode (feil): hvert knip-event = et helt 1,25-trinn.
    let trinnZoom = 1;
    for (let i = 0; i < 10; i++) trinnZoom *= hjulFaktor(-3); // -3 < 0 ⇒ 1,25
    // 1,25^10 ≈ 9,3 — et lite knip ville zoomet nesten 10×.
    expect(trinnZoom).toBeGreaterThan(9);

    // Ny kode (riktig): akkumulert exp over samme delta er mildt.
    const knip = knipFaktor(-3 * 10);
    expect(knip).toBeGreaterThan(1);
    expect(knip).toBeLessThan(1.4);
  });
});
