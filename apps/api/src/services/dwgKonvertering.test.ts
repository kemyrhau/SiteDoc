import { describe, it, expect } from "vitest";
import { kanMale, malMm } from "@sitedoc/shared";
import {
  gyldigKoordinat,
  gyldigeExtents,
  gyldigViewBox,
  insunitsTilMm,
  lesInsunits,
  utledDwgMaaling,
  beregnExtents,
  dxfTilSvg,
} from "./dwgKonvertering";

// ---------------------------------------------------------------------------
// D10 — enhetstester på HÅNDSKREVNE minimale DXF-tekster (format, ikke innhold:
// tillatt per minneregel; ingen genererte tegninger). Dekker D3 (1e20-vakt),
// D5 (INSUNITS→mmPrPiksel/scaleKilde=dwg) og D-M12 (INSERT-skala på radius).
// ---------------------------------------------------------------------------

/** Minimal DXF: rektangel w×h som LWPOLYLINE, med valgfri header-extents + INSUNITS. */
function rektangelDxf(opts: {
  w: number;
  h: number;
  insunits?: number;
  extMin?: [number, number];
  extMax?: [number, number];
}): string {
  const { w, h, insunits, extMin, extMax } = opts;
  const header: string[] = [];
  if (insunits !== undefined) header.push("9", "$INSUNITS", "70", String(insunits));
  if (extMin) header.push("9", "$EXTMIN", "10", String(extMin[0]), "20", String(extMin[1]), "30", "0.0");
  if (extMax) header.push("9", "$EXTMAX", "10", String(extMax[0]), "20", String(extMax[1]), "30", "0.0");
  return [
    "0", "SECTION", "2", "HEADER",
    ...header,
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LWPOLYLINE", "8", "0", "90", "4", "70", "1",
    "10", "0.0", "20", "0.0",
    "10", String(w), "20", "0.0",
    "10", String(w), "20", String(h),
    "10", "0.0", "20", String(h),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

/** Minimal DXF: ett block med en CIRCLE, satt inn via INSERT med skala. */
function insertSirkelDxf(radius: number, skala: number): string {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$EXTMIN", "10", "80.0", "20", "80.0", "30", "0.0",
    "9", "$EXTMAX", "10", "120.0", "20", "120.0", "30", "0.0",
    "0", "ENDSEC",
    "0", "SECTION", "2", "BLOCKS",
    "0", "BLOCK", "8", "0", "2", "MINBLOKK", "10", "0.0", "20", "0.0",
    "0", "CIRCLE", "8", "0", "10", "0.0", "20", "0.0", "40", String(radius),
    "0", "ENDBLK",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "INSERT", "8", "0", "2", "MINBLOKK",
    "10", "100.0", "20", "100.0", "41", String(skala), "42", String(skala),
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

describe("D3 — extents-vakt (1e20)", () => {
  it("gyldigKoordinat avviser 1e20 og uendelig, godtar reelle tall", () => {
    expect(gyldigKoordinat(1000)).toBe(true);
    expect(gyldigKoordinat(-500.5)).toBe(true);
    expect(gyldigKoordinat(1e20)).toBe(false);
    expect(gyldigKoordinat(-1e20)).toBe(false);
    expect(gyldigKoordinat(Infinity)).toBe(false);
    expect(gyldigKoordinat(NaN)).toBe(false);
  });

  it("gyldigeExtents avviser AutoCADs tomme sentinel (min>max, |v|=1e20)", () => {
    expect(gyldigeExtents(0, 1000, 0, 500)).toBe(true);
    // Sentinel: EXTMIN=(1e20,1e20), EXTMAX=(-1e20,-1e20)
    expect(gyldigeExtents(1e20, -1e20, 1e20, -1e20)).toBe(false);
    // min == max → ingen bredde
    expect(gyldigeExtents(10, 10, 0, 500)).toBe(false);
  });

  it("gyldigViewBox avviser null-stor og ekstremt avlang flate", () => {
    expect(gyldigViewBox(1040, 540)).toBe(true);
    expect(gyldigViewBox(0, 100)).toBe(false);
    expect(gyldigViewBox(100000, 1)).toBe(false); // ratio 1e5 > 1000
  });

  it("beregnExtents: gyldig header brukes direkte", () => {
    const e = beregnExtents(rektangelDxf({ w: 1000, h: 500, extMin: [0, 0], extMax: [1000, 500] }));
    expect(e).toEqual({ minX: 0, maxX: 1000, minY: 0, maxY: 500 });
  });

  it("beregnExtents: 1e20-sentinel-header forkastes → faller til entiteter", () => {
    const e = beregnExtents(rektangelDxf({ w: 1000, h: 500, extMin: [1e20, 1e20], extMax: [-1e20, -1e20] }));
    expect(e).not.toBeNull();
    expect(e!.maxX).toBeLessThan(1e12);
    expect(e!.maxX).toBeCloseTo(1000, 0);
    expect(e!.maxY).toBeCloseTo(500, 0);
  });

  it("dxfTilSvg: 1e20-header gir likevel SVG via persentil-fallback (ikke tom)", () => {
    const res = dxfTilSvg(rektangelDxf({ w: 1000, h: 500, extMin: [1e20, 1e20], extMax: [-1e20, -1e20] }));
    expect(res).not.toBeNull();
    expect(res!.svg).toContain("<polyline");
    expect(res!.vbW).toBeGreaterThan(900);
    expect(res!.vbW).toBeLessThan(1e12);
  });
});

describe("D5 — $INSUNITS → måling rett fra tegningens enheter", () => {
  it("insunitsTilMm dekker tabellen (1/2/4/5/6, 0=ukjent)", () => {
    expect(insunitsTilMm(1)).toBe(25.4);
    expect(insunitsTilMm(2)).toBe(304.8);
    expect(insunitsTilMm(4)).toBe(1);
    expect(insunitsTilMm(5)).toBe(10);
    expect(insunitsTilMm(6)).toBe(1000);
    expect(insunitsTilMm(0)).toBeNull();
    expect(insunitsTilMm(undefined)).toBeNull();
  });

  it("lesInsunits leser $INSUNITS fra rå DXF-tekst", () => {
    expect(lesInsunits(rektangelDxf({ w: 1, h: 1, insunits: 6 }))).toBe(6);
    expect(lesInsunits(rektangelDxf({ w: 1, h: 1 }))).toBeNull();
  });

  it("INSUNITS=4 (mm): scaleKilde=dwg, kanMale=true, og en 1000 mm-linje måler 1,00 m", () => {
    const dxf = rektangelDxf({ w: 1000, h: 500, insunits: 4, extMin: [0, 0], extMax: [1000, 500] });
    const res = dxfTilSvg(dxf)!;
    const mmPrEnhet = insunitsTilMm(lesInsunits(dxf));
    const maaling = utledDwgMaaling(res.vbW, res.width, res.height, mmPrEnhet);

    expect(maaling.scale).toBe("1:1");
    expect(maaling.scaleKilde).toBe("dwg");
    expect(kanMale(maaling.scale, maaling.mmPrPiksel, maaling.scaleKilde)).toBe(true);
    // mmPrPiksel = vbW·mmPrEnhet/2000. vbW inkluderer 2 %-margen (DoD-ens «0,5» er
    // tilnærmingen uten marg); den EKTE verdien er det som gir riktig måling:
    expect(maaling.mmPrPiksel!).toBeCloseTo(res.vbW / 2000, 6);

    // Round-trip (margin-uavhengig invariant): hele tegningsbredden = 1000 mm.
    const margin = (res.vbW - 1000) / 2;
    const venstre = (margin / res.vbW) * 100;
    const hoyre = ((1000 + margin) / res.vbW) * 100;
    const mm = malMm({ x: venstre, y: 50 }, { x: hoyre, y: 50 }, res.width, res.height, maaling.mmPrPiksel!, 1);
    expect(mm).toBeCloseTo(1000, 1);
  });

  it("INSUNITS=0 (ukjent): scale/scaleKilde=null → måling LÅST til kalibrering", () => {
    const dxf = rektangelDxf({ w: 1000, h: 500, insunits: 0, extMin: [0, 0], extMax: [1000, 500] });
    const res = dxfTilSvg(dxf)!;
    const maaling = utledDwgMaaling(res.vbW, res.width, res.height, insunitsTilMm(lesInsunits(dxf)));
    expect(maaling.scale).toBeNull();
    expect(maaling.scaleKilde).toBeNull();
    expect(maaling.mmPrPiksel).not.toBeNull(); // utledet (vbW/2000), men låst fordi scale=null
    expect(kanMale(maaling.scale, maaling.mmPrPiksel, maaling.scaleKilde)).toBe(false);
  });
});

describe("D-M12 — INSERT-skala treffer skalarstørrelser", () => {
  it("INSERT med skala 2 dobler sirkelens radius (10 → 20)", () => {
    const res = dxfTilSvg(insertSirkelDxf(10, 2))!;
    expect(res).not.toBeNull();
    // Normalisering flytter senteret, men radius er en skalar — skal være 20, ikke 10.
    expect(res.svg).toMatch(/<circle[^>]*\br="20"/);
    expect(res.svg).not.toMatch(/<circle[^>]*\br="10"/);
  });
});
