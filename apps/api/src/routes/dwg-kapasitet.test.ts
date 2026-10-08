import { describe, it, expect } from "vitest";

// DWG-1 / DoD-2: når konvertereren mangler, skal kapasiteten rapportere dwg=false,
// slik at opplastingsdialogen AVVISER .dwg/.dxf (ikke en stille `conversionStatus=failed`).
// Pek binærstien på noe som ikke finnes FØR import → deterministisk «mangler»-tilstand.
process.env.DWG2DXF_PATH = "/nonexistent/sitedoc-dwg2dxf-finnes-ikke";
const { parseDwgVersjon, hentKonverteringKapasitet, _nullstillKapasitetCache } = await import(
  "../services/dwgKonvertering"
);

describe("parseDwgVersjon — henter x.y(.z) fra --version-utskrift", () => {
  it("leser libredwg-formatet", () => {
    expect(parseDwgVersjon("dwg2dxf 0.14")).toBe("0.14");
    expect(parseDwgVersjon("dwg2dxf 0.14\nLibreDWG 0.14.0 ...")).toBe("0.14");
    expect(parseDwgVersjon("ProgramVersion: 0.13.4")).toBe("0.13.4");
  });
  it("gir null når ingen versjon finnes", () => {
    expect(parseDwgVersjon("ingen tall her")).toBeNull();
    expect(parseDwgVersjon("")).toBeNull();
  });
});

describe("hentKonverteringKapasitet — mangler konverterer → dwg=false", () => {
  it("rapporterer dwg=false/versjon=null når dwg2dxf ikke finnes", async () => {
    _nullstillKapasitetCache();
    const kap = await hentKonverteringKapasitet();
    expect(kap).toEqual({ dwg: false, versjon: null });
  });

  it("cacher svaret (samme referanse innen TTL)", async () => {
    _nullstillKapasitetCache();
    const a = await hentKonverteringKapasitet(1000);
    const b = await hentKonverteringKapasitet(2000); // < 60s senere → cache
    expect(a).toBe(b);
  });

  it("cachen utløper etter 60 s (nytt oppslag)", async () => {
    _nullstillKapasitetCache();
    const a = await hentKonverteringKapasitet(1000);
    const b = await hentKonverteringKapasitet(1000 + 60_001); // forbi TTL → nytt kall
    expect(a).not.toBe(b);
    expect(b).toEqual({ dwg: false, versjon: null });
  });
});
