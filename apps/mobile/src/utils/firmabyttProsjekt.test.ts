import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { firmabyttUtfall } from "./firmabyttProsjekt";

/**
 * Ordre 2026-11-15 (19): mobil nullstilte valgt prosjekt ved ethvert firmabytte, også
 * gjesteprosjekt. Nå samme regel som web (`skalNullstilleProsjekt` i @sitedoc/shared).
 */
const F = "firma-f";
const G = "firma-g";
const X = "firma-x";
const GJEST = { id: "p-gjest", primaryOrganizationId: X };

const utfall = (over: Partial<Parameters<typeof firmabyttUtfall>[0]>) =>
  firmabyttUtfall({
    forrigeFirmaId: F,
    valgtFirmaId: G,
    prosjektId: "p-eget",
    gjester: [GJEST],
    lasterGjester: false,
    ...over,
  });

describe("firmabyttUtfall — (19)", () => {
  it("🔴 gjesteprosjekt beholdes ved firmabytte", () => {
    expect(utfall({ prosjektId: GJEST.id })).toBe("behold");
  });
  it("🔴 gjesteprosjekt eid av det nye firmaet beholdes", () => {
    expect(utfall({ prosjektId: "p-g", gjester: [{ id: "p-g", primaryOrganizationId: G }] })).toBe("behold");
  });
  it("🔴 venter mens gjestelista laster (nullstiller ikke for tidlig)", () => {
    expect(utfall({ prosjektId: GJEST.id, lasterGjester: true })).toBe("vent");
  });
  // Negativkontroller: det som nullstilles i dag, nullstilles fortsatt.
  it("negativkontroll: prosjekt i forrige firma (ikke gjest) nullstilles som før", () => {
    expect(utfall({})).toBe("nullstill");
  });
  it("negativkontroll: gjestelista tom (frakoblet, ansettelser ukjent) → nullstilles som før", () => {
    expect(utfall({ prosjektId: GJEST.id, gjester: [] })).toBe("nullstill");
  });
  it("negativkontroll: uten valgt firma nullstilles alltid", () => {
    expect(utfall({ prosjektId: GJEST.id, valgtFirmaId: null })).toBe("nullstill");
  });
  it("ingen valgt prosjekt → ingenting å gjøre", () => {
    expect(utfall({ prosjektId: null })).toBe("behold");
  });
});

describe("kildevakt — ProsjektKontekst bruker den delte regelen", () => {
  const kilde = readFileSync(join(__dirname, "../kontekst/ProsjektKontekst.tsx"), "utf8");
  it("firmabytte går via firmabyttUtfall, ikke ubetinget nullstilling", () => {
    expect(kilde).toContain("firmabyttUtfall(");
    expect(kilde).not.toMatch(/if \(previous && previous !== valgtFirmaId\) \{\s*setValgtProsjektId\(null\)/);
  });
  it("firmabyttUtfall bruker skalNullstilleProsjekt fra @sitedoc/shared (ingen kopi)", () => {
    const util = readFileSync(join(__dirname, "firmabyttProsjekt.ts"), "utf8");
    expect(util).toMatch(/import \{ skalNullstilleProsjekt \} from "@sitedoc\/shared"/);
  });
});
