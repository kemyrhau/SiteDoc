import { describe, expect, it } from "vitest";
import { byggEgenskapsfelt } from "./egenskapsfelt";
import type { RegisterVerdenObjekt } from "./objektmodell";

function objekt(partial: Partial<RegisterVerdenObjekt> & { id: string }): RegisterVerdenObjekt {
  return {
    lag: "TEST",
    dtype: "LINE",
    kategori: "Test",
    lagLinjetype: "",
    ...partial,
  };
}

function nokler(felt: ReturnType<typeof byggEgenskapsfelt>): string[] {
  return felt.map((f) => f.nokkel);
}

describe("byggEgenskapsfelt", () => {
  it("A1: vegg med kategori gir felt 'hva' med rå lagnavn under", () => {
    const o = objekt({ id: "h1", lag: "242- Ikke-bærende innervegger", kategori: "Ikke-bærende innervegger · 242" });
    const felt = byggEgenskapsfelt(o);
    expect(felt[0]).toEqual({ nokkel: "hva", verdi: "Ikke-bærende innervegger · 242", underverdi: "242- Ikke-bærende innervegger" });
  });

  it("A2: romstempel gir felt 'rom' fra ROOM_NAME + ROOM_NUMBER", () => {
    const o = objekt({ id: "h2", attr: { ROOM_NAME: "LAB. 12", ROOM_NUMBER: "6V-18.03" } });
    const felt = byggEgenskapsfelt(o);
    expect(felt.find((f) => f.nokkel === "rom")?.verdi).toBe("LAB. 12 · 6V-18.03");
  });

  it("A3: kjent materiale vises direkte, ukjent materiale vises tolket", () => {
    const kjent = byggEgenskapsfelt(objekt({ id: "h3", materiale: "Betong" }));
    expect(kjent.find((f) => f.nokkel === "materiale")).toEqual({ nokkel: "materiale", verdi: "Betong" });

    const ukjent = byggEgenskapsfelt(objekt({ id: "h4", materialeRaa: "Skrålinjer_1" }));
    expect(ukjent.find((f) => f.nokkel === "materiale")).toEqual({
      nokkel: "materiale",
      verdi: "Skrålinjer_1",
      tolket: true,
    });
  });

  it("A9: blokknavn + type-id gir felt 'typeStorrelse'", () => {
    const o = objekt({ id: "h5", blokk: "Focus-ID Hel", typeId: "10×21 M" });
    const felt = byggEgenskapsfelt(o);
    expect(felt.find((f) => f.nokkel === "typeStorrelse")?.verdi).toBe("Focus-ID Hel · 10×21 M");
  });

  it("A12: nærmeste merking er alltid tolket, aldri objektets egen verdi", () => {
    const o = objekt({ id: "h6", naermesteMerking: "15.TR" });
    const felt = byggEgenskapsfelt(o);
    expect(felt.find((f) => f.nokkel === "naermesteMerking")).toEqual({
      nokkel: "naermesteMerking",
      verdi: "15.TR",
      tolket: true,
    });
  });

  it("A12 negativkontroll: ingen naermesteMerking gir ikke feltet", () => {
    const felt = byggEgenskapsfelt(objekt({ id: "h7" }));
    expect(felt.find((f) => f.nokkel === "naermesteMerking")).toBeUndefined();
  });

  it("A10: status 'rives' vises", () => {
    const felt = byggEgenskapsfelt(objekt({ id: "h8", status: "rives" }));
    expect(felt.find((f) => f.nokkel === "status")?.verdi).toBe("rives");
  });

  it("felt 6 (mål) krever kjent skala — lengde fra geom (strek)", () => {
    const o = objekt({ id: "h9", dtype: "LINE", geom: [[0, 0, 1000, 0]] }); // 1000 enheter
    const utenSkala = byggEgenskapsfelt(o, null);
    expect(utenSkala.find((f) => f.nokkel === "mal")).toBeUndefined();

    const medSkala = byggEgenskapsfelt(o, 1); // 1 mm pr. enhet -> 1000 mm = 1 m
    expect(medSkala.find((f) => f.nokkel === "mal")?.verdi).toBe("1 m");
  });

  it("felt 6 (mål): areal for flate (HATCH), ikke lengde", () => {
    // Kvadrat 1000x1000 enheter.
    const o = objekt({ id: "h10", dtype: "HATCH", geom: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]] });
    const felt = byggEgenskapsfelt(o, 1); // 1 mm pr. enhet -> 1 m x 1 m = 1 m²
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("1,00 m²");
  });

  it("id-felt foretrekker Revit element-id over DXF-handle", () => {
    expect(byggEgenskapsfelt(objekt({ id: "ABCD", elid: "727699" })).find((f) => f.nokkel === "id")?.verdi).toBe(
      "727699",
    );
    expect(byggEgenskapsfelt(objekt({ id: "ABCD" })).find((f) => f.nokkel === "id")?.verdi).toBe("ABCD");
  });

  it("felt uten verdi utelates helt (ikke tomme strenger/streker)", () => {
    const felt = byggEgenskapsfelt(objekt({ id: "h11", kategori: "" }));
    expect(nokler(felt)).not.toContain("hva");
    expect(nokler(felt)).not.toContain("rom");
    expect(nokler(felt)).not.toContain("materiale");
  });

  it("RETUR F1+F2 web r2: 'hva' normaliserer rått understrek-skilletegn (ArchiCAD-lagnavn)", () => {
    const o = objekt({ id: "h13", kategori: "Vinduer_ dører_ foldevegger · 244" });
    const felt = byggEgenskapsfelt(o);
    expect(felt.find((f) => f.nokkel === "hva")?.verdi).toBe("Vinduer, dører, foldevegger · 244");
  });

  it("RETUR F1+F2 web r2: dør-INSERT måler bredden fra blokkens LENGSTE segment, ikke det første", () => {
    const o = objekt({
      id: "8D2D",
      dtype: "INSERT",
      blokk: "Simple Door Opening[557]",
      // Kort jamb-tagg (12 enheter) FØRST, deretter den ekte åpningsbredden (1600 enheter).
      geom: [
        [0, 0, 0, 12],
        [0, 0, 1600, 0],
      ],
    });
    const felt = byggEgenskapsfelt(o, 1); // 1 mm pr. enhet
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("1,6 m");
  });

  it("RETUR F1+F2 web r2: dør uten geometri gir ikke et misvisende 'Mål'", () => {
    const o = objekt({ id: "h14", dtype: "INSERT", blokk: "Door (Wall) 1159[1]" });
    const felt = byggEgenskapsfelt(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toBeUndefined();
  });

  it("A13: ATTRIB-blokk uten rom gir felt 'tekst' fra øvrige attributter", () => {
    const o = objekt({ id: "h12", blokk: "_E-0234B", attr: { TXT1: "LITT J76.2", TXT2: "R/TV" } });
    const felt = byggEgenskapsfelt(o);
    expect(felt.find((f) => f.nokkel === "tekst")?.verdi).toBe("LITT J76.2 · R/TV");
  });
});
