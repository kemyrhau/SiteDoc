import { describe, it, expect } from "vitest";
import type { DxfKameraParametre, VerdenPunkt } from "./kamera-projeksjon";
import {
  insunitsTilMm,
  lesInsunitsFraDxfTekst,
  avstandVerden,
  malVerdenMm,
  malVerdenPolylinjeMm,
  malVerdenArealMm2,
  kanMaleVerden,
  laasDetaljerVerden,
  verdenPerSkjermPiksel,
  snapTilPunktVerden,
  snapTil90LinjeVerden,
  filtrerSynligeVerdenPunkter,
  beregnSnapVerden,
  finnNaermesteVerdenPunkt,
} from "./maaling-verden";

// Samme kamera-fixture som kamera-projeksjon.test.ts: symmetrisk boks, senter i
// verdenskoordinater (1000, 2000), canvas 800×600 (CSS-px).
const BASIS: DxfKameraParametre = {
  left: -400,
  right: 400,
  top: 300,
  bottom: -300,
  zoom: 1,
  senterX: 1000,
  senterY: 2000,
  rotasjonGrader: 0,
  canvasBredde: 800,
  canvasHoyde: 600,
};

describe("insunitsTilMm", () => {
  it("kjent tabell (speil av dwgKonvertering.ts)", () => {
    expect(insunitsTilMm(1)).toBeCloseTo(25.4, 9);
    expect(insunitsTilMm(2)).toBeCloseTo(304.8, 9);
    expect(insunitsTilMm(4)).toBe(1);
    expect(insunitsTilMm(5)).toBe(10);
    expect(insunitsTilMm(6)).toBe(1000);
  });

  it("ukjent/0/udefinert → null", () => {
    expect(insunitsTilMm(0)).toBeNull();
    expect(insunitsTilMm(3)).toBeNull();
    expect(insunitsTilMm(null)).toBeNull();
    expect(insunitsTilMm(undefined)).toBeNull();
  });
});

describe("lesInsunitsFraDxfTekst", () => {
  it("finner $INSUNITS-koden i en minimal DXF-header", () => {
    const dxf = "0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n";
    expect(lesInsunitsFraDxfTekst(dxf)).toBe(4);
  });

  it("fant ikke $INSUNITS → null", () => {
    expect(lesInsunitsFraDxfTekst("0\nSECTION\n2\nHEADER\n0\nENDSEC\n")).toBeNull();
  });
});

describe("D5-ekvivalent — kjent avstand i DXF-verdensenheter → riktig meter", () => {
  it("INSUNITS=4 (mm): en 1000-enhets linje (= 1000 mm) måler 1,00 m", () => {
    const mmPrEnhet = insunitsTilMm(lesInsunitsFraDxfTekst("9\n$INSUNITS\n70\n4\n"))!;
    const a: VerdenPunkt = { verdenX: 0, verdenY: 0 };
    const b: VerdenPunkt = { verdenX: 1000, verdenY: 0 };
    const mm = malVerdenMm(a, b, mmPrEnhet);
    expect(mm).toBeCloseTo(1000, 9);
    expect(mm / 1000).toBeCloseTo(1.0, 9); // meter
  });

  it("INSUNITS=6 (m): en 2,5-enhets linje (= 2,5 m) måler riktig antall mm", () => {
    const mmPrEnhet = insunitsTilMm(lesInsunitsFraDxfTekst("9\n$INSUNITS\n70\n6\n"))!;
    const a: VerdenPunkt = { verdenX: 10, verdenY: 10 };
    const b: VerdenPunkt = { verdenX: 10, verdenY: 12.5 };
    expect(malVerdenMm(a, b, mmPrEnhet)).toBeCloseTo(2500, 9);
  });

  it("INSUNITS=1 (tommer): en 2-enhets linje måler 50,8 mm", () => {
    const mmPrEnhet = insunitsTilMm(lesInsunitsFraDxfTekst("9\n$INSUNITS\n70\n1\n"))!;
    expect(malVerdenMm({ verdenX: 0, verdenY: 0 }, { verdenX: 2, verdenY: 0 }, mmPrEnhet)).toBeCloseTo(50.8, 9);
  });

  it("kanMaleVerden avslår uten kjent $INSUNITS (ukjent kode)", () => {
    const mmPrEnhet = insunitsTilMm(lesInsunitsFraDxfTekst("9\n$INSUNITS\n70\n0\n"));
    expect(kanMaleVerden(mmPrEnhet)).toBe(false);
  });
});

describe("malVerdenPolylinjeMm / malVerdenArealMm2", () => {
  it("polylinje: sum av segmenter", () => {
    const pkt: VerdenPunkt[] = [
      { verdenX: 0, verdenY: 0 },
      { verdenX: 3, verdenY: 0 },
      { verdenX: 3, verdenY: 4 },
    ];
    // 3 + 4 = 7 verdensenheter, INSUNITS=4 (mm/enhet=1) → 7 mm.
    expect(malVerdenPolylinjeMm(pkt, 1)).toBeCloseTo(7, 9);
  });

  it("areal: kvadrat 10×10 verdensenheter (INSUNITS=6, m) → 100 m²", () => {
    const mmPrEnhet = insunitsTilMm(6)!; // 1000 mm/enhet
    const kvadrat: VerdenPunkt[] = [
      { verdenX: 0, verdenY: 0 },
      { verdenX: 10, verdenY: 0 },
      { verdenX: 10, verdenY: 10 },
      { verdenX: 0, verdenY: 10 },
    ];
    const mm2 = malVerdenArealMm2(kvadrat, mmPrEnhet);
    const m2 = mm2 / 1_000_000;
    expect(m2).toBeCloseTo(100, 6);
  });

  it("< 3 punkter → 0", () => {
    expect(malVerdenArealMm2([{ verdenX: 0, verdenY: 0 }], 1)).toBe(0);
  });
});

describe("verdenPerSkjermPiksel", () => {
  it("skalerer med zoom: dobbel zoom halverer verdensenheter pr. skjerm-px", () => {
    const en = verdenPerSkjermPiksel(BASIS);
    const to = verdenPerSkjermPiksel({ ...BASIS, zoom: 2 });
    expect(to).toBeCloseTo(en / 2, 9);
  });
});

describe("laasDetaljerVerden — 90°-lås i verdensrom", () => {
  it("uten referanse/forforrige: låser til nærmeste akse (vannrett)", () => {
    const anker: VerdenPunkt = { verdenX: 0, verdenY: 0 };
    const kandidat: VerdenPunkt = { verdenX: 10, verdenY: 1 }; // nær vannrett
    const d = laasDetaljerVerden(anker, kandidat);
    expect(d.punkt.verdenY).toBeCloseTo(0, 9);
    expect(d.vinkelrett).toBe(false);
  });

  it("med forforrige: vinkelrett-retningen er tilgjengelig og brukes når nærmest", () => {
    const forforrige: VerdenPunkt = { verdenX: 0, verdenY: 0 };
    const anker: VerdenPunkt = { verdenX: 10, verdenY: 0 }; // segment 1: Ø-retning
    // Kandidat rett "opp" fra anker (vinkelrett på forrige segment, ikke en akse i world... her er akse OG vinkelrett sammenfallende siden forrige segment er vannrett)
    const kandidat: VerdenPunkt = { verdenX: 10.5, verdenY: 10 };
    const d = laasDetaljerVerden(anker, kandidat, forforrige);
    expect(d.punkt.verdenX).toBeCloseTo(10, 9); // låst loddrett gjennom anker
  });

  it("med referanselinje: låser parallelt eller vinkelrett på den, ikke på verdensaksene", () => {
    const referanse = { a: { verdenX: 0, verdenY: 0 }, b: { verdenX: 10, verdenY: 10 } }; // 45°-vegg
    const anker: VerdenPunkt = { verdenX: 5, verdenY: 5 };
    const kandidat: VerdenPunkt = { verdenX: 15, verdenY: 14 }; // nær parallelt med veggen
    const d = laasDetaljerVerden(anker, kandidat, null, referanse);
    // Låst punkt skal ligge på linjen gjennom anker med 45°-retning: verdenY - 5 === verdenX - 5
    expect(d.punkt.verdenY - 5).toBeCloseTo(d.punkt.verdenX - 5, 6);
  });
});

describe("snapTilPunktVerden / snapTil90LinjeVerden", () => {
  it("snapper til nærmeste punkt innen toleransen", () => {
    const mål: VerdenPunkt[] = [{ verdenX: 100, verdenY: 100 }, { verdenX: 200, verdenY: 200 }];
    const treff = snapTilPunktVerden({ verdenX: 101, verdenY: 99 }, mål, 5);
    expect(treff).toEqual({ verdenX: 100, verdenY: 100 });
  });

  it("ingen treff utenfor toleransen → null", () => {
    const mål: VerdenPunkt[] = [{ verdenX: 100, verdenY: 100 }];
    expect(snapTilPunktVerden({ verdenX: 200, verdenY: 200 }, mål, 5)).toBeNull();
  });

  it("snapTil90LinjeVerden låser x og y uavhengig til nærmeste referanse-akse", () => {
    const referanser: VerdenPunkt[] = [{ verdenX: 50, verdenY: 0 }];
    const { punkt, hjelpelinjer } = snapTil90LinjeVerden({ verdenX: 51, verdenY: 30 }, referanser, 5);
    expect(punkt.verdenX).toBeCloseTo(50, 9);
    expect(hjelpelinjer.vertikal).toBe(50);
    expect(hjelpelinjer.horisontal).toBeNull();
  });
});

describe("filtrerSynligeVerdenPunkter", () => {
  it("fjerner punkter utenfor canvaset (utenfor margin)", () => {
    const innenfor: VerdenPunkt = { verdenX: 1000, verdenY: 2000 }; // kamerasenter → midt på canvas
    const utenfor: VerdenPunkt = { verdenX: 100000, verdenY: 100000 }; // langt utenfor
    const synlige = filtrerSynligeVerdenPunkter([innenfor, utenfor], BASIS, 0);
    expect(synlige).toEqual([innenfor]);
  });
});

describe("beregnSnapVerden — presedens snap > ortho > 90°-hjelpelinjer", () => {
  it("snap vinner over ortho når begge er på og et punkt er nær", () => {
    const eksisterende: VerdenPunkt = { verdenX: 1005, verdenY: 2005 };
    const resultat = beregnSnapVerden({
      kandidat: { verdenX: 1006, verdenY: 2004 },
      anker: { verdenX: 900, verdenY: 2000 },
      forforrige: null,
      referanser: [eksisterende],
      ortho: true,
      snap: true,
      kamera: BASIS,
      punktTolPx: 20,
      guideTolPx: 10,
    });
    expect(resultat.traffPunkt).toBe(true);
    expect(resultat.punkt).toEqual(eksisterende);
  });

  it("ortho uten snap-treff låser mot ankeret og gir aksehjelpelinje", () => {
    const resultat = beregnSnapVerden({
      kandidat: { verdenX: 1100, verdenY: 2003 },
      anker: { verdenX: 1000, verdenY: 2000 },
      forforrige: null,
      referanser: [],
      ortho: true,
      snap: false,
      kamera: BASIS,
      punktTolPx: 20,
      guideTolPx: 10,
    });
    expect(resultat.punkt.verdenY).toBeCloseTo(2000, 6);
    expect(resultat.aksehjelpelinje).not.toBeNull();
  });
});

describe("finnNaermesteVerdenPunkt", () => {
  it("finner indeksen til punktet nærmest et skjermtrykk", () => {
    const punkter: VerdenPunkt[] = [
      { verdenX: 1000, verdenY: 2000 }, // → skjerm (400,300), kamerasenter
      { verdenX: 1100, verdenY: 2000 },
    ];
    const treff = finnNaermesteVerdenPunkt(punkter, { skjermX: 402, skjermY: 301 }, BASIS, 10);
    expect(treff).toBe(0);
  });

  it("ingen punkt innen toleransen → -1", () => {
    const punkter: VerdenPunkt[] = [{ verdenX: 1000, verdenY: 2000 }];
    expect(finnNaermesteVerdenPunkt(punkter, { skjermX: 0, skjermY: 0 }, BASIS, 5)).toBe(-1);
  });
});

describe("avstandVerden", () => {
  it("3-4-5-trekant", () => {
    expect(avstandVerden({ verdenX: 0, verdenY: 0 }, { verdenX: 3, verdenY: 4 })).toBeCloseTo(5, 9);
  });
});
