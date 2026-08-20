import { describe, it, expect } from "vitest";
import { beregnUkenorm } from "./ukenorm";

// Dagsnorm-verdiene her simulerer det injiserte oppslaget (hentEffektivArbeidstid).
// 7,5 = vinterdag (07:00-15:00-30), 8,0 = sommerdag (07:00-15:30-30). Ukenormen
// 37,5/40 er ALDRI en literal i koden — den emerges av summen.
const VINTER = 7.5;
const SOMMER = 8.0;

describe("beregnUkenorm", () => {
  it("ren vinteruke → norm = 5 × vinterdagsnorm (37,5)", () => {
    const r = beregnUkenorm("2026-01-05", () => VINTER); // mandag
    expect(r.norm).toBe(37.5);
    expect(r.perDag).toHaveLength(5);
    expect(r.perDag[0]?.dato).toBe("2026-01-05");
    expect(r.perDag[4]?.dato).toBe("2026-01-09"); // fredag
  });

  it("ren sommeruke → norm = 5 × sommerdagsnorm (40)", () => {
    const r = beregnUkenorm("2026-07-06", () => SOMMER);
    expect(r.norm).toBe(40);
  });

  it("overgangsuke regnes BLANDET (sommertid starter onsdag)", () => {
    // man+tir = vinter, ons-fre = sommer → 2×7,5 + 3×8,0 = 39
    const sommerFra = "2026-05-06"; // onsdag
    const r = beregnUkenorm("2026-05-04", (dato) =>
      dato >= sommerFra ? SOMMER : VINTER,
    );
    expect(r.norm).toBe(39);
    expect(r.perDag.map((d) => d.dagsnorm)).toEqual([
      VINTER,
      VINTER,
      SOMMER,
      SOMMER,
      SOMMER,
    ]);
  });

  it("helligdag reduserer normen for sin dag (injektor returnerer 0)", () => {
    // 1. mai (fredag) er helligdag → 0. 4 vinterdager + 0 = 30.
    const helligdag = "2026-05-01";
    const r = beregnUkenorm("2026-04-27", (dato) =>
      dato === helligdag ? 0 : VINTER,
    );
    expect(r.norm).toBe(30);
    expect(r.perDag[4]).toEqual({ dato: "2026-05-01", dagsnorm: 0 });
  });

  it("halvdag reduserer normen for sin dag", () => {
    // torsdag halvdag = 3,75. 4×7,5 + 3,75 = 33,75.
    const halvdag = "2026-01-08";
    const r = beregnUkenorm("2026-01-05", (dato) =>
      dato === halvdag ? 3.75 : VINTER,
    );
    expect(r.norm).toBe(33.75);
  });

  it("negativ dagsnorm klampes til 0", () => {
    const r = beregnUkenorm("2026-01-05", () => -5);
    expect(r.norm).toBe(0);
    expect(r.perDag.every((d) => d.dagsnorm === 0)).toBe(true);
  });

  it("krysser månedsgrense korrekt (UTC-aritmetikk)", () => {
    // uke som starter 30. mars 2026 (mandag) → fredag = 3. april
    const r = beregnUkenorm("2026-03-30", () => VINTER);
    expect(r.perDag[0]?.dato).toBe("2026-03-30");
    expect(r.perDag[4]?.dato).toBe("2026-04-03");
    expect(r.norm).toBe(37.5);
  });

  it("konfigurerbart antall arbeidsdager (f.eks. 6-dagers uke)", () => {
    const r = beregnUkenorm("2026-01-05", () => VINTER, 6);
    expect(r.perDag).toHaveLength(6);
    expect(r.norm).toBe(45);
  });
});
