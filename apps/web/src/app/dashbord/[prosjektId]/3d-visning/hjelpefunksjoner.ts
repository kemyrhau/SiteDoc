/* ------------------------------------------------------------------ */
/*  Hjelpefunksjoner for 3D-visning                                     */
/* ------------------------------------------------------------------ */

import { INTERNE_FELT, QUANTITY_ENHETER } from "./konstanter";
import type { EgenskapVerdi, EgenskapGruppe, OverflateData } from "./typer";

/** WEBIFC-konstanter cachet ved oppstart — brukes av finnIfcTypeKode */
let _webifcKonstanter: Record<string, number> | null = null;

export function settWebifcKonstanter(konstanter: Record<string, number>) {
  _webifcKonstanter = konstanter;
}

export function hentWebifcKonstanter(): Record<string, number> | null {
  return _webifcKonstanter;
}

/** Konverterer lesbart IFC-kategorinavn tilbake til WEBIFC-typekode.
 *  F.eks. "Wall" -> IFCWALL, "Flowsegment" -> IFCFLOWSEGMENT.
 *  Returnerer null hvis ingen match finnes. */
export function finnIfcTypeKode(kategori: string): number | null {
  if (!_webifcKonstanter) return null;
  const upper = `IFC${kategori.toUpperCase()}`;
  for (const suffix of ["", "STANDARDCASE", "ELEMENTEDCASE"]) {
    const kode = _webifcKonstanter[upper + suffix];
    if (typeof kode === "number") return kode;
  }
  return null;
}

export function formaterVerdi(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "Ja" : "Nei";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

export function hentNavn(item: Record<string, unknown>): string {
  const n = item["Name"];
  if (n && typeof n === "object" && "value" in (n as Record<string, unknown>)) {
    return String((n as { value: unknown }).value);
  }
  return "Egenskaper";
}

export function hentVerdi(obj: Record<string, unknown>): unknown {
  // IFCPROPERTYSINGLEVALUE -> NominalValue
  const nomVal = obj["NominalValue"];
  if (nomVal && typeof nomVal === "object" && "value" in (nomVal as Record<string, unknown>)) {
    const val = (nomVal as { value: unknown }).value;
    if (val === null || val === undefined || val === "") return null;
    const unit = obj["Unit"] as Record<string, unknown> | undefined;
    if (unit && typeof unit === "object" && "value" in (unit as Record<string, unknown>)) {
      return `${val} ${(unit as { value: unknown }).value}`;
    }
    return val;
  }

  // IFCELEMENTQUANTITY -> LengthValue, AreaValue, etc.
  for (const felt of ["LengthValue", "AreaValue", "VolumeValue", "WeightValue", "CountValue", "TimeValue"]) {
    const v = obj[felt];
    if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
      const val = (v as { value: unknown }).value;
      if (val === null || val === undefined || val === "") return null;
      const enhet = QUANTITY_ENHETER[felt] ?? "";
      if (enhet && typeof val === "number") {
        return `${Number(val.toFixed(3))} ${enhet}`;
      }
      return val;
    }
  }

  // IFCPROPERTYENUMERATEDVALUE -> EnumerationValues
  const enumVals = obj["EnumerationValues"] as unknown[] | undefined;
  if (Array.isArray(enumVals) && enumVals.length > 0) {
    const vals = enumVals
      .map((ev) => (ev && typeof ev === "object" && "value" in (ev as Record<string, unknown>)) ? (ev as { value: unknown }).value : null)
      .filter((v) => v != null && v !== "");
    if (vals.length > 0) return vals.join(", ");
  }

  // IFCPROPERTYLISTVALUE -> ListValues
  const listVals = obj["ListValues"] as unknown[] | undefined;
  if (Array.isArray(listVals) && listVals.length > 0) {
    const vals = listVals
      .map((lv) => (lv && typeof lv === "object" && "value" in (lv as Record<string, unknown>)) ? (lv as { value: unknown }).value : null)
      .filter((v) => v != null && v !== "");
    if (vals.length > 0) return vals.join(", ");
  }

  // IFCPROPERTYBOUNDEDVALUE -> UpperBoundValue / LowerBoundValue
  const upper = obj["UpperBoundValue"] as Record<string, unknown> | undefined;
  const lower = obj["LowerBoundValue"] as Record<string, unknown> | undefined;
  if (upper && typeof upper === "object" && "value" in upper) {
    const uv = upper.value;
    const lv = lower && typeof lower === "object" && "value" in lower ? lower.value : null;
    if (lv != null) return `${lv} – ${uv}`;
    return uv;
  }

  // Direkte verdi
  if ("value" in obj) {
    const val = (obj as { value: unknown }).value;
    if (val !== null && val !== undefined && val !== "") return val;
  }

  return null;
}

export function trekkUtEgenskaper(
  dataArray: Record<string, unknown>[],
): EgenskapGruppe[] {
  const grupper: EgenskapGruppe[] = [];
  for (const item of dataArray) {
    const navn = hentNavn(item);

    const hasProps = item["HasProperties"];
    if (Array.isArray(hasProps) && hasProps.length > 0) {
      const egenskaper: Record<string, EgenskapVerdi> = {};
      for (const prop of hasProps as Record<string, unknown>[]) {
        const propNavn = hentNavn(prop);
        const verdi = hentVerdi(prop);
        if (verdi !== null) {
          egenskaper[propNavn] = { value: verdi };
        }
      }
      if (Object.keys(egenskaper).length > 0) {
        grupper.push({ navn, egenskaper });
      }
      continue;
    }

    const hasQuant = item["HasQuantities"];
    if (Array.isArray(hasQuant) && hasQuant.length > 0) {
      const egenskaper: Record<string, EgenskapVerdi> = {};
      for (const q of hasQuant as Record<string, unknown>[]) {
        const qNavn = hentNavn(q);
        const verdi = hentVerdi(q);
        if (verdi !== null) {
          egenskaper[qNavn] = { value: verdi };
        }
      }
      if (Object.keys(egenskaper).length > 0) {
        grupper.push({ navn, egenskaper });
      }
      continue;
    }

    const egenskaper: Record<string, EgenskapVerdi> = {};
    for (const [k, v] of Object.entries(item)) {
      if (INTERNE_FELT.has(k)) continue;
      if (Array.isArray(v)) {
        grupper.push(...trekkUtEgenskaper(v as Record<string, unknown>[]));
      } else if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
        egenskaper[k] = v as EgenskapVerdi;
      }
    }
    if (Object.keys(egenskaper).length > 0) {
      grupper.push({ navn, egenskaper });
    }
  }
  return grupper;
}

/** Hjelpefunksjon for å parse LandXML og opprette OverflateData */
export async function parseLandXMLFil(fil: File): Promise<OverflateData> {
  const tekst = await fil.text();
  const { parseLandXML } = await import("@/lib/landxml-parser");
  const tin = await parseLandXML(tekst);

  return {
    id: crypto.randomUUID(),
    navn: tin.navn ?? fil.name.replace(/\.[^.]+$/, ""),
    kilde: "landxml",
    vertices: tin.vertices,
    triangles: tin.triangles,
    bbox: tin.bbox,
  };
}
