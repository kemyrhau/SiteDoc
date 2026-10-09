import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
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
  fargeFraRaa,
  parseHatcher,
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
// D10 — integrasjonstest mot EKTE kundefil (aldri i git). Krever libredwg
// (`dwg2dxf`) + `SITEDOC_DWG_KUNDEFIL`; ellers skippet.
// ---------------------------------------------------------------------------

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
});
