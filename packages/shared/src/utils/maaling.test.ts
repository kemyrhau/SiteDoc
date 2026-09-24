import { describe, it, expect } from "vitest";
import {
  utledMmPrPiksel,
  parseMalestokk,
  finnMalestokkFraTekst,
  loesGrepMalestokk,
  malMm,
  malPolylinjeMm,
  kanMale,
  kalibrerMalestokk,
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
    const forventet = malMm(p[0], p[1], IMG_W, IMG_H, mmPrPx, 50)
      + malMm(p[1], p[2], IMG_W, IMG_H, mmPrPx, 50)
      + malMm(p[2], p[3], IMG_W, IMG_H, mmPrPx, 50);
    expect(sum).toBeCloseTo(forventet, 6);
    expect(sum).toBeGreaterThan(5350);
    expect(sum).toBeLessThan(5450);
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

describe("måling i tegning — verktøyet er AVSLÅTT uten bekreftet målestokk (rød-først)", () => {
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

  it("er avslått for et UBEKREFTET tittelfelt-forslag (må bekreftes først)", () => {
    expect(kanMale("1:50", mmPrPx, "tittelfelt")).toBe(false);
  });

  it("er aktivt først når et menneske har bekreftet/kalibrert, eller georeferanse finnes", () => {
    expect(kanMale("1:50", mmPrPx, "manuell")).toBe(true);
    expect(kanMale("1:50", mmPrPx, "kalibrert")).toBe(true);
    expect(kanMale("1:50", mmPrPx, "georeferanse")).toBe(true);
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
