import { describe, it, expect } from "vitest";
import {
  radMatcherFilter,
  filtrerRader,
  matcherFristFilter,
  type TabellFilterConfig,
} from "./tabellFilter";

interface Rad {
  id: string;
  emne: string | null;
  byggeplass: string | null;
  dueDate: string | null;
  ferdig: boolean;
  felt: Record<string, string>;
}

const config: TabellFilterConfig<Rad> = {
  hentVerdi: (rad, kolId) => {
    switch (kolId) {
      case "emne":
        return rad.emne ?? "";
      case "bygning":
        return rad.byggeplass ?? "";
      default:
        return undefined; // ukjent kolonne
    }
  },
  hentFeltVerdi: (rad, objektId) => rad.felt[objektId] ?? "",
  hentFrist: (rad) => ({ dueDate: rad.dueDate, ferdig: rad.ferdig }),
};

function lagRad(over: Partial<Rad> = {}): Rad {
  return {
    id: "1",
    emne: "Befaring",
    byggeplass: "Lakselv",
    dueDate: null,
    ferdig: false,
    felt: {},
    ...over,
  };
}

describe("radMatcherFilter", () => {
  it("tomt filter matcher alt", () => {
    expect(radMatcherFilter(lagRad(), {}, config)).toBe(true);
  });

  it("tom filterverdi ignoreres", () => {
    expect(radMatcherFilter(lagRad(), { emne: "" }, config)).toBe(true);
  });

  it("enkel likhet matcher og avviser", () => {
    expect(radMatcherFilter(lagRad(), { emne: "Befaring" }, config)).toBe(true);
    expect(radMatcherFilter(lagRad(), { emne: "RUH" }, config)).toBe(false);
  });

  it("multi-verdi (komma) matcher hvis én treffer", () => {
    expect(radMatcherFilter(lagRad(), { emne: "RUH,Befaring" }, config)).toBe(true);
    expect(radMatcherFilter(lagRad(), { emne: "RUH,SJA" }, config)).toBe(false);
  });

  it("flere kolonner er OG (alle må matche)", () => {
    expect(
      radMatcherFilter(lagRad(), { emne: "Befaring", bygning: "Lakselv" }, config),
    ).toBe(true);
    expect(
      radMatcherFilter(lagRad(), { emne: "Befaring", bygning: "Lavangen" }, config),
    ).toBe(false);
  });

  it("tom rad-verdi matcher eksplisitt tom-filter (prosjekt-dokument)", () => {
    expect(radMatcherFilter(lagRad({ byggeplass: null }), { bygning: "" }, config)).toBe(true);
    // "" i split-settet
    const rad = lagRad({ byggeplass: null });
    expect(radMatcherFilter(rad, { bygning: "Lakselv," }, config)).toBe(true);
  });

  it("ukjent kolonne ignoreres (ingen filtrering)", () => {
    expect(radMatcherFilter(lagRad(), { finnesikke: "xyz" }, config)).toBe(true);
  });

  it("dynamiske mal-felt (felt:<id>)", () => {
    const rad = lagRad({ felt: { obj1: "Grønn" } });
    expect(radMatcherFilter(rad, { "felt:obj1": "Grønn" }, config)).toBe(true);
    expect(radMatcherFilter(rad, { "felt:obj1": "Rød" }, config)).toBe(false);
  });

  it("felt:-kolonne uten hentFeltVerdi ignoreres", () => {
    const utenFelt: TabellFilterConfig<Rad> = { hentVerdi: config.hentVerdi };
    expect(radMatcherFilter(lagRad(), { "felt:obj1": "Grønn" }, utenFelt)).toBe(true);
  });
});

describe("matcherFristFilter / frist-kolonne", () => {
  const iGaar = "2000-01-01T00:00:00.000Z";
  const langtFrem = "2999-01-01T00:00:00.000Z";

  it("forfalt: kun frister i fortiden som ikke er ferdige", () => {
    expect(
      radMatcherFilter(lagRad({ dueDate: iGaar }), { frist: "forfalt" }, config),
    ).toBe(true);
    expect(
      radMatcherFilter(lagRad({ dueDate: langtFrem }), { frist: "forfalt" }, config),
    ).toBe(false);
    // ferdig dokument er aldri forfalt
    expect(
      radMatcherFilter(lagRad({ dueDate: iGaar, ferdig: true }), { frist: "forfalt" }, config),
    ).toBe(false);
  });

  it("har_frist / ingen_frist", () => {
    expect(radMatcherFilter(lagRad({ dueDate: langtFrem }), { frist: "har_frist" }, config)).toBe(true);
    expect(radMatcherFilter(lagRad({ dueDate: null }), { frist: "har_frist" }, config)).toBe(false);
    expect(radMatcherFilter(lagRad({ dueDate: null }), { frist: "ingen_frist" }, config)).toBe(true);
    expect(radMatcherFilter(lagRad({ dueDate: langtFrem }), { frist: "ingen_frist" }, config)).toBe(false);
  });

  it("har_frist + ingen_frist samtidig = alt", () => {
    expect(
      radMatcherFilter(lagRad({ dueDate: null }), { frist: "har_frist,ingen_frist" }, config),
    ).toBe(true);
    expect(
      radMatcherFilter(lagRad({ dueDate: langtFrem }), { frist: "har_frist,ingen_frist" }, config),
    ).toBe(true);
  });

  it("frist uten hentFrist-config ignoreres", () => {
    const utenFrist: TabellFilterConfig<Rad> = { hentVerdi: config.hentVerdi };
    expect(radMatcherFilter(lagRad({ dueDate: null }), { frist: "har_frist" }, utenFrist)).toBe(true);
  });

  it("matcherFristFilter direkte", () => {
    expect(matcherFristFilter({ dueDate: iGaar, ferdig: false }, new Set(["forfalt"]))).toBe(true);
    expect(matcherFristFilter({ dueDate: null, ferdig: false }, new Set())).toBe(true);
  });
});

describe("filtrerRader", () => {
  it("filtrerer en liste og bevarer rekkefølge", () => {
    const rader = [
      lagRad({ id: "a", emne: "Befaring" }),
      lagRad({ id: "b", emne: "RUH" }),
      lagRad({ id: "c", emne: "Befaring" }),
    ];
    expect(filtrerRader(rader, { emne: "Befaring" }, config).map((r) => r.id)).toEqual([
      "a",
      "c",
    ]);
  });
});
