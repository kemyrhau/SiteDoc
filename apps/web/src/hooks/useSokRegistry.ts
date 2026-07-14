"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { useNyNavigasjon } from "@/hooks/useNyNavigasjon";
import { useInnstillingerKort } from "@/lib/innstillinger-kort";
import {
  kontakterElement,
  hrefForSidebarElement,
  useSidebarElementer,
} from "@/components/layout/sidebar-elementer";
import { useFirmaNavElementer } from "@/components/layout/firma-nav";
import { useDypeSider } from "@/components/layout/dype-sider";
import { normaliserSok, synonymerFor } from "@/lib/sok-match";

// normaliserSok bor nå i @/lib/sok-match (én kilde) — re-eksporteres her for
// bakoverkompatibilitet (SokModal m.fl. importerer den herfra).
export { normaliserSok };

/**
 * Søkeregister for den globale søkemodalen (steg iv).
 *
 * Utledes fra de SAMME kildene som huben og sidebaren — ingen parallell,
 * drift-utsatt liste. Underlenker (hub-kortenes chips) blir egne treff, så
 * «lønnsart» finner Firma › Timer › Lønnsarter. Gating arves fra kilde-hookene
 * (useInnstillingerKort / useSidebarElementer / useFirmaNavElementer), så
 * treff filtreres på brukerens faktiske tilgang.
 */

export type SokGruppe = "innstillinger" | "sider";

export interface SokTreff {
  id: string;
  gruppe: SokGruppe;
  tittel: string;
  brodsmule: string[];
  href: string;
  /** Diakritikk-normalisert søketekst (tittel + brødsmule). */
  norm: string;
}

export function useSokRegistry(): SokTreff[] {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const nyNav = useNyNavigasjon();
  const { firmaKort, prosjektKort } = useInnstillingerKort();
  const { filtrertHovedelementer } = useSidebarElementer();
  const firmaNav = useFirmaNavElementer();
  const dypeSider = useDypeSider();

  return useMemo(() => {
    const treff: SokTreff[] = [];
    const soneLabel = (s: "firma" | "prosjekt") =>
      s === "firma" ? t("nav.soneFirma") : t("nav.soneProsjekt");

    const legg = (
      id: string,
      gruppe: SokGruppe,
      tittel: string,
      brodsmule: string[],
      href: string,
      sokeord?: string,
    ) => {
      // sokeord (per-kort synonymer) + sentrale kjerne-synonymer er med i
      // match-normen, men ikke i det viste treffet. synonymerFor kjøres på den
      // normaliserte basen slik at f.eks. «Innstillinger» også treffes av
      // «oppsett/admin/instill», «Byggeplasser» av «lokasjon/tegning» osv.
      const base = normaliserSok([tittel, ...brodsmule, sokeord ?? ""].join(" "));
      treff.push({
        id,
        gruppe,
        tittel,
        brodsmule,
        href,
        norm: `${base} ${synonymerFor(base)}`.trim(),
      });
    };

    // Hub-treff under flagg-på: søk på «innstillinger» skal lande på den nye
    // innstillings-hubben — ikke den gamle firma-innstillinger-siden (F3). Alltid
    // synlig (hubben er nåbar for alle), uavhengig av firma-admin-gating under.
    if (nyNav) {
      legg("inn:hub", "innstillinger", t("nav.innstillinger"), [], "/dashbord/innstillinger");
    }

    // INNSTILLINGER — hver synlig underlenke er eget treff (chip-nivå).
    // Synonym-søk: kort- og lenke-nivå `sokeordKey` appendes til `norm` (usynlig
    // i treffet) → «lokasjoner/tegninger/kart/geofence» finner Byggeplasser.
    for (const kort of [...firmaKort, ...prosjektKort]) {
      if (!kort.synlig) continue;
      const kortTittel = t(kort.tittelKey);
      for (const lenke of kort.underlenker) {
        if (lenke.synlig === false) continue;
        const sokeord = [kort.sokeordKey, lenke.sokeordKey]
          .filter((k): k is string => !!k)
          .map((k) => t(k))
          .join(" ");
        legg(
          // id inkluderer labelKey — to underlenker kan dele href (Byggeplasser +
          // Tegninger → samme side), så React-key/id må være unik.
          `inn:${kort.id}:${lenke.labelKey}`,
          "innstillinger",
          t(lenke.labelKey),
          [soneLabel(kort.seksjon), kortTittel],
          lenke.href,
          sokeord || undefined,
        );
      }
    }

    // SIDER — prosjekt-sidebar (+ Kontakter) og firma-nav.
    // FM5/K2: «Mine timer» hører til brukerens egen flate, ikke PROSJEKT-sonen
    // → eget «Min side»-treff (fjernes fra prosjekt-lista under).
    for (const el of [...filtrertHovedelementer, kontakterElement]) {
      if (el.id === "mine-timer") continue;
      const href = hrefForSidebarElement(el, prosjektId);
      if (!href) continue; // krever prosjekt, men ingen valgt → ikke navigerbar
      legg(`side:${el.id}`, "sider", t(el.labelKey), [soneLabel("prosjekt")], href);
    }
    const mineTimer = filtrertHovedelementer.find((el) => el.id === "mine-timer");
    if (mineTimer) {
      legg("side:mine-timer", "sider", t(mineTimer.labelKey), [t("sok.minSide")], "/dashbord/timer/mine");
    }
    for (const el of firmaNav) {
      // Under flagg-på erstatter hubben den gamle innstillinger-roten — dropp
      // firma-nav-treffet dit, så «innstillinger» ikke lander på gammel side
      // (hub-treffet over dekker den). Integrasjoner + øvrige firma-sider beholdes.
      if (nyNav && el.href === "/dashbord/firma/innstillinger") continue;
      legg(`side:${el.href}`, "sider", t(el.labelKey), [soneLabel("firma")], el.href);
    }

    // K13 — dype sider (arbeidsflater uten nav-hjem): maler, firma-attestering,
    // kom-i-gang. Gating arvet fra useDypeSider. Brødsmula kan være tom
    // (kom-i-gang har ingen sone — fabel-avgjørelse).
    for (const s of dypeSider) {
      const href = s.href(prosjektId);
      if (!href) continue; // krever prosjekt, men ingen valgt → ikke navigerbar
      legg(`dyp:${s.id}`, "sider", t(s.labelKey), s.brodsmuleKeys.map((k) => t(k)), href);
    }

    return treff;
  }, [firmaKort, prosjektKort, filtrertHovedelementer, firmaNav, dypeSider, prosjektId, nyNav, t]);
}
