import { skalNullstilleProsjekt } from "@sitedoc/shared";
import { gjesteIderForNullstilling } from "@sitedoc/shared";

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
 *
 *  ADMIN-GJEST tillegg A (2026-11-25) / ADMIN-UTEN-GJESTEGRUPPE (2026-11-26):
 *  `adminUtenGjestegruppe` (sitedoc_admin, uansett firma) → gjesteprosjektet beskyttes ikke
 *  (`gjesteIderForNullstilling`). Eieren slås fortsatt opp i gjestelista, så et
 *  gjesteprosjekt eid av det nye firmaet beholdes.
 * ========================================================================== */

export type FirmabyttUtfall = "behold" | "nullstill" | "vent";

export function firmabyttUtfall(input: {
  forrigeFirmaId: string;
  valgtFirmaId: string | null;
  prosjektId: string | null;
  gjester: ReadonlyArray<{ id: string; primaryOrganizationId: string | null }>;
  lasterGjester: boolean;
  adminUtenGjestegruppe?: boolean;
}): FirmabyttUtfall {
  const { forrigeFirmaId, valgtFirmaId, prosjektId, gjester, lasterGjester } = input;
  if (!prosjektId) return "behold";
  if (!valgtFirmaId) return "nullstill";
  if (lasterGjester) return "vent";
  const gjest = gjester.find((g) => g.id === prosjektId);
  return skalNullstilleProsjekt({
    valgtFirmaId,
    prosjekt: { id: prosjektId, primaryOrganizationId: gjest ? gjest.primaryOrganizationId : forrigeFirmaId },
    gjesteIder: gjesteIderForNullstilling(
      gjester.map((g) => g.id),
      input.adminUtenGjestegruppe ?? false,
    ),
    lasterGjester: false,
  })
    ? "nullstill"
    : "behold";
}

/**
 * ADMIN-UTEN-GJESTEGRUPPE (Kenneth 2026-11-26) punkt 2: sitedoc_admin som står med et
 * gjesteprosjekt valgt (lagret fra før, også i eget firma) får valget nullstilt på samme måte
 * som ved firmabytte — uten at firmaet byttes. Samme regel (`firmabyttUtfall`), med valgt firma
 * som «forrige»: et prosjekt som ikke er gjest, regnes da som det valgte firmaets og beholdes;
 * et gjesteprosjekt i et annet firma nullstilles. Andre roller: alltid «behold».
 */
export function adminValgtGjestUtfall(input: {
  valgtFirmaId: string | null;
  prosjektId: string | null;
  gjester: ReadonlyArray<{ id: string; primaryOrganizationId: string | null }>;
  lasterGjester: boolean;
  adminUtenGjestegruppe: boolean;
}): FirmabyttUtfall {
  if (!input.adminUtenGjestegruppe || !input.valgtFirmaId || !input.prosjektId) return "behold";
  return firmabyttUtfall({
    forrigeFirmaId: input.valgtFirmaId,
    valgtFirmaId: input.valgtFirmaId,
    prosjektId: input.prosjektId,
    gjester: input.gjester,
    lasterGjester: input.lasterGjester,
    adminUtenGjestegruppe: true,
  });
}
