import { describe, it, expect } from "vitest";
import { normaliserRad, nyRadId } from "../typer";

/**
 * Rad-id (2026-08-22, variant omslutting): web ER write-siden — `_radId` er en EKTE stabil id.
 * Bakoverkompat: gamle nakne-Record-rader får uuid ved lesing (persisteres ved neste lagring).
 */
describe("normaliserRad / nyRadId (web) — write-side med ekte id", () => {
  it("gammel naken Record → omsluttes med EKTE uuid + felter urørt", () => {
    const gammel = { a: { verdi: "x", kommentar: "", vedlegg: [] } };
    const rad = normaliserRad(gammel);
    expect(rad.felter).toBe(gammel);
    expect(rad._radId).toBeTruthy();
    expect(rad._radId.length).toBeGreaterThan(8); // uuid, ikke tom
  });

  it("ny form passerer uendret (id bevart → stabil på tvers av lesninger)", () => {
    const ny = { _radId: "fast-id", felter: { a: { verdi: 1, kommentar: "", vedlegg: [] } } };
    expect(normaliserRad(ny)).toBe(ny);
    expect(normaliserRad(ny)._radId).toBe("fast-id");
  });

  it("nyRadId gir unike id-er", () => {
    expect(nyRadId()).not.toBe(nyRadId());
  });
});
