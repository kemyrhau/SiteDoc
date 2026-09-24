import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  RAMME_LANDXML,
  RAMME_LAS_PROVISORISK,
  erProvisoriskRamme,
  utledRammeForPunktsky,
  utledRammeForLandXML,
  samsvarerRamme,
  krevSammeRamme,
} from "./overflateRamme";

describe("utledRamme", () => {
  it("punktsky uten coordinateSystem → provisorisk las-utm", () => {
    expect(utledRammeForPunktsky(null)).toBe(RAMME_LAS_PROVISORISK);
    expect(utledRammeForPunktsky(undefined)).toBe(RAMME_LAS_PROVISORISK);
    expect(utledRammeForPunktsky("  ")).toBe(RAMME_LAS_PROVISORISK);
  });

  it("punktsky MED coordinateSystem (steg 3) → den faktiske sonen", () => {
    expect(utledRammeForPunktsky("utm33")).toBe("utm33");
    expect(utledRammeForPunktsky("ntm10")).toBe("ntm10");
  });

  it("landxml → landxml-bøtte", () => {
    expect(utledRammeForLandXML()).toBe(RAMME_LANDXML);
  });
});

describe("🔴 betingelse 2: las-utm er merket PROVISORISK — kan ikke arves stille i steg 3", () => {
  it("den rammen LAS får i steg 1 ER merket provisorisk", () => {
    // Denne FEILER hvis noen gjør las-utm permanent (fjerner den fra PROVISORISKE_RAMMER)
    // mens utledRammeForPunktsky fortsatt produserer den.
    const rammeSteg1 = utledRammeForPunktsky(null);
    expect(rammeSteg1).toBe(RAMME_LAS_PROVISORISK);
    expect(erProvisoriskRamme(rammeSteg1)).toBe(true);
  });

  it("en detektert sone (steg 3) er IKKE provisorisk", () => {
    expect(erProvisoriskRamme(utledRammeForPunktsky("utm33"))).toBe(false);
    expect(erProvisoriskRamme(RAMME_LANDXML)).toBe(false);
  });
});

describe("ramme-vakt (§ F)", () => {
  it("samsvarerRamme: lik = true, ulik = false", () => {
    expect(samsvarerRamme("utm33", "utm33")).toBe(true);
    expect(samsvarerRamme(RAMME_LAS_PROVISORISK, RAMME_LANDXML)).toBe(false);
  });

  it("krevSammeRamme slipper gjennom to like rammer", () => {
    expect(() => krevSammeRamme("utm33", "utm33")).not.toThrow();
  });

  it("krevSammeRamme AVVISER ulik ramme med lesbar feil", () => {
    try {
      krevSammeRamme(RAMME_LAS_PROVISORISK, RAMME_LANDXML);
      expect.unreachable("skulle ha kastet");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      expect((e as TRPCError).code).toBe("BAD_REQUEST");
      expect((e as TRPCError).message).toMatch(/ulike koordinatrammer/);
    }
  });
});
