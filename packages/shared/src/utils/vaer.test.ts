import { describe, it, expect } from "vitest";
import { vaerkodeTilTekst, finnVaerTimeIndeks, byggVaerSnapshot } from "./vaer";

describe("vaerkodeTilTekst", () => {
  it("kjente koder → norsk tekst", () => {
    expect(vaerkodeTilTekst(0)).toBe("Klart");
    expect(vaerkodeTilTekst(61)).toBe("Lett regn");
  });
  it("ukjent kode → «Ukjent»", () => {
    expect(vaerkodeTilTekst(999)).toBe("Ukjent");
  });
});

const TIMER = Array.from({ length: 24 }, (_, i) => `2026-08-14T${String(i).padStart(2, "0")}:00`);

describe("finnVaerTimeIndeks", () => {
  it("plukker timen nærmest klokkeslettet", () => {
    expect(finnVaerTimeIndeks(TIMER, "2026-08-14T07:12")).toBe(7);
    expect(finnVaerTimeIndeks(TIMER, "2026-08-14T07:31")).toBe(7); // nærmeste HEL time (avrunder ikke opp)
    expect(finnVaerTimeIndeks(TIMER, "2026-08-14T23:59")).toBe(23);
  });
  it("rent date-felt (uten klokkeslett) bruker kl. 12", () => {
    expect(finnVaerTimeIndeks(TIMER, "2026-08-14")).toBe(12);
  });
});

describe("byggVaerSnapshot", () => {
  const hourly = {
    time: TIMER,
    temperature_2m: TIMER.map((_, i) => i), // temp = time-indeks
    weather_code: TIMER.map(() => 61),
    wind_speed_10m: TIMER.map(() => 6),
    precipitation: TIMER.map(() => 0.5), // sum 12 mm
  };
  it("henter for timen nærmest tidspunktet + summerer nedbør for dagen", () => {
    const s = byggVaerSnapshot(hourly, "2026-08-14T07:12");
    expect(s.temp).toBe("7°C");
    expect(s.conditions).toBe("Lett regn");
    expect(s.wind).toBe("6 m/s");
    expect(s.precipitation).toBe("12 mm");
    expect(s.kilde).toBe("automatisk");
  });
});
