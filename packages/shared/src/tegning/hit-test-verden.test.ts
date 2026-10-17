import { describe, expect, it } from "vitest";
import type { DxfKameraParametre, SkjermPunkt } from "./kamera-projeksjon";
import { byggBboxIndeks, hitTestWorld } from "./hit-test-verden";
import type { RegisterVerden, RegisterVerdenObjekt } from "./objektmodell";

// Samme BASIS-kamera som kamera-projeksjon.test.ts: senter (1000, 2000),
// halvW=400/halvH=300 → pxPerVerdenhet = 800/(2*400) = 1 (enkel 1:1-skala, så
// test-geometrien kan konstrueres direkte i "pikselavstander" fra senteret).
const KAMERA: DxfKameraParametre = {
  left: -400,
  right: 400,
  top: 300,
  bottom: -300,
  zoom: 1,
  senterX: 1000,
  senterY: 2000,
  rotasjonGrader: 0,
  canvasBredde: 800,
  canvasHoyde: 600,
};

/** Skjermpunkt for en verdensoffset (dx, dy) fra kamerasenteret (Y flippet, skjerm-Y ned). */
function skjermVedOffset(dx: number, dy: number): SkjermPunkt {
  return { skjermX: 400 + dx, skjermY: 300 - dy };
}

function objekt(partial: Partial<RegisterVerdenObjekt> & { id: string }): RegisterVerdenObjekt {
  return {
    lag: "TEST",
    dtype: "LINE",
    kategori: "Test",
    lagLinjetype: "",
    ...partial,
  };
}

function register(objekter: RegisterVerdenObjekt[]): RegisterVerden {
  const map: Record<string, RegisterVerdenObjekt> = {};
  for (const o of objekter) map[o.id] = o;
  return {
    fil: "test.dxf",
    koordsys: "ukjent",
    antallObjekter: objekter.length,
    antallLag: 1,
    antallElid: 0,
    objekter: map,
    elidIndex: {},
    laginventar: [],
  };
}

describe("hitTestWorld", () => {
  it("treffer en strek nøyaktig på geometrien", () => {
    const linje = objekt({
      id: "A",
      dtype: "LINE",
      bbox: [990, 2000, 1010, 2000],
      geom: [[990, 2000, 1010, 2000]],
    });
    const reg = register([linje]);
    const idx = byggBboxIndeks(reg);
    const treff = hitTestWorld(skjermVedOffset(0, 0), KAMERA, reg, idx);
    expect(treff?.id).toBe("A");
  });

  it("flate-objekt (HATCH) treffer kun ved containment, ikke bbox-nærhet utenfor", () => {
    const skravur = objekt({
      id: "B",
      dtype: "HATCH",
      bbox: [950, 1950, 1050, 2050],
    });
    const reg = register([skravur]);
    const idx = byggBboxIndeks(reg);
    // Innenfor flaten → treff.
    expect(hitTestWorld(skjermVedOffset(10, 10), KAMERA, reg, idx)?.id).toBe("B");
    // Utenfor flatens bbox, men innenfor 400px-fallback-radius → ikke containment → ingen treff.
    expect(hitTestWorld(skjermVedOffset(200, 200), KAMERA, reg, idx)).toBeNull();
  });

  it("strek vinner alltid over flate ved nær-likhet (skravur taper mot kontur)", () => {
    const vegg = objekt({
      id: "VEGG",
      dtype: "LINE",
      bbox: [990, 2000, 1010, 2000],
      geom: [[990, 2000, 1010, 2000]],
    });
    const gulv = objekt({
      id: "GULV",
      dtype: "HATCH",
      kategori: "Gulv",
      bbox: [950, 1950, 1050, 2050],
    });
    const reg = register([vegg, gulv]);
    const idx = byggBboxIndeks(reg);
    // Trykk rett på veggen, inni gulvets flate — veggen (tier 0) skal vinne over gulvet (tier 1).
    const treff = hitTestWorld(skjermVedOffset(0, 0), KAMERA, reg, idx);
    expect(treff?.id).toBe("VEGG");
  });

  it("ved nær-likhet (±4px) vinner objektet med minst lokalt geometri-areal", () => {
    const kortSving = objekt({
      id: "KORT",
      dtype: "ARC",
      bbox: [999, 2000, 1001, 2000],
      geom: [[999, 2000, 1001, 2000]],
    });
    const langVegg = objekt({
      id: "LANG",
      dtype: "LINE",
      bbox: [900, 2000, 1100, 2000],
      geom: [[900, 2000, 1100, 2000]],
    });
    const reg = register([kortSving, langVegg]);
    const idx = byggBboxIndeks(reg);
    // Begge linjene går gjennom samme område, samme avstand til trykkpunktet (±4px) —
    // den med minst lokalt areal (døren/svingen) skal vinne over den lange veggen.
    const treff = hitTestWorld(skjermVedOffset(0, 0.5), KAMERA, reg, idx);
    expect(treff?.id).toBe("KORT");
  });

  it("klart nærmere objekt (>4px forskjell) vinner uavhengig av areal", () => {
    const naer = objekt({
      id: "NAER",
      dtype: "LINE",
      bbox: [999, 2000, 1001, 2000],
      geom: [[999, 2000, 1001, 2000]],
    });
    const fjern = objekt({
      id: "FJERN",
      dtype: "LINE",
      bbox: [900, 1990, 1100, 1990],
      geom: [[900, 1990, 1100, 1990]],
    });
    const reg = register([naer, fjern]);
    const idx = byggBboxIndeks(reg);
    const treff = hitTestWorld(skjermVedOffset(0, 0), KAMERA, reg, idx);
    expect(treff?.id).toBe("NAER");
  });

  it("negativ: trykk i tomrom gir ingen treff, ingen feil", () => {
    const linje = objekt({
      id: "A",
      bbox: [990, 2000, 1010, 2000],
      geom: [[990, 2000, 1010, 2000]],
    });
    const reg = register([linje]);
    const idx = byggBboxIndeks(reg);
    expect(hitTestWorld(skjermVedOffset(500, 500), KAMERA, reg, idx)).toBeNull();
  });

  it("to-pass-fallback: treff utenfor 20px-toleranse finnes i 400px-passet", () => {
    const punkt = objekt({
      id: "PUNKT",
      dtype: "INSERT",
      bbox: [1025, 2000, 1025, 2000],
      geom: [[1025, 2000]],
    });
    const reg = register([punkt]);
    const idx = byggBboxIndeks(reg);
    // 25 px unna: utenfor første pass (20 px), innenfor andre (400 px).
    const treff = hitTestWorld(skjermVedOffset(25, 0), KAMERA, reg, idx);
    expect(treff?.id).toBe("PUNKT");
  });

  it("objekt uten geom faller tilbake til bbox-kant-avstand", () => {
    const uten = objekt({
      id: "UTEN_GEOM",
      dtype: "INSERT",
      bbox: [995, 1998, 1005, 2002],
    });
    const reg = register([uten]);
    const idx = byggBboxIndeks(reg);
    expect(hitTestWorld(skjermVedOffset(0, 0), KAMERA, reg, idx)?.id).toBe("UTEN_GEOM");
  });
});
