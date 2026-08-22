import { describe, it, expect } from "vitest";
import { normaliserRad } from "./typer";

/**
 * Rad-id (2026-08-22, variant omslutting): repeater-rad = { _radId, felter }. PDF/api LESER kun
 * og bruker ikke id-en → tom id her. Kjernebeviset er BAKOVERKOMPAT: gamle nakne-Record-rader
 * (postgres-JSON / mobil-SQLite lagret før endringen) må rendres uendret.
 */
describe("normaliserRad (pdf) — bakoverkompat migrer-ved-lesing", () => {
  it("gammel naken Record → omsluttes i { _radId, felter }, felter uendret", () => {
    const gammel = { a: { verdi: "x", kommentar: "", vedlegg: [] }, b: { verdi: 2, kommentar: "", vedlegg: [] } };
    const rad = normaliserRad(gammel);
    expect(rad.felter).toBe(gammel); // samme referanse — ingen kloning, feltverdiene urørt
    expect(rad._radId).toBe(""); // pdf/api bruker ikke id-en
    expect(rad.felter.a.verdi).toBe("x");
  });

  it("ny form { _radId, felter } → passerer uendret", () => {
    const ny = { _radId: "uuid-1", felter: { a: { verdi: "y", kommentar: "", vedlegg: [] } } };
    expect(normaliserRad(ny)).toBe(ny);
  });

  it("null/undefined → tom felter", () => {
    expect(normaliserRad(undefined)).toEqual({ _radId: "", felter: {} });
    expect(normaliserRad(null)).toEqual({ _radId: "", felter: {} });
  });
});
