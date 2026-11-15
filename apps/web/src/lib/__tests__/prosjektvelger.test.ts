import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { erProsjektRadValgt } from "../prosjektvelger";

/** POST 2026-11-15 (16) punkt 1: aktivt prosjekt markert i velgeren uansett side. */
describe("erProsjektRadValgt — (16) punkt 1", () => {
  it("🔴 firmaside uten prosjekt-ID i URL: raden for valgtProsjekt er markert", () => {
    // Firmaside: prosjektScope er «mine»/«alle», men valgtProsjekt finnes (lagret valg).
    expect(erProsjektRadValgt("p-1", "p-1")).toBe(true);
  });
  it("andre rader er ikke markert", () => {
    expect(erProsjektRadValgt("p-2", "p-1")).toBe(false);
  });
  it("intet valgt prosjekt → ingen rad markert", () => {
    expect(erProsjektRadValgt("p-1", null)).toBe(false);
    expect(erProsjektRadValgt("p-1", undefined)).toBe(false);
  });
});

describe("KontekstChip — (16) vakt", () => {
  const kilde = readFileSync(
    join(__dirname, "../../components/layout/KontekstChip.tsx"),
    "utf-8",
  );
  it("🔴 markeringen av prosjektrader er ikke betinget av prosjektScope", () => {
    expect(kilde).not.toMatch(/valgt=\{[^}]*prosjektScope/);
    // Begge grupper (hovedliste + andre firma) bruker samme regel. (18): raden som er
    // markert i velgeren — ved åpning er det aktivt prosjekt (`setMarkertId(prosjektId)`).
    expect(kilde.match(/valgt=\{erProsjektRadValgt\(p\.id, markertId \?\? undefined\)\}/g)?.length).toBe(2);
    expect(kilde).toMatch(/function åpne\(\) \{[\s\S]*?setMarkertId\(prosjektId \?\? null\)/);
  });
  it("🔴 «andre firma»-gruppen filtreres mot valgt firma", () => {
    expect(kilde).toMatch(/gjesteprosjekterIAndreFirma\(gjesteprosjekter, valgtFirma\?\.id\)/);
    expect(kilde).not.toMatch(/new Set\(gjesteprosjekter\.map/);
  });
});
