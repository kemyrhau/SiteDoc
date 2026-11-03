import { describe, it, expect } from "vitest";
import type { TFunction } from "i18next";
import { UTEN_EMNE } from "./dokumentlisteFilter";
import { byggAktiveChips, PERIODE_CHIP } from "./filterEtikett";

/**
 * Filter-mobil RETUR (R2, 2026-11-03): chip-raden over sjekkliste-, oppgave- og
 * innbokslista bygges ett sted. Sentinel-verdier (UTEN_EMNE) skal aldri vises rått —
 * innboksens egne chips viste «__uten_emne__» før.
 */
const t = ((k: string) => `t:${k}`) as unknown as TFunction;

describe("byggAktiveChips", () => {
  it("«Uten emne» får oversatt etikett, aldri sentinelen", () => {
    const chips = byggAktiveChips({ emne: `${UTEN_EMNE},Bad` }, undefined, t);
    expect(chips.map((c) => c.label)).toEqual(["t:dokumentsok.utenEmne", "Bad"]);
    for (const c of chips) expect(c.label).not.toContain("__");
  });

  it("frist, prioritet og ballen oversettes; periode blir egen chip", () => {
    const chips = byggAktiveChips(
      { frist: "forfalt", prioritet: "high", ballen: "1" },
      { hurtigvalg: "uke", fra: null, til: null },
      t,
    );
    const etiketter = Object.fromEntries(chips.map((c) => [c.kolId, c.label]));
    expect(etiketter.frist).toBe("t:dokumentsok.fristForfalt");
    expect(etiketter.prioritet).toBe("t:prioritet.hoey");
    expect(etiketter.ballen).toBe("t:dokumentsok.ballenHosMeg");
    expect(etiketter[PERIODE_CHIP]).toMatch(/^t:tabell\.opprettet: t:/);
  });

  it("periode «alle» gir ingen chip", () => {
    expect(byggAktiveChips({}, { hurtigvalg: "alle", fra: null, til: null }, t)).toEqual([]);
  });
});
