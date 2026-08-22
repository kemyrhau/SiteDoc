import { describe, it, expect } from "vitest";
import { velgerRehydreringsHandling } from "../byggeplass-kontekst";

/**
 * Funn 2026-08-22: klikk i tegning fra repeater-posisjonsvelger åpnet «Opprett fra tegning»
 * i stedet for å sette punkt, fordi `posisjonsvelgerAktiv` (ren in-memory provider-state) gikk
 * tapt ved full last/remount av tegningssiden. URL-parameteren `posisjonsvelger=<feltId>` er nå
 * sannhetskilden; denne rene funksjonen avgjør re-hydreringen ved mount.
 */
describe("velgerRehydreringsHandling — URL som sannhetskilde for posisjonsvelger", () => {
  it("param satt + provider tom (F5 midt i valget) → «start» (gjenopprett velger-modus)", () => {
    expect(velgerRehydreringsHandling("rep:0", false)).toBe("start");
  });

  it("ingen param + provider aktiv (stale fra dokument-flyt, direkte nav) → «avbryt»", () => {
    // Kenneth-krav: FRA Tegninger-siden → klikk skal gi «Opprett fra tegning», aldri arvet velger-modus.
    expect(velgerRehydreringsHandling(null, true)).toBe("avbryt");
  });

  it("param satt + provider aktiv (klient-nav, alt korrekt) → «ingen» (rør ikke ref)", () => {
    expect(velgerRehydreringsHandling("rep:0", true)).toBe("ingen");
  });

  it("ingen param + provider tom (frisk Tegninger-visning) → «ingen» (Opprett-modus)", () => {
    expect(velgerRehydreringsHandling(null, false)).toBe("ingen");
  });

  it("tom streng-param behandles som fraværende", () => {
    expect(velgerRehydreringsHandling("", true)).toBe("avbryt");
    expect(velgerRehydreringsHandling("", false)).toBe("ingen");
  });
});
