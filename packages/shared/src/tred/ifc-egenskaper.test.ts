import { describe, expect, it } from "vitest";
import { lesIfcEnheter, trekkUtIfcEgenskaper, type IfcEgenskapsGruppe } from "./ifc-egenskaper";

/*
 * Formen på dataene er målt med web-ifc 0.0.77 (recursive = true) på
 * `DWG eksempelfiler/E3 3D-modell ARK.ifc` (mm-modell fra Revit) 2026-11-17.
 */

const lbl = (value: string, name = "IFCLABEL") => ({ value, type: 1, name });
const enumv = (value: string) => ({ type: 3, value });
/** Mål i web-ifc 0.0.77: _representationValue + value-getter. Testen bruker bare feltet. */
const maal = (v: number, name: string) => ({ type: 4, _internalValue: String(v), _representationValue: v, name });

const ENHETER_RAA = [
  { type: 448429030, UnitType: enumv("LENGTHUNIT"), Prefix: enumv("MILLI"), Name: enumv("METRE") },
  { type: 448429030, UnitType: enumv("AREAUNIT"), Prefix: null, Name: enumv("SQUARE_METRE") },
  { type: 2889183280, UnitType: enumv("PLANEANGLEUNIT"), Name: lbl("DEGREE") },
  { type: 448429030, UnitType: enumv("VOLUMEUNIT"), Prefix: null, Name: enumv("CUBIC_METRE") },
];

const VINDU = {
  expressID: 28546,
  type: 3304561284,
  GlobalId: lbl("0_ALFwRmvBVh7vCtHlNumm", "IFCGLOBALLYUNIQUEID"),
  OwnerHistory: { expressID: 18, type: 1207048766 },
  Name: lbl("Focus-Hel Rute fast:26x11M:727721"),
  Description: null,
  ObjectType: lbl("Focus-Hel Rute fast:26x11M"),
  ObjectPlacement: { expressID: 28545, type: 2624227202 },
  Representation: { expressID: 28540, type: 673634403 },
  Tag: lbl("727721"),
  OverallHeight: maal(1010, "IFCPOSITIVELENGTHMEASURE"),
  OverallWidth: maal(2610, "IFCPOSITIVELENGTHMEASURE"),
  PredefinedType: enumv("NOTDEFINED"),
  Kommentar: lbl(""),
};

const PSET_VINDU = {
  expressID: 28549,
  type: 1451395588,
  Name: lbl("Pset_WindowCommon"),
  HasProperties: [
    { expressID: 1, type: 3650150729, Name: lbl("Reference"), NominalValue: lbl("26x11M", "IFCIDENTIFIER"), Unit: null },
    { expressID: 2, type: 3650150729, Name: lbl("IsExternal"), NominalValue: { type: 3, name: "IFCBOOLEAN", value: true }, Unit: null },
    { expressID: 3, type: 3650150729, Name: lbl("FireRating"), NominalValue: lbl(""), Unit: null },
  ],
};

const QTO_VINDU = {
  expressID: 28551,
  type: 1883228015,
  Name: lbl("BaseQuantities"),
  Quantities: [
    { expressID: 28552, type: 931644368, Name: lbl("Height"), Unit: null, LengthValue: maal(990, "IFCLENGTHMEASURE") },
    { expressID: 28554, type: 2044713172, Name: lbl("Area"), Unit: null, AreaValue: maal(2.5641, "IFCAREAMEASURE") },
    { expressID: 28555, type: 2405470396, Name: lbl("NetVolume"), Unit: null, VolumeValue: maal(0.123456, "IFCVOLUMEMEASURE") },
  ],
};

const TYPE_HIMLING = {
  expressID: 29080,
  type: 1299126871,
  GlobalId: lbl("0xMzRPP_4l7NUvUrKnyVHy", "IFCGLOBALLYUNIQUEID"),
  Name: lbl("Compound Ceiling:600 x 601"),
  Description: null,
  Tag: lbl("705891"),
  ParameterTakesPrecedence: false,
  RepresentationMaps: [{ expressID: 28528, type: 1660063152 }],
  ConstructionType: enumv("NOTDEFINED"),
  HasPropertySets: [
    {
      expressID: 28530,
      type: 1451395588,
      Name: lbl("Pset_CoveringCommon"),
      HasProperties: [
        { expressID: 9, type: 3650150729, Name: lbl("TotalThickness"), NominalValue: maal(52, "IFCPOSITIVELENGTHMEASURE"), Unit: null },
      ],
    },
  ],
};

function gruppe(grupper: IfcEgenskapsGruppe[], art: string, navn: string | null) {
  return grupper.find((g) => g.art === art && g.navn === navn);
}

describe("lesIfcEnheter", () => {
  it("leser SI-prefiks, SI-navn og konverterte enheter", () => {
    expect(lesIfcEnheter(ENHETER_RAA)).toEqual({ LENGTHUNIT: "mm", AREAUNIT: "m²", PLANEANGLEUNIT: "°", VOLUMEUNIT: "m³" });
  });
  it("tåler manglende og ugyldig input", () => {
    expect(lesIfcEnheter(undefined)).toEqual({});
    expect(lesIfcEnheter([null, { UnitType: enumv("LENGTHUNIT") }])).toEqual({});
  });
});

describe("trekkUtIfcEgenskaper", () => {
  const enheter = lesIfcEnheter(ENHETER_RAA);
  const grupper = trekkUtIfcEgenskaper({ objekt: VINDU, egenskapssett: [PSET_VINDU, QTO_VINDU], typer: [TYPE_HIMLING], enheter });

  it("direkte attributter: verdier med enhet, uten interne ID-er og tittel", () => {
    expect(gruppe(grupper, "attributter", null)?.egenskaper).toEqual([
      { navn: "ObjectType", verdi: "Focus-Hel Rute fast:26x11M" },
      { navn: "Tag", verdi: "727721" },
      { navn: "OverallHeight", verdi: 1010, enhet: "mm" },
      { navn: "OverallWidth", verdi: 2610, enhet: "mm" },
    ]);
  });

  it("egenskapssett: boolsk verdi beholdes, tom verdi utelates", () => {
    expect(gruppe(grupper, "egenskapssett", "Pset_WindowCommon")?.egenskaper).toEqual([
      { navn: "Reference", verdi: "26x11M" },
      { navn: "IsExternal", verdi: true },
    ]);
  });

  it("mengder: lengde, areal og volum med modellens enheter, rundet til 3 desimaler", () => {
    expect(gruppe(grupper, "mengder", "BaseQuantities")?.egenskaper).toEqual([
      { navn: "Height", verdi: 990, enhet: "mm" },
      { navn: "Area", verdi: 2.564, enhet: "m²" },
      { navn: "NetVolume", verdi: 0.123, enhet: "m³" },
    ]);
  });

  it("type-egenskaper kastes ikke: type-objektets attributter og egenskapssett er med", () => {
    expect(gruppe(grupper, "type", "Compound Ceiling:600 x 601")?.egenskaper).toEqual([
      { navn: "Tag", verdi: "705891" },
      { navn: "ParameterTakesPrecedence", verdi: false },
    ]);
    expect(gruppe(grupper, "type", "Pset_CoveringCommon")?.egenskaper).toEqual([
      { navn: "TotalThickness", verdi: 52, enhet: "mm" },
    ]);
  });

  it("rekkefølge: attributter, egenskapssett, type, mengder til slutt", () => {
    expect(grupper.map((g) => g.art)).toEqual(["attributter", "egenskapssett", "type", "type", "mengder"]);
  });

  it("utelater grupper som bare har tomme verdier", () => {
    const tomt = { Name: lbl("Tomt"), HasProperties: [{ Name: lbl("A"), NominalValue: lbl("") }] };
    expect(trekkUtIfcEgenskaper({ egenskapssett: [tomt] })).toEqual([]);
  });

  it("uten enhetstabell: verdien er med, enheten mangler (gjetter ikke)", () => {
    const g = trekkUtIfcEgenskaper({ egenskapssett: [QTO_VINDU] });
    expect(g[0]?.egenskaper[0]).toEqual({ navn: "Height", verdi: 990 });
  });

  it("egen enhet på egenskapen går foran modellens", () => {
    const sett = {
      Name: lbl("Pset_Egen"),
      HasProperties: [{
        Name: lbl("Effekt"),
        NominalValue: { type: 4, value: 1500, name: "IFCPOWERMEASURE" },
        Unit: { UnitType: enumv("POWERUNIT"), Prefix: enumv("KILO"), Name: enumv("WATT") },
      }],
    };
    expect(trekkUtIfcEgenskaper({ egenskapssett: [sett], enheter })[0]?.egenskaper).toEqual([
      { navn: "Effekt", verdi: 1500, enhet: "kW" },
    ]);
  });

  it("oppramsing, liste, grenseverdi og sammensatt egenskap", () => {
    const sett = {
      Name: lbl("Pset_Diverse"),
      HasProperties: [
        { Name: lbl("Farge"), EnumerationValues: [lbl("Hvit"), lbl("Grå")] },
        { Name: lbl("Mål"), ListValues: [maal(10, "IFCLENGTHMEASURE"), maal(20, "IFCLENGTHMEASURE")] },
        { Name: lbl("Temp"), LowerBoundValue: { value: -10 }, UpperBoundValue: { value: 40 } },
        { Name: lbl("Profil"), HasProperties: [{ Name: lbl("Bredde"), NominalValue: maal(48, "IFCLENGTHMEASURE") }] },
      ],
    };
    expect(trekkUtIfcEgenskaper({ egenskapssett: [sett], enheter })[0]?.egenskaper).toEqual([
      { navn: "Farge", verdi: "Hvit, Grå" },
      { navn: "Mål", verdi: "10, 20", enhet: "mm" },
      { navn: "Temp", verdi: "-10 – 40" },
      { navn: "Profil.Bredde", verdi: 48, enhet: "mm" },
    ]);
  });

  it("output er ren JSON (kan sendes fra mobil-viewer til appen uendret)", () => {
    expect(JSON.parse(JSON.stringify(grupper))).toEqual(grupper);
  });
});
