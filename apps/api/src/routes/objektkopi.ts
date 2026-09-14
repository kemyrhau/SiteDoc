import type { Prisma } from "@sitedoc/db";

/**
 * Dyp kopi av mal-objekt-trær mellom tabellene (ReportObject / OrganizationTemplateObject /
 * BibliotekMalObjekt). Ekstrahert fra firmamal.ts (vei C del 1) fordi lånevegen fra
 * sentralarkivet nå leser BibliotekMalObjekt-RADER og kopierer dem verbatim inn i firma-
 * og prosjektmaler — samme to-pass-mekanikk som promotering/synk allerede brukte.
 *
 * To-pass id-mapping: pass 1 oppretter uten parentId og bygger gammel→ny id-map, pass 2
 * setter parentId. Bevarer treet uansett sortOrder, og kopierer `config`/`translations`
 * VERBATIM (zone-regelen, MALBYGGER.md) — ingen felt-bygging fra bunnen som kunne tape zone.
 */

/** Kilde-objekt slik det leses fra en mal-objekt-tabell (felles form for alle tre). */
export type KildeObjekt = {
  id: string;
  parentId: string | null;
  type: string;
  label: string;
  config: Prisma.JsonValue;
  translations: Prisma.JsonValue;
  sortOrder: number;
  required: boolean;
};

export async function kopierObjektTre(
  kildeObjekter: KildeObjekt[],
  opprett: (data: {
    type: string;
    label: string;
    config: Prisma.InputJsonValue;
    translations: Prisma.InputJsonValue;
    sortOrder: number;
    required: boolean;
  }) => Promise<{ id: string }>,
  settParent: (id: string, parentId: string) => Promise<void>,
): Promise<void> {
  const idMap = new Map<string, string>();
  for (const obj of kildeObjekter) {
    const nytt = await opprett({
      type: obj.type,
      label: obj.label,
      config: (obj.config ?? {}) as Prisma.InputJsonValue,
      translations: (obj.translations ?? {}) as Prisma.InputJsonValue,
      sortOrder: obj.sortOrder,
      required: obj.required,
    });
    idMap.set(obj.id, nytt.id);
  }
  for (const obj of kildeObjekter) {
    if (!obj.parentId) continue;
    const nyId = idMap.get(obj.id);
    const nyParentId = idMap.get(obj.parentId);
    if (nyId && nyParentId) await settParent(nyId, nyParentId);
  }
}
