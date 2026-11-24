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
      maskinOverArbeidForklaring: (maskin, arbeid) =>
        t("timer.attestering.forklaringMaskinOverArbeid", {
          maskin: maskin.toLocaleString(i18n.language, { maximumFractionDigits: 2 }),
          arbeid: arbeid.toLocaleString(i18n.language, { maximumFractionDigits: 2 }),
        }),
      reiseUnderTerskelMerke: (u) => {
        const enhet = (n: number) =>
          u.enhet === "km"
            ? t("timer.reiseTerskel.km", { km: n.toLocaleString(i18n.language, { maximumFractionDigits: 1 }) })
            : t("timer.reiseTerskel.min", { min: n.toLocaleString(i18n.language, { maximumFractionDigits: 0 }) });
        return {
          tekst: t("timer.attestering.tabell.merke.reiseUnderTerskel"),
          forklaring:
            u.maalt == null
              ? t("timer.attestering.tabell.merke.reiseUnderTerskelForklaringUtenMaaling", { terskel: enhet(u.terskel) })
              : t("timer.attestering.tabell.merke.reiseUnderTerskelForklaring", { maalt: enhet(u.maalt), terskel: enhet(u.terskel) }),
        };
      },
      tekst: {
        forslagSperre: t("timer.forslagValg.attesterBlokkert"),
        maskinUtenTimerad: t("timer.attestering.tabell.maskinUtenTimerad"),
        maskinforerbevis: t("timer.maskinforerbevis.leder"),
        merkeUtenTimerad: t("timer.attestering.tabell.merke.utenTimerad"),
        merkeUtenTimeradForklaring: t("timer.attestering.tabell.merke.utenTimeradForklaring"),
        merkeUtenForerbevis: t("timer.attestering.tabell.merke.utenForerbevis"),
        merkeMaskinOverArbeid: t("timer.attestering.merkeMaskinOverArbeid"),
        tilleggskrav: t("timer.attestering.sedel.tilleggskrav"),
        tilByggherre: t("timer.gruppe.tilByggherre"),
        fravaerUtenProsjekt: t("timer.detalj.fravaerUtenProsjekt"),
        annetProsjekt: t("timer.attestering.pivot.annetProsjekt"),
        reise: t("timer.attestering.tabell.type.reise"),
        utenUnderprosjekt: t("timer.attestering.registrering.uten"),
        statusVenter: t("timer.attestering.tabell.status.venter"),
        statusAttestert: t("timer.attestering.tabell.status.attestert"),
        statusReturnert: t("timer.attestering.tabell.status.returnert"),
      },
    });
  }, [sedler, katalog, avdelinger, t, i18n.language, ukeAvvikTekst]);
}
