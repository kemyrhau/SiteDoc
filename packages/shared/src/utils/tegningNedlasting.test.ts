import { describe, it, expect } from "vitest";
import {
  filendelseFraUrl,
  byggTegningNedlastingsnavn,
  unikNedlastingsnavn,
} from "./tegningNedlasting";

describe("filendelseFraUrl", () => {
  it("henter endelse fra en /uploads-sti", () => {
    expect(filendelseFraUrl("/uploads/abc-123.dwg")).toBe(".dwg");
    expect(filendelseFraUrl("/uploads/x.pdf")).toBe(".pdf");
  });

  it("ignorerer query-streng (signatur)", () => {
    expect(filendelseFraUrl("/uploads/x.dwg?exp=1&sig=zz")).toBe(".dwg");
  });

  it("tom streng når ingen gyldig endelse", () => {
    expect(filendelseFraUrl("/uploads/mappe/uten-endelse")).toBe("");
    expect(filendelseFraUrl("/uploads/ender-med-punktum.")).toBe("");
  });
});

describe("byggTegningNedlastingsnavn (filnavn-regel)", () => {
  it("tegningsnummer + _rev + endelse", () => {
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: "B3-06-A-20-35-01",
        navn: "Fallplan",
        revisjon: "03",
        fileUrl: "/uploads/uuid.dwg",
      }),
    ).toBe("B3-06-A-20-35-01_rev03.dwg");
  });

  it("bevarer bindestreker i tegningsnummeret", () => {
    const navn = byggTegningNedlastingsnavn({
      tegningsnummer: "ARK-P-101",
      navn: "x",
      revisjon: "A",
      fileUrl: "/uploads/uuid.pdf",
    });
    expect(navn).toBe("ARK-P-101_revA.pdf");
  });

  it("faller tilbake til navn når tegningsnummer mangler", () => {
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: null,
        navn: "Situasjonsplan",
        revisjon: "A",
        fileUrl: "/uploads/uuid.pdf",
      }),
    ).toBe("Situasjonsplan_revA.pdf");
  });

  it("uten revisjon → ingen _rev-suffiks", () => {
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: "A-20-101",
        navn: "x",
        revisjon: null,
        fileUrl: "/uploads/uuid.svg",
      }),
    ).toBe("A-20-101.svg");
  });

  it("saniterer mellomrom og path-/windows-ulovlige tegn, beholder æøå", () => {
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: "Plan 1: snitt/A*",
        navn: "x",
        revisjon: "B",
        fileUrl: "/uploads/uuid.pdf",
      }),
    ).toBe("Plan_1__snitt_A__revB.pdf");
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: "Grunnmur øst",
        navn: "x",
        revisjon: null,
        fileUrl: "/uploads/uuid.dwg",
      }),
    ).toBe("Grunnmur_øst.dwg");
  });

  it("mangler endelse → navn uten suffiks", () => {
    expect(
      byggTegningNedlastingsnavn({
        tegningsnummer: "A-20-101",
        navn: "x",
        revisjon: "A",
        fileUrl: "/uploads/uuid-uten-endelse",
      }),
    ).toBe("A-20-101_revA");
  });
});

describe("unikNedlastingsnavn (kollisjon)", () => {
  it("første forekomst beholdes uendret", () => {
    const brukt = new Set<string>();
    expect(unikNedlastingsnavn("A-20-101_revA.dwg", brukt)).toBe("A-20-101_revA.dwg");
  });

  it("kollisjon → -2, -3 FØR endelsen, deterministisk", () => {
    const brukt = new Set<string>();
    const n1 = unikNedlastingsnavn("A-20-101_revA.dwg", brukt);
    const n2 = unikNedlastingsnavn("A-20-101_revA.dwg", brukt);
    const n3 = unikNedlastingsnavn("A-20-101_revA.dwg", brukt);
    expect(n1).toBe("A-20-101_revA.dwg");
    expect(n2).toBe("A-20-101_revA-2.dwg");
    expect(n3).toBe("A-20-101_revA-3.dwg");
  });

  it("kollisjon uten endelse appender bakerst", () => {
    const brukt = new Set<string>(["mappe"]);
    expect(unikNedlastingsnavn("mappe", brukt)).toBe("mappe-2");
  });

  it("alle navn i et sett blir unike", () => {
    const brukt = new Set<string>();
    const navn = ["x.pdf", "x.pdf", "y.pdf", "x.pdf"].map((n) => unikNedlastingsnavn(n, brukt));
    expect(new Set(navn).size).toBe(navn.length);
    expect(navn).toEqual(["x.pdf", "x-2.pdf", "y.pdf", "x-3.pdf"]);
  });
});
