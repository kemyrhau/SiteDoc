import { describe, it, expect } from "vitest";
import {
  utledMmPrPiksel,
  parseMalestokk,
  finnMalestokkFraTekst,
  loesGrepMalestokk,
  malMm,
  malPolylinjeMm,
  malArealMm2,
  kanMale,
  kalibrerMalestokk,
  laasVinkel,
  aksehjelpelinje,
  snapTilPunkt,
  snapTil90Linje,
  beregnSnap,
  type Punkt,
} from "./maaling";

/**
 * Akseptansetesten LIGGER I TEGNINGEN SELV.
 *
 * Fasit måles på den ekte produksjonstegningen 40ae60ab (UNN Familierom,
 * A3, målestokk 1:50). Ingen syntetisk fixture — alle tall under er avlest
 * på selve tegningen 2026-09-24:
 *   - pdfinfo:  Page size 1190.55 × 841.89 pts (A3) → bredde 420,0 mm
 *   - pdftoppm -r 200 → sharp: 3308 × 2339 px
 *   - tittelfelt (pdftotext): «Mål:» … «1:50»
 *   - påførte mål i mm: 2 870 · 2 425 · 2 110 · 1 010
 *   - «2 870»-linja: røde endetikk detektert på px x=1117 og x=1569,
 *     rad y=811. Midtpunktet (1117+1569)/2 = 1343 = eksakt senter av
 *     etikett-teksten «2 870» (bbox), som bekrefter at det er riktig linje.
 */
const PAPIRBREDDE_MM = 420.0;
const IMG_W = 3308;
const IMG_H = 2339;

// Ekte pdftotext-utdrag fra tittelfeltet + brannklasse-blokken, i
// dokumentrekkefølge (brannkodene står FØR tittelfeltet på tegningen).
const TITTELFELT_TEKST = [
  "12x21",
  "EI30",
  "Rw ≥ 43dB",
  "",
  "IV11_EI60/ 37dB",
  "",
  "Innervegger",
  "350",
  "IV12_EI60/ 48dB",
  "Innhold:",
  "Plan isolat 5. etasje",
  "Mål:",
  "FLØY",
  "",
  "1:50",
  "ETG.",
  "Format:",
].join("\n");

describe("måling i tegning — mm pr. piksel er utledet, ikke hardkodet", () => {
  it("utleder mm/piksel av papirbredde ÷ pikselbredde (= 25,4/200 ved 200 DPI)", () => {
    const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);
    expect(mmPrPx).toBeCloseTo(25.4 / 200, 4); // 0,127
  });

  it("er DPI-uavhengig: 300 DPI gir samme virkelige mål som 200 DPI", () => {
    // Samme tegning rendret på 300 DPI: pikselbredde skaleres 1,5×,
    // og «2 870»-linja blir tilsvarende lengre. Svaret må være uendret.
    const imgW300 = Math.round((IMG_W * 300) / 200); // 4962
    const imgH300 = Math.round((IMG_H * 300) / 200);
    const mm200 = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);
    const mm300 = utledMmPrPiksel(PAPIRBREDDE_MM, imgW300);

    // Endepunkt i prosent er DPI-uavhengig; men vi viser at pikselveien
    // (piksel → prosent → mm) gir samme svar ved begge oppløsninger.
    const px200a: Punkt = { x: (1117 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const px200b: Punkt = { x: (1569 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const svar200 = malMm(px200a, px200b, IMG_W, IMG_H, mm200, 50);

    const px300a: Punkt = { x: ((1117 * 1.5) / imgW300) * 100, y: ((811 * 1.5) / imgH300) * 100 };
    const px300b: Punkt = { x: ((1569 * 1.5) / imgW300) * 100, y: ((811 * 1.5) / imgH300) * 100 };
    const svar300 = malMm(px300a, px300b, imgW300, imgH300, mm300, 50);

    expect(svar300).toBeCloseTo(svar200, 1);
  });
});

describe("måling i tegning — akseptansetest: 2 870 mm ±0,5 %", () => {
  it("måler «2 870»-linja fra kjente pikselkoordinater og treffer 2870 mm", () => {
    const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);
    const nevner = parseMalestokk("1:50")!;
    // Endepunktene i prosent-rommet UI-en bruker.
    const a: Punkt = { x: (1117 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const b: Punkt = { x: (1569 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const mm = malMm(a, b, IMG_W, IMG_H, mmPrPx, nevner);
    // 452 px × 0,126965 × 50 = 2869,4 mm
    expect(Math.abs(mm - 2870) / 2870).toBeLessThan(0.005);
  });

  it("summerer en polylinje (2 870 + 2 425) korrekt", () => {
    const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);
    // 2 425-linja: endetikk px x=1584 og x=1966, samme rad.
    const p: Punkt[] = [
      { x: (1117 / IMG_W) * 100, y: (811 / IMG_H) * 100 },
      { x: (1569 / IMG_W) * 100, y: (811 / IMG_H) * 100 },
      { x: (1584 / IMG_W) * 100, y: (811 / IMG_H) * 100 },
      { x: (1966 / IMG_W) * 100, y: (811 / IMG_H) * 100 },
    ];
    const sum = malPolylinjeMm(p, IMG_W, IMG_H, mmPrPx, 50);
    // 2 870 + veggluke (tikk 1569→1584 ≈ 95 mm) + 2 425 ≈ 5 390 mm.
    // Summen skal være leddvis addisjon — inkludert den reelle luken.
    const forventet = malMm(p[0]!, p[1]!, IMG_W, IMG_H, mmPrPx, 50)
      + malMm(p[1]!, p[2]!, IMG_W, IMG_H, mmPrPx, 50)
      + malMm(p[2]!, p[3]!, IMG_W, IMG_H, mmPrPx, 50);
    expect(sum).toBeCloseTo(forventet, 6);
    expect(sum).toBeGreaterThan(5350);
    expect(sum).toBeLessThan(5450);
  });
});

describe("måling i tegning — areal (shoelace) på kjent rektangel (RETUR 3 § C)", () => {
  const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W); // 0,127
  const nevner = 50;
  // Et akse-rettet rektangel definert i pikselkoordinater, uttrykt i prosent.
  const rektPx = { x0: 1000, y0: 500, x1: 1500, y1: 900 }; // 500 × 400 px
  const px2pct = (x: number, y: number): Punkt => ({ x: (x / IMG_W) * 100, y: (y / IMG_H) * 100 });
  const hjørner: Punkt[] = [
    px2pct(rektPx.x0, rektPx.y0),
    px2pct(rektPx.x1, rektPx.y0),
    px2pct(rektPx.x1, rektPx.y1),
    px2pct(rektPx.x0, rektPx.y1),
  ];

  it("areal = bredde × høyde (virkelige mm)", () => {
    const bredde = malMm(hjørner[0]!, hjørner[1]!, IMG_W, IMG_H, mmPrPx, nevner);
    const høyde = malMm(hjørner[1]!, hjørner[2]!, IMG_W, IMG_H, mmPrPx, nevner);
    const areal = malArealMm2(hjørner, IMG_W, IMG_H, mmPrPx, nevner);
    expect(areal).toBeCloseTo(bredde * høyde, 2);
  });

  it("er uavhengig av klikk-rekkefølge (med/mot klokka)", () => {
    const motsatt = [...hjørner].reverse();
    expect(malArealMm2(motsatt, IMG_W, IMG_H, mmPrPx, nevner)).toBeCloseTo(
      malArealMm2(hjørner, IMG_W, IMG_H, mmPrPx, nevner),
      6,
    );
  });

  it("lukker ringen automatisk (ekstra sluttpunkt = første endrer ingenting)", () => {
    const medLukking = [...hjørner, hjørner[0]!];
    expect(malArealMm2(medLukking, IMG_W, IMG_H, mmPrPx, nevner)).toBeCloseTo(
      malArealMm2(hjørner, IMG_W, IMG_H, mmPrPx, nevner),
      6,
    );
  });

  it("< 3 punkter → 0 (ingen flate)", () => {
    expect(malArealMm2([hjørner[0]!, hjørner[1]!], IMG_W, IMG_H, mmPrPx, nevner)).toBe(0);
    expect(malArealMm2([], IMG_W, IMG_H, mmPrPx, nevner)).toBe(0);
  });
});

describe("måling i tegning — målestokk foreslått fra «Mål»-nabolaget, ikke løst 1:NN", () => {
  it("finner 1:50 ved å anker-søke «Mål»/«Målestokk»/«Scale»", () => {
    expect(finnMalestokkFraTekst(TITTELFELT_TEKST)).toBe("1:50");
  });

  it("et løst grep treffer brannkoden «60/ 37» FØR den ekte målestokken", () => {
    // Beviser hvorfor anker-søket trengs: det løse grepet er selvsikkert feil.
    expect(loesGrepMalestokk(TITTELFELT_TEKST)).toBe("60/ 37");
    expect(loesGrepMalestokk(TITTELFELT_TEKST)).not.toBe("1:50");
  });

  it("returnerer null når ingen ankret målestokk finnes", () => {
    expect(finnMalestokkFraTekst("Bare tekst\nuten målestokk-verdi")).toBeNull();
    expect(finnMalestokkFraTekst("")).toBeNull();
  });
});

describe("måling i tegning — verktøyet er AVSLÅTT uten tolkbar målestokk + mm/piksel", () => {
  const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);

  it("er avslått når målestokk mangler", () => {
    expect(kanMale(null, mmPrPx, "manuell")).toBe(false);
    expect(kanMale("", mmPrPx, "manuell")).toBe(false);
    expect(kanMale("ikke-en-målestokk", mmPrPx, "manuell")).toBe(false);
  });

  it("er avslått når mm/piksel mangler", () => {
    expect(kanMale("1:50", null, "manuell")).toBe(false);
    expect(kanMale("1:50", 0, "manuell")).toBe(false);
  });

  it("er avslått når kilden er ukjent (null) — en vist verdi uten opprinnelse teller ikke", () => {
    expect(kanMale("1:50", mmPrPx, null)).toBe(false);
    expect(kanMale("1:50", mmPrPx, undefined)).toBe(false);
  });
});

describe("måling i tegning — tittelfelt-målestokk er målbar direkte (Kenneth-vedtak 2026-10-07)", () => {
  const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);

  it("et tittelfelt-forslag er gyldig med én gang (ingen ekstra bekreftelse)", () => {
    // Før vedtaket: `tittelfelt` var avslått (forslag, ikke målestokk). Nå:
    // målestokken som vises skal kunne brukes; kalibrering er korreksjonen.
    expect(kanMale("1:50", mmPrPx, "tittelfelt")).toBe(true);
  });

  it("er også aktivt når et menneske har bekreftet/kalibrert, eller georeferanse finnes", () => {
    expect(kanMale("1:50", mmPrPx, "manuell")).toBe(true);
    expect(kanMale("1:50", mmPrPx, "kalibrert")).toBe(true);
    expect(kanMale("1:50", mmPrPx, "georeferanse")).toBe(true);
  });

  it("DWG-enheter (scaleKilde=dwg) er målbar direkte (DWG-2, D5, Kenneth Q4)", () => {
    // $INSUNITS gir «1:1» + mm/piksel fra tegningens enheter — måling aktiv uten
    // bekreftelsessteg. Ukjent enhet → scaleKilde=null (fanget av testen under).
    expect(kanMale("1:1", mmPrPx, "dwg")).toBe(true);
    expect(kanMale("1:1", mmPrPx, null)).toBe(false);
  });

  it("tittelfelt uten tolkbar målestokk eller uten mm/piksel er fortsatt sperret", () => {
    expect(kanMale(null, mmPrPx, "tittelfelt")).toBe(false);
    expect(kanMale("1:50", null, "tittelfelt")).toBe(false);
  });
});

describe("måling i tegning — kalibrering utleder målestokk fra kjent lengde", () => {
  it("gir 50 tilbake når man kalibrerer «2 870»-linja mot 2870 mm", () => {
    const mmPrPx = utledMmPrPiksel(PAPIRBREDDE_MM, IMG_W);
    const a: Punkt = { x: (1117 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const b: Punkt = { x: (1569 / IMG_W) * 100, y: (811 / IMG_H) * 100 };
    const nevner = kalibrerMalestokk(a, b, IMG_W, IMG_H, mmPrPx, 2870);
    expect(nevner).not.toBeNull();
    expect(nevner!).toBeCloseTo(50, 0);
  });

  it("returnerer null ved ugyldig inndata", () => {
    const a: Punkt = { x: 10, y: 10 };
    expect(kalibrerMalestokk(a, a, IMG_W, IMG_H, 0.127, 1000)).toBeNull(); // null lengde
    expect(kalibrerMalestokk(a, { x: 20, y: 10 }, IMG_W, IMG_H, 0.127, 0)).toBeNull(); // 0 mm
  });
});

// =============================================================================
// 90°-lås (ortho) + snapping — rene geometritester (syntetiske, forklart i hver).
// =============================================================================

describe("laasVinkel — projiser kandidat på nærmeste av vannrett/loddrett/vinkelrett", () => {
  // Kvadratisk bilde: 1 % = 10 px i begge akser, så prosent og piksel samvarierer.
  const W = 1000, H = 1000;

  it("nær-vannrett kandidat låses til vannrett (y = ankerets y)", () => {
    const anker: Punkt = { x: 20, y: 50 };
    const kandidat: Punkt = { x: 60, y: 52 }; // liten y-drift
    const r = laasVinkel(anker, kandidat, W, H);
    expect(r.y).toBeCloseTo(50, 5); // låst til ankerets y
    expect(r.x).toBeCloseTo(60, 5); // x bevart
  });

  it("nær-loddrett kandidat låses til loddrett (x = ankerets x)", () => {
    const anker: Punkt = { x: 40, y: 20 };
    const kandidat: Punkt = { x: 42, y: 70 };
    const r = laasVinkel(anker, kandidat, W, H);
    expect(r.x).toBeCloseTo(40, 5);
    expect(r.y).toBeCloseTo(70, 5);
  });

  it("vinkelrett på forrige segment: etter et loddrett segment låses neste til vannrett", () => {
    // forforrige→anker er loddrett (samme x). Vinkelrett på det = vannrett.
    const forforrige: Punkt = { x: 30, y: 20 };
    const anker: Punkt = { x: 30, y: 60 };
    const kandidat: Punkt = { x: 75, y: 58 }; // nesten vannrett ut fra ankeret
    const r = laasVinkel(anker, kandidat, W, H, forforrige);
    expect(r.y).toBeCloseTo(60, 5); // vannrett (= vinkelrett på loddrett forrige)
    expect(r.x).toBeCloseTo(75, 5);
  });

  it("vinkelrett på et skrått forrige segment (45°) gir et 45°-låst punkt", () => {
    const forforrige: Punkt = { x: 10, y: 10 };
    const anker: Punkt = { x: 50, y: 50 }; // forrige segment = retning (1,1)
    // Vinkelrett = retning (-1,1). Kandidat nær den.
    const kandidat: Punkt = { x: 38, y: 64 };
    const r = laasVinkel(anker, kandidat, W, H, forforrige);
    // Låst punkt skal ligge på linja anker + t·(-1,1): dx og dy like store, motsatt fortegn.
    expect(r.x - 50).toBeCloseTo(-(r.y - 50), 4);
  });

  it("degenerert bilde (0 px) returnerer kandidaten urørt", () => {
    const anker: Punkt = { x: 10, y: 10 };
    const kandidat: Punkt = { x: 20, y: 30 };
    expect(laasVinkel(anker, kandidat, 0, 0)).toEqual(kandidat);
  });

  it("sideforhold ≠ 1: 'nærmeste retning' avgjøres i pikselrom, ikke prosent", () => {
    // Bredt bilde (2000×500): 1 % x = 20 px, 1 % y = 5 px. En kandidat som i
    // PROSENT ser nærmest loddrett ut, er i PIKSLER nærmest vannrett.
    const W2 = 2000, H2 = 500;
    const anker: Punkt = { x: 10, y: 50 };
    const kandidat: Punkt = { x: 20, y: 56 }; // Δx=10%→200px, Δy=6%→30px → nær vannrett
    const r = laasVinkel(anker, kandidat, W2, H2);
    expect(r.y).toBeCloseTo(50, 5); // vannrett vant (riktig i pikselrom)
  });
});

describe("snapTilPunkt — nærmeste punkt innen skjermterskel", () => {
  const W = 1000, H = 1000, TOL = 12;

  it("snapper til et punkt innenfor terskelen (eksakt det punktet)", () => {
    const mål: Punkt[] = [{ x: 30, y: 40 }, { x: 70, y: 80 }];
    // 0,5 % = 5 px < 12 px.
    const r = snapTilPunkt({ x: 30.5, y: 40.3 }, mål, W, H, TOL);
    expect(r).toEqual({ x: 30, y: 40 });
  });

  it("returnerer null når ingen er nær nok", () => {
    const mål: Punkt[] = [{ x: 30, y: 40 }];
    expect(snapTilPunkt({ x: 50, y: 50 }, mål, W, H, TOL)).toBeNull();
  });

  it("velger det nærmeste av flere kandidater", () => {
    const mål: Punkt[] = [{ x: 30, y: 40 }, { x: 30.8, y: 40 }];
    const r = snapTilPunkt({ x: 30.7, y: 40 }, mål, W, H, TOL);
    expect(r).toEqual({ x: 30.8, y: 40 });
  });
});

describe("snapTil90Linje — hjelpelinjer fra eksisterende punkters x/y", () => {
  const W = 1000, H = 1000, TOL = 12;

  it("låser x til et punkts x (loddrett hjelpelinje) når nær", () => {
    const ref: Punkt[] = [{ x: 25, y: 10 }];
    const r = snapTil90Linje({ x: 25.4, y: 70 }, ref, W, H, TOL);
    expect(r.punkt.x).toBe(25);
    expect(r.punkt.y).toBe(70); // y urørt
    expect(r.hjelpelinjer.vertikal).toBe(25);
    expect(r.hjelpelinjer.horisontal).toBeNull();
  });

  it("låser både x og y fra to ulike punkter", () => {
    const ref: Punkt[] = [{ x: 25, y: 10 }, { x: 80, y: 60 }];
    const r = snapTil90Linje({ x: 25.3, y: 60.4 }, ref, W, H, TOL);
    expect(r.punkt).toEqual({ x: 25, y: 60 });
    expect(r.hjelpelinjer.vertikal).toBe(25);
    expect(r.hjelpelinjer.horisontal).toBe(60);
  });

  it("ingen referanser → punktet urørt, ingen hjelpelinjer", () => {
    const r = snapTil90Linje({ x: 40, y: 40 }, [], W, H, TOL);
    expect(r.punkt).toEqual({ x: 40, y: 40 });
    expect(r.hjelpelinjer).toEqual({ vertikal: null, horisontal: null });
  });
});

describe("beregnSnap — presedens: punkt-snap > ortho-lås > hjelpelinje", () => {
  const base = {
    forforrige: null,
    imageWidth: 1000,
    imageHeight: 1000,
    rectW: 1000,
    rectH: 1000,
    punktTolPx: 12,
    guideTolPx: 12,
  };

  it("punkt-snap vinner selv når ortho er på", () => {
    const r = beregnSnap({
      ...base,
      kandidat: { x: 30.4, y: 40.2 },
      anker: { x: 10, y: 40 },
      referanser: [{ x: 30, y: 40 }],
      ortho: true,
      snap: true,
    });
    expect(r.traffPunkt).toBe(true);
    expect(r.punkt).toEqual({ x: 30, y: 40 });
  });

  it("ortho-lås mot anker når ingen punkter er nær", () => {
    const r = beregnSnap({
      ...base,
      kandidat: { x: 60, y: 52 },
      anker: { x: 20, y: 50 },
      referanser: [{ x: 90, y: 90 }],
      ortho: true,
      snap: true,
    });
    expect(r.traffPunkt).toBe(false);
    expect(r.punkt.y).toBeCloseTo(50, 5); // vannrett-lås
  });

  it("hjelpelinje når ortho på men INGEN anker (første punkt)", () => {
    const r = beregnSnap({
      ...base,
      kandidat: { x: 25.3, y: 70 },
      anker: null,
      referanser: [{ x: 25, y: 10 }],
      ortho: true,
      snap: true,
    });
    expect(r.punkt.x).toBe(25);
    expect(r.hjelpelinjer.vertikal).toBe(25);
  });

  it("ortho av + snap av → kandidaten urørt", () => {
    const r = beregnSnap({
      ...base,
      kandidat: { x: 33, y: 44 },
      anker: { x: 10, y: 40 },
      referanser: [{ x: 33.1, y: 44 }],
      ortho: false,
      snap: false,
    });
    expect(r.punkt).toEqual({ x: 33, y: 44 });
    expect(r.traffPunkt).toBe(false);
  });

  it("snap er idempotent: et allerede-snappet punkt snappes til seg selv", () => {
    const inn = {
      ...base,
      kandidat: { x: 30, y: 40 },
      anker: null,
      forforrige: null,
      referanser: [{ x: 30, y: 40 }],
      ortho: true,
      snap: true,
    };
    const r1 = beregnSnap(inn);
    const r2 = beregnSnap({ ...inn, kandidat: r1.punkt });
    expect(r2.punkt).toEqual(r1.punkt);
  });
});

describe("laasVinkel — referanselinje (GJENOPPTA § 1): lås parallelt/vinkelrett på en skrå vegg", () => {
  const W = 1000, H = 1000;
  const ref = { a: { x: 10, y: 10 }, b: { x: 60, y: 60 } }; // skrå vegg langs (1,1)

  it("kandidat nær PARALLELT med veggen → låses parallelt (dx == dy)", () => {
    const r = laasVinkel({ x: 40, y: 40 }, { x: 70, y: 68 }, W, H, null, ref);
    expect(r.x - 40).toBeCloseTo(r.y - 40, 4);
  });

  it("kandidat nær VINKELRETT på veggen → låses vinkelrett (dx == -dy)", () => {
    const r = laasVinkel({ x: 40, y: 40 }, { x: 28, y: 54 }, W, H, null, ref);
    expect(r.x - 40).toBeCloseTo(-(r.y - 40), 4);
  });

  it("beregnSnap: vinkelrett=true + aksehjelpelinje når låst vinkelrett på referansen", () => {
    const r = beregnSnap({
      kandidat: { x: 28, y: 54 }, anker: { x: 40, y: 40 }, forforrige: null,
      referanser: [], referanselinje: ref, ortho: true, snap: true,
      imageWidth: W, imageHeight: H, rectW: W, rectH: H, punktTolPx: 12, guideTolPx: 12,
    });
    expect(r.vinkelrett).toBe(true);
    expect(r.aksehjelpelinje).not.toBeNull();
  });

  it("beregnSnap: parallell-lås gir vinkelrett=false", () => {
    const r = beregnSnap({
      kandidat: { x: 70, y: 68 }, anker: { x: 40, y: 40 }, forforrige: null,
      referanser: [], referanselinje: ref, ortho: true, snap: false,
      imageWidth: W, imageHeight: H, rectW: W, rectH: H, punktTolPx: 12, guideTolPx: 12,
    });
    expect(r.vinkelrett).toBe(false);
  });
});

describe("aksehjelpelinje — stiplet akse tvers over bildet", () => {
  const W = 1000, H = 1000;
  it("vannrett akse gjennom (50,30) treffer venstre+høyre kant (y=30)", () => {
    const ep = aksehjelpelinje({ x: 50, y: 30 }, { x: 1, y: 0 }, W, H);
    expect(ep).not.toBeNull();
    const [p1, p2] = ep!;
    expect(p1.y).toBeCloseTo(30, 4);
    expect(p2.y).toBeCloseTo(30, 4);
    const xs = [p1.x, p2.x].sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(0, 4);
    expect(xs[1]).toBeCloseTo(100, 4);
  });
  it("loddrett akse gjennom (25,50) treffer topp+bunn (x=25)", () => {
    const [p1, p2] = aksehjelpelinje({ x: 25, y: 50 }, { x: 0, y: 1 }, W, H)!;
    expect(p1.x).toBeCloseTo(25, 4);
    expect(p2.x).toBeCloseTo(25, 4);
  });
  it("degenerert (0-retning / 0-bilde) → null", () => {
    expect(aksehjelpelinje({ x: 50, y: 50 }, { x: 0, y: 0 }, W, H)).toBeNull();
    expect(aksehjelpelinje({ x: 50, y: 50 }, { x: 1, y: 0 }, 0, 0)).toBeNull();
  });
});
