/**
 * web-ifc-oppslag for egenskapskortet (W3 web, M5 (2) mobil-viewer). Selve uttrekket er
 * den rene funksjonen `trekkUtIfcEgenskaper` i `@sitedoc/shared/tred`; her hentes bare
 * rådataene fra web-ifc. Ingen verdi-import av web-ifc: IFC-typekoden sendes inn av kalleren.
 */
import { lesIfcEnheter, trekkUtIfcEgenskaper, type IfcEgenskapsGruppe, type IfcEnheter } from "@sitedoc/shared/tred";

export interface IfcEgenskapsApi {
  GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number };
  GetLine: (m: number, id: number, flatten?: boolean) => Record<string, unknown>;
  properties: {
    getItemProperties: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>>;
    getPropertySets: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>[]>;
    getTypeProperties: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>[]>;
  };
}

/** Modellens enheter (IfcUnitAssignment), lest én gang pr. åpnet modell */
export function hentModellEnheter(
  api: IfcEgenskapsApi,
  modelId: number,
  ifcUnitAssignmentType: number,
  cache: Map<number, IfcEnheter>,
): IfcEnheter {
  const lagret = cache.get(modelId);
  if (lagret) return lagret;
  let enheter: IfcEnheter = {};
  try {
    const ids = api.GetLineIDsWithType(modelId, ifcUnitAssignmentType);
    if (ids.size() > 0) enheter = lesIfcEnheter(api.GetLine(modelId, ids.get(0), true).Units);
  } catch { /* Uten enheter vises verdiene uten enhet */ }
  cache.set(modelId, enheter);
  return enheter;
}

/** Objektets egenskapsgrupper: attributter, egenskapssett, type og mengder */
export async function hentIfcEgenskapsGrupper(
  api: IfcEgenskapsApi,
  modelId: number,
  expressId: number,
  enheter: IfcEnheter,
): Promise<IfcEgenskapsGruppe[]> {
  const [objekt, egenskapssett, typer] = await Promise.all([
    api.properties.getItemProperties(modelId, expressId, true).catch(() => null),
    api.properties.getPropertySets(modelId, expressId, true).catch(() => []),
    api.properties.getTypeProperties(modelId, expressId, true).catch(() => []),
  ]);
  return trekkUtIfcEgenskaper({ objekt, egenskapssett, typer, enheter });
}
