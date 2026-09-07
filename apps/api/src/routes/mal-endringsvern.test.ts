import { describe, it, expect } from "vitest";
import { erKunKosmetiskConfigEndring, samleEtterkommere } from "./mal";

/**
 * Endringsvern (2026-09-07): et krav i bruk kan ikke endres, men skrivefeil (label/helpText) og
 * kosmetikk (placeholder/multiline/role) skal kunne rettes. Prøvestein: kan endringen gjøre at et
 * signert dokument sier noe ANNET om hva som ble kontrollert mot? Ja → meningsbærende → sperr.
 */
describe("erKunKosmetiskConfigEndring — hva som slipper forbi vernet", () => {
  it("min-endring er meningsbærende → ikke kosmetisk (nektes på felt i bruk)", () => {
    expect(erKunKosmetiskConfigEndring({ min: 25 }, { min: 50 })).toBe(false);
  });
  it("kun helpText-endring er kosmetisk → tillates", () => {
    expect(erKunKosmetiskConfigEndring({ min: 25, helpText: "a" }, { min: 25, helpText: "b" })).toBe(true);
  });
  it("placeholder/multiline/role er kosmetiske (cowork-gate)", () => {
    expect(erKunKosmetiskConfigEndring({ placeholder: "0" }, { placeholder: "0.0" })).toBe(true);
    expect(erKunKosmetiskConfigEndring({ multiline: false }, { multiline: true })).toBe(true);
    expect(erKunKosmetiskConfigEndring({ role: "Kontrollør" }, { role: "Ansvarlig" })).toBe(true);
  });
  it("zone er BEVISST meningsbærende (topptekst = dokumentets identitet)", () => {
    expect(erKunKosmetiskConfigEndring({ zone: "datafelter" }, { zone: "topptekst" })).toBe(false);
  });
  it("options/kravType/enhet/styrendeFeltId/grenseVarianter/conditionType → meningsbærende", () => {
    expect(erKunKosmetiskConfigEndring({ options: ["A"] }, { options: ["B"] })).toBe(false);
    expect(erKunKosmetiskConfigEndring({ kravType: "hoyst" }, { kravType: "minst" })).toBe(false);
    expect(erKunKosmetiskConfigEndring({ enhet: "mm" }, { enhet: "cm" })).toBe(false);
    expect(erKunKosmetiskConfigEndring({ styrendeFeltId: "a" }, { styrendeFeltId: "b" })).toBe(false);
    expect(erKunKosmetiskConfigEndring({}, { grenseVarianter: [{ valg: "A", maks: 5 }] })).toBe(false);
    expect(erKunKosmetiskConfigEndring({}, { conditionType: "utenfor_krav" })).toBe(false);
  });
  it("ingen endring → kosmetisk (ingen sperre)", () => {
    expect(erKunKosmetiskConfigEndring({ min: 25, enhet: "mm" }, { min: 25, enhet: "mm" })).toBe(true);
  });
  it("meningsbærende + kosmetisk samtidig → meningsbærende vinner", () => {
    expect(erKunKosmetiskConfigEndring({ min: 25, helpText: "a" }, { min: 50, helpText: "b" })).toBe(false);
  });
});

describe("samleEtterkommere — objekt + hele parentId-treet", () => {
  const objs = [
    { id: "rot", parentId: null },
    { id: "barn1", parentId: "rot" },
    { id: "barnebarn", parentId: "barn1" },
    { id: "barn2", parentId: "rot" },
    { id: "annet", parentId: null },
  ];
  it("samler rot + alle etterkommere rekursivt", () => {
    expect(samleEtterkommere(objs, "rot").sort()).toEqual(["barn1", "barn2", "barnebarn", "rot"]);
  });
  it("løvnode → bare seg selv", () => {
    expect(samleEtterkommere(objs, "annet")).toEqual(["annet"]);
  });
});
