import { describe, it, expect } from "vitest";
import { IKKE_SLETTET, KUN_SLETTET, PAPIRKURV_DAGER, dagerIgjen } from "./softDelete";
import { ROLLE_HANDLINGER_DEFAULTS } from "./statusHandlinger";

describe("soft-delete guard-filter", () => {
  it("IKKE_SLETTET skjuler slettede rader (deletedAt IS NULL)", () => {
    expect(IKKE_SLETTET).toEqual({ deletedAt: null });
  });

  it("KUN_SLETTET er inversen — papirkurv-visning (deletedAt IS NOT NULL)", () => {
    expect(KUN_SLETTET).toEqual({ deletedAt: { not: null } });
  });

  it("de to filtrene er komplementære: ett dokument treffer nøyaktig ett av dem", () => {
    // IKKE_SLETTET krever null; KUN_SLETTET krever ikke-null. Disjunkte per definisjon.
    expect(IKKE_SLETTET.deletedAt).toBeNull();
    expect(KUN_SLETTET.deletedAt).not.toBeNull();
  });
});

describe("dagerIgjen (90-dagers papirkurv)", () => {
  const naa = new Date("2026-07-25T12:00:00Z");

  it("nettopp slettet → 90 dager igjen", () => {
    expect(dagerIgjen(new Date("2026-07-25T12:00:00Z"), naa)).toBe(PAPIRKURV_DAGER);
  });

  it("slettet for 10 dager siden → 80 dager igjen", () => {
    expect(dagerIgjen(new Date("2026-07-15T12:00:00Z"), naa)).toBe(80);
  });

  it("slettet for 89 dager siden → 1 dag igjen", () => {
    expect(dagerIgjen(new Date("2026-04-27T12:00:00Z"), naa)).toBe(1);
  });

  it("klampes til 0 når fristen er passert (>90 dager)", () => {
    expect(dagerIgjen(new Date("2026-01-01T12:00:00Z"), naa)).toBe(0);
  });
});

describe("papirkurv-rolledefaults (matrise § 3)", () => {
  it("registrator kan gjenopprette egne slettede (slettet→gjenopprett)", () => {
    expect(ROLLE_HANDLINGER_DEFAULTS.registrator?.slettet?.has("gjenopprett")).toBe(true);
  });

  it("ingen flyt-rolle har slett_endelig som default (kun prosjektadmin, via pseudo)", () => {
    for (const roller of Object.values(ROLLE_HANDLINGER_DEFAULTS)) {
      expect(roller.slettet?.has("slett_endelig") ?? false).toBe(false);
    }
  });
});
