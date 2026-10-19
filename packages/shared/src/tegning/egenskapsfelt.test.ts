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
    expect(medSkala.find((f) => f.nokkel === "mal")?.verdi).toBe("1,00 m");
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

  it("RETUR tillegg 2026-10-19: dør-INSERT med kun rette segmenter (ingen bue, ingen attributt/merking) gir IKKE Mål — 'lengste segment' er fjernet (spec § 9.3 sier aldri)", () => {
    const o = objekt({
      id: "8D2D",
      dtype: "INSERT",
      blokk: "Simple Door Opening[557]",
      geom: [
        [0, 0, 0, 12],
        [0, 0, 1600, 0],
      ],
    });
    const felt = bygg(o, 1); // 1 mm pr. enhet
    expect(felt.find((f) => f.nokkel === "mal")).toBeUndefined();
  });

  it("RETUR tillegg 2026-10-19 pkt 1: dør-bredde PRIORITET 1 — WIDTH-attributt vinner over merking OG bue", () => {
    const o = objekt({
      id: "dor-attr",
      dtype: "INSERT",
      blokk: "Dør[1]",
      attr: { WIDTH: "900" },
      merkingBreddeMm: 1090,
      merkingHoydeMm: 2090,
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toEqual({ nokkel: "mal", verdi: "900 mm" });
  });

  it("RETUR tillegg 2026-10-19 pkt 2: dør-bredde PRIORITET 2 — blokkens egen nestede dørmerking (Kenneths telefontest: «1 090x2 090»)", () => {
    const o = objekt({
      id: "AA09",
      dtype: "INSERT",
      blokk: "Dør[563]",
      merkingBreddeMm: 1090,
      merkingHoydeMm: 2090,
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toEqual({
      nokkel: "mal",
      verdi: "tegningsvelger.egenskaper.bredde 1,09 m · tegningsvelger.egenskaper.hoyde 2,09 m (tegningsvelger.egenskaper.fraMerking)",
      tolket: true,
    });
  });

  it("RETUR tillegg 2026-10-19 pkt 3: dør-bredde PRIORITET 3 — slagbuens (ARC) radius når verken attributt eller merking finnes", () => {
    const radius = 900;
    const flat: number[] = [];
    for (let i = 0; i <= 8; i++) {
      const vinkel = (i * Math.PI) / 2 / 8; // kvart sirkel, 9 punkter
      flat.push(Math.round(radius * Math.cos(vinkel)), Math.round(radius * Math.sin(vinkel)));
    }
    const o = objekt({ id: "dor-bue", dtype: "INSERT", blokk: "Dør[999]", geom: [flat] });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    // Punktene er heltallsavrundet (samme konvensjon som render.py sitt register),
    // så tilpasningen er ikke pikselnøyaktig — innenfor noen få mm av 900 holder.
    expect(mal?.verdi).toMatch(/^(89[5-9]|90[0-5]) mm$/);
    expect(mal?.tolket).toBe(true);
  });

  it("RETUR tillegg 2026-10-19 pkt 3: dobbeldør — to separate buer summeres", () => {
    const bue = (radius: number): number[] => {
      const flat: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const vinkel = (i * Math.PI) / 2 / 8;
        flat.push(Math.round(radius * Math.cos(vinkel)), Math.round(radius * Math.sin(vinkel)));
      }
      return flat;
    };
    const o = objekt({
      id: "dobbeldor",
      dtype: "INSERT",
      blokk: "Dobbel dør[1]",
      geom: [bue(900), bue(800).map((v, i) => v + (i % 2 === 0 ? 2000 : 0))],
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("1,70 m");
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
    // eksporteres som. Forholdet 4000/13 = 307 > bølgelinje-terskelen (8), så
    // RETUR tillegg 2026-10-19 sin formgjenkjenning slår inn og viser
    // Tykkelse+Lengde (tolket) i stedet for bare lengden — samme PCA-tall som
    // før (4 m), men nå med tykkelsen (13 mm) synlig ved siden av.
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
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 13 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
    expect(mal?.tolket).toBe(true);
  });

  it("RETUR tillegg 2026-10-19: kort/bred geometri (forhold ≤ 8) beholder vanlig lengde-Mål, ikke calipers", () => {
    // Samme dobbeltlinje-form som over, men kort nok (60/13 ≈ 4,6) til at
    // formen IKKE regnes som «langt og smalt» — vanlige kvadratiske/firkantede
    // objekter skal ikke plutselig få en tykkelse-visning.
    const o = objekt({
      id: "kortvegg",
      dtype: "LINE",
      geom: [
        [0, 0, 0, 13],
        [60, 0, 60, 13],
        [0, 0, 60, 0],
        [0, 13, 60, 13],
      ],
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toEqual({ nokkel: "mal", verdi: "60 mm" });
  });

  it("RETUR tillegg 2026-10-19: bølgelinje-isolasjon på ordinært vegglag (ikke HATCH, intet materiale-felt) — formen avgjør, ikke dtype", () => {
    // Sikksakk-mønster (bildet 67abf924): en PLINE som vandrer fram og tilbake
    // på tvers av en 100 mm smal bane over 4000 mm lengde — samme konveks-hull-
    // bredde som et rett bånd ville gitt, selv om selve linjen krysser fram og
    // tilbake underveis.
    const sikksakk: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i * 4000) / 40;
      const y = i % 2 === 0 ? 0 : 100;
      sikksakk.push(x, y);
    }
    const o = objekt({ id: "bolge1", dtype: "LWPOLYLINE", geom: [sikksakk] });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 100 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
    expect(mal?.tolket).toBe(true);
    // Materiale-feltet er fortsatt fraværende — formgjenkjenningen krever IKKE
    // en kjent HATCH/materiale-klassifisering.
    expect(felt.find((f) => f.nokkel === "materiale")).toBeUndefined();
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
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
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
