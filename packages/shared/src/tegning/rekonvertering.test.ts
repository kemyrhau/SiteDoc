import { describe, it, expect } from "vitest";
import { erRekonverterbarOriginal, erTegningDwgDxfOpphav } from "./rekonvertering";

describe("erRekonverterbarOriginal", () => {
  it("dwg/dxf-original → true", () => {
    expect(erRekonverterbarOriginal("/uploads/a.dwg")).toBe(true);
    expect(erRekonverterbarOriginal("/uploads/a.DXF")).toBe(true);
  });

  it("pdf-original eller mangler → false", () => {
    expect(erRekonverterbarOriginal("/uploads/a.pdf")).toBe(false);
    expect(erRekonverterbarOriginal(null)).toBe(false);
    expect(erRekonverterbarOriginal(undefined)).toBe(false);
  });
});

describe("erTegningDwgDxfOpphav", () => {
  it("original arkivert (.dwg/.dxf) → true uansett fileType", () => {
    expect(
      erTegningDwgDxfOpphav({ originalFileUrl: "/uploads/a.dwg", conversionStatus: "done", fileType: "svg" }),
    ).toBe(true);
  });

  it("original er pdf → false (utenfor scope, egen vei)", () => {
    expect(
      erTegningDwgDxfOpphav({ originalFileUrl: "/uploads/a.pdf", conversionStatus: "done", fileType: "png" }),
    ).toBe(false);
  });

  it("eldre tegning uten original, fileType=svg + konvertert → true (bevist DWG/DXF-vei)", () => {
    expect(
      erTegningDwgDxfOpphav({ originalFileUrl: null, conversionStatus: "done", fileType: "svg" }),
    ).toBe(true);
  });

  it("eldre tegning uten original, fileType=png (PDF-veien produserer alltid png) → false", () => {
    expect(
      erTegningDwgDxfOpphav({ originalFileUrl: null, conversionStatus: "done", fileType: "png" }),
    ).toBe(false);
  });

  it("plain opplastet SVG (conversionStatus aldri satt) → false", () => {
    expect(
      erTegningDwgDxfOpphav({ originalFileUrl: null, conversionStatus: null, fileType: "svg" }),
    ).toBe(false);
  });
});
