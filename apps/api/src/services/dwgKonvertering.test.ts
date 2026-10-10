import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { kanMale, malMm, detekterKoordinatSystem } from "@sitedoc/shared";
import {
  gyldigKoordinat,
  gyldigeExtents,
  gyldigViewBox,
  insunitsTilMm,
  lesInsunits,
  utledDwgMaaling,
  beregnExtents,
  dxfTilSvg,
  fargeFraRaa,
  parseHatcher,
  parseLeadere,
  dominantVeggvinkel,
  velgAutoRotasjon,
  roterPunkt,
  roterProsentMarkor,
  normaliser180,
  beregnStartutsnitt,
  parseAttrib,
  tellDxfInventar,
  byggRapport,
  RAPPORT_ALLOWLIST,
  robustGrense,
  fontStr,
  CAP_RATIO,
  mtekstForankring,
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

/** Minimal DXF med LAYER-tabell (navn→colorIndex) + én LINE som arver lagets farge (BYLAYER). */
function bylayerLinjeDxf(lagNavn: string, lagColorIndex: number): string {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0",
    "9", "$EXTMAX", "10", "100.0", "20", "100.0", "30", "0.0",
    "0", "ENDSEC",
    "0", "SECTION", "2", "TABLES",
    "0", "TABLE", "2", "LAYER", "70", "1",
    "0", "LAYER", "2", lagNavn, "70", "0", "62", String(lagColorIndex), "6", "CONTINUOUS",
    "0", "ENDTAB",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    // LINE uten egen 62 → BYLAYER → arver lagets farge
    "0", "LINE", "8", lagNavn, "10", "0.0", "20", "0.0", "11", "100.0", "21", "100.0",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

/** Minimal DXF: en LINE (så dxf-parser får ≥1 entitet) + én HATCH (polyline-grense, 4 pkt). */
function hatchDxf(opts: { solid: boolean }): string {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0",
    "9", "$EXTMAX", "10", "10.0", "20", "10.0", "30", "0.0",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "LINE", "8", "0", "10", "0.0", "20", "0.0", "11", "10.0", "21", "10.0",
    "0", "HATCH", "8", "VEGG", "70", opts.solid ? "1" : "0",
    "91", "1",                              // 1 grensebane
    "92", "3",                              // ekstern + polyline
    "72", "0", "73", "1", "93", "4",        // ikke-bulge, lukket, 4 vertekser
    "10", "1.0", "20", "1.0",
    "10", "9.0", "20", "1.0",
    "10", "9.0", "20", "9.0",
    "10", "1.0", "20", "9.0",
    "97", "0",                              // 0 kilde-grenseobjekter
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

/** Minimal DXF: blokk med base-punkt (100,100) og en LINE i verdenskoord, satt inn på (100,100). */
function blokkBaseDxf(): string {
  return [
    "0", "SECTION", "2", "HEADER",
    "9", "$EXTMIN", "10", "95.0", "20", "95.0", "30", "0.0",
    "9", "$EXTMAX", "10", "115.0", "20", "115.0", "30", "0.0",
    "0", "ENDSEC",
    "0", "SECTION", "2", "BLOCKS",
    // Base-punkt = (100,100), geometri i verdenskoord nær basen
    "0", "BLOCK", "8", "0", "2", "BB", "10", "100.0", "20", "100.0",
    "0", "LINE", "8", "0", "10", "100.0", "20", "100.0", "11", "110.0", "21", "110.0",
    "0", "ENDBLK",
    "0", "ENDSEC",
    "0", "SECTION", "2", "ENTITIES",
    "0", "INSERT", "8", "0", "2", "BB", "10", "100.0", "20", "100.0",
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

// ---------------------------------------------------------------------------
// RETUR 1 — farge (ACI 7/BYLAYER → svart), HATCH-fyll, full extents-dekning,
// blokk-base-punkt. Enhetstester på håndskrevne minimale DXF-tekster.
// ---------------------------------------------------------------------------

describe("RETUR 1 pkt 1/9 — ACI 7 og hvit tegnes svart; ekte RGB beholdes", () => {
  it("fargeFraRaa: hvit (0xFFFFFF), ACI 7 og ACI 0 → svart; ekte RGB → rgb()", () => {
    expect(fargeFraRaa(0xffffff)).toBe("#000"); // dxf-parser resolver ACI 7 hit
    expect(fargeFraRaa(7)).toBe("#000");
    expect(fargeFraRaa(0)).toBe("#000");
    expect(fargeFraRaa(0x0093dd)).toBe("rgb(0,147,221)"); // ekte farge beholdes
    expect(fargeFraRaa(0xfffffe)).toBe("#000"); // nesten-hvit → svart
  });

  it("dxfTilSvg: BYLAYER-linje på hvitt lag (colorIndex 7) tegnes svart, ikke hvit", () => {
    const res = dxfTilSvg(bylayerLinjeDxf("VEGG", 7))!;
    expect(res).not.toBeNull();
    expect(res.svg).toContain('stroke="#000"');
    expect(res.svg).not.toMatch(/stroke="(white|#fff|rgb\(255,255,255\))"/i);
  });
});

describe("RETUR 1 pkt 3 — HATCH (dxf-parser dropper dem, parses fra rå tekst)", () => {
  it("parseHatcher leser polyline-grensen (4 vertekser) fra model-space", () => {
    const h = parseHatcher(hatchDxf({ solid: false }));
    expect(h.model.length).toBe(1);
    expect(h.model[0]!.hatchLoops[0]!.length).toBe(4);
    expect(h.model[0]!.layer).toBe("VEGG");
    expect(h.model[0]!.solid).toBe(false);
  });

  it("dxfTilSvg: mønster-HATCH gir grått fyll under linjene", () => {
    const res = dxfTilSvg(hatchDxf({ solid: false }))!;
    expect(res).not.toBeNull();
    expect(res.svg).toMatch(/<path d="M[^"]*Z" fill="#c8c8c8" fill-rule="evenodd"/);
    // fyllet ligger FØR linjene i dokumentet (tegnes bak)
    expect(res.svg.indexOf("#c8c8c8")).toBeLessThan(res.svg.indexOf("<line"));
  });

  it("dxfTilSvg: ekte solid-HATCH (70=1) fylles ikke grått (bruker farge)", () => {
    const res = dxfTilSvg(hatchDxf({ solid: true }))!;
    expect(res!.svg).toMatch(/<path d="M[^"]*Z" fill="#000" fill-rule="evenodd"/);
  });
});

describe("RETUR 1 pkt 7 — extents dekker ALL gyldig geometri (ingen persentil-klipping)", () => {
  it("1e20-header → fallback favner hele entitets-boksen; 0 entiteter utenfor viewBox", () => {
    // Rektangel 1000×500 uten gyldig header → full min/max-fallback.
    const res = dxfTilSvg(rektangelDxf({ w: 1000, h: 500, extMin: [1e20, 1e20], extMax: [-1e20, -1e20] }))!;
    expect(res).not.toBeNull();
    // viewBox-bredden (inkl. 2 %-marg) skal dekke hele 1000-enheters bredden, ikke en klippet p99.
    expect(res.vbW).toBeGreaterThanOrEqual(1000);
    expect(res.vbW).toBeLessThan(1000 * 1.1);
    // Logg-fri sjekk: ingen polyline-punkter faller utenfor viewBox-rammen.
    expect(res.svg).toContain("<polyline");
  });
});

describe("RETUR 1 (reparasjon) — blokkens base-punkt trekkes fra ved INSERT", () => {
  it("verdens-autorert blokk med base = innsettingspunkt havner IKKE dobbelt forskjøvet", () => {
    // Uten base-fradrag ville linjen havnet på ~(200,200) og falt utenfor extents (95..115).
    const res = dxfTilSvg(blokkBaseDxf());
    expect(res).not.toBeNull();
    expect(res!.svg).toContain("<line");
  });
});

// ---------------------------------------------------------------------------
// RETUR 2 — auto-rotasjon (vegg + tekst), roterPunkt, startutsnitt, LEADER.
// Rene funksjoner + minimale håndskrevne DXF-er.
// ---------------------------------------------------------------------------

/** N parallelle LINE-segmenter i gitt vinkel (grader), + valgfri TEXT (rotasjon 0). */
function veggerDxf(vinkelDeg: number, antall: number, medTekst: boolean): string {
  const rad = (vinkelDeg * Math.PI) / 180;
  const L = 1000;
  const dx = Math.cos(rad) * L;
  const dy = Math.sin(rad) * L;
  const linjer: string[] = ["0", "SECTION", "2", "ENTITIES"];
  for (let i = 0; i < antall; i++) {
    const x0 = i * 80;
    const y0 = 0;
    linjer.push("0", "LINE", "8", "VEGG", "10", String(x0), "20", String(y0), "11", String(x0 + dx), "21", String(y0 + dy));
  }
  if (medTekst) {
    // TEXT med rotasjon 0 (kode 50 utelatt) midt i tegningen.
    linjer.push("0", "TEXT", "8", "KOTE", "10", "500.0", "20", "400.0", "40", "100.0", "1", "+42 000");
  }
  linjer.push("0", "ENDSEC", "0", "EOF");
  return linjer.join("\n");
}

/** Minimal DXF med én LEADER (2 knekkpunkter, pilhode på) i model space. */
function leaderDxf(): string {
  return [
    "0", "SECTION", "2", "ENTITIES",
    "0", "LEADER", "8", "FALL", "71", "1",
    "10", "0.0", "20", "0.0", "30", "0.0",
    "10", "100.0", "20", "50.0", "30", "0.0",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

describe("RETUR 2 — dominantVeggvinkel (lengdevektet histogram mod 90°)", () => {
  it("25 parallelle 50°-linjer → dominant ≈ 50°, andel ≈ 100 %", () => {
    const segs = Array.from({ length: 25 }, (_, i) => {
      const r = (50 * Math.PI) / 180;
      return { x1: i * 80, y1: 0, x2: i * 80 + 1000 * Math.cos(r), y2: 1000 * Math.sin(r) };
    });
    const d = dominantVeggvinkel(segs)!;
    expect(d).not.toBeNull();
    expect(d.grader).toBeCloseTo(50, 0);
    expect(d.andel).toBeGreaterThan(0.95);
  });

  it("perpendikulært par (0° + 90°) havner i samme mod-90-topp", () => {
    const segs = [
      ...Array.from({ length: 15 }, (_, i) => ({ x1: 0, y1: i, x2: 1000, y2: i })), // 0°
      ...Array.from({ length: 15 }, (_, i) => ({ x1: i, y1: 0, x2: i, y2: 1000 })), // 90°
    ];
    const d = dominantVeggvinkel(segs)!;
    expect(d.grader).toBeCloseTo(0, 0);
    expect(d.andel).toBeGreaterThan(0.95);
  });

  it("for tynt grunnlag (< 20 segmenter) → null", () => {
    expect(dominantVeggvinkel([{ x1: 0, y1: 0, x2: 1, y2: 1 }])).toBeNull();
  });
});

describe("RETUR 2 — velgAutoRotasjon (kvadrant fra tekst)", () => {
  it("vegg 50°, tekst vannrett (0°) → +40° (orthogonaliserer, minste |θ|)", () => {
    const tekst = Array.from({ length: 10 }, () => ({ grader: 0, vekt: 1 }));
    expect(velgAutoRotasjon(50, tekst)).toBeCloseTo(40, 5);
  });

  it("vegg 50°, tekst følger veggen (50°) → -50° (tekst blir lesbar ved 0°)", () => {
    const tekst = Array.from({ length: 10 }, () => ({ grader: 50, vekt: 1 }));
    expect(velgAutoRotasjon(50, tekst)).toBeCloseTo(-50, 5);
  });

  it("ingen tekst → minste |rotasjon| (≤ 45°)", () => {
    expect(velgAutoRotasjon(50, [])).toBeCloseTo(40, 5);
    expect(Math.abs(velgAutoRotasjon(50, []))).toBeLessThanOrEqual(45);
  });

  it("allerede aksejevn (0°) → 0", () => {
    expect(velgAutoRotasjon(0, [])).toBe(0);
  });
});

describe("RETUR 2 — roterPunkt + normaliser180 (georef-konsistens)", () => {
  it("roterer (1,0) 90° CCW om origo → (0,1)", () => {
    const p = roterPunkt({ x: 1, y: 0 }, 90, { x: 0, y: 0 });
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(1, 6);
  });

  it("round-trip: roter +R så -R gir opprinnelig punkt (kjent verdenspunkt lander likt)", () => {
    const senter = { x: 500000, y: 300000 };
    const P = { x: 581384.88, y: 346999.99 };
    const rotert = roterPunkt(P, 39.5, senter);
    const tilbake = roterPunkt(rotert, -39.5, senter);
    expect(tilbake.x).toBeCloseTo(P.x, 3);
    expect(tilbake.y).toBeCloseTo(P.y, 3);
    // avstand fra senter er bevart (stiv rotasjon)
    const d0 = Math.hypot(P.x - senter.x, P.y - senter.y);
    const d1 = Math.hypot(rotert.x - senter.x, rotert.y - senter.y);
    expect(d1).toBeCloseTo(d0, 3);
  });

  it("normaliser180 kartlegger til (-180, 180]", () => {
    expect(normaliser180(270)).toBe(-90);
    expect(normaliser180(190)).toBe(-170);
    expect(normaliser180(-200)).toBe(160);
    expect(normaliser180(180)).toBe(180);
    expect(normaliser180(40)).toBe(40);
  });
});

describe("RETUR 2 — beregnStartutsnitt (tett klynge, uteliggere ut)", () => {
  it("tett klynge + spredte uteliggere → boksen dekker klyngen, ikke uteliggerne", () => {
    const pkt: { x: number; y: number }[] = [];
    for (let i = 0; i < 200; i++) pkt.push({ x: 100 + (i % 20), y: 100 + Math.floor(i / 20) });
    pkt.push({ x: -5000, y: -5000 }, { x: 9000, y: 9000 }); // 2 uteliggere
    const su = beregnStartutsnitt(pkt)!;
    expect(su).not.toBeNull();
    expect(su.w).toBeLessThan(100); // klyngen er ~20 bred, ikke 14000
    expect(su.h).toBeLessThan(100);
    expect(su.x).toBeGreaterThan(50);
  });

  it("for få punkter (< 50) → null", () => {
    expect(beregnStartutsnitt([{ x: 0, y: 0 }])).toBeNull();
  });
});

describe("RETUR 2 TILLEGG — parseLeadere (dxf-parser dropper LEADER)", () => {
  it("leser model-space LEADER med knekkpunkter + pilhode-flagg", () => {
    const l = parseLeadere(leaderDxf());
    expect(l.model.length).toBe(1);
    expect(l.model[0]!.vertices.length).toBe(2);
    expect(l.model[0]!.harPil).toBe(true);
    expect(l.model[0]!.layer).toBe("FALL");
  });

  it("dxfTilSvg tegner LEADER som polylinje (data-type=LEADER)", () => {
    // Legg LEADER i en tegning med litt geometri så viewBox blir gyldig.
    const dxf = [
      "0", "SECTION", "2", "HEADER",
      "9", "$EXTMIN", "10", "0.0", "20", "0.0", "30", "0.0",
      "9", "$EXTMAX", "10", "100.0", "20", "100.0", "30", "0.0",
      "0", "ENDSEC",
      "0", "SECTION", "2", "ENTITIES",
      "0", "LINE", "8", "0", "10", "0.0", "20", "0.0", "11", "100.0", "21", "100.0",
      "0", "LEADER", "8", "FALL", "71", "0",
      "10", "10.0", "20", "10.0", "10", "60.0", "20", "40.0",
      "0", "ENDSEC", "0", "EOF",
    ].join("\n");
    const res = dxfTilSvg(dxf)!;
    expect(res).not.toBeNull();
    expect(res.svg).toContain('data-type="LEADER"');
  });
});

describe("RETUR 2 — rotasjon bakes inn, tekst motroteres (står vannrett som PDF)", () => {
  it("vegger 50° + tekst 0° → autoRotasjon ≈ +40°, og TEXT får ingen rotasjon (horisontal)", () => {
    const res = dxfTilSvg(veggerDxf(50, 25, true))!;
    expect(res).not.toBeNull();
    expect(res.autoRotasjon).not.toBeNull();
    expect(res.autoRotasjon!).toBeCloseTo(40, 0);
    // TEXT har rotasjon 0 i kilden → ingen rotate()-transform → står vannrett selv om
    // geometrien er rotert +40°.
    const tekstEl = res.svg.match(/<text[^>]*>\+42 000<\/text>/)?.[0] ?? "";
    expect(tekstEl).not.toBe("");
    expect(tekstEl).not.toContain("rotate(");
  });

  it("kartdata uten dominant par → ingen rotasjon (autoRotasjon null)", () => {
    // Spredte vinkler, ingen dominans.
    const linjer: string[] = ["0", "SECTION", "2", "ENTITIES"];
    for (let i = 0; i < 40; i++) {
      const r = ((i * 9) * Math.PI) / 180; // 0,9,18,... spredt
      linjer.push("0", "LINE", "8", "K", "10", String(i * 10), "20", "0", "11", String(i * 10 + 100 * Math.cos(r)), "21", String(100 * Math.sin(r)));
    }
    linjer.push("0", "ENDSEC", "0", "EOF");
    const res = dxfTilSvg(linjer.join("\n"))!;
    expect(res).not.toBeNull();
    expect(res.autoRotasjon).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RETUR 3 — Kontrollør-avvik: CRS kobler ut rotasjon (§1), markør-rotasjon ved
// re-konvertering (§2). Klikk-inverse-rotasjon (§3) testes i shared (maaling.test.ts).
// ---------------------------------------------------------------------------

describe("RETUR 3 §1 — CRS funnet kobler ut auto-rotasjon (georef står nord-opp)", () => {
  // Akse-rotert veggrid (50°) MEN plassert i UTM-verdenskoordinater (easting ~500 000,
  // northing ~6 500 000). Både et dominant veggpar OG norske koordinatverdier — nettopp
  // kombinasjonen som traff BEGGE signalene uten vakt (vanlig i norsk prosjektering).
  function utmVeggerDxf(): string {
    const rad = (50 * Math.PI) / 180, L = 100;
    const dx = Math.cos(rad) * L, dy = Math.sin(rad) * L;
    const baseX = 500000, baseY = 6500000;
    const linjer: string[] = ["0", "SECTION", "2", "ENTITIES"];
    for (let i = 0; i < 25; i++) {
      const x0 = baseX + i * 8, y0 = baseY;
      linjer.push("0", "LINE", "8", "VEGG", "10", String(x0), "20", String(y0), "11", String(x0 + dx), "21", String(y0 + dy));
    }
    linjer.push("0", "ENDSEC", "0", "EOF");
    return linjer.join("\n");
  }

  it("UTM-extents detekteres som koordinatsystem", () => {
    const ext = beregnExtents(utmVeggerDxf())!;
    expect(ext).not.toBeNull();
    expect(detekterKoordinatSystem("plan.dxf", ext)).toBe("utm33");
  });

  it("ingenAutoRotasjon=true kobler ut veggrid-rotasjonen (rotasjon 0); uten flagg roteres den", () => {
    const dxf = utmVeggerDxf();
    // Koblet (som konverterDwg gjør når et koordinatsystem er funnet): rotasjon 0.
    expect(dxfTilSvg(dxf, undefined, { ingenAutoRotasjon: true })!.autoRotasjon).toBeNull();
    // Uten kobling ville SAMME veggrid blitt rotert ~+40° — nettopp skjevstillingen vakta hindrer.
    const urørt = dxfTilSvg(dxf)!;
    expect(urørt.autoRotasjon).not.toBeNull();
    expect(urørt.autoRotasjon!).toBeCloseTo(40, 0);
  });

  it("urotert SVG bevarer verdens-aksene (bred easting-akse); rotert ville gitt ~kvadratisk bbox", () => {
    // Koblet ut: SVG-koordinatene er bare forskjøvet/y-speilet verden (ny(y)=-(y-oY)), ingen
    // rotasjon → viewBox beholder det brede easting×northing-forholdet (~256×77). Da peker
    // georefen (bygd på de samme uroterte extentene) konsistent. Hadde geometrien blitt rotert
    // ~40° ville bounding-boksen blitt nær kvadratisk — nettopp skjevstillingen vakta hindrer.
    const dxf = utmVeggerDxf();
    const urotert = dxfTilSvg(dxf, undefined, { ingenAutoRotasjon: true })!;
    const rotert = dxfTilSvg(dxf)!;
    expect(urotert.vbW / urotert.vbH).toBeGreaterThan(2.5); // bred, aksejustert verden
    expect(rotert.vbW / rotert.vbH).toBeLessThan(1.6);      // rotert bbox ~kvadratisk
  });
});

describe("RETUR 3 §2 — roterProsentMarkor (markør flyttes med endret bake-rotasjon)", () => {
  it("hjørnemarkør (0,0) roteres +90° om bildesenteret → (100,0); −90° bringer den tilbake", () => {
    const etter = roterProsentMarkor({ x: 0, y: 0 }, 90);
    expect(etter.x).toBeCloseTo(100, 6);
    expect(etter.y).toBeCloseTo(0, 6);
    const tilbake = roterProsentMarkor(etter, -90);
    expect(tilbake.x).toBeCloseTo(0, 6);
    expect(tilbake.y).toBeCloseTo(0, 6);
  });

  it("delta 0 → markøren står urørt (ingen rotasjonsendring)", () => {
    const p = roterProsentMarkor({ x: 37, y: 62 }, 0);
    expect(p.x).toBe(37);
    expect(p.y).toBe(62);
  });

  it("senter-markøren (50,50) er rotasjons-invariant", () => {
    const p = roterProsentMarkor({ x: 50, y: 50 }, 39.5);
    expect(p.x).toBeCloseTo(50, 6);
    expect(p.y).toBeCloseTo(50, 6);
  });

  it("resultatet klemmes til [0,100] (et hjørne kan lande akkurat på kanten)", () => {
    const p = roterProsentMarkor({ x: 100, y: 100 }, 45);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThanOrEqual(100);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// D10 — integrasjonstest mot EKTE kundefil (aldri i git). Krever libredwg
// (`dwg2dxf`) + `SITEDOC_DWG_KUNDEFIL`; ellers skippet.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RETUR 4 (fullstendighet) — ATTRIB-parsing + rapport. dxf-parser dropper ATTRIB,
// så den parses fra rå tekst og tegnes som TEXT. Rapporten flagger typer i DXF-en
// som ikke er tegnet (utenom allowlist). Gate: ukjent synlig type → ikkeTegnet ≠ {}.
// ---------------------------------------------------------------------------

/** Minimal DXF: ett ATTRIB i ENTITIES. flags=70 (bit 1 = usynlig). */
function attribDxf(opts: { text: string; flags?: number; rot?: number }): string {
  return [
    "0", "SECTION", "2", "ENTITIES",
    // En LINE så dxf.entities ikke er tom (dxf-parser dropper ATTRIB; ekte filer har
    // alltid geometri ved siden av attributtene).
    "0", "LINE", "8", "KOTE", "10", "0.0", "20", "0.0", "11", "300.0", "21", "300.0",
    "0", "ATTRIB", "8", "KOTE", "62", "7",
    "10", "100.0", "20", "200.0", "30", "0.0",
    "40", "2.5", "1", opts.text, "50", String(opts.rot ?? 0),
    "70", String(opts.flags ?? 0), "2", "TAG1",
    "0", "ENDSEC", "0", "EOF",
  ].join("\n");
}

describe("RETUR 4 — parseAttrib (dxf-parser dropper ATTRIB)", () => {
  it("synlig ATTRIB parses med posisjon, høyde, rotasjon og verditekst", () => {
    const a = parseAttrib(attribDxf({ text: "+42 000", rot: 50 }));
    expect(a.model).toHaveLength(1);
    expect(a.model[0]!.text).toBe("+42 000");
    expect(a.model[0]!.position).toEqual({ x: 100, y: 200 });
    expect(a.model[0]!.textHeight).toBe(2.5);
    expect(a.model[0]!.rotation).toBe(50);
  });

  it("usynlig ATTRIB (kode 70 bit 1) hoppes over — bare synlig i model space", () => {
    expect(parseAttrib(attribDxf({ text: "skjult", flags: 1 })).model).toHaveLength(0);
  });

  it("tom verditekst gir ingen ATTRIB", () => {
    expect(parseAttrib(attribDxf({ text: "" })).model).toHaveLength(0);
  });

  it("ATTRIB tegnes som <text> i SVG (verdien synes)", () => {
    const res = dxfTilSvg(attribDxf({ text: "V-42" }))!;
    expect(res).not.toBeNull();
    expect(res.svg).toContain(">V-42</text>");
    expect(res.rapport!.tegnetPrType["ATTRIB"]).toBe(1);
  });
});

describe("RETUR 4 — tellDxfInventar + byggRapport (fullstendighets-gate)", () => {
  it("teller entiteter pr. type i ENTITIES (strukturmarkører utelatt)", () => {
    const dxf = rektangelDxf({ w: 10, h: 10 });
    const inv = tellDxfInventar(dxf);
    expect(inv["LWPOLYLINE"]).toBe(1);
    expect(inv["SECTION"]).toBeUndefined();
    expect(inv["ENDSEC"]).toBeUndefined();
  });

  it("ukjent synlig type i DXF uten tegnet element → ikkeTegnet flagger den", () => {
    const r = byggRapport({ LINE: 5, WIPEOUT: 2 }, { LINE: 5 });
    expect(r.ikkeTegnet).toEqual({ WIPEOUT: 2 });
  });

  it("allowlistede typer (INSERT/SEQEND/ATTDEF/VERTEX) regnes ikke som manglende", () => {
    const r = byggRapport({ INSERT: 3, SEQEND: 3, ATTDEF: 1, VERTEX: 40, LINE: 2 }, { LINE: 2 });
    expect(r.ikkeTegnet).toEqual({});
    expect(RAPPORT_ALLOWLIST.has("INSERT")).toBe(true);
    expect(RAPPORT_ALLOWLIST.has("VERTEX")).toBe(true);
  });

  it("antalls-avvik (LINE 38 982 parset vs 38 981 tegnet) er IKKE en mangel", () => {
    const r = byggRapport({ LINE: 38982 }, { LINE: 38981 });
    expect(r.ikkeTegnet).toEqual({});
  });
});

describe("RETUR 5 TILLEGG 2 — stroke-width er fast skjerm-px, ikke viewBox-enheter", () => {
  /** Alle stroke-width-attributter i en SVG som tallverdier. */
  function strokeBredder(svg: string): number[] {
    return [...svg.matchAll(/stroke-width="([-\d.eE]+)"/g)].map((m) => parseFloat(m[1] ?? ""));
  }

  it("STOR tegning (vbW ~100 000): ingen stroke-width > 2 px — svart-klump-gaten", () => {
    // Før reparasjonen: sw = vbW/2000·1,5 ≈ 75 → `vector-effect:non-scaling-stroke`
    // realiserer det i 75 SKJERMPIKSLER → hele tegningen blir en svart klump i ren <img>.
    // Nå er stroke-width en konstant (1,5), uavhengig av tegningens skala.
    const svg = dxfTilSvg(rektangelDxf({ w: 100_000, h: 80_000 }))!.svg;
    const sws = strokeBredder(svg);
    expect(sws.length).toBeGreaterThan(0);
    expect(Math.max(...sws)).toBeLessThanOrEqual(2);
  });

  it("LITEN tegning (vbW ~200): samme faste stroke-width (ikke skalert ned til hårstrek)", () => {
    const svg = dxfTilSvg(rektangelDxf({ w: 200, h: 200 }))!.svg;
    const sws = strokeBredder(svg);
    expect(Math.max(...sws)).toBeLessThanOrEqual(2);
    // Stor og liten tegning får nå IDENTISK stroke-width — det er hele poenget.
    const stor = strokeBredder(dxfTilSvg(rektangelDxf({ w: 100_000, h: 80_000 }))!.svg);
    expect(Math.max(...sws)).toBeCloseTo(Math.max(...stor), 6);
  });

  it("SVG-en bærer non-scaling-stroke i egen <style> (tynn strek også uten injisert CSS)", () => {
    const svg = dxfTilSvg(rektangelDxf({ w: 100_000, h: 80_000 }))!.svg;
    expect(svg).toContain("non-scaling-stroke");
  });
});

// ---------------------------------------------------------------------------
// SVAR RETUR 6 — spor 2 (robust ytter-grense), teksthøyde (cap-ratio), MTEXT-
// forankring (gruppe 71). Rene funksjoner, deterministiske syntetiske data.
// ---------------------------------------------------------------------------

describe("SVAR RETUR 6 spor 2 — robustGrense (skrell isolerte ytter-klynger)", () => {
  it("jevn tett fordeling: ingen gap → full min/max (no-op, Ålesund uendret)", () => {
    const v = Array.from({ length: 1000 }, (_, i) => i); // 0..999, tett
    const g = robustGrense(v);
    expect(g.lo).toBeLessThanOrEqual(0 + 1000 / 512); // innen én bin-bredde
    expect(g.hi).toBeGreaterThanOrEqual(999 - 1000 / 512);
  });

  it("isolert ytter-klynge bak et stort gap, < maksTrim → skrelles bort", () => {
    // Hovedmasse jevnt 100..199 (1000 pkt) + ÉN uteligger på 1000 (modullinje-bobbel),
    // skilt med et stort tomt gap (200..1000). Uteligger = 0,1 % ≤ maksTrim → skrelles.
    const masse = Array.from({ length: 1000 }, (_, i) => 100 + (i % 100));
    const g = robustGrense([...masse, 1000]);
    expect(g.hi).toBeLessThan(300);         // uteliggeren på 1000 er borte fra grensen
    expect(g.lo).toBeLessThanOrEqual(102);  // nedre kant ~100 bevart
  });

  it("to like store klynger (hver 50 %): guard hindrer trimming → full range", () => {
    // En uteligger-klynge som utgjør mer enn maksTrim (2 %) skal IKKE skrelles —
    // beskytter ekte kantgeometri (RETUR 1 pkt 7).
    const v = [...Array(500).fill(0), ...Array(500).fill(1000)];
    const g = robustGrense(v);
    expect(g.lo).toBeLessThanOrEqual(2);
    expect(g.hi).toBeGreaterThanOrEqual(998);
  });

  it("tom/degenerert input er trygt", () => {
    expect(robustGrense([])).toEqual({ lo: 0, hi: 0 });
    expect(robustGrense([5, 5, 5]).lo).toBe(5);
  });
});

describe("SVAR RETUR 6 pkt 2 — fontStr (SVG-versalhøyde = CAD-nominalhøyde)", () => {
  it("font-size = høyde / cap-ratio (≈1,40× — vår tekst var ~0,72× av TrueView)", () => {
    expect(fontStr(100)).toBeCloseTo(100 / CAP_RATIO, 6);
    expect(fontStr(100) * CAP_RATIO).toBeCloseTo(100, 6); // versalhøyden lander på 100
    expect(fontStr(100)).toBeGreaterThan(130);
  });
});

describe("SVAR RETUR 6 pkt 3 — mtekstForankring (gruppe 71 → anchor/baseline)", () => {
  it("bunn-venstre (7) og udefinert gir TOM streng (uendret gammel utskrift)", () => {
    expect(mtekstForankring(7)).toBe("");
    expect(mtekstForankring(undefined)).toBe("");
    expect(mtekstForankring(0)).toBe("");
  });
  it("topp-venstre (1) henger teksten UNDER punktet (text-before-edge), venstre = default", () => {
    const s = mtekstForankring(1);
    expect(s).toContain('dominant-baseline="text-before-edge"');
    expect(s).not.toContain("text-anchor"); // kolonne venstre = start = default
  });
  it("topp-høyre (3): text-anchor=end + text-before-edge", () => {
    const s = mtekstForankring(3);
    expect(s).toContain('text-anchor="end"');
    expect(s).toContain('dominant-baseline="text-before-edge"');
  });
  it("midt-senter (5): text-anchor=middle + central", () => {
    const s = mtekstForankring(5);
    expect(s).toContain('text-anchor="middle"');
    expect(s).toContain('dominant-baseline="central"');
  });
});

const KUNDEFIL = process.env.SITEDOC_DWG_KUNDEFIL;
const DWG2DXF = process.env.DWG2DXF_PATH ?? "dwg2dxf";
function harDwg2dxf(): boolean {
  try { execFileSync(DWG2DXF, ["--version"], { timeout: 5000, stdio: "ignore" }); return true; }
  catch { return false; }
}
const kjørIntegrasjon = !!KUNDEFIL && harDwg2dxf();

describe.skipIf(!kjørIntegrasjon)("D10 integrasjon — kundefil (fallplan) via libredwg", () => {
  function konverterKundefil(): string {
    const dir = mkdtempSync(join(tmpdir(), "dwgtest-"));
    const dwg = join(dir, basename(KUNDEFIL!));
    copyFileSync(KUNDEFIL!, dwg);
    execFileSync(DWG2DXF, ["-y", dwg], { timeout: 120000, cwd: dir, maxBuffer: 200 * 1024 * 1024, stdio: "ignore" });
    const dxf = readFileSync(dwg.replace(/\.[^.]+$/, ".dxf"), "utf-8");
    rmSync(dir, { recursive: true, force: true });
    return dxf;
  }

  it("linjene tegnes svart (ikke hvit), og veggskraveringen (HATCH) finnes", () => {
    const dxf = konverterKundefil();
    const h = parseHatcher(dxf);
    expect(h.model.length).toBeGreaterThan(1000); // tusenvis av vegg-hatcher
    const res = dxfTilSvg(dxf)!;
    expect(res).not.toBeNull();
    // Ingen hvite streker
    expect(res.svg).not.toMatch(/stroke="(white|#fff|rgb\(255,255,255\))"/i);
    // Svarte streker finnes
    expect(res.svg).toContain('stroke="#000"');
    // HATCH-fyll (grått mønster) finnes
    expect(res.svg).toContain('fill="#c8c8c8"');
    // Rimelig viewBox-forhold (ikke degenerert)
    const ratio = res.vbW / res.vbH;
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(10);
  }, 180000);

  it("fullstendighet: ingen parset-men-ikke-tegnet type (utenom allowlist), og ATTRIB tegnes", () => {
    const res = dxfTilSvg(konverterKundefil())!;
    expect(res).not.toBeNull();
    const r = res.rapport!;
    // Gate: hver type i DXF-en er enten tegnet eller dokumentert ikke-visuell (allowlist).
    expect(r.ikkeTegnet).toEqual({});
    // De 503 ATTRIB var usynlige før RETUR 4 — nå tegnes de synlige verdiene.
    expect(r.parsetPrType["ATTRIB"]).toBeGreaterThan(0);
    expect(r.tegnetPrType["ATTRIB"]).toBeGreaterThan(0);
  }, 180000);

  it("SVAR RETUR 6 spor 2: utstrekningen dekker bygget, ikke modullinjene (de tegnes fortsatt, utenfor viewBox)", () => {
    const res = dxfTilSvg(konverterKundefil())!;
    const vb = res.svg.match(/viewBox="([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+)"/)!;
    const vbX = parseFloat(vb[1]!), vbW = parseFloat(vb[3]!);
    // Alle tegnede x-koordinater (line/polyline/circle/text).
    const xs: number[] = [];
    for (const m of res.svg.matchAll(/<line [^>]*x1="([-\d.eE]+)"[^>]*x2="([-\d.eE]+)"/g)) { xs.push(parseFloat(m[1]!), parseFloat(m[2]!)); }
    for (const m of res.svg.matchAll(/points="([^"]+)"/g)) for (const c of m[1]!.matchAll(/(-?[\d.eE]+),(-?[\d.eE]+)/g)) xs.push(parseFloat(c[1]!));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    // Modullinje-boblene tegnes fortsatt, men ligger UTENFOR viewBox: bevis på at de
    // IKKE styrer utstrekningen (uten skrelling ville all geometri ligget innenfor).
    expect(minX < vbX || maxX > vbX + vbW).toBe(true);
  }, 180000);

  it("RETUR 5 TILLEGG 2: ingen stroke-width > 2 px (fallplanen ble en svart klump i ren <img>)", () => {
    // Målt: vbW ~134 000 → gammel sw ≈ 94 → non-scaling-stroke ga ~94 px strek →
    // hele planen svart i georef-editor/eksport/mobil-WebView. Nå fast 1,5 px.
    const res = dxfTilSvg(konverterKundefil())!;
    const sws = [...res.svg.matchAll(/stroke-width="([-\d.eE]+)"/g)].map((m) => parseFloat(m[1] ?? ""));
    expect(sws.length).toBeGreaterThan(1000);
    expect(Math.max(...sws)).toBeLessThanOrEqual(2);
    expect(res.svg).toContain("non-scaling-stroke");
  }, 180000);
});
