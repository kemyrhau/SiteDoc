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
  });

  it("UTM32: koordinatsystem gjenkjennes fra filnavnet", { timeout: 120_000 }, async () => {
    const { res } = await konverterFixture(UTM32);
    expect(res.feil).toBeNull();
    expect(res.koordinatSystem).toBeTruthy();
    expect(res.scaleKilde).toBe("dwg"); // INSUNITS=6 (meter)
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
  },
);
