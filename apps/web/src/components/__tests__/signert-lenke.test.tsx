// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

/**
 * SignertLenke (lenke-runden) — komponent-nivå bevis for KRAV (c). Den delte regelen
 * (erUtloptSignatur, debounce) er bevist rent i @sitedoc/shared (signertBildePolicy.test.ts);
 * her bevises at komponenten WIRER selvfornyelsen riktig for lenker — der en <a>/window.open
 * IKKE kan fange et 401 (nettleseren navigerer og får feilen), så sjekken må skje FØR åpning:
 *   1. gyldig signatur → åpner DIREKTE, ingen invalidering
 *   2. utløpt signatur → invaliderer (debouncet) og VENTER — åpner ikke før fersk url kommer
 *   3. #page=N-fragmentet BEVARES gjennom fornyelsen
 */

const invalidate = vi.fn(() => Promise.resolve());
vi.mock("@/lib/trpc", () => ({
  trpc: { useUtils: () => ({ invalidate }) },
}));

import { SignertLenke, byggLenkeHref } from "../SignertLenke";

const NAA = 1_700_000_000_000;
const sti = "/uploads/privat/a.pdf";
const utloept = `${sti}?exp=${NAA - 1000}&sig=x`;
const gyldig = `${sti}?exp=${NAA + 900_000}&sig=x`;
const gyldig2 = `${sti}?exp=${NAA + 800_000}&sig=y`; // fersk signatur etter fornyelse

// Placeholder-vindu som window.open("", "_blank") returnerer (åpnes i klikk-gesten for å
// unngå popup-blokkering), og som senere navigeres til den ferske url-en.
let fakeWin: { location: { href: string } };
let openSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NAA);
  invalidate.mockClear();
  fakeWin = { location: { href: "" } };
  openSpy = vi.fn(() => fakeWin);
  window.open = openSpy as unknown as typeof window.open;
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  cleanup();
});

describe("byggLenkeHref", () => {
  it("legger /api på /uploads-stier og fester fragmentet bakerst", () => {
    expect(byggLenkeHref("/uploads/x.pdf?exp=1&sig=x")).toBe("/api/uploads/x.pdf?exp=1&sig=x");
    expect(byggLenkeHref("/uploads/x.pdf?exp=1&sig=x", "#page=3")).toBe("/api/uploads/x.pdf?exp=1&sig=x#page=3");
    expect(byggLenkeHref("/api/uploads/x.pdf?exp=1&sig=x")).toBe("/api/uploads/x.pdf?exp=1&sig=x");
  });
});

describe("SignertLenke — KRAV (c)", () => {
  it("1) GYLDIG signatur → åpner DIREKTE, ingen invalidering", () => {
    render(<SignertLenke url={gyldig} nyFane>åpne</SignertLenke>);
    fireEvent.click(screen.getByText("åpne"));
    // Åpnet direkte til den ferske url-en (ikke et tomt placeholder-vindu):
    expect(openSpy).toHaveBeenCalledWith(`/api${gyldig}`, "_blank", "noopener,noreferrer");
    vi.advanceTimersByTime(600);
    expect(invalidate).not.toHaveBeenCalled(); // gyldig → ingen selvfornyelse
  });

  it("2) UTLØPT signatur → invaliderer (debouncet) og VENTER (åpner ikke direkte)", () => {
    render(<SignertLenke url={utloept} nyFane>åpne</SignertLenke>);
    fireEvent.click(screen.getByText("åpne"));
    // Placeholder-vindu åpnet i gesten (unngår popup-blokk), men ikke navigert ennå:
    expect(openSpy).toHaveBeenCalledWith("", "_blank", "noopener,noreferrer");
    expect(fakeWin.location.href).toBe(""); // venter på fersk url
    expect(invalidate).not.toHaveBeenCalled(); // ikke før debounce-vinduet lukkes
    vi.advanceTimersByTime(600);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(fakeWin.location.href).toBe(""); // fortsatt ikke åpnet — venter på ny url-prop
  });

  it("3) #page=N BEVARES gjennom fornyelsen", () => {
    const { rerender } = render(<SignertLenke url={utloept} fragment="#page=5" nyFane>åpne</SignertLenke>);
    fireEvent.click(screen.getByText("åpne"));
    vi.advanceTimersByTime(600);
    expect(invalidate).toHaveBeenCalledTimes(1);
    // Serveren re-emitterer en fersk signatur → forelderen re-rendrer med ny url:
    rerender(<SignertLenke url={gyldig2} fragment="#page=5" nyFane>åpne</SignertLenke>);
    expect(fakeWin.location.href).toBe(`/api${gyldig2}#page=5`);
  });
});
