/**
 * Objektinfo-kortet i 3D-visningen (M5 (2)): gjør `objektValgt` fra `/mobil-viewer` om til
 * seksjoner med rader (etikett · verdi med enhet). Ren funksjon — oversettelsen sendes inn.
 *
 * - Har meldingen `grupper` (IfcEgenskapsGruppe[] fra `trekkUtIfcEgenskaper`, web 2026-11-17),
 *   vises én seksjon pr. gruppe: objektets attributter uten tittel, deretter egenskapssett,
 *   type og mengder med tittel som på web (`EgenskapsPopup.tsx`).
 * - Mangler `grupper` (eldre web-bygg) eller er den tom (råfila ikke hentet), vises de direkte
 *   attributtene som før M5 (2): én seksjon uten tittel, maks 8 rader.
 */
import type { IfcEgenskapsGruppe } from "@sitedoc/shared/tred";

export type Oversett = (nøkkel: string, valg?: { defaultValue?: string }) => string;

export interface ObjektinfoRad {
  etikett: string;
  verdi: string;
}

export interface ObjektinfoSeksjon {
  /** null = objektets egne attributter (vises rett under navnet, uten tittel) */
  tittel: string | null;
  rader: ObjektinfoRad[];
}

/** Ja/Nei for boolske verdier, ellers tall med maks 3 desimaler uten etterfølgende nuller */
export function formaterVerdi(verdi: string | number | boolean, t: Oversett): string {
  if (typeof verdi === "boolean") return verdi ? t("ifc.verdi.ja") : t("ifc.verdi.nei");
  if (typeof verdi === "number") {
    if (Number.isInteger(verdi)) return String(verdi);
    return String(Number(verdi.toFixed(3)));
  }
  return verdi;
}

/** Kjente IFC-navn (LoadBearing, Pset_WallCommon …) oversettes; ukjente vises som i modellen */
function etikett(navn: string, t: Oversett): string {
  return t(`ifc.attributt.${navn}`, { defaultValue: navn });
}

function gruppeTittel(gruppe: IfcEgenskapsGruppe, t: Oversett): string | null {
  if (gruppe.art === "attributter") return null;
  const navn = gruppe.navn ? etikett(gruppe.navn, t) : null;
  const artTekst = gruppe.art === "type" ? t("3d.egenskaper.type")
    : gruppe.art === "mengder" ? t("3d.egenskaper.mengder")
    : navn ? null : t("3d.egenskaper.egenskapssett");
  if (artTekst && navn) return `${artTekst}: ${navn}`;
  return artTekst ?? navn;
}

/** Direkte attributter som før M5 (2) — fallback når `grupper` mangler */
export function filtrerAttributter(attr: Record<string, unknown>, t: Oversett): ObjektinfoRad[] {
  const skjult = new Set([
    "expressID", "type", "GlobalId", "Tag", "OwnerHistory",
    "ObjectPlacement", "Representation", "CompositionType", "ShapeType",
    "Name", // Vises allerede i header
  ]);
  const tom = (s: string) => !s || s === "NOTDEFINED" || s === "null" || s === "undefined" || s === "ELEMENT";
  const visVerdi = (s: string) =>
    s === "true" || s === ".T." ? t("ifc.verdi.ja") : s === "false" || s === ".F." ? t("ifc.verdi.nei") : s;

  const resultat: ObjektinfoRad[] = [];
  // Prioriterte felter først
  const prioritert = ["ObjectType", "Description", "Material", "Reference", "IsExternal", "LoadBearing", "FireRating"];
  for (const nøkkel of prioritert) {
    const verdi = attr[nøkkel];
    if (verdi == null) continue;
    const s = String(verdi);
    if (!tom(s)) resultat.push({ etikett: etikett(nøkkel, t), verdi: visVerdi(s) });
  }
  // Øvrige felter
  for (const [k, v] of Object.entries(attr)) {
    if (skjult.has(k) || prioritert.includes(k)) continue;
    const s = String(v);
    if (tom(s)) continue;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(s)) continue;
    if (resultat.length >= 8) break;
    resultat.push({ etikett: etikett(k, t), verdi: visVerdi(s) });
  }
  return resultat;
}

/** Seksjonene i objektinfo-kortet */
export function lagObjektinfoSeksjoner(
  data: { attributter?: Record<string, unknown> | null; grupper?: IfcEgenskapsGruppe[] | null },
  t: Oversett,
): ObjektinfoSeksjon[] {
  const grupper = Array.isArray(data.grupper)
    ? data.grupper.filter((g) => Array.isArray(g.egenskaper) && g.egenskaper.length > 0)
    : [];
  if (grupper.length === 0) {
    const rader = filtrerAttributter(data.attributter ?? {}, t);
    return rader.length > 0 ? [{ tittel: null, rader }] : [];
  }
  return grupper.map((g) => ({
    tittel: gruppeTittel(g, t),
    rader: g.egenskaper.map((e) => {
      const verdi = formaterVerdi(e.verdi, t);
      return { etikett: etikett(e.navn, t), verdi: e.enhet ? `${verdi} ${e.enhet}` : verdi };
    }),
  }));
}
