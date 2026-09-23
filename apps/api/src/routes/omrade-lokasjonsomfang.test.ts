import { describe, it, expect } from "vitest";
import { krevOmradeVedOmradeOmfang } from "./lokasjon-omfang";

/**
 * DoD 12 (steg 2b, 2026-09-23) — et dokument med `lokasjonOmfang = "omrade"` og `omradeId = null`
 * skal være UGYLDIG. Uten regelen er "omrade" et omfang uten innhold. Sett RØD FØRST (verifisert
 * ved å no-op-e hjelperen: kastet uteble, testen ble rød), grønn med regelen på.
 */
describe("krevOmradeVedOmradeOmfang (DoD 12)", () => {
  it("UGYLDIG: omfang=omrade + omradeId=null → kaster BAD_REQUEST", () => {
    expect(() => krevOmradeVedOmradeOmfang("omrade", null)).toThrowError(
      /Velg et område når lokasjonsomfanget/,
    );
  });

  it("UGYLDIG: omfang=omrade + omradeId=undefined → kaster", () => {
    expect(() => krevOmradeVedOmradeOmfang("omrade", undefined)).toThrow();
  });

  it("UGYLDIG: omfang=omrade + omradeId=\"\" (tom streng) → kaster", () => {
    expect(() => krevOmradeVedOmradeOmfang("omrade", "")).toThrow();
  });

  it("GYLDIG: omfang=omrade + omradeId satt → kaster ikke", () => {
    expect(() => krevOmradeVedOmradeOmfang("omrade", "omr-123")).not.toThrow();
  });

  it("GYLDIG: omfang=byggeplass uten omradeId → kaster ikke (regelen gjelder bare omrade)", () => {
    expect(() => krevOmradeVedOmradeOmfang("byggeplass", null)).not.toThrow();
  });

  it("GYLDIG: omfang=punkt / null → kaster ikke", () => {
    expect(() => krevOmradeVedOmradeOmfang("punkt", null)).not.toThrow();
    expect(() => krevOmradeVedOmradeOmfang(null, null)).not.toThrow();
  });
});
