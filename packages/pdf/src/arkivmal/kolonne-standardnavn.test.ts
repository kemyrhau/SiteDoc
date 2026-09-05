import { describe, it, expect } from "vitest";
import { ekspanderEndring, byggKolonnerPerFelt } from "../index";

/**
 * Bygg 50: en repeater-kolonne uten egen label viste «Kolonne 3» + rå UUID til byggherre.
 * Rå UUID er alt fanget (`lesbarVerdi` → «(tegningsreferanse)»). Denne testen dekker den
 * andre input-mangelen: tom kolonne-label skal falle tilbake på FELTTYPENS standardnavn,
 * ikke «Kolonne N». Navnet injiseres av kallerne (shared `standardFeltNavn`) — pdf er
 * null-avhengigheter og slår ikke opp selv. Se relay/inbox-endringsdiff-kolonnelabel.md.
 */

// Simulerer shared `standardFeltNavn` (samme kontrakt: felttype → gjeldende navn | null).
const resolver = (type: string): string | null =>
  (({ drawing_position: "Posisjon i tegning", person: "Person" }) as Record<string, string>)[type] ?? null;

describe("byggKolonnerPerFelt — standardnavn-injeksjon", () => {
  it("fyller standardNavn fra resolver når barnet har type", () => {
    const tre = [{ id: "rep", label: "Repeater", children: [{ id: "c1", label: "", type: "drawing_position" }] }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kart = byggKolonnerPerFelt(tre as any, resolver);
    expect(kart["rep"]).toEqual([{ id: "c1", label: "", standardNavn: "Posisjon i tegning" }]);
  });

  it("uten resolver → standardNavn null (bakoverkompatibelt)", () => {
    const tre = [{ id: "rep", label: "R", children: [{ id: "c1", label: "", type: "drawing_position" }] }];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kart = byggKolonnerPerFelt(tre as any);
    expect(kart["rep"]![0]!.standardNavn).toBeNull();
  });
});

describe("ekspanderEndring — kolonnelabel-fallback", () => {
  const rad = (v: string) => JSON.stringify([{ _radId: "r1", felter: { c1: v } }]);

  it("tom label + standardNavn → «Rad 1 — Posisjon i tegning»", () => {
    const kolonner = [{ id: "c1", label: "", standardNavn: "Posisjon i tegning" }];
    const diffs = ekspanderEndring("Repeater", rad("A"), rad("B"), kolonner);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.felt).toBe("Rad 1 — Posisjon i tegning");
  });

  it("tom label uten standardNavn → «Rad 1 — Kolonne 1» (uendret backstop)", () => {
    const kolonner = [{ id: "c1", label: "" }];
    const diffs = ekspanderEndring("Repeater", rad("A"), rad("B"), kolonner);
    expect(diffs[0]!.felt).toBe("Rad 1 — Kolonne 1");
  });

  it("meningsfull egen label vinner over standardNavn", () => {
    const kolonner = [{ id: "c1", label: "Egen tittel", standardNavn: "Posisjon i tegning" }];
    const diffs = ekspanderEndring("Repeater", rad("A"), rad("B"), kolonner);
    expect(diffs[0]!.felt).toBe("Rad 1 — Egen tittel");
  });

  it("plassholder-label «_» uten standardNavn → «Kolonne N»; med → standardnavn", () => {
    expect(ekspanderEndring("R", rad("A"), rad("B"), [{ id: "c1", label: "_" }])[0]!.felt).toBe("Rad 1 — Kolonne 1");
    expect(
      ekspanderEndring("R", rad("A"), rad("B"), [{ id: "c1", label: "_", standardNavn: "Posisjon i tegning" }])[0]!.felt,
    ).toBe("Rad 1 — Posisjon i tegning");
  });
});
