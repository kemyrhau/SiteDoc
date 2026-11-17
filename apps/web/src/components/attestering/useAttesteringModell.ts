"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { NormtakBruddData } from "@sitedoc/shared";
import { trpc } from "@/lib/trpc";
import { normtakBruddLinje } from "@/lib/normtakBrudd";
import { useKatalogNavn } from "./DagsKort";
import { byggAttesteringModell, type AttDag, type AttSedel } from "./attestering-tabell";

/**
 * Tabellmodellen med samme oppslag og tekster på alle attesteringsflatene (d2b-2):
 * firmaets faner, prosjektattesteringen og detaljsiden. Ett sted, så flatene ikke drifter.
 *
 * `medAvdeling`: avdelingsnavn hentes bare der brukeren attesterer for firmaet
 * (prosjektlederen har ikke firmaets avdelingsliste).
 */
export function useAttesteringModell(
  orgId: string | undefined,
  sedler: readonly AttSedel[],
  valg: { medAvdeling?: boolean; ukeAvvikTekst?: (s: AttSedel) => string | null } = {},
): AttDag[] {
  const { t, i18n } = useTranslation();
  const katalog = useKatalogNavn(orgId);
  const { data: avdelinger } = trpc.avdeling.hentAlle.useQuery(
    { organizationId: orgId ?? "" },
    { enabled: !!orgId && !!valg.medAvdeling },
  );
  const { ukeAvvikTekst } = valg;
  return useMemo(() => {
    const avdNavn = new Map((avdelinger ?? []).map((a) => [a.id, a.navn]));
    return byggAttesteringModell(sedler, {
      ...katalog,
      avdelingNavn: (id) => (id ? avdNavn.get(id) ?? null : null),
      normtakLinje: (s) =>
        normtakBruddLinje(t, (s as unknown as { fravaerNormtakBrudd?: NormtakBruddData | null }).fravaerNormtakBrudd ?? null, i18n.language),
      ukeAvvikTekst: ukeAvvikTekst ?? (() => null),
      tekst: {
        forslagSperre: t("timer.forslagValg.attesterBlokkert"),
        maskinUtenTimerad: t("timer.attestering.tabell.maskinUtenTimerad"),
        maskinforerbevis: t("timer.maskinforerbevis.leder"),
        tilleggskrav: t("timer.attestering.sedel.tilleggskrav"),
        tilByggherre: t("timer.gruppe.tilByggherre"),
        fravaerUtenProsjekt: t("timer.detalj.fravaerUtenProsjekt"),
        annetProsjekt: t("timer.attestering.pivot.annetProsjekt"),
        reise: t("timer.attestering.tabell.type.reise"),
        statusVenter: t("timer.attestering.tabell.status.venter"),
        statusAttestert: t("timer.attestering.tabell.status.attestert"),
        statusReturnert: t("timer.attestering.tabell.status.returnert"),
      },
    });
  }, [sedler, katalog, avdelinger, t, i18n.language, ukeAvvikTekst]);
}
