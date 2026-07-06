"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
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
    for (const el of [...filtrertHovedelementer, kontakterElement]) {
      const href = hrefForSidebarElement(el, prosjektId);
      if (!href) continue; // krever prosjekt, men ingen valgt → ikke navigerbar
      legg(`side:${el.id}`, "sider", t(el.labelKey), [soneLabel("prosjekt")], href);
    }
    for (const el of firmaNav) {
      legg(`side:${el.href}`, "sider", t(el.labelKey), [soneLabel("firma")], el.href);
    }

    return treff;
  }, [firmaKort, prosjektKort, filtrertHovedelementer, firmaNav, prosjektId, t]);
}
