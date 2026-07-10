import { describe, it, expect } from "vitest";
import {
  tilErEtterFra,
  tidsromOverlapper,
  finnOverlappendeTidsrom,
  finnTidsromKonflikt,
} from "./tidsromValidering";

describe("tilErEtterFra", () => {
  it("til etter fra = gyldig", () => {
    expect(tilErEtterFra("08:00", "12:00")).toBe(true);
  });
  it("til lik fra = ugyldig", () => {
    expect(tilErEtterFra("08:00", "08:00")).toBe(false);
  });
  it("til før fra = ugyldig", () => {
    expect(tilErEtterFra("12:00", "08:00")).toBe(false);
  });
  it("mangler en tid = ingen validering (gyldig)", () => {
    expect(tilErEtterFra(null, "12:00")).toBe(true);
    expect(tilErEtterFra("08:00", null)).toBe(true);
    expect(tilErEtterFra(undefined, undefined)).toBe(true);
  });
});

describe("tidsromOverlapper", () => {
  it("ekte overlapp", () => {
    expect(tidsromOverlapper("08:00", "12:00", "11:00", "13:00")).toBe(true);
  });
  it("berøring i endepunkt teller ikke", () => {
    expect(tidsromOverlapper("08:00", "12:00", "12:00", "14:00")).toBe(false);
    expect(tidsromOverlapper("12:00", "14:00", "08:00", "12:00")).toBe(false);
  });
  it("helt adskilt = ingen overlapp", () => {
    expect(tidsromOverlapper("08:00", "10:00", "12:00", "14:00")).toBe(false);
  });
  it("innkapslet rad overlapper", () => {
    expect(tidsromOverlapper("08:00", "16:00", "11:00", "12:00")).toBe(true);
  });
});

describe("finnOverlappendeTidsrom", () => {
  const andre = [
    { fraTid: "08:00", tilTid: "10:00" },
    { fraTid: "12:00", tilTid: "14:00" },
  ];
  it("finner overlappende rad", () => {
    expect(finnOverlappendeTidsrom("13:00", "15:00", andre)).toEqual({
      fraTid: "12:00",
      tilTid: "14:00",
    });
  });
  it("berøring i endepunkt = ingen treff", () => {
    expect(finnOverlappendeTidsrom("10:00", "12:00", andre)).toBeNull();
  });
  it("hopper over rader uten begge tider", () => {
    // Null-tid-raden ville dekket 10:30–11:00 hvis den ikke ble hoppet over;
    // 10:30–11:00 ligger i gapet mellom de to gyldige radene (10:00 og 12:00).
    const medHull = [{ fraTid: "10:00", tilTid: null }, ...andre];
    expect(finnOverlappendeTidsrom("10:30", "11:00", medHull)).toBeNull();
  });
  it("null når egen tid mangler", () => {
    expect(finnOverlappendeTidsrom(null, "12:00", andre)).toBeNull();
  });
});

describe("finnTidsromKonflikt (batch-intern)", () => {
  it("gyldig sett = null", () => {
    expect(
      finnTidsromKonflikt([
        { fraTid: "08:00", tilTid: "10:00" },
        { fraTid: "10:00", tilTid: "12:00" },
        { fraTid: "13:00", tilTid: "15:00" },
      ]),
    ).toBeNull();
  });
  it("fanger fra_etter_til før overlapp", () => {
    const k = finnTidsromKonflikt([{ fraTid: "12:00", tilTid: "08:00" }]);
    expect(k?.type).toBe("fra_etter_til");
  });
  it("fanger overlapp innad i settet", () => {
    const k = finnTidsromKonflikt([
      { fraTid: "08:00", tilTid: "12:00" },
      { fraTid: "11:00", tilTid: "13:00" },
    ]);
    expect(k?.type).toBe("overlapp");
    if (k?.type === "overlapp") {
      expect(k.rad.fraTid).toBe("08:00");
      expect(k.annen.fraTid).toBe("11:00");
    }
  });
  it("rader uten tider blokkerer ikke", () => {
    expect(
      finnTidsromKonflikt([
        { fraTid: null, tilTid: null },
        { fraTid: "08:00", tilTid: "12:00" },
        { fraTid: undefined, tilTid: undefined },
      ]),
    ).toBeNull();
  });

  // SYNC-2 gate-krav (relé 2026-07-10):
  it("SYNC-2: batch-intern overlapp 08:00–12:00 + 11:00–15:00 avvises", () => {
    const k = finnTidsromKonflikt([
      { fraTid: "08:00", tilTid: "12:00" },
      { fraTid: "11:00", tilTid: "15:00" },
    ]);
    expect(k?.type).toBe("overlapp");
  });
  it("SYNC-2: endepunkt-berøring 08:00–12:00 + 12:00–16:00 godtas", () => {
    expect(
      finnTidsromKonflikt([
        { fraTid: "08:00", tilTid: "12:00" },
        { fraTid: "12:00", tilTid: "16:00" },
      ]),
    ).toBeNull();
  });
});
