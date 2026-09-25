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

  it("🔴 GYLDIG signatur men feilet (404/slettet) → fallback, INGEN invalidering", () => {
    render(<SignertBilde url={gyldig} alt="c" fallback={<span>borte</span>} />);
    fireEvent.error(screen.getByAltText("c"));
    vi.advanceTimersByTime(600);
    expect(invalidate).not.toHaveBeenCalled(); // en fersk signatur hjelper ikke en slettet fil
    expect(screen.getByText("borte")).toBeTruthy();
  });

  it("🔴 maks ETT gjenforsøk: andre feil på samme url → fallback, ikke ny løkke", () => {
    render(<SignertBilde url={utloept} alt="d" fallback={<span>feil</span>} />);
    const img = screen.getByAltText("d");
    fireEvent.error(img); // forsøk 1 → planlegger fornyelse
    fireEvent.error(img); // forsøk 2 (samme url) → taket nådd → fallback
    expect(screen.getByText("feil")).toBeTruthy();
    vi.advanceTimersByTime(600);
    expect(invalidate).toHaveBeenCalledTimes(1); // kun det første forsøket fornyet
  });
});
