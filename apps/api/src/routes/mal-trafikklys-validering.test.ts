import { describe, it, expect } from "vitest";
import { valideerTrafikklysConfig } from "./mal";

/**
 * Vakt for trafikklys-lyssettet (designordre § 3): `config.options` må bære KANONISKE verdier,
 * uten duplikat, minst to lys. Uten denne testen er de tre BAD_REQUEST-kastene en regel som kan
 * slettes uten at noe sier fra — nøyaktig felletypen «stille tomhet» rydder mot.
 *
 * 🔴 Skrevet rød først: kjørt mot en mal.ts der valideringskroppen var en no-op, og de tre
 * kast-testene feilet (bevis at de vokter, ikke bare kompilerer). Punkt 4 er falsk-positiv-
 * sjekken (SAMARBEIDSREGLER § negativ assertion): options som MANGLER MÅ slippe gjennom, ellers
 * ville en for streng vakt blokkert alle dagens felt uten options.
 */
describe("valideerTrafikklysConfig — lyssett-vakt (§3)", () => {
  it("options er ikke en liste → BAD_REQUEST", () => {
    expect(() => valideerTrafikklysConfig({ options: "green,red" })).toThrow(/liste/i);
  });

  it("færre enn to lys → BAD_REQUEST", () => {
    expect(() => valideerTrafikklysConfig({ options: [{ value: "green" }] })).toThrow(/minst to/i);
  });

  it("duplikat verdi → BAD_REQUEST", () => {
    expect(() =>
      valideerTrafikklysConfig({ options: [{ value: "green" }, { value: "green" }] }),
    ).toThrow(/flere ganger/i);
  });

  it("verdi utenfor de fire kanoniske → BAD_REQUEST", () => {
    expect(() =>
      valideerTrafikklysConfig({ options: [{ value: "green" }, { value: "blå" }] }),
    ).toThrow(/ugyldig/i);
  });

  // 🔴 Falsk-positiv-sjekk: uten options SKAL slippe gjennom (feltet faller til kanonisk sett).
  // Uten denne kunne en for streng vakt blokkert alle 27 dagens felt uten options — usynlig.
  it("options MANGLER → slipper gjennom (ingen throw)", () => {
    expect(() => valideerTrafikklysConfig({})).not.toThrow();
    expect(() => valideerTrafikklysConfig(undefined)).not.toThrow();
    expect(() => valideerTrafikklysConfig({ options: null })).not.toThrow();
  });

  // Positiv kontroll: et gyldig sett (tre lys, kanoniske, unike) slipper gjennom.
  it("gyldig tre-lys-sett → OK", () => {
    expect(() =>
      valideerTrafikklysConfig({
        options: [{ value: "red", label: "Åpent" }, { value: "yellow" }, { value: "green", label: "Lukket" }],
      }),
    ).not.toThrow();
  });
});
