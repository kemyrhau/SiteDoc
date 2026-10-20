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

/** RETUR `7f51e238` (orkestrator 2026-10-20): normalisert til lokal origo (min
 * x/y trukket fra, rundet til hele mm) fra registeret i
 * `relay/arbeidstegning-prove/gate1/fallplan.register-world.json`
 * (objekter.<Id>.geom, utenfor git). Ingen absolutte kundekoordinater her —
 * kun formen som beviser klassifiseringen. `AFF2_GEOM` er redusert til hvert
 * 10. segment (31 av 305) — samme klassifisering (ingen enkelt-strek > 30 %,
 * median langt under tykkelsen), bekreftet ved måling før reduksjon. De tre
 * andre er beholdt i full lengde (allerede korte, eller — for `BECB` —
 * nødvendige for selve edge-casen). Se describe-blokken «bølgelinje-detektor
 * mot EKTE geometri». */
const AFF2_GEOM: number[][] = [[3, 694, 0, 683], [549, 243, 547, 233], [234, 491, 223, 493], [780, 41, 769, 43], [562, 286, 544, 248], [261, 534, 243, 496], [808, 84, 790, 45], [529, 313, 495, 288], [164, 548, 168, 538], [711, 98, 715, 88], [407, 361, 398, 356], [149, 639, 144, 648], [695, 188, 691, 198], [407, 426, 418, 423], [125, 646, 134, 651], [671, 196, 680, 201], [365, 449, 367, 459], [64, 696, 30, 671], [611, 246, 577, 221], [337, 471, 340, 481], [67, 706, 62, 716], [613, 256, 609, 266], [316, 489, 325, 493], [52, 719, 62, 716], [598, 268, 609, 266], [303, 446, 301, 436], [27, 661, 31, 651], [574, 211, 578, 200], [325, 428, 316, 423], [42, 649, 31, 651], [589, 198, 578, 200]];

const D19E_GEOM: number[][] = [[179, 313, 1283, 1417], [378, 554, 1481, 1658], [576, 795, 1680, 1899], [775, 1036, 1878, 2140], [973, 1277, 1857, 2161], [1172, 1518, 1834, 2180], [1370, 1759, 1810, 2199], [1569, 2000, 1787, 2218], [95, 17, 290, 212], [72, 36, 489, 453], [48, 55, 687, 694], [25, 75, 886, 935], [2, 94, 1084, 1176], [0, 96, 1764, 2237], [1880, 2142, 115, 0], [1764, 2237, 1880, 2142], [115, 0, 0, 96]];

const D2BA_GEOM: number[][] = [[1979, 2497, 3083, 3601], [2177, 2738, 3208, 3769], [2376, 2979, 3185, 3788], [2575, 3220, 3162, 3808], [2773, 3461, 3139, 3827], [2972, 3702, 3115, 3846], [192, 329, 1296, 1433], [391, 570, 1495, 1674], [589, 811, 1693, 1915], [788, 1052, 1892, 2155], [986, 1293, 2090, 2396], [1185, 1534, 2289, 2637], [1383, 1775, 2487, 2878], [1582, 2015, 2686, 3119], [1780, 2256, 2884, 3360], [94, 18, 304, 228], [71, 38, 502, 469], [47, 57, 701, 710], [24, 76, 899, 951], [1, 95, 1098, 1192], [0, 96, 1860, 2353], [1860, 2353, 1956, 2469], [1956, 2469, 3100, 3858], [3216, 3763, 116, 0], [0, 96, 116, 0], [3216, 3763, 3100, 3858]];

/** `BECB` — en vegg-blokk som INNEHOLDER sin egen isolasjon-bølgelinje blandet
 * inn i SAMME geometri som veggomrisset (dumpet rå: de første ~100 segmentene
 * er tenner identisk formet som i `AFF2`, de siste ~7 er veggens egne lange
 * kant-strek). Edge case for bølgelinje-detektoren — se kommentaren ved
 * `BOLGELINJE_DOMINERENDE_STREK_TERSKEL` i egenskapsfelt.ts. Beholdt i full
 * lengde (normalisert) fordi hele den blandede strukturen ER edge-casen. */
const BECB_GEOM: number[][] = [[2174, 110, 2295, 230], [2151, 129, 2272, 250], [2127, 148, 2248, 269], [2104, 167, 2225, 288], [2081, 186, 2202, 307], [2058, 205, 2178, 326], [2034, 225, 2155, 345], [2011, 244, 2132, 365], [1988, 263, 2109, 384], [1965, 282, 2085, 403], [1941, 301, 2062, 422], [1918, 320, 2039, 441], [1895, 340, 2016, 460], [1872, 359, 1992, 479], [1848, 378, 1969, 499], [1825, 397, 1946, 518], [1802, 416, 1923, 537], [1779, 435, 1899, 556], [1755, 455, 1876, 575], [1732, 474, 1853, 594], [1709, 493, 1830, 614], [1686, 512, 1806, 633], [1662, 531, 1783, 652], [1639, 550, 1760, 671], [1616, 570, 1737, 690], [1592, 589, 1713, 709], [1569, 608, 1690, 729], [1546, 627, 1667, 748], [1523, 646, 1643, 767], [1499, 665, 1620, 786], [1476, 685, 1597, 805], [1453, 704, 1574, 824], [1430, 723, 1550, 844], [1406, 742, 1527, 863], [1383, 761, 1504, 882], [1360, 780, 1481, 901], [1337, 800, 1457, 920], [1313, 819, 1434, 939], [1290, 838, 1411, 959], [1267, 857, 1388, 978], [1244, 876, 1364, 997], [1220, 895, 1341, 1016], [1197, 915, 1318, 1035], [1174, 934, 1295, 1054], [1151, 953, 1271, 1074], [1127, 972, 1248, 1093], [1104, 991, 1225, 1112], [1081, 1010, 1201, 1131], [1057, 1030, 1178, 1150], [1034, 1049, 1155, 1169], [1011, 1068, 1132, 1189], [988, 1087, 1108, 1208], [964, 1106, 1085, 1227], [941, 1125, 1062, 1246], [918, 1145, 1039, 1265], [895, 1164, 1015, 1284], [871, 1183, 992, 1304], [848, 1202, 969, 1323], [825, 1221, 946, 1342], [802, 1240, 922, 1361], [778, 1259, 899, 1380], [755, 1279, 876, 1399], [732, 1298, 853, 1419], [709, 1317, 829, 1438], [685, 1336, 806, 1457], [662, 1355, 783, 1476], [639, 1374, 760, 1495], [616, 1394, 736, 1514], [592, 1413, 713, 1534], [569, 1432, 690, 1553], [546, 1451, 666, 1572], [522, 1470, 643, 1591], [499, 1489, 620, 1610], [476, 1509, 597, 1629], [453, 1528, 573, 1649], [429, 1547, 550, 1668], [406, 1566, 527, 1687], [383, 1585, 504, 1706], [360, 1604, 480, 1725], [336, 1624, 457, 1744], [313, 1643, 434, 1764], [290, 1662, 411, 1783], [267, 1681, 387, 1802], [243, 1700, 364, 1821], [220, 1719, 341, 1840], [197, 1739, 318, 1859], [174, 1758, 294, 1879], [150, 1777, 271, 1898], [127, 1796, 248, 1917], [104, 1815, 225, 1936], [81, 1834, 201, 1955], [57, 1854, 178, 1974], [34, 1873, 155, 1994], [11, 1892, 131, 2013], [2290, 14, 2411, 135], [2267, 33, 2388, 154], [2244, 52, 2365, 173], [2221, 71, 2341, 192], [2197, 90, 2318, 211], [48, 1971, 108, 2032], [2307, 0, 2176, 108], [2176, 108, 0, 1901], [92, 2045, 2415, 131], [0, 1901, 54, 1967], [54, 1967, 38, 1979], [38, 1979, 92, 2045], [2415, 131, 2307, 0]];

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

  it("SVAR orkestrator 2026-10-19: tykkelse under 10 mm (enkel linje uten bredde) gir vanlig lengde-Mål, ikke calipers", () => {
    // Samme lang/smal-form som vegg-testen over (forhold 4000/8 = 500, godt over
    // bølgelinje-terskelen), men tykkelsen (8 mm) er under TYKKELSE_MIN_MM — en
    // strek uten reell bredde skal aldri vise en nær-null «tykkelse».
    const o = objekt({
      id: "tynnlinje",
      dtype: "LINE",
      geom: [
        [0, 0, 0, 8],
        [4000, 0, 4000, 8],
        [0, 0, 4000, 0],
        [0, 8, 4000, 8],
      ],
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")).toEqual({ nokkel: "mal", verdi: "4,00 m" });
  });

  it("RETUR tillegg 2026-10-19: bølgelinje-isolasjon på ordinært vegglag (ikke HATCH, intet materiale-felt) — formen avgjør, ikke dtype", () => {
    // Sikksakk-mønster (bildet 67abf924): en PLINE som vandrer fram og tilbake
    // på tvers av en 100 mm smal bane over 4000 mm lengde — samme konveks-hull-
    // bredde som et rett bånd ville gitt, selv om selve linjen krysser fram og
    // tilbake underveis. RETUR 42219afc: bølgelinje-detektoren kjenner denne
    // formen igjen (intet enkelt-strek dominerer lengden) → «Isolasjon».
    const sikksakk: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i * 4000) / 40;
      const y = i % 2 === 0 ? 0 : 100;
      sikksakk.push(x, y);
    }
    const o = objekt({ id: "bolge1", dtype: "LWPOLYLINE", geom: [sikksakk] });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 100 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
    expect(mal?.tolket).toBe(true);
    // Materiale-feltet er fortsatt fraværende — formgjenkjenningen krever IKKE
    // en kjent HATCH/materiale-klassifisering.
    expect(felt.find((f) => f.nokkel === "materiale")).toBeUndefined();
  });

  it("POST snevre inn formregelen 2026-10-19 (a): HATCH 1,5×15 m uten isolasjonsmateriale gir areal, ikke tykkelse", () => {
    // Forhold 15000/1500 = 10, over BOLGELINJE_FORHOLD_TERSKEL — ville trigget
    // formgjenkjenningen hvis den ikke hoppet over ekte flater (korridor/sal).
    const o = objekt({
      id: "flate-lang",
      dtype: "HATCH",
      geom: [[0, 0, 15000, 0, 15000, 1500, 0, 1500]],
    });
    const felt = bygg(o, 1);
    expect(felt.find((f) => f.nokkel === "mal")?.verdi).toBe("22,50 m²");
  });

  it("POST snevre inn formregelen 2026-10-19 (b): rom (ROOM_NAME), langt og smalt, gir ikke tykkelse", () => {
    // Samme lang/smal-geometri som bølgelinje-testen (forhold 4000/8=500), men
    // merket med ROOM_NAME — en korridor har ingen tykkelse (spec § 9 K2).
    const o = objekt({
      id: "rom-korridor",
      dtype: "LWPOLYLINE",
      attr: { ROOM_NAME: "Korridor" },
      geom: [
        [0, 0, 0, 8],
        [4000, 0, 4000, 8],
        [0, 0, 4000, 0],
        [0, 8, 4000, 8],
      ],
    });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("4,00 m");
    expect(mal?.tolket).toBeUndefined();
  });

  it("POST snevre inn formregelen 2026-10-19 (c): bølgelinje-isolasjon på ordinært vegglag fortsatt tykkelse + lengde", () => {
    // Negativkontroll for (a)/(b): den eksisterende bølgelinje-formen (ikke
    // HATCH, ikke rom) skal fortsatt gå gjennom formgjenkjenningen uendret
    // (RETUR 42219afc: etiketten er nå «Isolasjon», se egen test-serie under).
    const sikksakk: number[] = [];
    for (let i = 0; i <= 40; i++) {
      const x = (i * 4000) / 40;
      const y = i % 2 === 0 ? 0 : 100;
      sikksakk.push(x, y);
    }
    const o = objekt({ id: "bolge-kontroll", dtype: "LWPOLYLINE", geom: [sikksakk] });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 100 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
    expect(mal?.tolket).toBe(true);
  });

  it("POST snevre inn formregelen 2026-10-19 (d): isolasjon-HATCH fortsatt tykkelse (isolasjonsgrenen uendret)", () => {
    // Isolasjonsgrenen sjekkes FØR formgjenkjenningen og returnerer tidlig —
    // skal ikke påvirkes av den nye FLATE_DTYPE-sperren.
    const o = objekt({
      id: "isol-hatch",
      dtype: "HATCH",
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
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 13 mm");
    expect(mal?.underverdi).toBe("tegningsvelger.egenskaper.lengde 4,00 m");
  });

  it("Kenneth-vedtak 2026-10-20: kjent isolasjonsmateriale viser «Isolasjon», ikke «Tykkelse»", () => {
    // Bakgrunn: Kenneth leste «Tykkelse 71 mm» under en innervegg som veggens
    // tykkelse, mens tallet var isolasjonens bredde. Kjent materiale (HATCH-
    // mønster/lagnavn klassifisert av render.py, se ER_ISOLASJON_MATERIALE)
    // skal derfor hete «Isolasjon» i hovedverdien.
    const o = objekt({
      id: "isol-etikett",
      dtype: "HATCH",
      materiale: "Isolasjon",
      geom: [
        [0, 0, 0, 71],
        [4000, 0, 4000, 71],
        [0, 0, 4000, 0],
        [0, 71, 4000, 71],
      ],
    });
    const felt = bygg(o, 1);
    const mal = felt.find((f) => f.nokkel === "mal");
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 71 mm");
    expect(mal?.tolket).toBeUndefined();
  });

  it("RETUR 42219afc: formgjenkjenning av en rett vegg-dobbeltlinje (ikke bølgelinje) beholder «Tykkelse»", () => {
    // Samme vegg-dobbeltlinje som «vegg1»-testen: INGEN materiale-felt (ikke
    // HATCH). Bølgelinje-detektoren skiller denne fra en isolasjon-bølgelinje
    // via det dominerende enkelt-streket (de to 4000 mm-lange "railene" utgjør
    // 100 % av lengden — langt over BOLGELINJE_DOMINERENDE_STREK_TERSKEL).
    const o = objekt({
      id: "vegg-ikke-isolasjon",
      dtype: "LINE",
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
  });

  describe("RETUR 42219afc/7f51e238: bølgelinje-detektor mot EKTE geometri (normalisert, se kommentar ved _GEOM-konstantene)", () => {
    // Geometrien under er normalisert fra objektregisteret (samme fil
    // orkestrator målte på, se SJEKKPUNKT) — ikke syntetisk. mmPr=1 fordi
    // $INSUNITS=mm for denne fila (samme konvensjon som resten av filens tester
    // mot ekte DXF-tall, jf. RETUR isolasjon `7d5d6787`).

    it("Id AFF2 (Kenneths bilde `2-isolasjon-71mm.jpg`, 242-laget, anonym INSERT, INGEN materiale-felt) → «Isolasjon»", () => {
      const o = objekt({
        id: "AFF2",
        lag: "242- Ikke-bærende innervegger(Nye konstruksjoner)",
        dtype: "INSERT",
        blokk: "*X0",
        geom: AFF2_GEOM,
      });
      const felt = bygg(o, 1);
      const mal = felt.find((f) => f.nokkel === "mal");
      expect(mal?.verdi.startsWith("tegningsvelger.egenskaper.isolasjon ")).toBe(true);
      expect(mal?.tolket).toBe(true);
    });

    it("Id D19E (ordinær vegg, I-WALL-OTLN) → «Tykkelse», ikke «Isolasjon»", () => {
      const o = objekt({
        id: "D19E",
        lag: "I-WALL-____-OTLN.IFC-standardImport",
        dtype: "INSERT",
        blokk: "Vegg",
        geom: D19E_GEOM,
      });
      const felt = bygg(o, 1);
      const mal = felt.find((f) => f.nokkel === "mal");
      expect(mal?.verdi.startsWith("tegningsvelger.egenskaper.tykkelse ")).toBe(true);
    });

    it("Id D2BA (ordinær vegg, I-WALL-OTLN) → «Tykkelse», ikke «Isolasjon»", () => {
      const o = objekt({
        id: "D2BA",
        lag: "I-WALL-____-OTLN.IFC-standardImport",
        dtype: "INSERT",
        blokk: "Vegg",
        geom: D2BA_GEOM,
      });
      const felt = bygg(o, 1);
      const mal = felt.find((f) => f.nokkel === "mal");
      expect(mal?.verdi.startsWith("tegningsvelger.egenskaper.tykkelse ")).toBe(true);
    });

    it("Id BECB (vegg-blokk MED egen isolasjon-bølgelinje blandet inn i omrisset) → fortsatt «Tykkelse»", () => {
      // Edge case: blokken har hundrevis av isolasjon-tenner OG veggens egne
      // lange kant-strek i SAMME geometri. Det lange kant-strekket (~94 % av
      // lengden) dominerer fortsatt — korrekt "Tykkelse", ikke "Isolasjon".
      // Målt tykkelse (171 mm) dekker HELE den blandede geometrien, ikke bare
      // isolasjonstennene, så "Isolasjon" hadde vært en feil etikett her uansett.
      const o = objekt({
        id: "BECB",
        lag: "I-WALL-____-OTLN.IFC-standardImport",
        dtype: "INSERT",
        blokk: "Vegg",
        geom: BECB_GEOM,
      });
      const felt = bygg(o, 1);
      const mal = felt.find((f) => f.nokkel === "mal");
      expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 171 mm");
    });

    it("RETUR 7f51e238: syntetisk 10 m vegg × 150 mm med fem åpninger (6 biter pr. side) → fortsatt «Tykkelse», ikke «Isolasjon»", () => {
      // Hver vegg-bit er 1000 mm, åpningene (dør/vindu) 800 mm: 6×1000 + 5×800 = 10000 mm.
      // Ingen enkelt-strek overstiger 30 % av lengden (1000/10000 = 10 %), så den gamle
      // regelen («ingen dominerende enkeltstrek») ville feilaktig gitt «Isolasjon» her.
      // Medianstreket (1000 mm) er langt over 2 × tykkelsen (2 × 150 = 300 mm), som
      // skiller en vegg-bit fra en isolasjonstann (på størrelse med bredden).
      const bitGrenser: number[] = [];
      let x = 0;
      for (let i = 0; i < 6; i++) {
        bitGrenser.push(x, x + 1000);
        x += 1000 + 800;
      }
      const geom: number[][] = [];
      for (let i = 0; i < bitGrenser.length; i += 2) {
        const [x1, x2] = [bitGrenser[i]!, bitGrenser[i + 1]!];
        geom.push([x1, 0, x2, 0]); // yttervegg
        geom.push([x1, 150, x2, 150]); // innervegg
      }
      const o = objekt({ id: "vegg-med-aapninger", dtype: "LINE", geom });
      const felt = bygg(o, 1);
      const mal = felt.find((f) => f.nokkel === "mal");
      expect(mal?.verdi).toBe("tegningsvelger.egenskaper.tykkelse 150 mm");
    });
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
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 13 mm");
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
    expect(mal?.verdi).toBe("tegningsvelger.egenskaper.isolasjon 100 mm");
  });
});
