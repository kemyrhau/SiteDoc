import { describe, it, expect } from "vitest";
import {
  byggUtsnitt,
  posisjonsEtikett,
  finnOverlapp,
  delOppTermer,
  søkeTermer,
  ELLIPSE,
  HL_START,
  HL_STOP,
  type UtsnittDel,
} from "./utsnitt";

/**
 * Mobilsøk MVP (spec-sok-mobil rev. 2 § 7): utsnitt-/leser-logikken flyttes fra web til shared så web og mobil
 * viser samme utsnitt, samme «side N»/«avsnitt N» og samme overlapp-kutt. Webs egne tester (utsnitt.test.ts,
 * fulltekst-*.test.tsx) går fortsatt via re-eksporten — disse låser at selve modulen bor i shared.
 */

const tekstAv = (deler: UtsnittDel[]) => deler.map((d) => d.tekst).join("");
const treffAv = (deler: UtsnittDel[]) => deler.filter((d) => d.type === "treff").map((d) => d.tekst);

describe("byggUtsnitt (shared)", () => {
  it("headline: sentinlene blir treff-deler, «…» der headline er kuttet", () => {
    const chunkText = "Innledning. Komprimering av masser skal skje lagvis. Avslutning følger.";
    const deler = byggUtsnitt({
      chunkText,
      søkeord: "komprimering",
      utdrag: `${HL_START}Komprimering${HL_STOP} av masser skal skje lagvis.`,
    });
    expect(treffAv(deler)).toEqual(["Komprimering"]);
    expect(tekstAv(deler).startsWith(ELLIPSE)).toBe(true);
    expect(tekstAv(deler).endsWith(ELLIPSE)).toBe(true);
  });

  it("uten headline: vindu rundt første forekomst, søkeordet markert", () => {
    const fyll = Array.from({ length: 60 }, (_, i) => `ord${i}`).join(" ");
    const deler = byggUtsnitt({ chunkText: `${fyll} membran ${fyll}`, søkeord: "membran" });
    expect(treffAv(deler)).toEqual(["membran"]);
    expect(tekstAv(deler).startsWith(`${ELLIPSE} `)).toBe(true);
  });

  it("rent semantisk treff: setningen er egen del, ingen gul markering", () => {
    const deler = byggUtsnitt({
      chunkText: "Første setning. Fukt i betong måles før belegg. Siste setning.",
      søkeord: "fuktmåling",
      semantiskSetning: "Fukt i betong måles før belegg.",
      metode: "semantisk",
    });
    expect(deler.find((d) => d.type === "semantisk")?.tekst).toBe("Fukt i betong måles før belegg.");
    expect(treffAv(deler)).toEqual([]);
  });

  it("sectionTitle fjernes fra starten av utsnittet", () => {
    const deler = byggUtsnitt({ chunkText: "Grunnarbeid: Graving skjer etter plan.", søkeord: "graving", sectionTitle: "Grunnarbeid" });
    expect(tekstAv(deler)).toBe("Graving skjer etter plan.");
  });
});

describe("posisjonsEtikett (shared)", () => {
  it("side når sidetall finnes, ellers avsnitt (1-basert), ellers null", () => {
    expect(posisjonsEtikett(4, 7)).toEqual({ type: "side", nr: 4 });
    expect(posisjonsEtikett(null, 0)).toEqual({ type: "avsnitt", nr: 1 });
    expect(posisjonsEtikett(0, 2)).toEqual({ type: "avsnitt", nr: 3 });
    expect(posisjonsEtikett(null, null)).toBeNull();
  });
});

describe("finnOverlapp (shared)", () => {
  it("finner overlapp mellom halen av a og starten av b (minst 20 tegn)", () => {
    const felles = "x".repeat(10) + "felles overlapp-tekst her";
    expect(finnOverlapp(`start ${felles}`, `${felles} slutt`)).toBe(felles.length);
  });

  it("under 20 tegn eller ingen felles tekst gir 0", () => {
    expect(finnOverlapp("abc kort", "kort def")).toBe(0);
    expect(finnOverlapp("helt annen tekst som ikke matcher", "noe helt annet i starten her")).toBe(0);
  });
});

describe("delOppTermer (shared)", () => {
  it("markerer termer > 2 tegn uavhengig av store/små bokstaver", () => {
    const deler = delOppTermer("Membran og MEMBRAN på tak", "membran på");
    expect(deler.filter((d) => d.erMatch).map((d) => d.tekst)).toEqual(["Membran", "MEMBRAN"]);
    expect(deler.map((d) => d.tekst).join("")).toBe("Membran og MEMBRAN på tak");
  });

  it("uten søkeord: én umarkert del", () => {
    expect(delOppTermer("tekst", undefined)).toEqual([{ tekst: "tekst", erMatch: false }]);
  });

  it("søkeTermer og delOppTermer tolker søkeordet likt", () => {
    expect(søkeTermer("Av Membran ok")).toEqual(["membran"]);
  });
});
