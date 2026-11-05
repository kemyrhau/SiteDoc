import { describe, it, expect } from "vitest";
import { utledKildeformat, TEGNING_STATUS_NOEKKEL } from "./kildeformat";
import { DRAWING_STATUSES } from "../validation";

describe("utledKildeformat (B-5)", () => {
  it("konvertert DWG: originalens endelse vinner over fileType=svg", () => {
    expect(utledKildeformat("/uploads/abc-123.DWG", "svg")).toBe("dwg");
  });

  it("konvertert PDF: pdf, ikke png", () => {
    expect(utledKildeformat("/uploads/x/plan.pdf?v=2", "png")).toBe("pdf");
  });

  it("uten original: fileType er kildeformatet", () => {
    expect(utledKildeformat(null, "IFC")).toBe("ifc");
    expect(utledKildeformat(undefined, "png")).toBe("png");
  });

  it("original uten endelse faller tilbake til fileType", () => {
    expect(utledKildeformat("/uploads/abc", "dxf")).toBe("dxf");
    expect(utledKildeformat("/uploads.d/abc", "dxf")).toBe("dxf");
  });

  it("ingenting å utlede → null", () => {
    expect(utledKildeformat(null, null)).toBeNull();
    expect(utledKildeformat("", " ")).toBeNull();
  });
});

describe("TEGNING_STATUS_NOEKKEL", () => {
  it("dekker alle tegningsstatuser", () => {
    expect(Object.keys(TEGNING_STATUS_NOEKKEL).sort()).toEqual([...DRAWING_STATUSES].sort());
  });
});
