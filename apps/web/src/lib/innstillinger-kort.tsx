"use client";

/**
 * Delt kilde for innstillinger-hubens kort + gating.
 *
 * Ekstrahert ut av `dashbord/innstillinger/page.tsx` (steg iv) slik at BÅDE
 * huben (uendret render) og den globale søkemodalen (`SokModal`) leser samme
 * kort-definisjoner og gating. Underlenkene blir egne søketreff, så «lønnsart»
 * finner Firma › Timer › Lønnsarter uten en parallell, drift-utsatt liste.
 *
 * Gating-hook-kallene + de to useMemo-blokkene er flyttet verbatim fra huben —
 * ingen endring i hvilke kort/underlenker som er synlige.
 */

import { useMemo, type ReactNode } from "react";
import {
  Building2,
  Users,
  GraduationCap,
  Clock,
  Truck,
  ShieldAlert,
  Settings,
  LayoutGrid,
  FileText,
  GitBranch,
  Sparkles,
  Calendar,
  Package,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { useKanManageField } from "@/hooks/useKanManageField";

export type Seksjon = "firma" | "prosjekt";

export interface Underlenke {
  labelKey: string;
  href: string;
  synlig?: boolean;
}

export interface HubKort {
  id: string;
  seksjon: Seksjon;
  tittelKey: string;
  beskrivelseKey: string;
  ikon: ReactNode;
  underlenker: Underlenke[];
  synlig: boolean;
}

export function useInnstillingerKort(): {
  firmaKort: HubKort[];
  prosjektKort: HubKort[];
} {
  const { kanAdministrereFirma, valgtFirma, erSitedocAdmin } = useFirma();
  const { prosjektId } = useProsjekt();

  // Prosjekt-tillatelser (manage_field) — delt gating-hook (speiler oppsett-
  // sidebarens admin/registrator-bypass). Ekstrahert til `useKanManageField`
  // for gjenbruk (Mapper-sidens «Administrer mapper»-inngang).
  const kanManageField = useKanManageField();

  // PSI-mal-oppsett (O10) gates på at PSI-modulen er aktiv på prosjektet —
  // speiler oppsett-sidebarens skjulte PSI-barn.
  const { data: aktiveModuler } = trpc.modul.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const psiAktiv = !!aktiveModuler?.some(
    (m: { moduleSlug: string; status: string }) =>
      m.moduleSlug === "psi" && m.status === "aktiv",
  );

  const firmamoduler = valgtFirma?.aktiveFirmamoduler ?? [];
  const harTimer = firmamoduler.includes("timer");
  const harMaskin = firmamoduler.includes("maskin");
  const harVarelager = firmamoduler.includes("varelager");

  const firmaKort: HubKort[] = useMemo(
    () => [
      {
        id: "firmaprofil",
        seksjon: "firma",
        tittelKey: "innstillinger.firmaprofil.tittel",
        beskrivelseKey: "innstillinger.firmaprofil.beskrivelse",
        ikon: <Building2 className="h-5 w-5" />,
        synlig: kanAdministrereFirma,
        underlenker: [
          { labelKey: "innstillinger.lenke.firmainfo", href: "/dashbord/firma/innstillinger" },
          // (e) Fakturering gates på erSitedocAdmin for å SPEILE dagens firma-layout
          // (firma-sidebar: Fakturering = kreverSitedocAdmin). 1a-designet plasserte den
          // under company_admin — å vise den for firma-admin ville være en atferdsendring
          // (fakturerings-innsyn). Ikke avgjort her; flagget som åpen beslutning til Kenneth.
          { labelKey: "innstillinger.lenke.fakturering", href: "/dashbord/firma/fakturering", synlig: erSitedocAdmin },
        ],
      },
      {
        id: "ansatte",
        seksjon: "firma",
        tittelKey: "innstillinger.ansatte.tittel",
        beskrivelseKey: "innstillinger.ansatte.beskrivelse",
        ikon: <Users className="h-5 w-5" />,
        synlig: kanAdministrereFirma,
        underlenker: [
          { labelKey: "innstillinger.lenke.ansatte", href: "/dashbord/firma/ansatte" },
          { labelKey: "innstillinger.lenke.avdelinger", href: "/dashbord/firma/avdelinger" },
        ],
      },
      {
        id: "kompetanse",
        seksjon: "firma",
        tittelKey: "innstillinger.kompetanse.tittel",
        beskrivelseKey: "innstillinger.kompetanse.beskrivelse",
        ikon: <GraduationCap className="h-5 w-5" />,
        synlig: kanAdministrereFirma,
        underlenker: [
          // (b) dedup: Matrise + Import delte samme URL — import åpnes på matrise-siden.
          { labelKey: "innstillinger.lenke.matrise", href: "/dashbord/firma/kompetanse" },
        ],
      },
      {
        id: "kalender",
        seksjon: "firma",
        tittelKey: "innstillinger.kalender.tittel",
        beskrivelseKey: "innstillinger.kalender.beskrivelse",
        ikon: <Calendar className="h-5 w-5" />,
        synlig: kanAdministrereFirma,
        underlenker: [
          { labelKey: "innstillinger.lenke.kalender", href: "/dashbord/firma/kalender" },
        ],
      },
      {
        id: "varelager",
        seksjon: "firma",
        tittelKey: "innstillinger.varelager.tittel",
        beskrivelseKey: "innstillinger.varelager.beskrivelse",
        ikon: <Package className="h-5 w-5" />,
        synlig: kanAdministrereFirma && harVarelager,
        underlenker: [
          { labelKey: "innstillinger.lenke.varelagerKatalog", href: "/dashbord/firma/varelager" },
          { labelKey: "innstillinger.lenke.varelagerImport", href: "/dashbord/firma/varelager/import" },
        ],
      },
      {
        id: "timer",
        seksjon: "firma",
        tittelKey: "innstillinger.timer.tittel",
        beskrivelseKey: "innstillinger.timer.beskrivelse",
        ikon: <Clock className="h-5 w-5" />,
        synlig: kanAdministrereFirma && harTimer,
        underlenker: [
          { labelKey: "innstillinger.lenke.lonnsarter", href: "/dashbord/firma/timer/lonnsarter" },
          { labelKey: "innstillinger.lenke.aktiviteter", href: "/dashbord/firma/timer/aktiviteter" },
          { labelKey: "innstillinger.lenke.tillegg", href: "/dashbord/firma/timer/tillegg" },
        ],
      },
      {
        id: "maskin",
        seksjon: "firma",
        tittelKey: "innstillinger.maskin.tittel",
        beskrivelseKey: "innstillinger.maskin.beskrivelse",
        ikon: <Truck className="h-5 w-5" />,
        synlig: kanAdministrereFirma && harMaskin,
        underlenker: [
          { labelKey: "innstillinger.lenke.maskinregister", href: "/dashbord/maskin" },
        ],
      },
      {
        id: "hms",
        seksjon: "firma",
        tittelKey: "innstillinger.hms.tittel",
        beskrivelseKey: "innstillinger.hms.beskrivelse",
        ikon: <ShieldAlert className="h-5 w-5" />,
        synlig: kanAdministrereFirma,
        underlenker: [
          // (b) dedup: Dashbord + Varsling delte samme URL; firma/hms har ingen egen
          // varsling-fane (fanene er avvik/sja/ruh/statistikk). Beskrivelsen dekker begge.
          { labelKey: "innstillinger.lenke.hmsDashbord", href: "/dashbord/firma/hms" },
        ],
      },
    ],
    [kanAdministrereFirma, erSitedocAdmin, harTimer, harMaskin, harVarelager],
  );

  const prosjektKort: HubKort[] = useMemo(() => {
    if (!prosjektId) return [];
    const p = prosjektId;
    return [
      {
        id: "prosjektoppsett",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.prosjektoppsett.tittel",
        beskrivelseKey: "innstillinger.prosjektoppsett.beskrivelse",
        ikon: <Settings className="h-5 w-5" />,
        synlig: true,
        underlenker: [
          { labelKey: "innstillinger.lenke.generelt", href: "/dashbord/oppsett/prosjektoppsett" },
          { labelKey: "innstillinger.lenke.byggeplasser", href: "/dashbord/oppsett/byggeplasser" },
          // (c) Mapper-oppsett (O9) — produksjons-barn, krever manage_field.
          { labelKey: "innstillinger.lenke.mappeoppsett", href: "/dashbord/oppsett/produksjon/box", synlig: kanManageField },
        ],
      },
      {
        id: "moduler",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.moduler.tittel",
        beskrivelseKey: "innstillinger.moduler.beskrivelse",
        ikon: <LayoutGrid className="h-5 w-5" />,
        synlig: kanManageField,
        underlenker: [
          { labelKey: "innstillinger.lenke.moduler", href: "/dashbord/oppsett/produksjon/moduler" },
        ],
      },
      {
        id: "medlemmer",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.medlemmer.tittel",
        beskrivelseKey: "innstillinger.medlemmer.beskrivelse",
        ikon: <Users className="h-5 w-5" />,
        synlig: true,
        underlenker: [
          { labelKey: "innstillinger.lenke.medlemmer", href: "/dashbord/oppsett/brukere" },
          { labelKey: "innstillinger.lenke.faggrupper", href: `/dashbord/${p}/faggrupper` },
        ],
      },
      {
        id: "maler",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.maler.tittel",
        beskrivelseKey: "innstillinger.maler.beskrivelse",
        ikon: <FileText className="h-5 w-5" />,
        synlig: kanManageField,
        underlenker: [
          { labelKey: "innstillinger.lenke.sjekklistemaler", href: "/dashbord/oppsett/produksjon/sjekklistemaler" },
          { labelKey: "innstillinger.lenke.oppgavemaler", href: "/dashbord/oppsett/produksjon/oppgavemaler" },
          // (c) PSI-mal-oppsett (O10) — kun når PSI-modulen er aktiv (som oppsett-sidebar).
          { labelKey: "innstillinger.lenke.psiMal", href: "/dashbord/oppsett/produksjon/psi", synlig: psiAktiv },
        ],
      },
      {
        id: "dokumentflyt",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.dokumentflyt.tittel",
        beskrivelseKey: "innstillinger.dokumentflyt.beskrivelse",
        ikon: <GitBranch className="h-5 w-5" />,
        synlig: kanManageField,
        underlenker: [
          { labelKey: "innstillinger.lenke.dokumentflyt", href: "/dashbord/oppsett/produksjon/dokumentflyt" },
        ],
      },
      {
        id: "sokAi",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.sokAi.tittel",
        beskrivelseKey: "innstillinger.sokAi.beskrivelse",
        ikon: <Sparkles className="h-5 w-5" />,
        synlig: true,
        underlenker: [
          { labelKey: "innstillinger.lenke.aiSok", href: "/dashbord/oppsett/ai-sok" },
        ],
      },
    ];
  }, [prosjektId, kanManageField, psiAktiv]);

  return { firmaKort, prosjektKort };
}
