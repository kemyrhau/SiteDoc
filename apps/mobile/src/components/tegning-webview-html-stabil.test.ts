import { describe, it, expect } from "vitest";
import { lagHtmlBygger, type StabilHtmlInndata } from "./tegning-webview-html";

/**
 * ORDRE 24: ny HTML-streng = full WebView-reload = zoom/pan nullstilles. Markører og
 * «du er her» skal derfor ikke endre HTML-en — de injiseres via window.settMarkørLag.
 */
const stabil: StabilHtmlInndata = {
  tegningUrl: "/uploads/plan.png",
  omrader: [],
  trykkOppsett: "enkel",
  rotasjonDelta: 0,
  startutsnitt: null,
  svgInline: false,
};

describe("lagHtmlBygger — markør/GPS gir ingen ny HTML", () => {
  it("flyttet rødt punkt → samme HTML", () => {
    const bygg = lagHtmlBygger();
    const før = bygg(stabil, { markører: [{ id: "pos", x: 10, y: 10, farge: "#ef4444" }], gpsMarkør: null });
    const etter = bygg({ ...stabil }, { markører: [{ id: "pos", x: 55, y: 70, farge: "#ef4444" }], gpsMarkør: null });
    expect(etter).toBe(før);
  });

  it("«du er her» kommer inn etter åpning → samme HTML", () => {
    const bygg = lagHtmlBygger();
    const før = bygg(stabil, { markører: [], gpsMarkør: null });
    const etter = bygg({ ...stabil, omrader: [] }, { markører: [], gpsMarkør: { x: 40, y: 60 } });
    expect(etter).toBe(før);
  });

  it("startverdiene ligger i første HTML (første bilde er riktig)", () => {
    const html = lagHtmlBygger()(stabil, { markører: [{ id: "pos", x: 12.5, y: 33, farge: "#ef4444" }], gpsMarkør: { x: 40, y: 60 } });
    expect(html).toContain('"x":12.5');
    expect(html).toContain('var gpsPos = {"x":40,"y":60}');
    expect(html).toContain("window.settMarkørLag");
  });

  it("ny tegning (stabil inndata endret) → ny HTML", () => {
    const bygg = lagHtmlBygger();
    const før = bygg(stabil, { markører: [], gpsMarkør: null });
    expect(bygg({ ...stabil, tegningUrl: "/uploads/annen.png" }, { markører: [], gpsMarkør: null })).not.toBe(før);
    expect(bygg({ ...stabil, tegningUrl: "/uploads/annen.png", rotasjonDelta: 90 }, { markører: [], gpsMarkør: null })).toContain("annen.png");
  });
});
