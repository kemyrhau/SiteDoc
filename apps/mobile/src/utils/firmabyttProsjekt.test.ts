import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adminValgtGjestUtfall, firmabyttUtfall } from "./firmabyttProsjekt";

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

describe("firmabyttUtfall — ADMIN-GJEST tillegg A (2026-11-25)", () => {
  it("🔴 admin i fremmed firma: valgt gjesteprosjekt nullstilles", () => {
    expect(utfall({ prosjektId: GJEST.id, adminUtenGjestegruppe: true })).toBe("nullstill");
  });
  it("admin i fremmed firma: gjesteprosjekt eid av det nye firmaet beholdes", () => {
    expect(
      utfall({ prosjektId: "p-g", gjester: [{ id: "p-g", primaryOrganizationId: G }], adminUtenGjestegruppe: true }),
    ).toBe("behold");
  });
  it("ellers beholdes gjesteprosjektet (15)", () => {
    expect(utfall({ prosjektId: GJEST.id, adminUtenGjestegruppe: false })).toBe("behold");
  });
});

describe("adminValgtGjestUtfall — ADMIN-UTEN-GJESTEGRUPPE punkt 2 (2026-11-26)", () => {
  // Kenneths prod-oppsett: admin i eget firma F, Prosessanlegg eid av firma X.
  const gjest = (over: Partial<Parameters<typeof adminValgtGjestUtfall>[0]>) =>
    adminValgtGjestUtfall({
      valgtFirmaId: F,
      prosjektId: GJEST.id,
      gjester: [GJEST],
      lasterGjester: false,
      adminUtenGjestegruppe: true,
      ...over,
    });
  it("🔴 admin i eget firma med valgt gjesteprosjekt → nullstilles uten firmabytte", () => {
    expect(gjest({})).toBe("nullstill");
  });
  it("admin: prosjekt i valgt firma (ikke gjest) beholdes", () => {
    expect(gjest({ prosjektId: "p-eget" })).toBe("behold");
  });
  it("admin: gjesteprosjekt eid av valgt firma beholdes", () => {
    expect(gjest({ valgtFirmaId: X })).toBe("behold");
  });
  it("admin: venter mens gjestelista laster", () => {
    expect(gjest({ lasterGjester: true })).toBe("vent");
  });
  it("regresjon: vanlig bruker / company_admin beholder valgt gjesteprosjekt", () => {
    expect(gjest({ adminUtenGjestegruppe: false })).toBe("behold");
  });
  it("intet valgt prosjekt eller firma → ingenting å gjøre", () => {
    expect(gjest({ prosjektId: null })).toBe("behold");
    expect(gjest({ valgtFirmaId: null })).toBe("behold");
  });
});

describe("kildevakt — ProsjektKontekst bruker den delte regelen", () => {
  const kilde = readFileSync(join(__dirname, "../kontekst/ProsjektKontekst.tsx"), "utf8");
  it("firmabytte går via firmabyttUtfall, ikke ubetinget nullstilling", () => {
    expect(kilde).toContain("firmabyttUtfall(");
    expect(kilde).toMatch(/lasterGjester,\n\s*adminUtenGjestegruppe,\n\s*\}\);/);
    expect(kilde).not.toMatch(/if \(previous && previous !== valgtFirmaId\) \{\s*setValgtProsjektId\(null\)/);
  });
  it("🔴 ADMIN-UTEN-GJESTEGRUPPE: rollen alene avgjør, og lagret gjestevalg sjekkes uten firmabytte", () => {
    expect(kilde).toMatch(/erAdminUtenGjestegruppe\(minBruker\.data\?\.role\)/);
    expect(kilde).toContain("adminValgtGjestUtfall({");
    expect(kilde).toMatch(/enabled: trengerGjester/);
    expect(kilde).not.toContain("erAdminIFremmedFirma");
  });
  it("firmabyttUtfall bruker skalNullstilleProsjekt fra @sitedoc/shared (ingen kopi)", () => {
    const util = readFileSync(join(__dirname, "firmabyttProsjekt.ts"), "utf8");
    expect(util).toMatch(/import \{ skalNullstilleProsjekt \} from "@sitedoc\/shared"/);
  });
});
