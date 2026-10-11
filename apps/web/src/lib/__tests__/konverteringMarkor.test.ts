import { describe, it, expect } from "vitest";
import {
  lesKonverteringMarkor,
  formaterKonvertertTid,
  kortKodeversjon,
} from "../konverteringMarkor";

describe("lesKonverteringMarkor — defensiv parse av konvertering_rapport", () => {
  it("leser markøren og BEHOLDER fullstendighetsrapporten ved siden av", () => {
    const rapport = {
      parsetPrType: { LINE: 5 },
      markor: { kodeversjon: "2034396e", konvertertTid: "2026-10-11T08:45:00.000Z", motor: "egen" },
    };
    expect(lesKonverteringMarkor(rapport)).toEqual({
      kodeversjon: "2034396e",
      konvertertTid: "2026-10-11T08:45:00.000Z",
      motor: "egen",
    });
  });

  it("null når feltet mangler markør (eldre tegning, kun fullstendighetsrapport)", () => {
    expect(lesKonverteringMarkor({ parsetPrType: { LINE: 5 } })).toBeNull();
  });

  it("null for null/udefinert/feil form", () => {
    expect(lesKonverteringMarkor(null)).toBeNull();
    expect(lesKonverteringMarkor(undefined)).toBeNull();
    expect(lesKonverteringMarkor({ markor: { kodeversjon: 1 } })).toBeNull();
    expect(lesKonverteringMarkor("tekst")).toBeNull();
  });
});

describe("formaterKonvertertTid — kompakt dd.MM HH:mm", () => {
  it("gir «dd.MM HH:mm»-mønster for gyldig ISO", () => {
    expect(formaterKonvertertTid("2026-10-11T08:45:00.000Z")).toMatch(/^\d{2}\.\d{2} \d{2}:\d{2}$/);
  });
  it("tom streng for ugyldig ISO", () => {
    expect(formaterKonvertertTid("ikke-en-dato")).toBe("");
  });
});

describe("kortKodeversjon — 8 tegn, «ukjent» beholdes", () => {
  it("kutter til 8 tegn", () => {
    expect(kortKodeversjon("2034396e1234567")).toBe("2034396e");
  });
  it("beholder «ukjent» uendret", () => {
    expect(kortKodeversjon("ukjent")).toBe("ukjent");
  });
});
