import { describe, it, expect } from "vitest";
import { erMeldbarHmsMal } from "./meldHmsMal";

const mal = (category: string, domain: string, subdomain: string | null) => ({ category, domain, subdomain });

describe("erMeldbarHmsMal (HM1 tillegg A)", () => {
  it("seedet HMS-avvik og RUH (category oppgave, domain hms) kan meldes", () => {
    expect(erMeldbarHmsMal(mal("oppgave", "hms", "avvik"))).toBe(true);
    expect(erMeldbarHmsMal(mal("oppgave", "hms", "ruh"))).toBe(true);
  });

  it("seedet SJA (category sjekkliste, domain hms) kan meldes", () => {
    expect(erMeldbarHmsMal(mal("sjekkliste", "hms", "sja"))).toBe(true);
  });

  it("eldre category hms-mal kan fortsatt meldes", () => {
    expect(erMeldbarHmsMal(mal("hms", "hms", "avvik"))).toBe(true);
  });

  it("byggmaler og kontraktssak tilbys ikke", () => {
    expect(erMeldbarHmsMal(mal("oppgave", "bygg", null))).toBe(false);
    expect(erMeldbarHmsMal(mal("oppgave", "bygg", "kontrakt"))).toBe(false);
    expect(erMeldbarHmsMal(mal("sjekkliste", "bygg", null))).toBe(false);
  });

  it("HMS-mal uten gyldig subdomain tilbys ikke (kan ikke rutes)", () => {
    expect(erMeldbarHmsMal(mal("hms", "hms", null))).toBe(false);
  });
});
