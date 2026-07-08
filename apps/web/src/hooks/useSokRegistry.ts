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

/** Normaliserer for diakritikk-tolerant match: «lonnsart» treffer «Lønnsarter». */
export function normaliserSok(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // fjern kombinasjonstegn: å→a, ü→u, é→e …
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae");
}

export function useSokRegistry(): SokTreff[] {
  const { t } = useTranslation();
  const { prosjektId } = useProsjekt();
  const nyNav = useNyNavigasjon();
  const { firmaKort, prosjektKort } = useInnstillingerKort();
  const { filtrertHovedelementer } = useSidebarElementer();
  const firmaNav = useFirmaNavElementer();

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
    ) => {
      treff.push({
        id,
        gruppe,
        tittel,
        brodsmule,
        href,
        norm: normaliserSok([tittel, ...brodsmule].join(" ")),
      });
    };

    // Hub-treff under flagg-på: søk på «innstillinger» skal lande på den nye
    // innstillings-hubben — ikke den gamle firma-innstillinger-siden (F3). Alltid
    // synlig (hubben er nåbar for alle), uavhengig av firma-admin-gating under.
    if (nyNav) {
      legg("inn:hub", "innstillinger", t("nav.innstillinger"), [], "/dashbord/innstillinger");
    }

    // INNSTILLINGER — hver synlig underlenke er eget treff (chip-nivå).
    for (const kort of [...firmaKort, ...prosjektKort]) {
      if (!kort.synlig) continue;
      const kortTittel = t(kort.tittelKey);
      for (const lenke of kort.underlenker) {
        if (lenke.synlig === false) continue;
        legg(
          `inn:${lenke.href}`,
          "innstillinger",
          t(lenke.labelKey),
          [soneLabel(kort.seksjon), kortTittel],
          lenke.href,
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

    return treff;
  }, [firmaKort, prosjektKort, filtrertHovedelementer, firmaNav, prosjektId, nyNav, t]);
}
