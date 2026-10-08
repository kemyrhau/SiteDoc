import { describe, it, expect } from "vitest";
import {
  sideTilProsent,
  prosentTilSide,
  finnNaermesteSidePunkt,
  sideTilSkjerm,
  type BildeBoks,
} from "./tegningKoordinat";
import type { Punkt } from "@sitedoc/shared";

/**
 * Akseptansetesten for RETUR 5 § 1 (bare siste punkt flyttes på enhet):
 * samme koordinattransform som WebView-en, med zoom ≠ 1 og scroll ≠ 0, og den
 * SKAL treffe punkt nr. 1 av 4. Testen modellerer WKWebView sitt visuelle
 * viewport: et skjermtrykk (dp) → dokument-/side-koordinat (px).
 *
 *   side = viewportOffset + skjerm / skala
 *
 * (skjerm = (side − viewportOffset) × skala). `pageX`/`pageY` som nettleseren
 * gir oss ER allerede side-koordinater; her reproduserer vi dem fra et modellert
 * trykk for å vise at punkt nr. 1 treffes selv når man har zoomet og panet.
 */
function skjermTilSide(skjermX: number, skjermY: number, vpLeft: number, vpTop: number, skala: number) {
  return { pageX: vpLeft + skjermX / skala, pageY: vpTop + skjermY / skala };
}

// Bildet: 1000×1000 layout-px i dokumentroten (0,0) — zoom-invariant boks.
const BOKS: BildeBoks = { sideLeft: 0, sideTop: 0, bredde: 1000, høyde: 1000 };
// Fire målepunkter (prosent). P0 er «punkt nr. 1».
const P: Punkt[] = [
  { x: 10, y: 10 }, // P0 — layout (100,100)
  { x: 90, y: 10 }, // P1 — layout (900,100)
  { x: 90, y: 90 }, // P2 — layout (900,900)
  { x: 10, y: 90 }, // P3 — layout (100,900)
];

describe("sideTilProsent / prosentTilSide — side(dokument) ↔ prosent", () => {
  it("midt på bildet", () => {
    expect(sideTilProsent(500, 500, BOKS)).toEqual({ x: 50, y: 50 });
  });
  it("respekterer bildets offset i dokumentet", () => {
    const boks: BildeBoks = { sideLeft: 40, sideTop: 120, bredde: 800, høyde: 600 };
    expect(sideTilProsent(40, 120, boks)).toEqual({ x: 0, y: 0 });
    expect(sideTilProsent(840, 720, boks)).toEqual({ x: 100, y: 100 });
  });
  it("klemmer utenfor-trykk til 0–100", () => {
    expect(sideTilProsent(-50, 1500, BOKS)).toEqual({ x: 0, y: 100 });
  });
  it("er invers av prosentTilSide", () => {
    const p = { x: 37, y: 62 };
    const s = prosentTilSide(p, BOKS);
    expect(sideTilProsent(s.x, s.y, BOKS)).toEqual(p);
  });
});

describe("finnNaermesteSidePunkt — RETUR 5 § 1: punkt nr. 1 av 4 treffes under zoom + scroll", () => {
  it("zoom 2×, panet til topp-venstre: trykk på P0 (nr. 1) treffer indeks 0", () => {
    // Zoomet 2×, viewport i dokumentorigo (0,0) → viser layout [0..skjermB/2].
    // P0 ligger på layout (100,100) → skjerm (200,200).
    const trykk = skjermTilSide(200, 200, 0, 0, 2);
    expect(trykk.pageX).toBeCloseTo(100, 6);
    expect(sideTilProsent(trykk.pageX, trykk.pageY, BOKS)).toEqual({ x: 10, y: 10 });
    // Skjermterskel 24 px → side-terskel 24/2 = 12 px.
    expect(finnNaermesteSidePunkt(trykk.pageX, trykk.pageY, BOKS, P, 24 / 2)).toBe(0);
  });

  it("zoom 2×, panet til bunn-høyre (scroll ≠ 0): trykk på P2 treffer indeks 2 — og P0 er IKKE siste-punkt-avhengig", () => {
    // Viewport panet til dokument (800,800) → viser layout [800..1000].
    // P2 på layout (900,900) → skjerm ((900-800)*2, (900-800)*2) = (200,200).
    const trykk = skjermTilSide(200, 200, 800, 800, 2);
    expect(trykk.pageX).toBeCloseTo(900, 6);
    expect(finnNaermesteSidePunkt(trykk.pageX, trykk.pageY, BOKS, P, 12)).toBe(2);
  });

  it("alle fire punktene er grabbare (ikke bare det siste)", () => {
    for (let i = 0; i < P.length; i++) {
      const s = prosentTilSide(P[i]!, BOKS);
      expect(finnNaermesteSidePunkt(s.x, s.y, BOKS, P, 12)).toBe(i);
    }
  });

  it("DEMONSTRASJON av bugen: å mate det RÅ skjermtrykket inn i layout-formelen bommer på P0", () => {
    // Den gamle veien behandlet skjermkoordinaten (200,200) som om den var en
    // layout-koordinat: prosent = 200/1000 = 20 % → (20,20), 100 px fra P0.
    const feilPageX = (20 / 100) * 1000; // 200
    const feilPageY = (20 / 100) * 1000; // 200
    expect(finnNaermesteSidePunkt(feilPageX, feilPageY, BOKS, P, 12)).toBe(-1); // bom
    // Den riktige side-veien treffer P0.
    const riktig = skjermTilSide(200, 200, 0, 0, 2);
    expect(finnNaermesteSidePunkt(riktig.pageX, riktig.pageY, BOKS, P, 12)).toBe(0);
  });

  it("degenerert bilde (0 px) → ingen treff", () => {
    expect(finnNaermesteSidePunkt(100, 100, { sideLeft: 0, sideTop: 0, bredde: 0, høyde: 0 }, P, 12)).toBe(-1);
  });
});

describe("sideTilSkjerm — finger i WebViewens synlige areal (RN-lupe-plassering)", () => {
  it("skala 1, ingen offset: side = skjerm", () => {
    expect(sideTilSkjerm(150, 220, 0, 0, 1)).toEqual({ x: 150, y: 220 });
  });
  it("zoom 2×, panet: skjerm = (side − offset) × skala", () => {
    // P2 på side (900,900), viewport (800,800), skala 2 → skjerm (200,200).
    expect(sideTilSkjerm(900, 900, 800, 800, 2)).toEqual({ x: 200, y: 200 });
  });
});
