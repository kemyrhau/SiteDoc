/* ------------------------------------------------------------------ */
/*  Konstanter for 3D-visning                                           */
/* ------------------------------------------------------------------ */

/** Modul-level cache for nedlastede IFC-filer.
 *  Overlever SPA-navigasjon (men ikke full sidelasting). */
export const ifcFilCache = new Map<string, Uint8Array>();

/** Klassifiseringskoder og farger (ASPRS) */
export const KLASSE_FARGER: Record<number, string> = {
  0: "#999999", 1: "#cccccc", 2: "#8B4513", 3: "#90EE90",
  4: "#32CD32", 5: "#006400", 6: "#FF0000", 7: "#FF69B4",
  8: "#FFD700", 9: "#0000FF", 10: "#808080", 11: "#A9A9A9",
  12: "#DDA0DD", 13: "#FFA500", 14: "#FF8C00", 15: "#8B0000",
  16: "#FF4500", 17: "#696969", 18: "#FF1493",
};

export const KLASSE_NAVN: Record<number, string> = {
  0: "Aldri klassifisert", 1: "Uklassifisert", 2: "Bakke",
  3: "Lav vegetasjon", 4: "Middels vegetasjon", 5: "Høy vegetasjon",
  6: "Bygning", 7: "Støy (lav)", 8: "Nøkkelpunkt",
  9: "Vann", 10: "Jernbane", 11: "Veioverflate",
  12: "Overlapp", 13: "Ledning (vern)", 14: "Ledning (leder)",
  15: "Sendemast", 16: "Ledningskobling", 17: "Bro", 18: "Støy (høy)",
};

/** Interne IFC-felt som ikke er nyttige for brukeren */
export const INTERNE_FELT = new Set([
  "_category", "_localId", "_guid", "type", "Name", "GlobalId",
  "OwnerHistory", "ObjectPlacement", "Representation",
  "RepresentationMaps", "HasAssignments", "HasContext",
  "IsDecomposedBy", "Decomposes", "HasAssociations",
  "expressID",
]);

/** Enheter for IFC-quantities */
export const QUANTITY_ENHETER: Record<string, string> = {
  LengthValue: "mm",
  AreaValue: "m²",
  VolumeValue: "m³",
  WeightValue: "kg",
  CountValue: "",
  TimeValue: "s",
};
