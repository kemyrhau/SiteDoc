import { describe, it, expect } from "vitest";
import {
  annoteringsflateHoyde,
  annoteringsbildeFit,
  tekstboksStandardBredde,
  klemTekstboksPosisjon,
  skalTekstTapRedigere,
  erTekstType,
  tekstErSelectableIVerktoy,
  TEKSTBOKS_MARG,
  TEKSTBOKS_MIN_BREDDE,
  avstandTilLinjestykke,
  avstandTilForm,
  trefferForm,
  formTypeFraBarn,
  objektTrykkHandling,
  angreSisteHandling,
  FORM_TREFF_TOLERANSE,
  type FormGeometri,
  type AngreHandling,
} from "./plassering";

/**
 * Vokter vedtaket (Kenneth 2026-10-21): bildet har ÉN fast plassering med og uten tastatur,
 * forankret under overskriften. Flaten reserverer alltid tastaturhøyden, og bildet skaleres
 * til flaten med sideforhold bevart (liggende bundet av bredde, stående av høyde).
 */
describe("annoteringsflateHoyde — fast flate, uavhengig av tastaturtilstand", () => {
  // Realistiske tall (iPhone-aktig, pt): vindu 844, status 47, header 52, tastatur 300, hjelpelinje 44.
  const basis = { vindusHoyde: 844, insetTop: 47, headerHoyde: 52, tastaturHoyde: 300, hjelpelinjeHoyde: 44 };

  it("trekker fra status, header, reservert tastatur og hjelpelinje", () => {
    expect(annoteringsflateHoyde(basis)).toBe(844 - 47 - 52 - 300 - 44); // 401
  });

  it("er identisk uansett når den kalles — funksjonen har ingen «tastatur synlig»-tilstand", () => {
    // Samme input → samme flate. Komponenten beregner den ÉN gang; tastaturet som kommer og
    // går endrer ingen input her, så bildet kan ikke hoppe.
    expect(annoteringsflateHoyde(basis)).toBe(annoteringsflateHoyde({ ...basis }));
  });

  it("klemmes til 0 ved liten skjerm / stor header (aldri negativ)", () => {
    expect(annoteringsflateHoyde({ ...basis, vindusHoyde: 300 })).toBe(0);
  });
});

describe("annoteringsbildeFit — sideforhold bevart, øvre kant forankret", () => {
  const FLATE_B = 390;
  const FLATE_H = 401; // flaten fra testen over

  it("liggende bilde bindes av BREDDEN (vertikal plass til overs)", () => {
    const r = annoteringsbildeFit(1600, 1200, FLATE_B, FLATE_H); // 4:3 liggende
    expect(r.bundetAv).toBe("bredde");
    expect(r.visningsBredde).toBeCloseTo(390, 5); // fyller bredden
    expect(r.visningsHoyde).toBeLessThan(FLATE_H); // plass igjen vertikalt
  });

  it("stående bilde bindes av HØYDEN (skaleres mindre)", () => {
    const r = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H); // 3:4 stående
    expect(r.bundetAv).toBe("hoyde");
    expect(r.visningsHoyde).toBeCloseTo(401, 5); // fyller høyden
    expect(r.visningsBredde).toBeLessThan(FLATE_B);
  });

  it("samme bilde + samme flate gir samme resultat med og uten tastatur", () => {
    // Flaten beregnes med tastatur reservert (FLATE_H). Enten tastaturet faktisk er fremme
    // eller ikke, er flaten den samme → fit-resultatet er det samme. Ingen hopping.
    const utenTastaturFeil = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H);
    const medTastatur = annoteringsbildeFit(1200, 1600, FLATE_B, FLATE_H);
    expect(medTastatur).toEqual(utenTastaturFeil);
  });

  it("bevarer sideforholdet", () => {
    const r = annoteringsbildeFit(1600, 1200, FLATE_B, FLATE_H);
    expect(r.visningsBredde / r.visningsHoyde).toBeCloseTo(1600 / 1200, 5);
  });

  it("gir skala 1 / rå størrelse når flaten ikke er målt ennå (0)", () => {
    expect(annoteringsbildeFit(1600, 1200, 0, 0)).toEqual({
      skala: 1,
      visningsBredde: 1600,
      visningsHoyde: 1200,
      bundetAv: "bredde",
    });
  });
});

/**
 * Vokter Del 1 (Kenneth 2026-10-22): tekstboksen får en bredde fra trykkpunktet til
 * bildets høyre kant minus marg, så teksten bryter på bildet (bilde 10-funnet: IText
 * brøt aldri og gikk ut over kanten).
 */
describe("tekstboksStandardBredde — trykkpunkt til høyre kant minus marg", () => {
  const CANVAS = 390;

  it("strekker fra trykkpunktet til høyre marg i normaltilfellet", () => {
    // Trykk på x=100 → bredden når akkurat til canvasBredde - marg.
    expect(tekstboksStandardBredde(100, CANVAS, TEKSTBOKS_MARG)).toBe(CANVAS - 100 - TEKSTBOKS_MARG);
    // left + bredde = høyre marg: 100 + 282 = 382 = 390 - 8. Teksten bryter innenfor kanten.
    expect(100 + tekstboksStandardBredde(100, CANVAS)).toBe(CANVAS - TEKSTBOKS_MARG);
  });

  it("klemmer til minBredde når trykket er helt ute ved høyre kant (ingen negativ bredde)", () => {
    expect(tekstboksStandardBredde(385, CANVAS)).toBe(TEKSTBOKS_MIN_BREDDE);
  });

  it("blir aldri bredere enn flaten mellom margene tillater", () => {
    // Trykk helt til venstre (x=0): fraTrykk ville vært 382, men maks i flate er 390-2·8 = 374.
    expect(tekstboksStandardBredde(0, CANVAS)).toBe(CANVAS - 2 * TEKSTBOKS_MARG);
  });

  it("tåler en veldig smal canvas uten å gå negativ", () => {
    expect(tekstboksStandardBredde(10, 20)).toBe(Math.max(0, 20 - 2 * TEKSTBOKS_MARG));
  });
});

/**
 * Vokter Del 1 (Kenneth 2026-10-22): «teksten skal aldri havne utenfor bildet» — ved
 * opprettelse, dra og bredde-endring klemmes boksens hjørne innenfor margene.
 */
describe("klemTekstboksPosisjon — boksen holdes innenfor bildet", () => {
  const felles = { bredde: 100, hoyde: 40, canvasBredde: 390, canvasHoyde: 520, marg: TEKSTBOKS_MARG };

  it("lar en boks godt innenfor stå urørt", () => {
    expect(klemTekstboksPosisjon({ ...felles, left: 50, top: 60 })).toEqual({ left: 50, top: 60 });
  });

  it("skyver en boks som stikker ut til høyre innover", () => {
    // left 350 + bredde 100 = 450 > 390-8 → maksLeft = 390-8-100 = 282.
    expect(klemTekstboksPosisjon({ ...felles, left: 350, top: 60 }).left).toBe(282);
  });

  it("skyver en boks som stikker ut nederst oppover", () => {
    // top 500 + hoyde 40 = 540 > 520-8 → maksTop = 520-8-40 = 472.
    expect(klemTekstboksPosisjon({ ...felles, left: 50, top: 500 }).top).toBe(472);
  });

  it("klemmer negativ posisjon til margen (øvre venstre hjørne synlig)", () => {
    expect(klemTekstboksPosisjon({ ...felles, left: -30, top: -30 })).toEqual({
      left: TEKSTBOKS_MARG,
      top: TEKSTBOKS_MARG,
    });
  });

  it("lar margen vinne når boksen er bredere enn flaten", () => {
    expect(klemTekstboksPosisjon({ ...felles, bredde: 500, left: 100, top: 60 }).left).toBe(TEKSTBOKS_MARG);
  });
});

/**
 * RETUR 5965e37b (Kenneth 2026-10-22, PROD STOPPET): en avsluttet tekst kunne ikke åpnes
 * igjen etter Textbox-migreringen, og tap-til-rediger var bundet til Tekst-verktøyet.
 * Vedtak (orkestrator-GO): et TRYKK (< TEKST_TAP_TERSKEL) på en tekst redigerer i ALLE
 * verktøy; et DRA fra en tekst tegner fortsatt formen. Både ny `textbox` og gammel
 * `i-text`/`text` fra prod skal åpnes.
 */
describe("erTekstType — ny Textbox og eldre i-text/text", () => {
  it("kjenner igjen textbox, i-text og text", () => {
    expect(erTekstType("textbox")).toBe(true);
    expect(erTekstType("i-text")).toBe(true);
    expect(erTekstType("text")).toBe(true);
  });
  it("er usann for former og tomt treff", () => {
    expect(erTekstType("group")).toBe(false); // pil/sirkel/firkant er grupper
    expect(erTekstType("path")).toBe(false); // frihånd
    expect(erTekstType(null)).toBe(false);
    expect(erTekstType(undefined)).toBe(false);
  });
});

describe("skalTekstTapRedigere — trykk redigerer, dra tegner", () => {
  it("TRYKK på en textbox redigerer i Pil-verktøyet (verktøy-agnostisk tap)", () => {
    expect(skalTekstTapRedigere({ objType: "textbox", aktivtVerktoy: "arrow", beveget: false })).toBe(true);
  });
  it("DRA fra en textbox i Pil-verktøyet tegner (redigerer IKKE)", () => {
    expect(skalTekstTapRedigere({ objType: "textbox", aktivtVerktoy: "arrow", beveget: true })).toBe(false);
  });
  it("gammel i-text fra prod åpnes med trykk (sirkel-verktøyet)", () => {
    expect(skalTekstTapRedigere({ objType: "i-text", aktivtVerktoy: "circle", beveget: false })).toBe(true);
  });
  it("eldre text-lag åpnes med trykk (firkant-verktøyet)", () => {
    expect(skalTekstTapRedigere({ objType: "text", aktivtVerktoy: "rect", beveget: false })).toBe(true);
  });
  it("trykk i Tekst-verktøyet redigerer også", () => {
    expect(skalTekstTapRedigere({ objType: "textbox", aktivtVerktoy: "text", beveget: false })).toBe(true);
  });
  it("trykk i Frihånd (draw) redigerer nå også — «uansett verktøy» (Kenneth 2026-10-28)", () => {
    expect(skalTekstTapRedigere({ objType: "textbox", aktivtVerktoy: "draw", beveget: false })).toBe(true);
  });
  it("Fabric eier flytt (select) — ingen tap-redigering der", () => {
    expect(skalTekstTapRedigere({ objType: "textbox", aktivtVerktoy: "select", beveget: false })).toBe(false);
  });
  it("en form (ikke tekst) redigeres aldri", () => {
    expect(skalTekstTapRedigere({ objType: "group", aktivtVerktoy: "arrow", beveget: false })).toBe(false);
  });
});

describe("tekstErSelectableIVerktoy — tekst Fabric-flyttbar bare i select/text", () => {
  it("selectable i Velg og Tekst (flytt / dra-flytt)", () => {
    expect(tekstErSelectableIVerktoy("select")).toBe(true);
    expect(tekstErSelectableIVerktoy("text")).toBe(true);
  });
  it("IKKE selectable i tegneverktøyene (dra fra tekst tegner formen)", () => {
    expect(tekstErSelectableIVerktoy("arrow")).toBe(false);
    expect(tekstErSelectableIVerktoy("circle")).toBe(false);
    expect(tekstErSelectableIVerktoy("rect")).toBe(false);
    expect(tekstErSelectableIVerktoy("draw")).toBe(false);
  });
});

// ── Velg alle objekter (Kenneth 2026-10-28) ────────────────────────────────────────
//
// Vokter regelen: trykk på en forms STREK (ikke rammeboksen) velger den i alle verktøy,
// dra tegner som før, trykk på tomt fjerner valget. Treff måles mot streken med 22 px
// toleranse — et trykk midt i en stor sirkel/firkant skal IKKE plukke den opp.

describe("avstandTilLinjestykke — korteste avstand til et segment", () => {
  it("punkt rett over midten av et horisontalt segment = den vinkelrette avstanden", () => {
    expect(avstandTilLinjestykke({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(10);
  });
  it("punkt utenfor endepunktet klemmes til endepunktet (ikke til linja forlenget)", () => {
    expect(avstandTilLinjestykke({ x: 130, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(30);
  });
  it("degenerert segment (a === b) = avstand til punktet", () => {
    expect(avstandTilLinjestykke({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe("avstandTilForm / trefferForm — treff mot streken, ikke rammeboksen", () => {
  it("pil: måles til linjestykket hale→spiss", () => {
    const g: FormGeometri = { type: "linje", fra: { x: 0, y: 0 }, til: { x: 100, y: 0 } };
    expect(avstandTilForm({ x: 50, y: 5 }, g)).toBe(5);
    expect(trefferForm({ x: 50, y: 5 }, g)).toBe(true);
    expect(trefferForm({ x: 50, y: 40 }, g)).toBe(false);
  });

  it("sirkel: |avstand til senter − r|; trykk MIDT inni treffer ikke, på streken treffer", () => {
    const g: FormGeometri = { type: "ellipse", cx: 100, cy: 100, rx: 50, ry: 50 };
    // Midt i en stor sirkel: 50 px fra streken → ikke treff (plan: «trykk midt i stor sirkel skal ikke plukke den opp»)
    expect(avstandTilForm({ x: 100, y: 100 }, g)).toBe(50);
    expect(trefferForm({ x: 100, y: 100 }, g)).toBe(false);
    // På streken
    expect(avstandTilForm({ x: 150, y: 100 }, g)).toBeCloseTo(0, 6);
    expect(trefferForm({ x: 150, y: 100 }, g)).toBe(true);
    // Rett innenfor toleransen
    expect(trefferForm({ x: 150 - FORM_TREFF_TOLERANSE + 1, y: 100 }, g)).toBe(true);
    expect(trefferForm({ x: 150 - FORM_TREFF_TOLERANSE - 1, y: 100 }, g)).toBe(false);
  });

  it("oval (rx ≠ ry) regnes radielt", () => {
    const g: FormGeometri = { type: "ellipse", cx: 0, cy: 0, rx: 80, ry: 40 };
    expect(avstandTilForm({ x: 80, y: 0 }, g)).toBeCloseTo(0, 6);
    expect(avstandTilForm({ x: 0, y: 40 }, g)).toBeCloseTo(0, 6);
  });

  it("firkant: avstand til nærmeste kant; trykk midt inni er langt fra streken", () => {
    const g: FormGeometri = { type: "rektangel", cx: 100, cy: 100, bredde: 200, hoyde: 100 };
    // Senteret: min(100, 50) = 50 fra nærmeste kant → ikke treff
    expect(avstandTilForm({ x: 100, y: 100 }, g)).toBe(50);
    expect(trefferForm({ x: 100, y: 100 }, g)).toBe(false);
    // På en kant
    expect(avstandTilForm({ x: 100, y: 50 }, g)).toBe(0);
    // Utenfor et hjørne (3-4-5)
    expect(avstandTilForm({ x: 203, y: 154 }, g)).toBe(5);
  });

  it("frihånd (sti): minste avstand til stiens segmenter", () => {
    const g: FormGeometri = { type: "sti", punkter: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] };
    expect(avstandTilForm({ x: 50, y: 7 }, g)).toBe(7);
    expect(avstandTilForm({ x: 107, y: 50 }, g)).toBe(7);
    // Tynn strek treffes innen 22 px
    expect(trefferForm({ x: 50, y: 20 }, g)).toBe(true);
  });

  it("rotert firkant (vinkel) måles i objektets egne akser", () => {
    const g: FormGeometri = { type: "rektangel", cx: 0, cy: 0, bredde: 100, hoyde: 20, vinkel: 90 };
    // Etter 90°-rotasjon ligger den lange kanten langs y-aksen; et punkt på x = 10 er utenfor halvhøyden (10)
    expect(avstandTilForm({ x: 10, y: 0 }, g)).toBe(0);
  });
});

describe("formTypeFraBarn — siste barn avgjør (gamle prod-grupper gjenkjennes likt)", () => {
  it("pil = siste barn triangle", () => {
    expect(formTypeFraBarn(["line", "triangle", "line", "triangle"])).toBe("pil");
  });
  it("sirkel = siste barn circle", () => {
    expect(formTypeFraBarn(["circle", "circle"])).toBe("sirkel");
  });
  it("firkant = siste barn rect", () => {
    expect(formTypeFraBarn(["rect", "rect"])).toBe("firkant");
  });
  it("ukjent ellers", () => {
    expect(formTypeFraBarn(["path"])).toBe("ukjent");
    expect(formTypeFraBarn([])).toBe("ukjent");
  });
});

describe("objektTrykkHandling — trykk velger, dra tegner, håndtak endrer (alle verktøy)", () => {
  const base = { aktivtVerktoy: "arrow", beveget: false, traffValgt: false, traffHandtak: false, valgtType: null as "tekst" | "form" | null };

  it("TRYKK på en forms strek → velg (i et tegneverktøy)", () => {
    expect(objektTrykkHandling({ ...base, treffType: "form" })).toBe("velg");
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "circle", treffType: "form" })).toBe("velg");
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "rect", treffType: "form" })).toBe("velg");
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "draw", treffType: "form" })).toBe("velg");
  });
  it("TRYKK på en tekst → rediger-tekst", () => {
    expect(objektTrykkHandling({ ...base, treffType: "tekst" })).toBe("rediger-tekst");
  });
  it("DRA fra et ikke-valgt objekt → tegn (pil fra en etikett går fortsatt)", () => {
    expect(objektTrykkHandling({ ...base, treffType: "tekst", beveget: true })).toBe("tegn");
    expect(objektTrykkHandling({ ...base, treffType: "form", beveget: true })).toBe("tegn");
  });
  it("DRA som starter på det VALGTE objektet → flytt", () => {
    expect(objektTrykkHandling({ ...base, treffType: null, traffValgt: true, beveget: true, valgtType: "form" })).toBe("flytt");
  });
  it("TRYKK (uten bevegelse) på det valgte objektet → ingen (ikke utilsiktet flytt)", () => {
    expect(objektTrykkHandling({ ...base, treffType: null, traffValgt: true, beveget: false, valgtType: "form" })).toBe("ingen");
  });
  it("DRA i et håndtak → endre (størrelse)", () => {
    expect(objektTrykkHandling({ ...base, treffType: null, traffHandtak: true, beveget: true, valgtType: "form" })).toBe("endre");
  });
  it("TRYKK på tomt område med en valgt FORM → fjern-valg", () => {
    expect(objektTrykkHandling({ ...base, treffType: null, valgtType: "form" })).toBe("fjern-valg");
  });
  it("TRYKK på tomt i Tekst-verktøyet lager NY tekst selv om en tekst er valgt", () => {
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "text", treffType: null, valgtType: "tekst" })).toBe("tegn");
  });
  it("TRYKK på tomt med valgt tekst i et ANNET verktøy → fjern-valg", () => {
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "arrow", treffType: null, valgtType: "tekst" })).toBe("fjern-valg");
  });
  it("TRYKK på tomt i Frihånd uten valg → tegn (prikk som før)", () => {
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "draw", treffType: null, valgtType: null })).toBe("tegn");
  });
  it("select (web-«Flytt») eies helt av Fabric → ingen", () => {
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "select", treffType: "form" })).toBe("ingen");
    expect(objektTrykkHandling({ ...base, aktivtVerktoy: "select", treffType: null, traffHandtak: true, beveget: true, valgtType: "form" })).toBe("ingen");
  });
});

describe("angreSisteHandling — angrer siste HANDLING (flytt/størrelse/erstatt), ikke bare opprettelse", () => {
  type O = { id: string };
  const a: O = { id: "a" };
  const b: O = { id: "b" };

  it("lagt-til → fjerner objektet", () => {
    const stakk: AngreHandling<O, number>[] = [{ type: "lagt-til", obj: a }];
    const r = angreSisteHandling(stakk, [a, b]);
    expect(r.objekter).toEqual([b]);
    expect(r.effekt).toEqual({ type: "fjern", obj: a });
    expect(r.stakk).toEqual([]);
  });

  it("endret (flytt/størrelse) → gjenoppretter tilstanden, objektet blir værende", () => {
    const stakk: AngreHandling<O, number>[] = [{ type: "endret", obj: a, for: 42 }];
    const r = angreSisteHandling(stakk, [a, b]);
    expect(r.objekter).toEqual([a, b]);
    expect(r.effekt).toEqual({ type: "gjenopprett", obj: a, tilstand: 42 });
  });

  it("erstattet (pil-endepunkt) → bytter ny tilbake til gammel på samme plass", () => {
    const ny: O = { id: "ny" };
    const stakk: AngreHandling<O, number>[] = [{ type: "erstattet", gammel: a, ny }];
    const r = angreSisteHandling(stakk, [ny, b]);
    expect(r.objekter).toEqual([a, b]);
    expect(r.effekt).toEqual({ type: "bytt", ut: ny, inn: a });
  });

  it("flytt → angre → tilbake: tilstanden som gjenopprettes er den fra FØR flyttingen", () => {
    const stakk: AngreHandling<O, { left: number }>[] = [{ type: "endret", obj: a, for: { left: 10 } }];
    const r = angreSisteHandling(stakk, [a]);
    expect(r.effekt).toMatchObject({ type: "gjenopprett", tilstand: { left: 10 } });
  });

  it("hopper over handlinger på objekter som ikke lenger finnes (tom tekst ryddet bort)", () => {
    const borte: O = { id: "borte" };
    const stakk: AngreHandling<O, number>[] = [
      { type: "lagt-til", obj: a },
      { type: "lagt-til", obj: borte },
    ];
    const r = angreSisteHandling(stakk, [a]); // borte er ikke i objekter
    expect(r.effekt).toEqual({ type: "fjern", obj: a });
    expect(r.stakk).toEqual([]); // begge poppet
  });

  it("tom stakk → faller tilbake til gammel oppførsel (fjern siste objekt, også lastet lag)", () => {
    const r = angreSisteHandling([], [a, b]);
    expect(r.objekter).toEqual([a]);
    expect(r.effekt).toEqual({ type: "fjern", obj: b });
  });

  it("alt tomt → ingen effekt", () => {
    const r = angreSisteHandling([], []);
    expect(r.effekt).toBeNull();
    expect(r.objekter).toEqual([]);
  });
});
