import { describe, it, expect } from "vitest";
import { utledProsjektForZip, ZipAvvist, type ZipTegningRad } from "./tegningNedlasting";

function rad(id: string, projectId: string): ZipTegningRad {
  return {
    id,
    name: id,
    drawingNumber: null,
    revision: "A",
    fileUrl: `/uploads/${id}.dwg`,
    originalFileUrl: null,
    projectId,
  };
}

describe("utledProsjektForZip (tilgangsavvisning)", () => {
  it("returnerer prosjektet når alle id-er finnes i samme prosjekt", () => {
    const rader = [rad("a", "P1"), rad("b", "P1")];
    expect(utledProsjektForZip(rader, 2)).toBe("P1");
  });

  it("avviser når en forespurt id ikke ble funnet (antall-avvik)", () => {
    const rader = [rad("a", "P1")]; // ba om 2, fikk 1 → fremmed/ukjent id
    expect(() => utledProsjektForZip(rader, 2)).toThrow(ZipAvvist);
  });

  it("avviser når id-ene spenner flere prosjekter (smuglet fremmed id)", () => {
    const rader = [rad("a", "P1"), rad("b", "P2")];
    expect(() => utledProsjektForZip(rader, 2)).toThrow(ZipAvvist);
  });

  it("avviser tom forespørsel", () => {
    expect(() => utledProsjektForZip([], 0)).toThrow(ZipAvvist);
  });

  it("en enslig fremmed id i et annet prosjekt gir fortsatt ett prosjekt — tilgang avgjøres så av verifiserProsjektmedlem", () => {
    // utledProsjektForZip slipper gjennom (ett prosjekt); den faktiske
    // medlemssjekken (DB) avviser. Dette dokumenterer ansvarsdelingen.
    const rader = [rad("a", "FREMMED")];
    expect(utledProsjektForZip(rader, 1)).toBe("FREMMED");
  });
});
