import { describe, it, expect } from "vitest";
import { beregnHoydeTilBunn } from "../useHoydeTilBunn";

/**
 * F3 (relay 29.10): søkesiden ligger i `main` (blokk, overflow-y-auto) via en prosjekt-layout som
 * får auto-høyde — `h-full` på siden løser til ingenting (målt i ekte app 29.10: main 852 px, barn
 * 174 892 px etter klikk, søkefeltet usynlig). Siden måler selv plassen ned til bunnen av `main`.
 * Rød før: `beregnHoydeTilBunn` fantes ikke.
 */
describe("F3 — beregnHoydeTilBunn", () => {
  it("høyde = bunnen av main minus elementets topp (main uten egen rulling)", () => {
    // main 48–900, siden starter på 48 → 852
    expect(beregnHoydeTilBunn(900, 48, 0)).toBe(852);
  });

  it("tar hensyn til at main allerede er rullet (elementet står høyere i viewport)", () => {
    // main rullet 200 px: elementets viewport-topp er 48 − 200 = −152, men plassen er fortsatt 852
    expect(beregnHoydeTilBunn(900, -152, 200)).toBe(852);
  });

  it("verktøylinje eller banner over siden trekkes fra", () => {
    expect(beregnHoydeTilBunn(900, 88, 0)).toBe(812);
  });

  it("aldri negativ", () => {
    expect(beregnHoydeTilBunn(100, 500, 0)).toBe(0);
  });
});
