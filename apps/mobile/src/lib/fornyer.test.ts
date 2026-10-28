import { describe, it, expect, vi, afterEach } from "vitest";
import { lagFornyer, FORNY_MAKS, FORNY_INTERVALL_MS } from "./fornyer";

/**
 * Oppfølger RETUR svart gjenåpning (Kontrollør-gate 483e7057): i `fornyer` ble ny henting bare
 * utløst av at URI-en endret seg — ga første refetch ingen signert URL, ble det aldri et forsøk
 * nr. 2, bare 8 s-fristen. Nå: invalidate på timer, 3 faktiske forsøk, så synlig feil.
 * Rød før: modulen fantes ikke (fornyelsen lå som én invalidate + frist i BildeAnnotering).
 */

afterEach(() => vi.useRealTimers());

describe("lagFornyer — invalidate på timer, maks 3, så gi opp", () => {
  it("invaliderer straks, så hvert 2,5 s — 3 ganger — og gir opp ett intervall etter siste", () => {
    vi.useFakeTimers();
    const invalider = vi.fn();
    const onGiOpp = vi.fn();
    const f = lagFornyer({ invalider, onGiOpp });
    f.start();
    expect(invalider).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(FORNY_INTERVALL_MS);
    expect(invalider).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(FORNY_INTERVALL_MS);
    expect(invalider).toHaveBeenCalledTimes(FORNY_MAKS);
    expect(onGiOpp).not.toHaveBeenCalled();
    vi.advanceTimersByTime(FORNY_INTERVALL_MS);
    expect(onGiOpp).toHaveBeenCalledTimes(1);
    expect(invalider).toHaveBeenCalledTimes(FORNY_MAKS);
    expect(f.aktiv()).toBe(false);
  });

  it("stopp() når bildet er lastet → ingen flere forsøk og ingen feil", () => {
    vi.useFakeTimers();
    const invalider = vi.fn();
    const onGiOpp = vi.fn();
    const f = lagFornyer({ invalider, onGiOpp });
    f.start();
    vi.advanceTimersByTime(FORNY_INTERVALL_MS);
    f.stopp();
    vi.advanceTimersByTime(FORNY_INTERVALL_MS * 10);
    expect(invalider).toHaveBeenCalledTimes(2);
    expect(onGiOpp).not.toHaveBeenCalled();
  });

  it("start() mens den er aktiv nullstiller ikke tellingen (ny rå URL midt i fornyelsen)", () => {
    vi.useFakeTimers();
    const invalider = vi.fn();
    const f = lagFornyer({ invalider, onGiOpp: vi.fn() });
    f.start();
    f.start();
    vi.advanceTimersByTime(FORNY_INTERVALL_MS * 10);
    expect(invalider).toHaveBeenCalledTimes(FORNY_MAKS);
  });
});
