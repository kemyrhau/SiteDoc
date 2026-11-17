/**
 * Egenskapene til ett IFC-objekt, gruppert for egenskapskortet (W3 web, M5 (2) mobil).
 *
 * Ren funksjon uten avhengigheter: input er det web-ifc gir i klienten
 * (`properties.getItemProperties` / `getPropertySets` / `getTypeProperties`, alle med
 * `recursive = true`) og enhetene fra modellens `IfcUnitAssignment`. Output er rene
 * JSON-verdier, så det kan sendes uendret fra mobil-viewer til appen.
 *
 * Grupper (i denne rekkefølgen):
 * - `attributter`: objektets direkte attributter (Description, ObjectType, Tag, OverallHeight …)
 * - `egenskapssett`: ett pr. IfcPropertySet (Pset_* og egne sett)
 * - `type`: type-objektets attributter og egenskapssett (IfcWallType o.l.)
 * - `mengder`: ett pr. IfcElementQuantity (Qto_*, BaseQuantities): lengde, areal, volum …
 *
 * Tomme verdier, NOTDEFINED og interne ID-er (expressID, GlobalId, referanser) utelates.
 */

export type IfcEgenskapsArt = "attributter" | "egenskapssett" | "type" | "mengder";

export interface IfcEgenskap {
  navn: string;
  verdi: string | number | boolean;
  /** Enhet fra modellen, f.eks. "mm", "m²". Mangler når verdien ikke har enhet. */
  enhet?: string;
}

export interface IfcEgenskapsGruppe {
  art: IfcEgenskapsArt;
  /** Settets eller typens navn fra modellen; null for objektets egne attributter */
  navn: string | null;
  egenskaper: IfcEgenskap[];
}

/** Modellens enheter pr. IFC-enhetstype, f.eks. { LENGTHUNIT: "mm", AREAUNIT: "m²" } */
export type IfcEnheter = Partial<Record<string, string>>;

export interface IfcEgenskapsInput {
  /** getItemProperties(…, true) */
  objekt?: Record<string, unknown> | null;
  /** getPropertySets(…, true): IfcPropertySet og IfcElementQuantity */
  egenskapssett?: Record<string, unknown>[] | null;
  /** getTypeProperties(…, true): type-objektene, med HasPropertySets */
  typer?: Record<string, unknown>[] | null;
  enheter?: IfcEnheter;
}

type Rec = Record<string, unknown>;

/** Attributter som er interne ID-er, referanser eller vises andre steder (Name = tittel) */
const INTERNE_ATTRIBUTTER = new Set([
  "expressID", "type", "GlobalId", "Name", "OwnerHistory", "ObjectPlacement",
  "Representation", "RepresentationMaps", "HasPropertySets", "HasAssignments",
  "HasContext", "IsDecomposedBy", "Decomposes", "HasAssociations", "IsTypedBy",
  "IsDefinedBy", "_category", "_localId", "_guid",
]);

/** Enum-verdier som betyr «ikke angitt» */
const TOMME_ENUM = new Set(["NOTDEFINED", "USERDEFINED"]);

/** Målets IFC-typenavn → enhetstypen i IfcUnitAssignment */
const MAAL_TIL_ENHETSTYPE: Record<string, string> = {
  IFCLENGTHMEASURE: "LENGTHUNIT",
  IFCPOSITIVELENGTHMEASURE: "LENGTHUNIT",
  IFCNONNEGATIVELENGTHMEASURE: "LENGTHUNIT",
  IFCAREAMEASURE: "AREAUNIT",
  IFCVOLUMEMEASURE: "VOLUMEUNIT",
  IFCPLANEANGLEMEASURE: "PLANEANGLEUNIT",
  IFCPOSITIVEPLANEANGLEMEASURE: "PLANEANGLEUNIT",
  IFCMASSMEASURE: "MASSUNIT",
  IFCTIMEMEASURE: "TIMEUNIT",
  IFCTHERMODYNAMICTEMPERATUREMEASURE: "THERMODYNAMICTEMPERATUREUNIT",
};

/** IfcElementQuantity-feltene og enhetstypen deres (brukes når verdien mangler typenavn) */
const MENGDEFELT: [string, string | null][] = [
  ["LengthValue", "LENGTHUNIT"],
  ["AreaValue", "AREAUNIT"],
  ["VolumeValue", "VOLUMEUNIT"],
  ["WeightValue", "MASSUNIT"],
  ["TimeValue", "TIMEUNIT"],
  ["CountValue", null],
];

const SI_PREFIKS: Record<string, string> = {
  EXA: "E", PETA: "P", TERA: "T", GIGA: "G", MEGA: "M", KILO: "k", HECTO: "h", DECA: "da",
  DECI: "d", CENTI: "c", MILLI: "m", MICRO: "µ", NANO: "n", PICO: "p",
};

const SI_NAVN: Record<string, string> = {
  METRE: "m", SQUARE_METRE: "m²", CUBIC_METRE: "m³", GRAM: "g", SECOND: "s",
  RADIAN: "rad", KELVIN: "K", DEGREE_CELSIUS: "°C", WATT: "W", JOULE: "J",
  NEWTON: "N", PASCAL: "Pa", VOLT: "V", AMPERE: "A", HERTZ: "Hz", LUX: "lx",
  LUMEN: "lm", CANDELA: "cd", OHM: "Ω", LITRE: "l",
};

const KONVERTERT_NAVN: Record<string, string> = { DEGREE: "°" };

function erRec(v: unknown): v is Rec {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

/** Primitiv verdi fra et web-ifc-verdiobjekt ({ value } eller målets _representationValue) */
function primitiv(v: unknown): string | number | boolean | null {
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (!erRec(v)) return null;
  const raw = "value" in v ? v.value : v._representationValue;
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return raw;
  return null;
}

function tekst(v: unknown): string | null {
  const p = primitiv(v);
  return p == null || p === "" ? null : String(p);
}

/** Tom, ikke angitt eller ikke-endelig → null; tall rundes til 3 desimaler */
function rens(v: string | number | boolean | null): string | number | boolean | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s === "" || TOMME_ENUM.has(s) ? null : s;
  }
  if (typeof v === "number") return Number.isFinite(v) ? Number(v.toFixed(3)) : null;
  return v;
}

/** Enhetstekst for en IfcSIUnit / IfcConversionBasedUnit / IfcDerivedUnit */
function enhetTekst(enhet: unknown): string | null {
  if (!erRec(enhet)) return null;
  const navn = tekst(enhet.Name);
  if (!navn) return null;
  if (navn in SI_NAVN) {
    const prefiks = tekst(enhet.Prefix);
    return `${prefiks ? (SI_PREFIKS[prefiks] ?? "") : ""}${SI_NAVN[navn]}`;
  }
  return KONVERTERT_NAVN[navn] ?? navn;
}

/** Modellens enheter fra IfcUnitAssignment.Units (lest med recursive = true) */
export function lesIfcEnheter(units: unknown): IfcEnheter {
  const enheter: IfcEnheter = {};
  if (!Array.isArray(units)) return enheter;
  for (const u of units) {
    if (!erRec(u)) continue;
    const enhetstype = tekst(u.UnitType);
    const t = enhetTekst(u);
    if (enhetstype && t && !(enhetstype in enheter)) enheter[enhetstype] = t;
  }
  return enheter;
}

function enhetForMaal(verdi: unknown, enheter: IfcEnheter, reserveType: string | null = null): string | undefined {
  const maalNavn = erRec(verdi) && typeof verdi.name === "string" ? verdi.name.toUpperCase() : null;
  const enhetstype = (maalNavn && MAAL_TIL_ENHETSTYPE[maalNavn]) ?? (maalNavn ? null : reserveType);
  return enhetstype ? enheter[enhetstype] : undefined;
}

function lagEgenskap(navn: string, verdi: string | number | boolean | null, enhet?: string): IfcEgenskap | null {
  const v = rens(verdi);
  if (v == null) return null;
  return enhet ? { navn, verdi: v, enhet } : { navn, verdi: v };
}

/** Direkte attributter på et objekt eller et type-objekt */
function attributter(obj: Rec, enheter: IfcEnheter): IfcEgenskap[] {
  const ut: IfcEgenskap[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (INTERNE_ATTRIBUTTER.has(k) || Array.isArray(v)) continue;
    // Referanser til andre linjer (recursive = true gir objekt med expressID; ellers handle type 5)
    if (erRec(v) && ("expressID" in v || v.type === 5)) continue;
    const e = lagEgenskap(k, primitiv(v), enhetForMaal(v, enheter));
    if (e) ut.push(e);
  }
  return ut;
}

/** Én IfcProperty (single, enumerated, list, bounded, complex) → egenskaper */
function egenskapFraProperty(prop: Rec, enheter: IfcEnheter, prefiks = ""): IfcEgenskap[] {
  const navn = `${prefiks}${tekst(prop.Name) ?? "?"}`;
  const nestet = prop.HasProperties;
  if (Array.isArray(nestet)) {
    return nestet.filter(erRec).flatMap((n) => egenskapFraProperty(n, enheter, `${navn}.`));
  }
  const egenEnhet = enhetTekst(prop.Unit) ?? undefined;
  if ("NominalValue" in prop) {
    const e = lagEgenskap(navn, primitiv(prop.NominalValue), egenEnhet ?? enhetForMaal(prop.NominalValue, enheter));
    return e ? [e] : [];
  }
  for (const felt of ["EnumerationValues", "ListValues"]) {
    const liste = prop[felt];
    if (Array.isArray(liste)) {
      const verdier = liste.map((x) => rens(primitiv(x))).filter((x) => x != null);
      const enhet = egenEnhet ?? (liste[0] !== undefined ? enhetForMaal(liste[0], enheter) : undefined);
      const e = lagEgenskap(navn, verdier.length ? verdier.join(", ") : null, enhet);
      return e ? [e] : [];
    }
  }
  if ("UpperBoundValue" in prop || "LowerBoundValue" in prop) {
    const ned = rens(primitiv(prop.LowerBoundValue));
    const opp = rens(primitiv(prop.UpperBoundValue));
    const verdi = ned != null && opp != null ? `${ned} – ${opp}` : (opp ?? ned);
    const enhet = egenEnhet ?? enhetForMaal(prop.UpperBoundValue ?? prop.LowerBoundValue, enheter);
    const e = lagEgenskap(navn, verdi, enhet);
    return e ? [e] : [];
  }
  return [];
}

/** Én IfcPhysicalQuantity → egenskap med enhet */
function egenskapFraMengde(q: Rec, enheter: IfcEnheter): IfcEgenskap | null {
  const navn = tekst(q.Name) ?? "?";
  for (const [felt, enhetstype] of MENGDEFELT) {
    if (!(felt in q) || q[felt] == null) continue;
    const enhet = enhetTekst(q.Unit) ?? enhetForMaal(q[felt], enheter, enhetstype);
    return lagEgenskap(navn, primitiv(q[felt]), enhet);
  }
  return null;
}

/** Ett egenskapssett eller mengdesett → gruppe (null hvis tomt) */
function settTilGruppe(sett: Rec, art: IfcEgenskapsArt, enheter: IfcEnheter): IfcEgenskapsGruppe | null {
  const navn = tekst(sett.Name);
  const mengder = sett.Quantities ?? sett.HasQuantities;
  if (Array.isArray(mengder)) {
    const egenskaper = mengder.filter(erRec).map((q) => egenskapFraMengde(q, enheter)).filter((e): e is IfcEgenskap => e != null);
    return egenskaper.length ? { art: "mengder", navn, egenskaper } : null;
  }
  const props = sett.HasProperties;
  if (Array.isArray(props)) {
    const egenskaper = props.filter(erRec).flatMap((p) => egenskapFraProperty(p, enheter));
    return egenskaper.length ? { art, navn, egenskaper } : null;
  }
  return null;
}

export function trekkUtIfcEgenskaper(inn: IfcEgenskapsInput): IfcEgenskapsGruppe[] {
  const enheter = inn.enheter ?? {};
  const grupper: IfcEgenskapsGruppe[] = [];

  if (erRec(inn.objekt)) {
    const egenskaper = attributter(inn.objekt, enheter);
    if (egenskaper.length) grupper.push({ art: "attributter", navn: null, egenskaper });
  }

  const mengder: IfcEgenskapsGruppe[] = [];
  for (const sett of inn.egenskapssett ?? []) {
    if (!erRec(sett)) continue;
    const g = settTilGruppe(sett, "egenskapssett", enheter);
    if (g) (g.art === "mengder" ? mengder : grupper).push(g);
  }

  for (const typeObj of inn.typer ?? []) {
    if (!erRec(typeObj)) continue;
    const typeNavn = tekst(typeObj.Name);
    const egne = attributter(typeObj, enheter);
    if (egne.length) grupper.push({ art: "type", navn: typeNavn, egenskaper: egne });
    const settListe = typeObj.HasPropertySets;
    if (!Array.isArray(settListe)) continue;
    for (const sett of settListe) {
      if (!erRec(sett)) continue;
      const g = settTilGruppe(sett, "type", enheter);
      if (g) (g.art === "mengder" ? mengder : grupper).push(g);
    }
  }

  return [...grupper, ...mengder];
}
