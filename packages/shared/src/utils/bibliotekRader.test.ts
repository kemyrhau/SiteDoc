import { describe, it, expect } from "vitest";
import { byggBibliotekRader, bibliotekFaseHeadingLabel, faseFraHeadingLabel } from "./bibliotekRader";
import type { BibliotekFeltData } from "./bibliotekRader";

/**
 * Spesifikasjon for JSON → rad-transformasjonen (vei C del 1). Seeden og migreringen
 * MÅ produsere nøyaktig dette; round-trip-testen i api bruker samme regel som fasit.
 *
 * Negativ kontroll (ordre Krav 2c): en test låser at overskriftsrader har TOM config —
 * bryt det (sett zone på heading) og testen blir rød.
 */

const MAL: BibliotekFeltData[] = [
  { label: "Type materiale", type: "list_single", zone: "datafelter", fase: "FØR", config: { options: ["A", "B"] } },
  { label: "Fuktighet", type: "decimal", zone: "datafelter", fase: "FØR", config: { unit: "%" } },
  { label: "Resultat", type: "traffic_light", zone: "datafelter", fase: "ETTER" },
];

describe("byggBibliotekRader", () => {
  it("materialiserer én heading per distinkt fase, i første-opptreden-rekkefølge", () => {
    const rader = byggBibliotekRader(MAL);
    // FØR-heading, 2 FØR-felt, ETTER-heading, 1 ETTER-felt = 5 rader (3 felt + 2 faser).
    expect(rader).toHaveLength(5);
    expect(rader.map((r) => `${r.type}:${r.label}`)).toEqual([
      "heading:Kontroll FØR utførelse",
      "list_single:Type materiale",
      "decimal:Fuktighet",
      "heading:Kontroll ETTER utførelse",
      "traffic_light:Resultat",
    ]);
  });

  it("sortOrder er global, inkrementell og starter på 1", () => {
    const rader = byggBibliotekRader(MAL);
    expect(rader.map((r) => r.sortOrder)).toEqual([1, 2, 3, 4, 5]);
  });

  it("overskriftsrader har TOM config og ingen hjelpetekst (negativ kontroll)", () => {
    const headings = byggBibliotekRader(MAL).filter((r) => r.type === "heading");
    expect(headings).toHaveLength(2);
    for (const h of headings) {
      expect(h.config).toEqual({});
      expect(h.required).toBe(false);
      expect(h.parentId).toBeNull();
      expect("helpText" in h.config).toBe(false);
    }
  });

  it("feltrader beholder config og får zone (sone først, feltets config vinner)", () => {
    const rader = byggBibliotekRader(MAL);
    const typeFelt = rader.find((r) => r.label === "Type materiale");
    expect(typeFelt?.config).toEqual({ zone: "datafelter", options: ["A", "B"] });
    const resultat = rader.find((r) => r.label === "Resultat");
    // Uten zone i JSON → default datafelter.
    expect(resultat?.config).toEqual({ zone: "datafelter" });
  });

  it("felt UTEN fase legges til slutt uten heading", () => {
    const medUtenFase: BibliotekFeltData[] = [
      { label: "A", type: "text_field", fase: "FØR" },
      { label: "Fritt", type: "text_field" },
    ];
    const rader = byggBibliotekRader(medUtenFase);
    expect(rader.map((r) => `${r.type}:${r.label}`)).toEqual([
      "heading:Kontroll FØR utførelse",
      "text_field:A",
      "text_field:Fritt",
    ]);
  });

  it("required bevares (default false); alle rader bærer tom translations", () => {
    const rader = byggBibliotekRader([{ label: "X", type: "checkbox", fase: "FØR", required: true }]);
    const felt = rader.find((r) => r.label === "X");
    expect(felt?.required).toBe(true);
    for (const r of rader) expect(r.translations).toEqual({});
  });

  it("tom/ikke-array gir tom liste", () => {
    expect(byggBibliotekRader([])).toEqual([]);
    // @ts-expect-error — bevisst feil input
    expect(byggBibliotekRader(null)).toEqual([]);
  });

  it("bibliotekFaseHeadingLabel dekker FØR/UNDER/ETTER og faller til ETTER", () => {
    expect(bibliotekFaseHeadingLabel("FØR")).toBe("Kontroll FØR utførelse");
    expect(bibliotekFaseHeadingLabel("UNDER")).toBe("Kontroll UNDER utførelse");
    expect(bibliotekFaseHeadingLabel("ETTER")).toBe("Kontroll ETTER utførelse");
    expect(bibliotekFaseHeadingLabel("ukjent")).toBe("Kontroll ETTER utførelse");
  });

  it("faseFraHeadingLabel er invers for de tre kjente labelene, null ellers", () => {
    expect(faseFraHeadingLabel("Kontroll FØR utførelse")).toBe("FØR");
    expect(faseFraHeadingLabel("Kontroll UNDER utførelse")).toBe("UNDER");
    expect(faseFraHeadingLabel("Kontroll ETTER utførelse")).toBe("ETTER");
    expect(faseFraHeadingLabel("Beskrivelse")).toBeNull();
    // Round-trip: label → fase → label for de tre fasene.
    for (const fase of ["FØR", "UNDER", "ETTER"]) {
      expect(faseFraHeadingLabel(bibliotekFaseHeadingLabel(fase))).toBe(fase);
    }
  });
});

/**
 * Del A (betingede felt, ordre 2026-09-21): `ref` på en forelder → rad-`id`; `parentRef` på et barn
 * → rad-`parentId`. Flate felt beholder id/parentId = null (uendret for alle 23 dagens maler).
 */
describe("byggBibliotekRader — forelder/barn (del A)", () => {
  it("flate felt har id og parentId null (uendret)", () => {
    for (const r of byggBibliotekRader(MAL)) {
      expect(r.id).toBeNull();
      expect(r.parentId).toBeNull();
    }
  });

  it("forelder får id=ref, barn får parentId=parentRef, i forfatter-rekkefølge", () => {
    const tre: BibliotekFeltData[] = [
      { label: "Underlag", type: "list_single", fase: "FØR", ref: "underlag",
        config: { options: ["Ubundet", "Bundet"], conditionActive: true } },
      { label: "Planhet", type: "list_single", fase: "FØR", parentRef: "underlag",
        config: { options: ["OK", "Avvik"], conditionValues: ["Ubundet"] } },
      { label: "Klebing", type: "list_single", fase: "FØR", parentRef: "underlag",
        config: { options: ["OK", "Avvik"], conditionValues: ["Bundet"] } },
    ];
    const rader = byggBibliotekRader(tre);
    // heading + forelder + 2 barn = 4 rader; barn rett etter forelder.
    expect(rader.map((r) => `${r.type}:${r.label}`)).toEqual([
      "heading:Kontroll FØR utførelse",
      "list_single:Underlag",
      "list_single:Planhet",
      "list_single:Klebing",
    ]);
    const forelder = rader.find((r) => r.label === "Underlag")!;
    const planhet = rader.find((r) => r.label === "Planhet")!;
    const klebing = rader.find((r) => r.label === "Klebing")!;
    expect(forelder.id).toBe("underlag");
    expect(forelder.parentId).toBeNull();
    expect(planhet.parentId).toBe("underlag");
    expect(klebing.parentId).toBe("underlag");
    // Utløsersettene ligger PÅ BARNET (ulike per barn) — det app-endringen leser.
    expect(planhet.config.conditionValues).toEqual(["Ubundet"]);
    expect(klebing.config.conditionValues).toEqual(["Bundet"]);
    // Forelderen kommer FØR barna (parent_id kan skrives med foreldre først).
    expect(rader.indexOf(forelder)).toBeLessThan(rader.indexOf(planhet));
    expect(rader.indexOf(forelder)).toBeLessThan(rader.indexOf(klebing));
  });
});
