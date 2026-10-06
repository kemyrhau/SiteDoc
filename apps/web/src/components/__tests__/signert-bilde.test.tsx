// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * SignertBilde (G1/G2) — komponent-nivå bevis for selvfornyelsen. Den delte regelen
 * (debounce, 401-vs-404, ett-forsøk) er bevist rent i @sitedoc/shared
 * (signertBildePolicy.test.ts); her bevises at komponenten WIRER den riktig:
 *  - render legger /api-proxy-prefikset på
 *  - utløpt signatur (401) → debouncet invalidering (selvfornyelse)
 *  - gyldig signatur men feilet (404/slettet) → fallback, INGEN invalidering
 *  - maks ETT gjenforsøk pr. bilde (aldri løkke mot 401)
 */

const invalidate = vi.fn(() => Promise.resolve());
vi.mock("@/lib/trpc", () => ({
  trpc: { useUtils: () => ({ invalidate }) },
}));

import { SignertBilde, byggBildeSrc } from "../SignertBilde";

const NAA = 1_700_000_000_000;
const utloept = `/uploads/a.jpg?exp=${NAA - 1000}&sig=x`;
const gyldig = `/uploads/a.jpg?exp=${NAA + 900_000}&sig=x`;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NAA);
  invalidate.mockClear();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("byggBildeSrc", () => {
  it("legger /api på /uploads-stier, slipper eksterne/data igjennom", () => {
    expect(byggBildeSrc("/uploads/a.jpg?exp=1&sig=x")).toBe("/api/uploads/a.jpg?exp=1&sig=x");
    expect(byggBildeSrc("/api/uploads/a.jpg")).toBe("/api/uploads/a.jpg");
    expect(byggBildeSrc("https://cdn/x.jpg")).toBe("https://cdn/x.jpg");
    expect(byggBildeSrc("data:image/png;base64,AA")).toBe("data:image/png;base64,AA");
  });
});

describe("SignertBilde", () => {
  it("render legger /api-prefikset på", () => {
    render(<SignertBilde url={gyldig} alt="test" />);
    const img = screen.getByAltText("test") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(`/api${gyldig}`);
  });

  it("mangler url → fallback", () => {
    render(<SignertBilde url={null} fallback={<span>tomt</span>} />);
    expect(screen.getByText("tomt")).toBeTruthy();
  });

  it("UTLØPT signatur (401) → debouncet invalidering (selvfornyelse)", () => {
    render(<SignertBilde url={utloept} alt="b" />);
    fireEvent.error(screen.getByAltText("b"));
    expect(invalidate).not.toHaveBeenCalled(); // ikke før debounce-vinduet lukkes
    vi.advanceTimersByTime(600);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("🔴 KRAV(c)3: GYLDIG signatur men feilet (404/slettet) → fallback, 404 gjenforsøkes IKKE", () => {
    // Rød grunn: en slettet fil har fersk signatur; et gjenforsøk gir bare en ny 404.
    // Feiler hvis 404-skillet (erUtloptSignatur) forsvinner og 404 begynner å retries.
    render(<SignertBilde url={gyldig} alt="c" fallback={<span>borte</span>} />);
    fireEvent.error(screen.getByAltText("c"));
    vi.advanceTimersByTime(5000); // godt forbi enhver backoff+debounce
    expect(invalidate).not.toHaveBeenCalled(); // en fersk signatur hjelper ikke en slettet fil
    expect(screen.getByText("borte")).toBeTruthy();
  });

  it("🔴 KRAV(c)1: forsøk nummer TO gjøres — ett dekningsdropp ødelegger ikke bildet (var MAKS=1)", () => {
    // Rød grunn: med det gamle taket (1) ga bildet opp etter første feilede fornyelse.
    // Feiler hvis forsøk 2 ikke resulterer i en ny invalidering.
    render(<SignertBilde url={utloept} alt="e" fallback={<span>feil</span>} />);
    const img = screen.getByAltText("e");
    fireEvent.error(img); // forsøk 1 (backoff 0 → umiddelbar planlegging)
    vi.advanceTimersByTime(600); // debounce lukkes → invalidering #1
    expect(invalidate).toHaveBeenCalledTimes(1);
    fireEvent.error(img); // forsøk 2 (backoff 1000, url uendret i test → forsokRef består)
    vi.advanceTimersByTime(1000 + 600); // backoff + debounce
    expect(invalidate).toHaveBeenCalledTimes(2); // forsøk 2 FAKTISK gjort
    expect(screen.queryByText("feil")).toBeNull(); // ikke gitt opp
  });

  it("🔴 KRAV(c)2: maks TRE forsøk — fjerde feil gir feiltilstand, ALDRI en fjerde invalidering", () => {
    // Rød grunn: en uendelig retry mot 401 er verre enn en feiltilstand.
    // Feiler hvis det gjøres mer enn tre invalideringer, eller fallback uteblir.
    render(<SignertBilde url={utloept} alt="f" fallback={<span>feil</span>} />);
    const img = screen.getByAltText("f");
    fireEvent.error(img); vi.advanceTimersByTime(600); // forsøk 1 → #1
    fireEvent.error(img); vi.advanceTimersByTime(1000 + 600); // forsøk 2 → #2
    fireEvent.error(img); vi.advanceTimersByTime(2000 + 600); // forsøk 3 → #3
    expect(invalidate).toHaveBeenCalledTimes(3);
    fireEvent.error(img); // fjerde feil → taket nådd
    vi.advanceTimersByTime(5000);
    expect(invalidate).toHaveBeenCalledTimes(3); // ALDRI en fjerde
    expect(screen.getByText("feil")).toBeTruthy(); // samme tydelige feiltilstand som før
  });

  it("⚠️ koalescering holder: TRE bilder feiler samtidig → ÉN invalidering pr. forsøksnivå, ikke tre", () => {
    // Vernet mot tordenskrall: tre forsøk pr. bilde × N bilder må ikke bli 3N invalideringer.
    // Den modul-delte debounce-en koalescerer alle instansenes samtidige feil til én.
    render(
      <>
        <SignertBilde url={utloept} alt="k1" />
        <SignertBilde url={utloept} alt="k2" />
        <SignertBilde url={utloept} alt="k3" />
      </>,
    );
    fireEvent.error(screen.getByAltText("k1"));
    fireEvent.error(screen.getByAltText("k2"));
    fireEvent.error(screen.getByAltText("k3"));
    vi.advanceTimersByTime(600); // forsøk 1 for alle tre (backoff 0) → debounce lukkes
    expect(invalidate).toHaveBeenCalledTimes(1); // TRE bilder, ÉN invalidering
  });
});
