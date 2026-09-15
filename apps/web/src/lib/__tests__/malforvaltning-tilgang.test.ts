import { describe, it, expect } from "vitest";
import {
  MALFORVALTNING_FANER,
  gateMalforvaltningFaner,
} from "../malforvaltning-tilgang";

/**
 * Malforvaltning-gating (ordre malforvaltning, Krav 1) — negativ kontroll.
 *
 * Lese ≠ redigere: prosjektbruker/-admin skal ALDRI se forvaltnings-flaten. Hele flaten er
 * synlig kun hvis minst én fane er det. PR 1 har KUN SiteDoc-arkiv-fanen (erSitedocAdmin);
 * firmaarkiv-fanen (kanAdministrereFirma) kommer i PR 2.
 */
describe("gateMalforvaltningFaner — negativ kontroll", () => {
  const faner = (t: { kanAdministrereFirma: boolean; erSitedocAdmin: boolean }) =>
    gateMalforvaltningFaner(MALFORVALTNING_FANER, t).map((f) => f.id);

  it("SiteDoc-admin ser SiteDoc-arkiv-fanen", () => {
    expect(faner({ kanAdministrereFirma: false, erSitedocAdmin: true })).toContain("sitedoc");
  });

  it("prosjektadmin/-bruker (ingen admin-rett) ser INGEN fane → flaten skjult", () => {
    expect(faner({ kanAdministrereFirma: false, erSitedocAdmin: false })).toEqual([]);
  });

  it("firma-admin uten sitedoc ser ingen fane i PR 1 (firmaarkiv-fanen kommer i PR 2)", () => {
    // Dokumenterer PR 1-tilstanden: firma-admin bruker fortsatt /dashbord/firma/malarkiv til
    // PR 2 flytter firmaarkivet hit. Bytt denne når firmaarkiv-fanen legges til.
    expect(faner({ kanAdministrereFirma: true, erSitedocAdmin: false })).toEqual([]);
  });

  it("gatingen er ikke død — admin får FLERE faner enn en bruker uten rett", () => {
    const admin = faner({ kanAdministrereFirma: true, erSitedocAdmin: true }).length;
    const bruker = faner({ kanAdministrereFirma: false, erSitedocAdmin: false }).length;
    expect(admin).toBeGreaterThan(bruker);
  });
});
