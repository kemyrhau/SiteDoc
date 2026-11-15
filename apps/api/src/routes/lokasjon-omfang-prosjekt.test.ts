import { describe, expect, it } from "vitest";
import { z } from "zod";
import { LOKASJON_OMFANG, omfangMedByggeplass } from "./lokasjon-omfang";

/** ORDRE (20) punkt 2, alternativ A: «prosjekt» = bevisst «Hele prosjektet». */
describe("lokasjonOmfang «prosjekt»", () => {
  const skjema = z.enum(LOKASJON_OMFANG).nullable().optional();

  it("Zod godtar «prosjekt» og de eksisterende verdiene", () => {
    for (const v of ["prosjekt", "punkt", "byggeplass", "omrade", null, undefined]) {
      expect(skjema.safeParse(v).success).toBe(true);
    }
  });

  it("negativkontroll: ukjent verdi avvises fortsatt", () => {
    expect(skjema.safeParse("alt").success).toBe(false);
  });

  it("opprett med «prosjekt» uten byggeplass → lagres som «prosjekt»", () => {
    expect(
      omfangMedByggeplass({ inputOmfang: "prosjekt", naavaerendeOmfang: undefined, effektivByggeplassId: undefined }),
    ).toBe("prosjekt");
  });

  it("byggeplass settes på et «prosjekt»-dokument → omfang nullstilles", () => {
    expect(
      omfangMedByggeplass({ inputOmfang: undefined, naavaerendeOmfang: "prosjekt", effektivByggeplassId: "b1" }),
    ).toBeNull();
  });

  it("«prosjekt» sammen med byggeplass i samme kall → null", () => {
    expect(
      omfangMedByggeplass({ inputOmfang: "prosjekt", naavaerendeOmfang: null, effektivByggeplassId: "b1" }),
    ).toBeNull();
  });

  it("negativkontroll: andre omfang røres ikke av byggeplass", () => {
    expect(
      omfangMedByggeplass({ inputOmfang: undefined, naavaerendeOmfang: "byggeplass", effektivByggeplassId: "b1" }),
    ).toBeUndefined();
    expect(
      omfangMedByggeplass({ inputOmfang: "punkt", naavaerendeOmfang: "prosjekt", effektivByggeplassId: "b1" }),
    ).toBe("punkt");
  });
});
