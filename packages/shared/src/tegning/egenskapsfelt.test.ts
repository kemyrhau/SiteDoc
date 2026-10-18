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

/** i18n-fri test-identitet (pakken er i18n-fri — ekte oversettelse testes i panelet). */
const T = (nokkel: string): string => nokkel;

/** Tynn wrapper: holder de 18 eksisterende kalls-stedene uendret selv om den ekte
 * funksjonen nå krever en `t`-callback (kun isolasjon-grenen bruker den). */
function bygg(o: RegisterVerdenObjekt, mmPr?: number | null): ReturnType<typeof byggEgenskapsfelt> {
  return byggEgenskapsfelt(o, mmPr ?? null, T);
}

describe("byggEgenskapsfelt", () => {
  it("A1: vegg med kategori gir felt 'hva' med rå lagnavn under", () => {
    const o = objekt({ id: "h1", lag: "242- Ikke-bærende innervegger", kategori: "Ikke-bærende innervegger · 242" });
    const felt = bygg(o);
    expect(felt[0]).toEqual({ nokkel: "hva", verdi: "Ikke-bærende innervegger · 242", underverdi: "242- Ikke-bærende innervegger" });
  });

  it("A2: romstempel gir felt 'rom' fra ROOM_NAME + ROOM_NUMBER", () => {
    const o = objekt({ id: "h2", attr: { ROOM_NAME: "LAB. 12", ROOM_NUMBER: "6V-18.03" } });
    const felt = bygg(o);
    expect(felt.find((f) => f.nokkel === "rom")?.verdi).toBe("LAB. 12 · 6V-18.03");
  });

  it("A3: kjent materiale vises direkte, ukjent materiale vises tolket", () => {
    const kjent = bygg(objekt({ id: "h3", materiale: "Betong" }));
    expect(kjent.find((f) => f.nokkel === "materiale")).toEqual({ nokkel: "materiale", verdi: "Betong" });

    const ukjent = bygg(objekt({ id: "h4", materialeRaa: "Skrålinjer_1" }));
    expect(ukjent.find((f) => f.nokkel === "materiale")).toEqual({
      nokkel: "materiale",
      verdi: "Skrålinjer_1",
      tolket: true,
    });
  });

  it("A9: blokknavn + type-id gir felt 'typeStorrelse'", () => {
    const o = objekt({ id: "h5", blokk: "Focus-ID Hel", typeId: "10×21 M" });
    const felt = bygg(o);
    expect(felt.find((f) => f.nokkel === "typeStorrelse")?.verdi).toBe("Focus-ID Hel · 10×21 M");
  });

  it("A12: nærmeste merking er alltid tolket, aldri objektets egen verdi", () => {
    const o = objekt({ id: "h6", naermesteMerking: "15.TR" });
    const felt = bygg(o);
    expect(felt.find((f) => f.nokkel === "naermesteMerking")).toEqual({
      nokkel: "naermesteMerking",
      verdi: "15.TR",
      tolket: true,
    });
  });

  it("A12 negativkontroll: ingen naermesteMerking gir ikke feltet", () => {
    const felt = bygg(objekt({ id: "h7" }));
    expect(felt.find((f) => f.nokkel === "naermesteMerking")).toBeUndefined();
  });

  it("A10: status 'rives' vises", () => {
    const felt = bygg(objekt({ id: "h8", status: "rives" }));
    expect(felt.find((f) => f.nokkel === "status")?.verdi).toBe("rives");
  });

  it("felt 6 (mål) krever kjent skala — lengde fra geom (strek)", () => {
    const o = objekt({ id: "h9", dtype: "LINE", geom: [[0, 0, 1000, 0]] }); // 1000 enheter
    const utenSkala = bygg(o, null);
    expect(utenSkala.find((f) => f.nokkel === "mal")).toBeUndefined();

    const medSkala = bygg(o, 1); // 1 mm pr. enhet -> 1000 mm = 1 m
    expect(medSkala.find((f) => f.nokkel === "mal")?.verdi).toBe("1 m");
  });

  it("felt 6 (mål): areal for flate (HATCH), ikke lengde", () => {
    // Kvadrat 1000x1000 enheter.
    const o = objekt({ id: "h10", dtype: "HATCH", geom: [[0, 0, 1000, 0, 1000, 1000, 0, 1000]] });
    const felt = bygg(o, 1); // 1 mm pr. enhet -> 1 m x 1 m = 1 m²
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("1,00 m²");
  });

  it("id-felt foretrekker Revit element-id over DXF-handle", () => {
    expect(bygg(objekt({ id: "ABCD", elid: "727699" })).find((f) => f.nokkel === "id")?.verdi).toBe(
      "727699",
    );
    expect(bygg(objekt({ id: "ABCD" })).find((f) => f.nokkel === "id")?.verdi).toBe("ABCD");
  });

  it("felt uten verdi utelates helt (ikke tomme strenger/streker)", () => {
    const felt = bygg(objekt({ id: "h11", kategori: "" }));
    expect(nokler(felt)).not.toContain("hva");
    expect(nokler(felt)).not.toContain("rom");
    expect(nokler(felt)).not.toContain("materiale");
  });

  it("RETUR F1+F2 web r2: 'hva' normaliserer rått understrek-skilletegn (ArchiCAD-lagnavn)", () => {
    const o = objekt({ id: "h13", kategori: "Vinduer_ dører_ foldevegger · 244" });
    const felt = bygg(o);
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
    const felt = bygg(o, 1); // 1 mm pr. enhet
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("1,6 m");
  });

  it("RETUR F1+F2 web r2: dør uten geometri gir ikke et misvisende 'Mål'", () => {
    const o = objekt({ id: "h14", dtype: "INSERT", blokk: "Door (Wall) 1159[1]" });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toBeUndefined();
  });

  it("A13: ATTRIB-blokk uten rom gir felt 'tekst' fra øvrige attributter", () => {
    const o = objekt({ id: "h12", blokk: "_E-0234B", attr: { TXT1: "LITT J76.2", TXT2: "R/TV" } });
    const felt = bygg(o);
    expect(felt.find((f) => f.nokkel === "tekst")?.verdi).toBe("LITT J76.2 · R/TV");
  });

  it("POST flytte målepunkter pkt 4a: vegg-lengde er LENGSTE AKSE over ALLE segmenter, ikke geom[0] alene", () => {
    // To korte tverr-tagger (13 enheter, symmetriske om midten) + to lange
    // langsgående "rails" (4000 enheter) — akkurat formen en dobbeltlinje-vegg
    // eksporteres som. Før fiksen ga geom[0] (tverr-taggen) "Mål 13 mm" — bug-
    // rapportens eksakte tall. Symmetrisk oppsett gir et EKSAKT PCA-svar (ingen
    // flyttall-toleranse nødvendig i testen).
    const o = objekt({
      id: "vegg1",
      dtype: "LINE",
      geom: [
        [0, 0, 0, 13],
        [4000, 0, 4000, 13],
        [0, 0, 4000, 0],
        [0, 13, 4000, 13],
      ],
    });
    const felt = bygg(o, 1); // 1 mm pr. enhet
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("4 m");
  });

  it("POST flytte målepunkter pkt 4b: anonymt AutoCAD-blokknavn ('*X976') skjules i typeStorrelse", () => {
    const anonym = bygg(objekt({ id: "h15", blokk: "*X976" }));
    expect(anonym.find((f) => f.nokkel === "typeStorrelse")).toBeUndefined();

    // typeId uten (eller med) blokk vises fortsatt.
    const medTypeId = bygg(objekt({ id: "h16", blokk: "*X976", typeId: "10×21 M" }));
    expect(medTypeId.find((f) => f.nokkel === "typeStorrelse")?.verdi).toBe("10×21 M");

    const vanlig = bygg(objekt({ id: "h17", blokk: "Focus-ID Hel" }));
    expect(vanlig.find((f) => f.nokkel === "typeStorrelse")?.verdi).toBe("Focus-ID Hel");
  });

  it("POST flytte målepunkter pkt 4d: isolasjon viser TYKKELSEN i 'mal', lengden som underverdi", () => {
    // Samme geometri som vegg-testen over (tykkelse 13 mm, lengde 4 m) — men nå
    // merket som isolasjon av render.py (`materiale === \"Isolasjon\"`).
    const o = objekt({
      id: "isol1",
      dtype: "LINE",
      materiale: "Isolasjon",
      geom: [
        [0, 0, 0, 13],
        [4000, 0, 4000, 13],
        [0, 0, 4000, 0],
        [0, 13, 4000, 13],
      ],
    });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 13 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4 m");
    // Materiale-feltet er uendret (vises fortsatt som vanlig).
    expect(felt.find((f) => f.nokkel === "materiale")?.verdi).toBe("Isolasjon");
  });

  it("RETUR isolasjon `7d5d6787` pkt 1: tykkelse er vinkelrett avstand mellom lange kanter, robust mot skrå endeavslutning", () => {
    // Parallellogram-formet isolasjonsbånd: de to lange kantene (y=0 og y=100) er
    // nøyaktig 100 mm fra hverandre, men den ENE enden er skåret skrått (x=-80 ved
    // y=100 i stedet for x=0) — akkurat slik et isolasjonsbånd kuttes skrått der
    // det møter en annen bygningsdel. PCA korteste-akse (beregnAkslerMm, se testen
    // over) ville gitt ~103,7 mm her (tilsvarer det målte avviket 104 vs. 100 mm i
    // RETUR-posten), fordi det skrå snittet blåser opp variansen i tverretningen.
    const o = objekt({
      id: "isol2",
      dtype: "HATCH",
      materiale: "Isolasjon",
      geom: [[0, 0, 1000, 0, 1000, 100, -80, 100]],
    });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 100 mm");
  });
});
