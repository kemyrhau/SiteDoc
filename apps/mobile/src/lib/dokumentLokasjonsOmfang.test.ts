import { describe, it, expect } from "vitest";
import { dokumentLokasjonsOmfang } from "./dokumentLokasjonsOmfang";

describe("dokumentLokasjonsOmfang — gate-kriteriene for områdenivå på mobil", () => {
  it("🔴 gate 1: omfang=omrade med navn → navnet vises, type som kontekstnøkkel", () => {
    expect(
      dokumentLokasjonsOmfang({
        lokasjonOmfang: "omrade",
        omrade: { navn: "Sone A — grunnarbeid", type: "sone" },
      }),
    ).toEqual({ slag: "omrade", navn: "Sone A — grunnarbeid", typeNokkel: "omrade.type.sone" });
  });

  it("🔴 gate 2: omfang=omrade UTEN navn (område slettet/ikke sammenstilt) → navn null (komponent viser nøytral, aldri tomt)", () => {
    expect(dokumentLokasjonsOmfang({ lokasjonOmfang: "omrade", omrade: null })).toEqual({
      slag: "omrade",
      navn: null,
      typeNokkel: null,
    });
  });

  it("omfang=omrade med ukjent type → typeNokkel null (ingen kontekstlinje, som PDF)", () => {
    expect(
      dokumentLokasjonsOmfang({ lokasjonOmfang: "omrade", omrade: { navn: "X", type: "vilkårlig" } }),
    ).toEqual({ slag: "omrade", navn: "X", typeNokkel: null });
  });

  it("alle fire kjente typer gir sin i18n-nøkkel", () => {
    for (const type of ["sone", "rom", "etasje", "trase"]) {
      expect(dokumentLokasjonsOmfang({ lokasjonOmfang: "omrade", omrade: { navn: "N", type } })).toMatchObject({
        typeNokkel: `omrade.type.${type}`,
      });
    }
  });

  it("🔴 gate 3: omfang=byggeplass med fritekst → sted=fritekst (uendret)", () => {
    expect(
      dokumentLokasjonsOmfang({ lokasjonOmfang: "byggeplass", lokasjonFritekst: "Brakkerigg vest" }),
    ).toEqual({ slag: "byggeplass", sted: "Brakkerigg vest" });
  });

  it("🔴 gate 3: omfang=byggeplass uten fritekst → sted=null (komponent: «hele byggeplassen»)", () => {
    expect(dokumentLokasjonsOmfang({ lokasjonOmfang: "byggeplass" })).toEqual({
      slag: "byggeplass",
      sted: null,
    });
  });

  it("🔴 gate 4: omfang=punkt → «ingen» (tegningsmarkør-logikken uendret)", () => {
    expect(dokumentLokasjonsOmfang({ lokasjonOmfang: "punkt" })).toEqual({ slag: "ingen" });
  });

  it("🔴 gate 4: omfang=null → «ingen» (uendret)", () => {
    expect(dokumentLokasjonsOmfang({ lokasjonOmfang: null })).toEqual({ slag: "ingen" });
    expect(dokumentLokasjonsOmfang({})).toEqual({ slag: "ingen" });
  });

  it("tom/whitespace fritekst behandles som ikke satt (|| null)", () => {
    expect(dokumentLokasjonsOmfang({ lokasjonOmfang: "byggeplass", lokasjonFritekst: "" })).toEqual({
      slag: "byggeplass",
      sted: null,
    });
  });
});
