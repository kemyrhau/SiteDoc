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
  MapPin,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { useKanManageField } from "@/hooks/useKanManageField";
import { HUB_LENKER } from "@/lib/hub-ruter";

export type Seksjon = "firma" | "prosjekt";

export interface Underlenke {
  labelKey: string;
  href: string;
  synlig?: boolean;
  /** Synonymnøkkel (i18n) appendet til søkets `norm` — usynlig i UI. */
  sokeordKey?: string;
}

export interface HubKort {
  id: string;
  seksjon: Seksjon;
  tittelKey: string;
  beskrivelseKey: string;
  ikon: ReactNode;
  underlenker: Underlenke[];
  synlig: boolean;
  /**
   * Synonymnøkkel (i18n) hvis verdi (mellomrom-separert) appendes til søkets
   * `norm` for hver av kortets underlenke-treff — usynlig i UI. Generell
   * mekanisme: ethvert kort kan få synonymer (f.eks. Byggeplasser ← «lokasjoner
   * tegninger kart geofence»).
   */
  sokeordKey?: string;
}

export function useInnstillingerKort(): {
  firmaKort: HubKort[];
  prosjektKort: HubKort[];
} {
  const { kanAdministrereFirma, valgtFirma, erSitedocAdmin } = useFirma();
  const { prosjektId } = useProsjekt();

  // O12 (Eier-firma) — samme gating som oppsett/layout.tsx: `!!prosjektFirma || erAdmin`.
  // Dobbel gating (pålegg 1): prosjekt-kontekst (kortet er prosjekt-seksjon) OG firmatilgang.
  const { data: prosjektFirma } = trpc.organisasjon.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const harFirmaTilgang = !!prosjektFirma || erSitedocAdmin;

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
          { labelKey: "innstillinger.lenke.firmainfo", href: HUB_LENKER.firmainfo },
          // (e) Fakturering gates på erSitedocAdmin for å SPEILE dagens firma-layout
          // (firma-sidebar: Fakturering = kreverSitedocAdmin). 1a-designet plasserte den
          // under company_admin — å vise den for firma-admin ville være en atferdsendring
          // (fakturerings-innsyn). Ikke avgjort her; flagget som åpen beslutning til Kenneth.
          { labelKey: "innstillinger.lenke.fakturering", href: HUB_LENKER.fakturering, synlig: erSitedocAdmin },
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
          { labelKey: "innstillinger.lenke.ansatte", href: HUB_LENKER.ansatte },
          { labelKey: "innstillinger.lenke.avdelinger", href: HUB_LENKER.avdelinger },
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
          { labelKey: "innstillinger.lenke.matrise", href: HUB_LENKER.matrise },
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
          { labelKey: "innstillinger.lenke.kalender", href: HUB_LENKER.kalender },
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
          { labelKey: "innstillinger.lenke.varelagerKatalog", href: HUB_LENKER.varelagerKatalog },
          { labelKey: "innstillinger.lenke.varelagerImport", href: HUB_LENKER.varelagerImport },
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
          { labelKey: "innstillinger.lenke.lonnsarter", href: HUB_LENKER.lonnsarter },
          { labelKey: "innstillinger.lenke.aktiviteter", href: HUB_LENKER.aktiviteter },
          { labelKey: "innstillinger.lenke.tillegg", href: HUB_LENKER.tillegg },
          // K13 F14/K13-g — begge timer-setup-faner er konfig → hub-underlenker (regel 1).
          // Gjenbruker develops fane-nøkler (fabel K13-g); labels: «Onboarding» + «Oppsett».
          { labelKey: "firma.timer.fane.onboarding", href: HUB_LENKER.timerOnboarding },
          { labelKey: "firma.timer.fane.oppsett", href: HUB_LENKER.timerOppsett },
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
          { labelKey: "innstillinger.lenke.maskinregister", href: HUB_LENKER.maskinregister },
          // K13 FM4 — maskin-import er konfig → hub-underlenke (regel 1), parallell til Varelager › Import
          { labelKey: "innstillinger.lenke.maskinImport", href: HUB_LENKER.maskinImport },
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
          { labelKey: "innstillinger.lenke.hmsDashbord", href: HUB_LENKER.hmsDashbord },
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
          { labelKey: "innstillinger.lenke.generelt", href: HUB_LENKER.generelt },
          // (c) Mapper-oppsett (O9) — produksjons-barn, krever manage_field.
          { labelKey: "innstillinger.lenke.mappeoppsett", href: HUB_LENKER.mappeoppsett, synlig: kanManageField },
          // K13 O12 — Eier-firma (Prosjekteier). Dobbel gating (pålegg 1): prosjekt-
          // kontekst (kortet er prosjekt-seksjon) OG harFirmaTilgang. Speiler
          // oppsett/layout.tsx: `!!prosjektFirma || erAdmin`.
          { labelKey: "innstillinger.lenke.eierFirma", href: HUB_LENKER.eierFirma, synlig: harFirmaTilgang },
        ],
      },
      {
        // Eget kort (tidligere anonym chip under Prosjektoppsett → ingen fant det).
        // Synonym-søk løfter «lokasjoner/tegninger/kart/geofence» hit.
        id: "byggeplasser",
        seksjon: "prosjekt",
        tittelKey: "innstillinger.byggeplasser.tittel",
        beskrivelseKey: "innstillinger.byggeplasser.beskrivelse",
        ikon: <MapPin className="h-5 w-5" />,
        synlig: true,
        sokeordKey: "innstillinger.sokeord.byggeplasser",
        underlenker: [
          // Begge → samme side: tegning-visningen er ikke dyplenkbar
          // (byggeplasser/page.tsx bruker `valgtTegningId=useState`, ingen searchParams).
          { labelKey: "innstillinger.lenke.byggeplasser", href: HUB_LENKER.byggeplasser },
          { labelKey: "innstillinger.lenke.tegninger", href: HUB_LENKER.byggeplasser },
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
          { labelKey: "innstillinger.lenke.moduler", href: HUB_LENKER.moduler },
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
          { labelKey: "innstillinger.lenke.medlemmer", href: HUB_LENKER.medlemmer },
          { labelKey: "innstillinger.lenke.faggrupper", href: HUB_LENKER.faggrupper.replace("[prosjektId]", p) },
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
          { labelKey: "innstillinger.lenke.sjekklistemaler", href: HUB_LENKER.sjekklistemaler },
          { labelKey: "innstillinger.lenke.oppgavemaler", href: HUB_LENKER.oppgavemaler },
          { labelKey: "innstillinger.lenke.hmsmaler", href: HUB_LENKER.hmsmaler },
          // (c) PSI-mal-oppsett (O10) — kun når PSI-modulen er aktiv (som oppsett-sidebar).
          { labelKey: "innstillinger.lenke.psiMal", href: HUB_LENKER.psiMal, synlig: psiAktiv },
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
          { labelKey: "innstillinger.lenke.dokumentflyt", href: HUB_LENKER.dokumentflyt },
          // Kryss-lenker: faggrupper + medlemmer er flyt-deltakerne — nås også
          // herfra (eksisterende ruter, delt med Medlemmer-kortet). Gjensidig
          // søkbarhet via KJERNE_SYNONYMER (dokumentflyt↔faggruppe↔medlemmer).
          { labelKey: "innstillinger.lenke.faggrupper", href: HUB_LENKER.faggrupper.replace("[prosjektId]", p) },
          { labelKey: "innstillinger.lenke.medlemmer", href: HUB_LENKER.medlemmer },
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
          { labelKey: "innstillinger.lenke.aiSok", href: HUB_LENKER.aiSok },
        ],
      },
    ];
  }, [prosjektId, kanManageField, psiAktiv, harFirmaTilgang]);

  return { firmaKort, prosjektKort };
}
