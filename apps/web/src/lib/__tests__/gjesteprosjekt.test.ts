import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { skalNullstilleProsjekt } from "../gjesteprosjekt";

/** POST 2026-11-15 (15) test (d): firmabytte nullstiller eget firmas prosjekt, ikke gjesteprosjekt. */
const F = "firma-f";
const G = "firma-g";
const EGET = { id: "p-eget", primaryOrganizationId: F };
const GJEST = { id: "p-gjest", primaryOrganizationId: "firma-x" };
const STANDALONE = { id: "p-standalone", primaryOrganizationId: null };

describe("skalNullstilleProsjekt — (15) test (d)", () => {
  it("prosjekt i valgt firma → beholdes", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: F, prosjekt: EGET, gjesteIder: [], lasterGjester: false })).toBe(false);
  });
  it("🔴 bytte til annet firma → eget firmas prosjekt nullstilles (som før)", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: G, prosjekt: EGET, gjesteIder: [GJEST.id], lasterGjester: false })).toBe(true);
  });
  it("🔴 gjesteprosjekt → nullstilles IKKE ved firmabytte", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: F, prosjekt: GJEST, gjesteIder: [GJEST.id], lasterGjester: false })).toBe(false);
    expect(skalNullstilleProsjekt({ valgtFirmaId: G, prosjekt: GJEST, gjesteIder: [GJEST.id], lasterGjester: false })).toBe(false);
  });
  it("🔴 gjestelista laster → vent (ingen nullstilling før lista er kjent)", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: F, prosjekt: GJEST, gjesteIder: [], lasterGjester: true })).toBe(false);
  });
  it("standalone med firma valgt → nullstilles (uendret)", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: F, prosjekt: STANDALONE, gjesteIder: [], lasterGjester: false })).toBe(true);
  });
  it("intet firma eller intet prosjekt → ingen nullstilling", () => {
    expect(skalNullstilleProsjekt({ valgtFirmaId: null, prosjekt: EGET, gjesteIder: [], lasterGjester: false })).toBe(false);
    expect(skalNullstilleProsjekt({ valgtFirmaId: F, prosjekt: null, gjesteIder: [], lasterGjester: false })).toBe(false);
  });
  it("vakt: ProsjektProvider avgjør nullstilling via skalNullstilleProsjekt", () => {
    const kilde = readFileSync(join(__dirname, "../../kontekst/prosjekt-kontekst.tsx"), "utf-8");
    expect(kilde).toMatch(/skalNullstilleProsjekt\(\{/);
    expect(kilde).not.toMatch(/primaryOrganizationId === valgtFirma\.id\) return/);
  });
});

// (e) Sidebar: Timer/Vareforbruk-elementene gates på gjestestatus.
describe("(e) sidebar skjuler firmamoduler for gjesteprosjekt", () => {
  const kilde = readFileSync(
    join(__dirname, "../../components/layout/sidebar-elementer.tsx"),
    "utf-8",
  );
  it("filteret kaller skjulFirmaModulForGjest med valgtGjest", () => {
    expect(kilde).toContain("skjulFirmaModulForGjest(element.kreverFirmaModul, valgtGjest)");
    expect(kilde).toMatch(/const \{ prosjektId, valgtGjest \} = useProsjekt\(\)/);
  });
});
