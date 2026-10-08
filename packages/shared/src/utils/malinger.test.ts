import { describe, it, expect } from "vitest";
import {
  TOM_MALETILSTAND,
  aktivMaling,
  harPaagaaende,
  startMaling,
  leggTilPunkt,
  settFerdig,
  flyttPunkt,
  velgMaling,
  slettAktiv,
  slettAlle,
  avsluttAktiv,
  finnNaermestePunkt,
  finnMalingTreff,
  type MaleTilstand,
} from "./malinger";

// Terskel-hjelpere som kallerne eier (web: px, mobil: prosent). I testen bruker
// vi en enkel prosent-nærhet (≤ 3,5) for å speile mobilens LUKK_TERSKEL_PCT.
const naer = (x: number, y: number) => (q: { x: number; y: number }) =>
  Math.hypot(q.x - x, q.y - y) <= 3.5;

describe("malinger — flere målinger, aktiv, slett (RETUR 2)", () => {
  it("start + to linjalpunkter → ferdig; ny start beholder forrige", () => {
    let t: MaleTilstand = startMaling(TOM_MALETILSTAND, "linjal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 30, y: 30 }, naer(30, 30));
    expect(aktivMaling(t)?.ferdig).toBe(true);
    expect(aktivMaling(t)?.punkter).toHaveLength(2);

    // Ny linjal → forrige blir stående, ny er aktiv og tom.
    t = startMaling(t, "linjal", "b");
    expect(t.malinger).toHaveLength(2);
    expect(t.aktivId).toBe("b");
    expect(aktivMaling(t)?.punkter).toHaveLength(0);
  });

  it("areal: lukkes ved trykk nær første punkt, ellers legges punkt til", () => {
    let t = startMaling(TOM_MALETILSTAND, "areal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 40, y: 10 }, naer(40, 10));
    t = leggTilPunkt(t, { x: 40, y: 40 }, naer(40, 40));
    expect(aktivMaling(t)?.punkter).toHaveLength(3);
    expect(aktivMaling(t)?.ferdig).toBe(false);
    // Trykk nær første punkt → lukk.
    t = leggTilPunkt(t, { x: 11, y: 11 }, naer(11, 11));
    expect(aktivMaling(t)?.ferdig).toBe(true);
    expect(aktivMaling(t)?.punkter).toHaveLength(3);
  });

  it("🔴 bom-trykk sletter ALDRI en ferdig figur", () => {
    let t = startMaling(TOM_MALETILSTAND, "linjal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 30, y: 30 }, naer(30, 30));
    const foer = aktivMaling(t)!.punkter;
    // Et nytt trykk når målingen er ferdig gjør INGENTING med figuren.
    const etter = leggTilPunkt(t, { x: 80, y: 80 }, naer(80, 80));
    expect(etter).toBe(t); // uendret referanse
    expect(aktivMaling(etter)!.punkter).toEqual(foer);
  });

  it("flyttPunkt justerer ALLE punkter uten å røre ferdig", () => {
    let t = startMaling(TOM_MALETILSTAND, "areal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 40, y: 10 }, naer(40, 10));
    t = leggTilPunkt(t, { x: 40, y: 40 }, naer(40, 40));
    t = settFerdig(t);
    expect(aktivMaling(t)?.ferdig).toBe(true);
    // Flytt FØRSTE punkt (ikke bare siste).
    t = flyttPunkt(t, 0, { x: 5, y: 5 });
    expect(aktivMaling(t)?.punkter[0]).toEqual({ x: 5, y: 5 });
    expect(aktivMaling(t)?.ferdig).toBe(true);
    // Ugyldig indeks → uendret.
    expect(flyttPunkt(t, 9, { x: 0, y: 0 })).toBe(t);
  });

  it("velg + slett aktiv + slett alle", () => {
    let t = startMaling(TOM_MALETILSTAND, "linjal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 30, y: 30 }, naer(30, 30));
    t = startMaling(t, "areal", "b");
    t = leggTilPunkt(t, { x: 50, y: 50 }, naer(50, 50));
    t = leggTilPunkt(t, { x: 60, y: 50 }, naer(60, 50));
    t = leggTilPunkt(t, { x: 60, y: 60 }, naer(60, 60));
    expect(t.malinger).toHaveLength(2);

    // Velg den første igjen.
    t = velgMaling(t, "a");
    expect(t.aktivId).toBe("a");
    expect(velgMaling(t, "finnesikke")).toBe(t);

    // Slett aktiv → kun "b" igjen, ingen aktiv.
    t = slettAktiv(t);
    expect(t.malinger.map((m) => m.id)).toEqual(["b"]);
    expect(t.aktivId).toBeNull();
    expect(slettAktiv(t)).toBe(t); // ingen aktiv → uendret

    // Slett alle.
    t = slettAlle();
    expect(t.malinger).toHaveLength(0);
  });

  it("startMaling forkaster en abandonert, for-kort påbegynt måling", () => {
    let t = startMaling(TOM_MALETILSTAND, "areal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10)); // kun 1 punkt
    t = startMaling(t, "linjal", "b");
    // "a" var for kort (areal krever 3) → forkastet.
    expect(t.malinger.map((m) => m.id)).toEqual(["b"]);
  });

  it("avsluttAktiv beholder ferdige, forkaster kort påbegynt, nullstiller valg", () => {
    let t = startMaling(TOM_MALETILSTAND, "linjal", "a");
    t = leggTilPunkt(t, { x: 10, y: 10 }, naer(10, 10));
    t = leggTilPunkt(t, { x: 30, y: 30 }, naer(30, 30)); // ferdig
    t = startMaling(t, "polylinje", "b");
    t = leggTilPunkt(t, { x: 50, y: 50 }, naer(50, 50)); // kun 1 punkt (for kort)
    t = avsluttAktiv(t);
    expect(t.aktivId).toBeNull();
    expect(t.malinger.map((m) => m.id)).toEqual(["a"]);
    expect(harPaagaaende(t)).toBe(false);
  });
});

describe("malinger — hit-test", () => {
  // Bilde vist 100×100 px → prosent == px (enkelt å resonnere om).
  const W = 100;
  const H = 100;

  it("finnNaermestePunkt treffer ALLE punkter, ikke bare det siste", () => {
    const punkter = [
      { x: 10, y: 10 },
      { x: 50, y: 50 },
      { x: 90, y: 90 },
    ];
    expect(finnNaermestePunkt(punkter, { x: 10, y: 11 }, W, H, 5)).toBe(0);
    expect(finnNaermestePunkt(punkter, { x: 51, y: 49 }, W, H, 5)).toBe(1);
    expect(finnNaermestePunkt(punkter, { x: 90, y: 90 }, W, H, 5)).toBe(2);
    // Utenfor toleranse → ingen.
    expect(finnNaermestePunkt(punkter, { x: 30, y: 30 }, W, H, 5)).toBe(-1);
  });

  it("finnMalingTreff treffer punkt, kant og inni areal — ellers null", () => {
    const malinger = [
      { id: "linje", verktoy: "linjal" as const, punkter: [{ x: 10, y: 10 }, { x: 10, y: 60 }], ferdig: true },
      {
        id: "flate",
        verktoy: "areal" as const,
        punkter: [{ x: 40, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 80 }, { x: 40, y: 80 }],
        ferdig: true,
      },
    ];
    // Punkt på linja.
    expect(finnMalingTreff(malinger, { x: 10, y: 10 }, W, H, 4)).toBe("linje");
    // Midt på linjas kant.
    expect(finnMalingTreff(malinger, { x: 11, y: 35 }, W, H, 4)).toBe("linje");
    // Inni flaten.
    expect(finnMalingTreff(malinger, { x: 60, y: 60 }, W, H, 4)).toBe("flate");
    // Tomt område.
    expect(finnMalingTreff(malinger, { x: 95, y: 20 }, W, H, 4)).toBeNull();
  });

  it("en åpen (ikke ferdig) areal-figur treffer ikke på innsiden", () => {
    const malinger = [
      {
        id: "flate",
        verktoy: "areal" as const,
        punkter: [{ x: 40, y: 40 }, { x: 80, y: 40 }, { x: 80, y: 80 }, { x: 40, y: 80 }],
        ferdig: false,
      },
    ];
    expect(finnMalingTreff(malinger, { x: 60, y: 60 }, W, H, 4)).toBeNull();
    // Men en kant treffer fortsatt.
    expect(finnMalingTreff(malinger, { x: 60, y: 40 }, W, H, 4)).toBe("flate");
  });
});
