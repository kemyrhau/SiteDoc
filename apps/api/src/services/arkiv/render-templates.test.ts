import { describe, it, expect } from "vitest";
import { byggRenderHeader, byggRenderFooter } from "./render-templates";
import type { RammeData } from "./sammenstilling";

/**
 * Per-side header/footer for Playwright (4c). Rent lag. Verifiserer at margin-
 * konteksten får eksplisitt font-size (Chromium default 0 = usynlig),
 * sporbarhetsminimum på hver side, sidetall-spennene og escaping.
 */

const ramme: RammeData = {
  firmaNavn: "SiteDoc AS",
  orgnr: "923 456 789",
  dokumenttype: "Sjekkliste",
  dokumentnavn: "Betong <dekke>",
  dokumentnummer: "SJ-2026-0142",
  dokumentId: "sj_9f2c41d8",
  prosjekt: "P-101 · Bjørvika",
  logoDataUrl: "data:image/png;base64,AAAA",
};

describe("byggRenderHeader", () => {
  it("bærer KUN dokumentreferanse (dokumenttype · navn · nummer)", () => {
    const h = byggRenderHeader(ramme);
    expect(h).toContain("Sjekkliste");
    expect(h).toContain("SJ-2026-0142");
  });

  it("utelater firma, org.nr, logo og prosjekt (unngår side-1-dublering)", () => {
    const h = byggRenderHeader(ramme);
    expect(h).not.toContain("SiteDoc AS");
    expect(h).not.toContain("Org.nr");
    expect(h).not.toContain("<img");
    expect(h).not.toContain("P-101");
  });

  it("setter eksplisitt font-size (margin-konteksten arver ingen CSS)", () => {
    expect(byggRenderHeader(ramme)).toMatch(/font-size:\s*\d/);
  });

  it("escaper dokumentnavn", () => {
    const h = byggRenderHeader(ramme);
    expect(h).toContain("Betong &lt;dekke&gt;");
    expect(h).not.toContain("Betong <dekke>");
  });

  it("utelater dokumentnummer-spennet når nummer mangler", () => {
    const h = byggRenderHeader({ ...ramme, dokumentnummer: "" });
    expect(h).not.toContain("<strong");
    expect(h).toContain("Sjekkliste");
  });
});

describe("byggRenderFooter", () => {
  it("har generert-stempel (sporbarhetsminimum) og sidetall-spenn; dokument-id utgått (funn 3)", () => {
    const f = byggRenderFooter(ramme, "14.08.2026 14:32");
    expect(f).toContain("Generert fra SiteDoc 14.08.2026 14:32");
    expect(f).not.toContain("dokument-id");
    expect(f).toContain('<span class="pageNumber"></span>');
    expect(f).toContain('<span class="totalPages"></span>');
  });

  it("setter eksplisitt font-size", () => {
    expect(byggRenderFooter(ramme, "x")).toMatch(/font-size:\s*\d/);
  });
});
