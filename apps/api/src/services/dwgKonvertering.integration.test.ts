import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, copyFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// D10 — INTEGRASJONSTESTER på EKTE DWG-fixtures. Kjører KUN når libredwgs
// `dwg2dxf` finnes (describe.skipIf) — i CI via Docker-image-steget. Lokalt
// finner den brew-binæren på /opt/homebrew/bin. Setter DWG2DXF_PATH/DWG2SVG_PATH
// FØR den dynamisk importerer tjenesten (modulen leser env ved last).
//
// Ålesund-fixturene ligger i repoet (apps/api/test-fixtures/dwg). Kundetegningen
// (fallplan) ligger ALDRI i git — testen leser den fra env SITEDOC_DWG_KUNDEFIL
// og hoppes over når den mangler.
// ---------------------------------------------------------------------------

function finnDwg2dxf(): string | null {
  const kandidater = [process.env.DWG2DXF_PATH, "/opt/homebrew/bin/dwg2dxf", "/usr/local/bin/dwg2dxf"].filter(
    (s): s is string => !!s,
  );
  for (const k of kandidater) {
    try { execFileSync(k, ["--version"], { stdio: "ignore" }); return k; } catch { /* prøv neste */ }
  }
  try {
    const p = execFileSync("which", ["dwg2dxf"]).toString().trim();
    if (p) { execFileSync(p, ["--version"], { stdio: "ignore" }); return p; }
  } catch { /* ikke på PATH */ }
  return null;
}

const dwg2dxf = finnDwg2dxf();
if (dwg2dxf) {
  process.env.DWG2DXF_PATH = dwg2dxf;
  process.env.DWG2SVG_PATH = dwg2dxf.replace(/dwg2dxf$/, "dwg2SVG");
}

const FIXTURES = fileURLToPath(new URL("../../test-fixtures/dwg/", import.meta.url));
const NTM6 = join(FIXTURES, "2413953_Aalesund_byrom_Vektoriserte_objekter_NTM6.dwg");
const UTM32 = join(FIXTURES, "2413953_Aalesund_byrom_Vektoriserte_objekter_utomhus_UTM32.dwg");
const KUNDEFIL = process.env.SITEDOC_DWG_KUNDEFIL ?? "";

/** Kopier fixturen inn i en temp-uploadDir og konverter DERFRA (dwg2dxf skriver
 * DXF-en ved siden av kilden — vi vil ikke forurense repoet med en .dxf). */
async function konverterFixture(sti: string) {
  const { konverterDwg } = await import("./dwgKonvertering");
  const dir = mkdtempSync(join(tmpdir(), "dwgtest-"));
  const kopi = join(dir, basename(sti));
  copyFileSync(sti, kopi);
  const res = await konverterDwg(kopi, basename(sti), dir, "dwg");
  return { res, dir };
}

describe.skipIf(!dwg2dxf)("D10 — ekte DWG-fixtures (libredwg)", () => {
  it("NTM6 (1e20-saken): gir en IKKE-tom SVG etter D3-vakta", { timeout: 120_000 }, async () => {
    const { res, dir } = await konverterFixture(NTM6);
    expect(res.feil).toBeNull();
    expect(res.visningUrl).toMatch(/\.svg$/);
    const svg = readFileSync(join(dir, res.visningUrl.replace("/uploads/", "")), "utf-8");
    // Ikke tom: inneholder faktisk tegnet geometri (ikke bare den hvite rect-en).
    expect(svg).toMatch(/<(line|polyline|path|circle|polygon)\b/);
    // $INSUNITS=6 (meter) → måling rett fra enhetene.
    expect(res.scaleKilde).toBe("dwg");
    expect(res.scale).toBe("1:1");
    expect(res.mmPrPiksel).toBeGreaterThan(0);
    // RETUR 2 (vedtak A): kartdata har ingen tydelig vinkelrett veggrid → ingen rotasjon.
    expect(res.autoRotasjon).toBeNull();
  });

  it("UTM32: koordinatsystem gjenkjennes fra filnavnet", { timeout: 120_000 }, async () => {
    const { res } = await konverterFixture(UTM32);
    expect(res.feil).toBeNull();
    expect(res.koordinatSystem).toBeTruthy();
    expect(res.scaleKilde).toBe("dwg"); // INSUNITS=6 (meter)
    // Kartdata skal stå urotert (ingen dominant vinkelrett par).
    expect(res.autoRotasjon).toBeNull();
  });

  it("RETUR 4 fullstendighet: NTM6 + UTM32 har ingen parset-men-ikke-tegnet type", { timeout: 120_000 }, async () => {
    for (const fil of [NTM6, UTM32]) {
      const { res } = await konverterFixture(fil);
      expect(res.feil).toBeNull();
      // Gate: hver DXF-type er tegnet eller på allowlist (VERTEX/SEQEND folder inn i POLYLINE).
      expect(res.rapport!.ikkeTegnet).toEqual({});
    }
  });

  it("SVAR RETUR 6 spor 2: Ålesund er en no-op (ingen isolerte ytter-klynger → all geometri innenfor viewBox)", { timeout: 120_000 }, async () => {
    // Robust-grensen skal IKKE trimme kartdata (ingen modullinjer/løse markører). Bevis:
    // hvert tegnet punkt ligger innenfor viewBox. Hadde den skrelt, ville skrelt geometri
    // ligget utenfor. (RETUR 1 pkt 7: aldri klipp ekte kantgeometri.)
    for (const fil of [NTM6, UTM32]) {
      const { res, dir } = await konverterFixture(fil);
      const svg = readFileSync(join(dir, res.visningUrl.replace("/uploads/", "")), "utf-8");
      const vb = svg.match(/viewBox="([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+) ([-\d.eE]+)"/)!;
      const vbX = parseFloat(vb[1]!), vbY = parseFloat(vb[2]!), vbW = parseFloat(vb[3]!), vbH = parseFloat(vb[4]!);
      const eps = Math.max(vbW, vbH) * 1e-6;
      let utenfor = 0;
      for (const m of svg.matchAll(/points="([^"]+)"/g))
        for (const c of m[1]!.matchAll(/(-?[\d.eE]+),(-?[\d.eE]+)/g)) {
          const x = parseFloat(c[1]!), y = parseFloat(c[2]!);
          if (x < vbX - eps || x > vbX + vbW + eps || y < vbY - eps || y > vbY + vbH + eps) utenfor++;
        }
      expect(utenfor).toBe(0);
    }
  });
});

describe.skipIf(!dwg2dxf || !KUNDEFIL || !existsSync(KUNDEFIL))(
  "D10 — kundetegning (fallplan, kun via SITEDOC_DWG_KUNDEFIL)",
  () => {
    it("mm-plan: $INSUNITS gir mmPrPiksel", { timeout: 180_000 }, async () => {
      const { res } = await konverterFixture(KUNDEFIL);
      expect(res.feil).toBeNull();
      expect(res.visningUrl).toMatch(/\.svg$/);
      expect(res.mmPrPiksel).toBeGreaterThan(0);
    });

    it("RETUR 2 (vedtak A): bygget auto-roteres ~+40° (vegger 50° → aksejevnt)", { timeout: 180_000 }, async () => {
      const { res } = await konverterFixture(KUNDEFIL);
      expect(res.autoRotasjon).not.toBeNull();
      // Veggrid målt til ~50,5° (97,6 % av linjelengden) → ~+39,5° gjør det aksejevnt.
      // Rotasjonen skal orthogonalisere (|θ| ≤ 45°) og ligge rundt +40°.
      expect(res.autoRotasjon!).toBeGreaterThan(35);
      expect(res.autoRotasjon!).toBeLessThanOrEqual(45);
    });

    it("RETUR 2 §3: startutsnitt (tett klynge) settes", { timeout: 180_000 }, async () => {
      const { res } = await konverterFixture(KUNDEFIL);
      expect(res.startutsnitt).not.toBeNull();
      expect(res.startutsnitt!.w).toBeGreaterThan(0);
      expect(res.startutsnitt!.w).toBeLessThanOrEqual(1);
      expect(res.startutsnitt!.h).toBeGreaterThan(0);
    });

    it("RETUR 2 TILLEGG: LEADER (fall-piler) tegnes — dxf-parser dropper dem", { timeout: 180_000 }, async () => {
      const { konverterDwg: _k } = await import("./dwgKonvertering");
      const { parseLeadere } = await import("./dwgKonvertering");
      const dir = mkdtempSync(join(tmpdir(), "dwgtest-"));
      const kopi = join(dir, basename(KUNDEFIL));
      copyFileSync(KUNDEFIL, kopi);
      execFileSync(dwg2dxf!, ["-y", kopi], { timeout: 180_000, cwd: dir, maxBuffer: 300 * 1024 * 1024, stdio: "ignore" });
      const dxf = readFileSync(kopi.replace(/\.[^.]+$/, ".dxf"), "utf-8");
      const leadere = parseLeadere(dxf);
      // Kundefila: 24 LEADER i model space (23 på «878-…», 1 på «858-…»).
      expect(leadere.model.length).toBeGreaterThanOrEqual(20);
      const { dxfTilSvg } = await import("./dwgKonvertering");
      const svg = dxfTilSvg(dxf)!.svg;
      // Alle LEADER-ene skal ende som polylinjer i SVG-en (før RETUR 2: 0).
      const antall = (svg.match(/data-type="LEADER"/g) || []).length;
      expect(antall).toBeGreaterThanOrEqual(leadere.model.length);
    });

    it("RETUR 4 fullstendighet: ikkeTegnet er tom, og ATTRIB-verditekst tegnes", { timeout: 180_000 }, async () => {
      const { res } = await konverterFixture(KUNDEFIL);
      expect(res.feil).toBeNull();
      expect(res.rapport!.ikkeTegnet).toEqual({});
      // 503 ATTRIB var usynlige før RETUR 4 (dxf-parser dropper dem) → nå tegnes verdiene.
      expect(res.rapport!.parsetPrType["ATTRIB"]).toBeGreaterThan(0);
      expect(res.rapport!.tegnetPrType["ATTRIB"]).toBeGreaterThan(0);
    });
  },
);
