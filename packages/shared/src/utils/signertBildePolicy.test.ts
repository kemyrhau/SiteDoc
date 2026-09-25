import { describe, it, expect, vi, afterEach } from "vitest";
import {
  SIGNERT_BILDE_DEBOUNCE_MS,
  SIGNERT_BILDE_MAKS_FORSOK,
  lesExpFraUrl,
  erUtloptSignatur,
  lagInvalideringsDebounce,
} from "./signertBildePolicy";

/**
 * Delt gjenfornyelses-policy for SignertBilde (G2). De tre reglene som web og
 * mobil MÅ dele: 401-vs-404-skillet, debounce-koalesceringen og ett-gjenforsøk-taket.
 */

describe("lesExpFraUrl", () => {
  it("henter exp fra en signert URL", () => {
    expect(lesExpFraUrl("/uploads/a.jpg?exp=1700000000000&sig=abc")).toBe(1700000000000);
  });
  it("null uten query, uten exp, eller ved ikke-tall", () => {
    expect(lesExpFraUrl("/uploads/a.jpg")).toBeNull();
    expect(lesExpFraUrl("/uploads/a.jpg?sig=abc")).toBeNull();
    expect(lesExpFraUrl("/uploads/a.jpg?exp=ikketall&sig=abc")).toBeNull();
  });
});

describe("erUtloptSignatur — skill 401 (utløpt) fra 404 (slettet)", () => {
  const NAA = 1_700_000_000_000;

  it("UTLØPT signatur (exp i fortiden) → fornybar (true)", () => {
    const url = `/uploads/a.jpg?exp=${NAA - 1000}&sig=abc`;
    expect(erUtloptSignatur(url, NAA)).toBe(true);
  });

  it("🔴 GYLDIG signatur men feilet (exp i framtiden = 404/slettet) → IKKE fornybar (false)", () => {
    // Dette er DoS-vernet: en slettet fil har fersk signatur; et gjenforsøk gir
    // bare en ny 404. Skal ikke utløse fornyelse.
    const url = `/uploads/a.jpg?exp=${NAA + 15 * 60 * 1000}&sig=abc`;
    expect(erUtloptSignatur(url, NAA)).toBe(false);
  });

  it("RÅ /uploads/ uten signatur → fornybar (refetch vil signere)", () => {
    expect(erUtloptSignatur("/uploads/a.jpg", NAA)).toBe(true);
  });

  it("ikke en /uploads/-URL → false (ekstern/data/file hjelpes ikke av invalidering)", () => {
    expect(erUtloptSignatur("https://cdn/x.jpg", NAA)).toBe(false);
    expect(erUtloptSignatur("data:image/png;base64,AAAA", NAA)).toBe(false);
    expect(erUtloptSignatur("file:///lokal.jpg", NAA)).toBe(false);
  });

  it("klokkeavvik flipper ikke en fersk 404 til «utløpt»", () => {
    // Klient ligger 60 s bak serveren; en fersk-emittert 15-min-URL er fortsatt
    // godt i framtiden → leses korrekt som IKKE utløpt.
    const url = `/uploads/slettet.jpg?exp=${NAA + 15 * 60 * 1000}&sig=abc`;
    expect(erUtloptSignatur(url, NAA - 60_000)).toBe(false);
  });
});

describe("lagInvalideringsDebounce — femti feil = én invalidering", () => {
  afterEach(() => vi.useRealTimers());

  it("koalescerer mange kall i vinduet til ÉN utførelse", () => {
    vi.useFakeTimers();
    const spion = vi.fn();
    const trigger = lagInvalideringsDebounce(SIGNERT_BILDE_DEBOUNCE_MS);
    for (let i = 0; i < 50; i++) trigger(spion); // 50 bilder feiler «samtidig»
    expect(spion).not.toHaveBeenCalled(); // ikke fyrt før vinduet lukkes
    vi.advanceTimersByTime(SIGNERT_BILDE_DEBOUNCE_MS);
    expect(spion).toHaveBeenCalledTimes(1); // ÉN invalidering for hele bursten
  });

  it("et nytt kall ETTER at vinduet lukket starter et nytt vindu", () => {
    vi.useFakeTimers();
    const spion = vi.fn();
    const trigger = lagInvalideringsDebounce(100);
    trigger(spion);
    vi.advanceTimersByTime(100);
    expect(spion).toHaveBeenCalledTimes(1);
    trigger(spion); // ny burst
    vi.advanceTimersByTime(100);
    expect(spion).toHaveBeenCalledTimes(2);
  });
});

describe("gjenforsøks-tak", () => {
  it("🔴 maks ETT gjenforsøk (aldri løkke mot 401)", () => {
    expect(SIGNERT_BILDE_MAKS_FORSOK).toBe(1);
  });
});
