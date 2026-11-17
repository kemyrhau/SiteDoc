import { describe, it, expect } from "vitest";
import type { IfcEgenskapsGruppe } from "@sitedoc/shared/tred";
import { formaterVerdi, lagObjektinfoSeksjoner, type Oversett } from "./objektinfoRader";

// Fast oversettelse: kjente nøkler får norsk tekst, ellers defaultValue (som i18next)
const tekster: Record<string, string> = {
  "ifc.verdi.ja": "Ja",
  "ifc.verdi.nei": "Nei",
  "ifc.attributt.LoadBearing": "Bærende",
  "ifc.attributt.Pset_WallCommon": "Veggegenskaper",
  "ifc.attributt.ObjectType": "Type",
  "3d.egenskaper.type": "Type",
  "3d.egenskaper.mengder": "Mengder",
  "3d.egenskaper.egenskapssett": "Egenskapssett",
};
const t: Oversett = (n, v) => tekster[n] ?? v?.defaultValue ?? n;

describe("formaterVerdi", () => {
  it("boolsk → Ja/Nei, heltall uendret, desimaltall maks 3 uten etterfølgende nuller", () => {
    expect(formaterVerdi(true, t)).toBe("Ja");
    expect(formaterVerdi(false, t)).toBe("Nei");
    expect(formaterVerdi(200, t)).toBe("200");
    expect(formaterVerdi(2.4, t)).toBe("2.4");
    expect(formaterVerdi(0.123456, t)).toBe("0.123");
    expect(formaterVerdi("EI 60", t)).toBe("EI 60");
  });
});

describe("lagObjektinfoSeksjoner — med grupper (M5 (2))", () => {
  const grupper: IfcEgenskapsGruppe[] = [
    { art: "attributter", navn: null, egenskaper: [{ navn: "ObjectType", verdi: "Yttervegg 300" }] },
    { art: "egenskapssett", navn: "Pset_WallCommon", egenskaper: [
      { navn: "LoadBearing", verdi: true },
      { navn: "FireRating", verdi: "EI 60" },
    ] },
    { art: "egenskapssett", navn: null, egenskaper: [{ navn: "Merknad", verdi: "x" }] },
    { art: "type", navn: "Basic Wall", egenskaper: [{ navn: "Width", verdi: 300, enhet: "mm" }] },
    { art: "mengder", navn: "Qto_WallBaseQuantities", egenskaper: [{ navn: "NetArea", verdi: 12.3456, enhet: "m²" }] },
    { art: "egenskapssett", navn: "Tomt", egenskaper: [] },
  ];

  it("én seksjon pr. ikke-tom gruppe, i meldingens rekkefølge, med titler som på web", () => {
    const s = lagObjektinfoSeksjoner({ attributter: { Name: "Vegg" }, grupper }, t);
    expect(s.map((x) => x.tittel)).toEqual([
      null, "Pset_WallCommon", "Egenskapssett", "Type: Basic Wall", "Mengder: Qto_WallBaseQuantities",
    ]);
  });

  it("gruppetittelen oversettes aldri, selv når navnet har en ifc.attributt-nøkkel (paritet med web)", () => {
    const oversetterAlt: Oversett = (n, v) =>
      n.startsWith("ifc.attributt.") ? "OVERSATT" : tekster[n] ?? v?.defaultValue ?? n;
    const s = lagObjektinfoSeksjoner({ grupper }, oversetterAlt);
    expect(s.map((x) => x.tittel)).toEqual([
      null, "Pset_WallCommon", "Egenskapssett", "Type: Basic Wall", "Mengder: Qto_WallBaseQuantities",
    ]);
  });

  it("rader: oversatt etikett · formatert verdi · enhet", () => {
    const s = lagObjektinfoSeksjoner({ grupper }, t);
    expect(s[0]!.rader).toEqual([{ etikett: "Type", verdi: "Yttervegg 300" }]);
    expect(s[1]!.rader).toEqual([
      { etikett: "Bærende", verdi: "Ja" },
      { etikett: "FireRating", verdi: "EI 60" },
    ]);
    expect(s[3]!.rader).toEqual([{ etikett: "Width", verdi: "300 mm" }]);
    expect(s[4]!.rader).toEqual([{ etikett: "NetArea", verdi: "12.346 m²" }]);
  });

  it("grupper vinner over attributter (ingen dobbel visning)", () => {
    const s = lagObjektinfoSeksjoner({ attributter: { Description: "fra attributter" }, grupper }, t);
    expect(s.flatMap((x) => x.rader).some((r) => r.verdi === "fra attributter")).toBe(false);
  });
});

describe("lagObjektinfoSeksjoner — fallback uten grupper", () => {
  const attributter = {
    Name: "Vegg", GlobalId: "2O2Fr$t4X7Zf8NOew3FLOH", expressID: 42,
    ObjectType: "Yttervegg", LoadBearing: ".T.", PredefinedType: "NOTDEFINED", Tag: "123",
  };

  it("mangler grupper (eldre web-bygg): direkte attributter som før, én seksjon uten tittel", () => {
    const s = lagObjektinfoSeksjoner({ attributter }, t);
    expect(s).toEqual([{ tittel: null, rader: [
      { etikett: "Type", verdi: "Yttervegg" },
      { etikett: "Bærende", verdi: "Ja" },
    ] }]);
  });

  it("tom grupper-liste eller bare tomme grupper gir samme fallback", () => {
    const forventet = lagObjektinfoSeksjoner({ attributter }, t);
    expect(lagObjektinfoSeksjoner({ attributter, grupper: [] }, t)).toEqual(forventet);
    expect(lagObjektinfoSeksjoner({ attributter, grupper: [{ art: "mengder", navn: "Q", egenskaper: [] }] }, t))
      .toEqual(forventet);
  });

  it("ingenting å vise → ingen seksjoner (kortet viser bare kategori og navn)", () => {
    expect(lagObjektinfoSeksjoner({ attributter: { Name: "Tak" } }, t)).toEqual([]);
    expect(lagObjektinfoSeksjoner({}, t)).toEqual([]);
  });

  it("fallback kutter som før etter 8 rader", () => {
    const mange = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`Felt${i}`, `v${i}`]));
    expect(lagObjektinfoSeksjoner({ attributter: mange }, t)[0]!.rader).toHaveLength(8);
  });
});
