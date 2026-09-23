import { describe, it, expect } from "vitest";
import {
  MALFORVALTNING_FANER,
  gateMalforvaltningFaner,
} from "../malforvaltning-tilgang";

/**
 * Malforvaltning-gating (ordre malforvaltning, Krav 1) — negativ kontroll.
 *
 * Lese ≠ redigere: prosjektbruker/-admin skal ALDRI se forvaltnings-flaten. Hele flaten er
 * synlig kun hvis minst én fane er det. PR 2: firmaarkiv-fanen (kanAdministrereFirma) er lagt
 * til FØR sitedoc — flaten er dermed synlig for kanAdministrereFirma || erSitedocAdmin.
 */
describe("gateMalforvaltningFaner — negativ kontroll", () => {
  const faner = (t: { kanAdministrereFirma: boolean; erSitedocAdmin: boolean }) =>
    gateMalforvaltningFaner(MALFORVALTNING_FANER, t).map((f) => f.id);

  it("SiteDoc-admin ser SiteDoc-arkiv-fanen", () => {
    expect(faner({ kanAdministrereFirma: false, erSitedocAdmin: true })).toContain("sitedoc");
  });

  it("firma-admin ser Firmaarkiv-fanen (PR 2), IKKE SiteDoc-fanen", () => {
    const f = faner({ kanAdministrereFirma: true, erSitedocAdmin: false });
    expect(f).toContain("firmaarkiv");
    expect(f).not.toContain("sitedoc");
  });

  it("firma-admin lander på Firmaarkiv — den står FØRST i registeret", () => {
    expect(faner({ kanAdministrereFirma: true, erSitedocAdmin: true })[0]).toBe("firmaarkiv");
  });

  it("prosjektadmin/-bruker (ingen admin-rett) ser INGEN fane → flaten skjult", () => {
    // 🔴 Negativ kontroll (gate-krav): prosjektadmin skal fortsatt se INGENTING etter at
    // firmaarkiv-fanen er lagt til. Begge flagg false → tom liste → flaten skjules.
    expect(faner({ kanAdministrereFirma: false, erSitedocAdmin: false })).toEqual([]);
  });

  it("begge roller ser begge faner", () => {
    expect(faner({ kanAdministrereFirma: true, erSitedocAdmin: true })).toEqual([
      "firmaarkiv",
      "sitedoc",
    ]);
  });

  it("gatingen er ikke død — admin får FLERE faner enn en bruker uten rett", () => {
    const admin = faner({ kanAdministrereFirma: true, erSitedocAdmin: true }).length;
    const bruker = faner({ kanAdministrereFirma: false, erSitedocAdmin: false }).length;
    expect(admin).toBeGreaterThan(bruker);
  });
});
