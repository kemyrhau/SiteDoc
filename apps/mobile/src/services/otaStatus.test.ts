import { describe, expect, it } from "vitest";
import {
  fordelBunnInnsetter,
  OTA_STATUS_NOEKKEL,
  OTA_STRUPING_MS,
  OTA_TVUNGET_SPERRE_MS,
  skalSjekke,
  utledOtaStatus,
  type OtaFlagg,
} from "./otaStatus";

const basis: OtaFlagg = { aktivert: true, påNett: true, sjekker: false, lasterNed: false, klar: false };

describe("utledOtaStatus", () => {
  it("gir riktig status og tekstnøkkel for hver tilstand", () => {
    const tilfeller: Array<[Partial<OtaFlagg>, string, string | undefined]> = [
      [{}, "oppdatert", "ota.oppdatert"],
      [{ påNett: false }, "frakoblet", "ota.frakoblet"],
      [{ sjekker: true }, "sjekker", "ota.sjekker"],
      [{ lasterNed: true }, "laster", "ota.lasterNed"],
      [{ klar: true }, "klar", "ota.klarTrykk"],
      [{ aktivert: false }, "av", undefined],
    ];
    for (const [flagg, status, nøkkel] of tilfeller) {
      const s = utledOtaStatus({ ...basis, ...flagg });
      expect(s).toBe(status);
      expect((OTA_STATUS_NOEKKEL as Record<string, string>)[s]).toBe(nøkkel);
    }
  });

  it("avslått Updates gir «av» uansett øvrige flagg", () => {
    expect(
      utledOtaStatus({ aktivert: false, påNett: true, sjekker: true, lasterNed: true, klar: true }),
    ).toBe("av");
  });

  it("nedlastet versjon er klar også offline, og klar slår laster/sjekker", () => {
    expect(utledOtaStatus({ ...basis, påNett: false, klar: true })).toBe("klar");
    expect(utledOtaStatus({ ...basis, klar: true, lasterNed: true, sjekker: true })).toBe("klar");
    expect(utledOtaStatus({ ...basis, lasterNed: true, sjekker: true })).toBe("laster");
  });
});

describe("skalSjekke", () => {
  const t0 = 1_000_000;
  it("første sjekk alltid", () => {
    expect(skalSjekke(null, t0)).toBe(true);
  });
  it("struper automatisk sjekk til én per 5 min", () => {
    expect(skalSjekke(t0, t0 + 4 * 60 * 1000)).toBe(false);
    expect(skalSjekke(t0, t0 + OTA_STRUPING_MS)).toBe(true);
  });
  it("tvunget sjekk går forbi strupingen, men ikke dobbelttrykk", () => {
    expect(skalSjekke(t0, t0 + 60 * 1000, true)).toBe(true);
    expect(skalSjekke(t0, t0 + OTA_TVUNGET_SPERRE_MS - 1, true)).toBe(false);
  });
});

describe("fordelBunnInnsetter", () => {
  const innsetter = { top: 47, right: 0, bottom: 34, left: 0 };
  it("uten linje: navigatoren beholder bunnmargen, linja har ingen", () => {
    expect(fordelBunnInnsetter(innsetter, false)).toEqual({ navigator: innsetter, modal: innsetter, linjeBunn: 0 });
  });
  it("med linje: margen flyttes til linja — summen er den samme (ingen dobbel, ingen manglende)", () => {
    const { navigator, linjeBunn } = fordelBunnInnsetter(innsetter, true);
    expect(navigator).toEqual({ ...innsetter, bottom: 0 });
    expect(linjeBunn).toBe(34);
    expect(navigator.bottom + linjeBunn).toBe(innsetter.bottom);
  });
  it("med linje: modalinnhold får FULL bunnmarg — modal dekker linja (RETUR 1)", () => {
    const { navigator, modal } = fordelBunnInnsetter(innsetter, true);
    expect(modal).toEqual(innsetter);
    expect(modal.bottom).toBe(34);
    expect(modal.bottom).not.toBe(navigator.bottom);
  });
});
