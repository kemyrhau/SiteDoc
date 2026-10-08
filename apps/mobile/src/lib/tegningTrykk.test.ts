import { describe, it, expect } from "vitest";
import { avgjorTrykkHandling, LANGT_TRYKK_MS } from "./tegningTrykk";

const tap = (varighetMs: number) => ({ varighetMs, flyttet: false, antallPekere: 1 });

describe("avgjorTrykkHandling — hva et trykk gjør", () => {
  it("navigering + kort trykk → hint (og BARE kort trykk gir hint)", () => {
    expect(avgjorTrykkHandling("navigering", tap(120))).toBe("hint");
    expect(avgjorTrykkHandling("navigering", tap(LANGT_TRYKK_MS - 1))).toBe("hint");
  });

  it("navigering + langt trykk → opprett", () => {
    expect(avgjorTrykkHandling("navigering", tap(LANGT_TRYKK_MS))).toBe("opprett");
    expect(avgjorTrykkHandling("navigering", tap(900))).toBe("opprett");
  });

  it("hint utløses IKKE ved pan (flyttet) eller knip (≥2 pekere)", () => {
    expect(avgjorTrykkHandling("navigering", { varighetMs: 120, flyttet: true, antallPekere: 1 })).toBe("ingen");
    expect(avgjorTrykkHandling("navigering", { varighetMs: 120, flyttet: false, antallPekere: 2 })).toBe("ingen");
  });

  it("hint utløses IKKE i plasserings- eller målemodus", () => {
    expect(avgjorTrykkHandling("plassering", tap(120))).toBe("opprett");
    expect(avgjorTrykkHandling("maling", tap(120))).toBe("malepunkt");
  });

  it("målemodus → hvert rent trykk er et målepunkt (uansett varighet)", () => {
    expect(avgjorTrykkHandling("maling", tap(120))).toBe("malepunkt");
    expect(avgjorTrykkHandling("maling", tap(900))).toBe("malepunkt");
    // men ikke ved pan/knip
    expect(avgjorTrykkHandling("maling", { varighetMs: 120, flyttet: true, antallPekere: 1 })).toBe("ingen");
  });

  it("plassering + langt trykk → opprett (uendret plasseringsflyt)", () => {
    expect(avgjorTrykkHandling("plassering", tap(900))).toBe("opprett");
  });

  it("dra av et målepunkt er aldri hint/opprett/nytt punkt (TILLEGG RETUR 1)", () => {
    // Kort, uten bevegelse, men merket som punktdrag → ingen handling.
    expect(avgjorTrykkHandling("maling", { varighetMs: 120, flyttet: false, antallPekere: 1, drarPunkt: true })).toBe("ingen");
    // Også i navigering (skal ikke bli langt trykk / hint).
    expect(avgjorTrykkHandling("navigering", { varighetMs: 700, flyttet: false, antallPekere: 1, drarPunkt: true })).toBe("ingen");
    expect(avgjorTrykkHandling("navigering", { varighetMs: 120, flyttet: false, antallPekere: 1, drarPunkt: true })).toBe("ingen");
  });
});
