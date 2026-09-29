import { describe, it, expect } from "vitest";
import { reskalerLagObjekt, FABRIC_VERSJON } from "./lag";

describe("reskalerLagObjekt — koordinat-normalisering på tvers av skjermstørrelser", () => {
  it("ratio 1 (samme canvas) lar objektet stå urørt", () => {
    const obj = { type: "circle", left: 40, top: 20, scaleX: 1.5, scaleY: 1.5, stroke: "#ef4444" };
    expect(reskalerLagObjekt(obj, 1)).toEqual(obj);
  });

  it("ratio 2 (web→dobbelt så stor canvas) dobler posisjon OG skala", () => {
    const ut = reskalerLagObjekt({ left: 40, top: 20, scaleX: 1.5, scaleY: 2 }, 2);
    expect(ut.left).toBe(80);
    expect(ut.top).toBe(40);
    expect(ut.scaleX).toBe(3);
    expect(ut.scaleY).toBe(4);
  });

  it("ratio 0.5 (web→mobil, mindre canvas) halverer", () => {
    const ut = reskalerLagObjekt({ left: 100, top: 60, scaleX: 2, scaleY: 2 }, 0.5);
    expect(ut).toMatchObject({ left: 50, top: 30, scaleX: 1, scaleY: 1 });
  });

  it("manglende scaleX/scaleY behandles som 1 (Fabric-default), ikke 0", () => {
    const ut = reskalerLagObjekt({ left: 10, top: 10 }, 3);
    expect(ut.scaleX).toBe(3);
    expect(ut.scaleY).toBe(3);
  });

  it("manglende left/top behandles som 0", () => {
    const ut = reskalerLagObjekt({ scaleX: 1, scaleY: 1 }, 4);
    expect(ut.left).toBe(0);
    expect(ut.top).toBe(0);
  });

  it("bevarer øvrige egenskaper (type, stroke, path) uendret", () => {
    const obj = { type: "path", path: [["M", 0, 0]], stroke: "#ef4444", left: 5, top: 5, scaleX: 1, scaleY: 1 };
    const ut = reskalerLagObjekt(obj, 2);
    expect(ut.type).toBe("path");
    expect(ut.stroke).toBe("#ef4444");
    expect(ut.path).toEqual([["M", 0, 0]]);
  });

  it("FABRIC_VERSJON matcher CDN-en HTML-en laster (én kilde)", () => {
    expect(FABRIC_VERSJON).toBe("5.3.1");
  });
});
