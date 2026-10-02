import { describe, it, expect } from "vitest";
import {
  avstandM,
  gjenkjennSted,
  tolkStart,
  tolkSlutt,
  velgDestinasjon,
  RADIUS_GRENSER,
  type Geofence,
} from "./sted";

/**
 * Stedsmodellen (LAG 1-A). Gate-kriteriene fra ordren:
 *  1. A1 Narvik–Tromsø ±0,5 %.
 *  2. A2 innenfor · utenfor · to overlappende (nærmeste vinner) · uten radius avvist.
 *  3. A3 alle fire utfall + kontor-og-byggeplass → kontor + pos==null → ukjent (rød først).
 *  4. A5 primærbyggeplass velges IKKE når to byggeplasser har punkt (rød først).
 */

// Oppmøtested-geofence med id.
function oppm(id: string, lat: number, lng: number, radiusM = 150) {
  return { id, lat, lng, radiusM };
}
function bygg(id: string, lat: number, lng: number, radiusM = 150) {
  return { id, lat, lng, radiusM };
}

describe("A1 avstandM — haversine i meter", () => {
  it("Narvik–Tromsø innenfor ±0,5 % av kjent luftlinje (~147,66 km)", () => {
    const m = avstandM(
      { lat: 68.4385, lng: 17.4272 },
      { lat: 69.6489, lng: 18.9551 },
    );
    const fasit = 147_660;
    expect(Math.abs(m - fasit) / fasit).toBeLessThanOrEqual(0.005);
  });

  it("1° breddegrad ved ekvator ≈ 111,19 km (ikke-sirkulær referanse)", () => {
    const m = avstandM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(m).toBeGreaterThan(111_000);
    expect(m).toBeLessThan(111_400);
  });

  it("samme punkt → 0 m", () => {
    expect(avstandM({ lat: 59.9, lng: 10.7 }, { lat: 59.9, lng: 10.7 })).toBe(0);
  });

  it("returnerer heltall", () => {
    const m = avstandM({ lat: 59.9, lng: 10.7 }, { lat: 59.91, lng: 10.72 });
    expect(Number.isInteger(m)).toBe(true);
  });
});

describe("A2 gjenkjennSted", () => {
  const pos = { lat: 59.9, lng: 10.75 };

  it("innenfor radius → treff med målt avstand", () => {
    const treff = gjenkjennSted(pos, [bygg("b1", 59.9001, 10.7501, 150)]);
    expect(treff?.sted.id).toBe("b1");
    expect(treff?.avstandM).toBeGreaterThanOrEqual(0);
  });

  it("utenfor radius → null", () => {
    // ~7 km unna, radius 150 m.
    const treff = gjenkjennSted(pos, [bygg("b1", 59.96, 10.75, 150)]);
    expect(treff).toBeNull();
  });

  it("to overlappende → nærmeste vinner", () => {
    const naer = bygg("naer", 59.9001, 10.7501, 5000);
    const fjern = bygg("fjern", 59.92, 10.77, 5000);
    const treff = gjenkjennSted(pos, [fjern, naer]);
    expect(treff?.sted.id).toBe("naer");
  });

  it("pos == null → null", () => {
    expect(gjenkjennSted(null, [bygg("b1", 59.9, 10.75, 150)])).toBeNull();
  });

  it("kandidatlista er kallerens ansvar — tom liste → null", () => {
    const kandidater: Geofence[] = [];
    expect(gjenkjennSted(pos, kandidater)).toBeNull();
  });
});

describe("A3 tolkStart / A4 tolkSlutt", () => {
  const pos = { lat: 59.9, lng: 10.75 };
  const kontorHer = oppm("k1", 59.9, 10.75, 200);
  const byggHer = bygg("b1", 59.9, 10.75, 200);
  const langtUnna = { lat: 59.99, lng: 10.9 };

  it("kun oppmøtested treffer → kontor", () => {
    const r = tolkStart(pos, [kontorHer], []);
    expect(r).toEqual({ type: "kontor", oppmotestedId: "k1", byggeplassId: null });
  });

  it("kun byggeplass treffer → byggeplass", () => {
    const r = tolkStart(pos, [], [byggHer]);
    expect(r).toEqual({ type: "byggeplass", byggeplassId: "b1" });
  });

  it("ingen treffer → utenfor", () => {
    const r = tolkStart(pos, [oppm("k1", 59.99, 10.9, 150)], [bygg("b1", 59.99, 10.9, 150)]);
    expect(r).toEqual({ type: "utenfor" });
  });

  it("kontor OG byggeplass treffer → kontor vinner (V15), bærer byggeplass-id", () => {
    const r = tolkStart(pos, [kontorHer], [byggHer]);
    expect(r).toEqual({
      type: "kontor",
      oppmotestedId: "k1",
      byggeplassId: "b1",
    });
  });

  it("🔴 pos == null → ukjent, ALDRI utenfor (H11)", () => {
    const r = tolkStart(null, [kontorHer], [byggHer]);
    expect(r).toEqual({ type: "ukjent", aarsak: "posisjon_utilgjengelig" });
    expect(r.type).not.toBe("utenfor");
  });

  it("tolkSlutt deler union og logikk med tolkStart", () => {
    expect(tolkSlutt(pos, [kontorHer], [])).toEqual({
      type: "kontor",
      oppmotestedId: "k1",
      byggeplassId: null,
    });
    expect(tolkSlutt(langtUnna, [kontorHer], [])).toEqual({ type: "utenfor" });
    expect(tolkSlutt(null, [], [])).toEqual({
      type: "ukjent",
      aarsak: "posisjon_utilgjengelig",
    });
  });
});

describe("A5 velgDestinasjon", () => {
  it("(1) sluttsted er byggeplass → den", () => {
    const d = velgDestinasjon({
      sluttsted: { type: "byggeplass", byggeplassId: "slutt-b" },
      kontekstByggeplassId: "kontekst-b",
      prosjektByggeplasser: [{ id: "p-b", harPunkt: true }],
    });
    expect(d).toEqual({ type: "byggeplass", byggeplassId: "slutt-b" });
  });

  it("(2) kontekstbyggeplass når sluttsted ikke er byggeplass", () => {
    const d = velgDestinasjon({
      sluttsted: { type: "kontor", oppmotestedId: "k1", byggeplassId: null },
      kontekstByggeplassId: "kontekst-b",
      prosjektByggeplasser: [
        { id: "a", harPunkt: true },
        { id: "b", harPunkt: true },
      ],
    });
    expect(d).toEqual({ type: "byggeplass", byggeplassId: "kontekst-b" });
  });

  it("(3) nøyaktig én byggeplass med punkt → den", () => {
    const d = velgDestinasjon({
      sluttsted: { type: "utenfor" },
      kontekstByggeplassId: null,
      prosjektByggeplasser: [
        { id: "a", harPunkt: true },
        { id: "b", harPunkt: false },
      ],
    });
    expect(d).toEqual({ type: "byggeplass", byggeplassId: "a" });
  });

  it("🔴 to byggeplasser med punkt → ukjent/flere_byggeplasser, ALDRI primær (rød først)", () => {
    const d = velgDestinasjon({
      sluttsted: { type: "utenfor" },
      kontekstByggeplassId: null,
      prosjektByggeplasser: [
        { id: "a", harPunkt: true },
        { id: "b", harPunkt: true },
      ],
    });
    expect(d).toEqual({ type: "ukjent", aarsak: "flere_byggeplasser" });
  });

  it("(4) ingen byggeplass med punkt → ukjent/ingen_byggeplass_med_punkt", () => {
    const d = velgDestinasjon({
      sluttsted: { type: "utenfor" },
      kontekstByggeplassId: null,
      prosjektByggeplasser: [{ id: "a", harPunkt: false }],
    });
    expect(d).toEqual({ type: "ukjent", aarsak: "ingen_byggeplass_med_punkt" });
  });
});

describe("A6 RADIUS_GRENSER — navngitt, uendret kilde", () => {
  it("speiler koden (oppmøtested 10–5000 · byggeplass-API 1–100000 · modal 25–500)", () => {
    expect(RADIUS_GRENSER.oppmotested).toEqual({ min: 10, max: 5000 });
    expect(RADIUS_GRENSER.byggeplassApi).toEqual({ min: 1, max: 100_000 });
    expect(RADIUS_GRENSER.modal).toEqual({ min: 25, max: 500 });
  });
});
