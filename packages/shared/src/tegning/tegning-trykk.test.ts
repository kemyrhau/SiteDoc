import { describe, it, expect } from "vitest";
import {
  avgjorTrykkHandling,
  visLupeForGest,
  erMaleVerktoy,
  LANGT_TRYKK_MS,
  LANGT_TRYKK_PUNKT_MS,
  type TegningVerktoy,
  type TrykkGest,
} from "./tegning-trykk";

const gest = (o: Partial<TrykkGest> = {}): TrykkGest => ({
  varighetMs: 120,
  flyttet: false,
  antallPekere: 1,
  ...o,
});

describe("avgjorTrykkHandling — eksplisitte verktøy (RETUR 3)", () => {
  it("🔴 et trykk i Flytt setter ALDRI punkt", () => {
    const verktoy: TegningVerktoy = "flytt";
    // Rent trykk på tom flate → pan, aldri settPunkt.
    expect(avgjorTrykkHandling(verktoy, gest())).toBe("pan");
    // Lang/kort, med/uten bevegelse → aldri settPunkt.
    for (const g of [
      gest({ varighetMs: 900 }),
      gest({ flyttet: true }),
      gest({ varighetMs: 50 }),
    ]) {
      expect(avgjorTrykkHandling(verktoy, g)).not.toBe("settPunkt");
    }
  });

  it("Flytt: kort trykk på punkt → velgMaling (markerer, flytter IKKE — POST 2026-10-18 pkt 3)", () => {
    // Under LANGT_TRYKK_PUNKT_MS og ingen bevegelse: velg målingen, ikke drag.
    expect(avgjorTrykkHandling("flytt", gest({ nedPaaPunkt: true, varighetMs: LANGT_TRYKK_PUNKT_MS - 1 }))).toBe(
      "velgMaling",
    );
    // Bevegelse (selv kort trykk) → likevel en reell drag.
    expect(avgjorTrykkHandling("flytt", gest({ nedPaaPunkt: true, flyttet: true, varighetMs: 50 }))).toBe(
      "draPunkt",
    );
    // På et SEGMENT (ikke et punkt) → velgMaling, uansett bevegelse (pan er deaktivert
    // for hele gesten når et segment er truffet — se kalleren).
    expect(avgjorTrykkHandling("flytt", gest({ traffMaling: true }))).toBe("velgMaling");
    expect(avgjorTrykkHandling("flytt", gest({ traffMaling: true, flyttet: true }))).toBe("velgMaling");
    // Bom (ingen punkt, ingen måling) → pan.
    expect(avgjorTrykkHandling("flytt", gest())).toBe("pan");
  });

  it("Flytt: langt trykk (≥LANGT_TRYKK_PUNKT_MS) på et punkt committer en drag", () => {
    expect(avgjorTrykkHandling("flytt", gest({ nedPaaPunkt: true, varighetMs: LANGT_TRYKK_PUNKT_MS }))).toBe(
      "draPunkt",
    );
    expect(avgjorTrykkHandling("flytt", gest({ nedPaaPunkt: true, varighetMs: 2000 }))).toBe("draPunkt");
    // Langt OG dratt → fortsatt drag (ingen endring).
    expect(avgjorTrykkHandling("flytt", gest({ nedPaaPunkt: true, varighetMs: 900, flyttet: true }))).toBe(
      "draPunkt",
    );
  });

  it("🔴 et trykk i måleverktøy DRAR aldri (og velger aldri) — setter punkt", () => {
    for (const v of ["linjal", "polylinje", "areal"] as const) {
      // Selv om nedtrykket tilfeldigvis traff et punkt/måling: måleverktøy setter punkt.
      expect(avgjorTrykkHandling(v, gest({ nedPaaPunkt: true }))).toBe("settPunkt");
      expect(avgjorTrykkHandling(v, gest({ traffMaling: true }))).toBe("settPunkt");
      expect(avgjorTrykkHandling(v, gest({ flyttet: true }))).toBe("settPunkt");
      expect(avgjorTrykkHandling(v, gest({ varighetMs: 900 }))).toBe("settPunkt");
    }
  });

  it("knip (≥2 pekere) → pan i alle verktøy (aldri commit)", () => {
    for (const v of ["navigering", "flytt", "linjal", "polylinje", "areal", "opprett"] as const) {
      expect(avgjorTrykkHandling(v, gest({ antallPekere: 2 }))).toBe("pan");
      expect(avgjorTrykkHandling(v, gest({ antallPekere: 2, nedPaaPunkt: true }))).toBe("pan");
    }
  });

  it("Opprett: rent trykk → opprett; bevegelse → pan", () => {
    expect(avgjorTrykkHandling("opprett", gest())).toBe("opprett");
    expect(avgjorTrykkHandling("opprett", gest({ varighetMs: 900 }))).toBe("opprett");
    expect(avgjorTrykkHandling("opprett", gest({ flyttet: true }))).toBe("pan");
  });

  it("Navigering: kort → hint, langt → opprett, bevegelse → pan", () => {
    expect(avgjorTrykkHandling("navigering", gest({ varighetMs: 120 }))).toBe("hint");
    expect(avgjorTrykkHandling("navigering", gest({ varighetMs: LANGT_TRYKK_MS - 1 }))).toBe("hint");
    expect(avgjorTrykkHandling("navigering", gest({ varighetMs: LANGT_TRYKK_MS }))).toBe("opprett");
    expect(avgjorTrykkHandling("navigering", gest({ flyttet: true }))).toBe("pan");
  });
});

describe("visLupeForGest — når lupa skal vises ved nedtrykk", () => {
  it("måleverktøy: alltid", () => {
    expect(visLupeForGest("linjal", false)).toBe(true);
    expect(visLupeForGest("polylinje", false)).toBe(true);
    expect(visLupeForGest("areal", false)).toBe(true);
  });
  it("Flytt: kun når nedtrykket traff et punkt", () => {
    expect(visLupeForGest("flytt", true)).toBe(true);
    expect(visLupeForGest("flytt", false)).toBe(false);
  });
  it("opprett/navigering: aldri", () => {
    expect(visLupeForGest("opprett", true)).toBe(false);
    expect(visLupeForGest("navigering", true)).toBe(false);
  });
});

describe("erMaleVerktoy", () => {
  it("skiller måleverktøy fra resten", () => {
    expect(erMaleVerktoy("linjal")).toBe(true);
    expect(erMaleVerktoy("polylinje")).toBe(true);
    expect(erMaleVerktoy("areal")).toBe(true);
    expect(erMaleVerktoy("flytt")).toBe(false);
    expect(erMaleVerktoy("opprett")).toBe(false);
    expect(erMaleVerktoy("navigering")).toBe(false);
  });
});
