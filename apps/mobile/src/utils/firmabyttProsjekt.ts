import { skalNullstilleProsjekt } from "@sitedoc/shared";

/* ============================================================================
 *  Valgt prosjekt ved firmabytte på mobil (ordre 2026-11-15 (19)).
 *
 *  Samme regel som web: `skalNullstilleProsjekt` i @sitedoc/shared. Et
 *  gjesteprosjekt (medlem, eid av et firma brukeren ikke er ansatt i) beholdes;
 *  et prosjekt i forrige firma som ikke er gjest nullstilles som før.
 *
 *  Mobilens prosjektkontekst kjenner bare prosjekt-ID-en. Eieren hentes fra
 *  gjestelista (som har `primaryOrganizationId`); er prosjektet ikke gjest, var
 *  det valgt i forrige firma — eieren settes da til forrige firma.
 *
 *  Uten valgt firma (utlogging/firma fjernet) nullstilles alltid, som før.
 * ========================================================================== */

export type FirmabyttUtfall = "behold" | "nullstill" | "vent";

export function firmabyttUtfall(input: {
  forrigeFirmaId: string;
  valgtFirmaId: string | null;
  prosjektId: string | null;
  gjester: ReadonlyArray<{ id: string; primaryOrganizationId: string | null }>;
  lasterGjester: boolean;
}): FirmabyttUtfall {
  const { forrigeFirmaId, valgtFirmaId, prosjektId, gjester, lasterGjester } = input;
  if (!prosjektId) return "behold";
  if (!valgtFirmaId) return "nullstill";
  if (lasterGjester) return "vent";
  const gjest = gjester.find((g) => g.id === prosjektId);
  return skalNullstilleProsjekt({
    valgtFirmaId,
    prosjekt: { id: prosjektId, primaryOrganizationId: gjest ? gjest.primaryOrganizationId : forrigeFirmaId },
    gjesteIder: gjester.map((g) => g.id),
    lasterGjester: false,
  })
    ? "nullstill"
    : "behold";
}
