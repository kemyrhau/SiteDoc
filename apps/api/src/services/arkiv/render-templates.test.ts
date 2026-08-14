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
  it("bygger slank fortsettelses-linje med firma + dok-referanse", () => {
    const h = byggRenderHeader(ramme);
    expect(h).toContain("SiteDoc AS");
    expect(h).toContain("Org.nr 923 456 789");
    expect(h).toContain("SJ-2026-0142");
    expect(h).toContain("P-101");
  });

  it("setter eksplisitt font-size (margin-konteksten arver ingen CSS)", () => {
    expect(byggRenderHeader(ramme)).toMatch(/font-size:\s*\d/);
  });

  it("escaper dokumentnavn", () => {
    const h = byggRenderHeader(ramme);
    expect(h).toContain("Betong &lt;dekke&gt;");
    expect(h).not.toContain("Betong <dekke>");
  });

  it("utelater logo og org.nr når de mangler", () => {
    const h = byggRenderHeader({ ...ramme, logoDataUrl: null, orgnr: undefined });
    expect(h).not.toContain("<img");
    expect(h).not.toContain("Org.nr");
  });
});

describe("byggRenderFooter", () => {
  it("har generert-stempel + dokument-id (sporbarhetsminimum) og sidetall-spenn", () => {
    const f = byggRenderFooter(ramme, "14.08.2026 14:32");
    expect(f).toContain("Generert fra SiteDoc 14.08.2026 14:32");
    expect(f).toContain("dokument-id sj_9f2c41d8");
    expect(f).toContain('<span class="pageNumber"></span>');
    expect(f).toContain('<span class="totalPages"></span>');
  });

  it("setter eksplisitt font-size", () => {
    expect(byggRenderFooter(ramme, "x")).toMatch(/font-size:\s*\d/);
  });
});
