import { describe, expect, it } from "vitest";
import { byggLagGrupper } from "./lag-gruppering";
import type { RegisterVerdenLagInfo } from "./objektmodell";

function lag(partial: Partial<RegisterVerdenLagInfo> & { navn: string }): RegisterVerdenLagInfo {
  return {
    antall: 1,
    visningsnavn: partial.navn,
    desc: "",
    aci: null,
    ltype: "CONTINUOUS",
    lw: null,
    gruppe: "A",
    gruppeNavn: "Arkitekt",
    ...partial,
  };
}

describe("byggLagGrupper", () => {
  it("grupperer på rå gruppe-kode når gruppeNavn ikke er 'Andre'", () => {
    const grupper = byggLagGrupper([
      lag({ navn: "A-WALL-1", gruppe: "A", gruppeNavn: "Arkitekt", antall: 10 }),
      lag({ navn: "A-WALL-2", gruppe: "A", gruppeNavn: "Arkitekt", antall: 5 }),
      lag({ navn: "P-PIPE-1", gruppe: "P", gruppeNavn: "VVS (rør)", antall: 3 }),
    ]);
    expect(grupper).toHaveLength(2);
    expect(grupper[0]).toMatchObject({ navn: "A", gruppeNavn: "Arkitekt", antallTotal: 15 });
    expect(grupper[0]?.lag).toHaveLength(2);
    expect(grupper[1]).toMatchObject({ navn: "P", gruppeNavn: "VVS (rør)", antallTotal: 3 });
  });

  it("slår sammen ALLE rå koder som har gruppeNavn 'Andre' i ÉN gruppe", () => {
    const grupper = byggLagGrupper([
      lag({ navn: "878-X", gruppe: "878", gruppeNavn: "Andre", antall: 100 }),
      lag({ navn: "82-Y", gruppe: "82", gruppeNavn: "Andre", antall: 50 }),
      lag({ navn: "UTEN-KODE", gruppe: "", gruppeNavn: "Andre", antall: 18 }),
      lag({ navn: "A-DOOR", gruppe: "A", gruppeNavn: "Arkitekt", antall: 7 }),
    ]);
    const andre = grupper.find((g) => g.gruppeNavn === "Andre");
    expect(andre).toBeDefined();
    expect(andre?.navn).toBe("Andre");
    expect(andre?.lag).toHaveLength(3);
    expect(andre?.antallTotal).toBe(168);
    expect(grupper).toHaveLength(2);
  });

  it("sorterer grupper etter antallTotal, størst først", () => {
    const grupper = byggLagGrupper([
      lag({ navn: "liten", gruppe: "S", gruppeNavn: "Konstruksjon", antall: 1 }),
      lag({ navn: "stor", gruppe: "A", gruppeNavn: "Arkitekt", antall: 99 }),
    ]);
    expect(grupper.map((g) => g.navn)).toEqual(["A", "S"]);
  });

  it("tom liste gir tom gruppeliste", () => {
    expect(byggLagGrupper([])).toEqual([]);
  });
});
