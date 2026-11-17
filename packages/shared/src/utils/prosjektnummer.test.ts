import { describe, it, expect } from "vitest";
import { visProsjektnummer } from "./prosjektnummer";

// T63 (kort-id-spec § 12.7, E4).
describe("visProsjektnummer", () => {
  it("internnummeret vises", () => {
    expect(
      visProsjektnummer({ internalProjectNumber: "2611", projectNumber: "SD-20260101-0001", visSiteDocNummer: true }),
    ).toBe("2611");
  });
  it("internnummeret vises også når SD-visning er av", () => {
    expect(
      visProsjektnummer({ internalProjectNumber: "2611", projectNumber: "SD-20260101-0001", visSiteDocNummer: false }),
    ).toBe("2611");
  });
  it("uten internnummer vises SD-nummeret", () => {
    expect(visProsjektnummer({ internalProjectNumber: null, projectNumber: "SD-20260101-0001", visSiteDocNummer: true })).toBe(
      "SD-20260101-0001",
    );
    expect(visProsjektnummer({ internalProjectNumber: "  ", projectNumber: "SD-20260101-0001" })).toBe("SD-20260101-0001");
  });
  it("uten internnummer og med SD-visning av er feltet tomt", () => {
    expect(
      visProsjektnummer({ internalProjectNumber: null, projectNumber: "SD-20260101-0001", visSiteDocNummer: false }),
    ).toBe("");
  });
  it("uten prosjekt er feltet tomt", () => {
    expect(visProsjektnummer(null)).toBe("");
  });
});
