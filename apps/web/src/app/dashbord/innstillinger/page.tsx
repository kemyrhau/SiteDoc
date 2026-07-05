"use client";

// Innstillinger-hub (1a) — navigasjonsredesign (redesign/navigasjon).
// Direkte nåbar via URL uavhengig av `nyNavigasjon`-flagget; flagget gater kun
// synlig navigasjon (sidebar/toppbar), ikke selve ruten. Se useNyNavigasjon.

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
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
  Search,
} from "lucide-react";
import { useFirma } from "@/kontekst/firma-kontekst";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { HjelpKnapp, HjelpFane } from "@/components/hjelp/HjelpModal";

type Seksjon = "firma" | "prosjekt";

interface Underlenke {
  labelKey: string;
  href: string;
  synlig?: boolean;
}

interface HubKort {
  id: string;
  seksjon: Seksjon;
  tittelKey: string;
  beskrivelseKey: string;
  ikon: ReactNode;
  underlenker: Underlenke[];
  synlig: boolean;
}

// Seksjonsfarger per handoff-spec (blå = firma, amber = prosjekt).
const SEKSJON_STIL: Record<Seksjon, { aksent: string; flis: string }> = {
  firma: { aksent: "#1e40af", flis: "#e7edfb" },
  prosjekt: { aksent: "#92610a", flis: "#fbf3e2" },
};

export default function InnstillingerHub() {
  const { t } = useTranslation();
  const { kanAdministrereFirma, valgtFirma, erSitedocAdmin } = useFirma();
  const { prosjektId } = useProsjekt();

  const [sok, setSok] = useState("");
  const [filter, setFilter] = useState<"alt" | Seksjon>("alt");

  // Prosjekt-tillatelser (manage_field) speiler oppsett-sidebarens gating på
  // produksjons-avledede kort (moduler/maler/dokumentflyt).
  const { data: tillatelser } = trpc.gruppe.hentMineTillatelser.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const kanManageField = !!tillatelser?.includes("manage_field");

  const firmamoduler = valgtFirma?.aktiveFirmamoduler ?? [];
  const harTimer = firmamoduler.includes("timer");
  const harMaskin = firmamoduler.includes("maskin");

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
          { labelKey: "innstillinger.lenke.matrise", href: "/dashbord/firma/kompetanse" },
          { labelKey: "innstillinger.lenke.import", href: "/dashbord/firma/kompetanse" },
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
          { labelKey: "innstillinger.lenke.hmsDashbord", href: "/dashbord/firma/hms" },
          { labelKey: "innstillinger.lenke.hmsVarsling", href: "/dashbord/firma/hms" },
        ],
      },
    ],
    [kanAdministrereFirma, erSitedocAdmin, harTimer, harMaskin],
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
  }, [prosjektId, kanManageField]);

  const sokLavere = sok.trim().toLowerCase();

  function matcherSok(kort: HubKort): boolean {
    if (!sokLavere) return true;
    const felt = [t(kort.tittelKey), t(kort.beskrivelseKey), ...kort.underlenker.map((l) => t(l.labelKey))];
    return felt.some((f) => f.toLowerCase().includes(sokLavere));
  }

  const visFirma = filter === "alt" || filter === "firma";
  const visProsjekt = filter === "alt" || filter === "prosjekt";

  const synligeFirma = firmaKort.filter((k) => k.synlig && matcherSok(k));
  const synligeProsjekt = prosjektKort.filter((k) => k.synlig && matcherSok(k));

  const harNoenTreff =
    (visFirma && synligeFirma.length > 0) || (visProsjekt && synligeProsjekt.length > 0);

  function renderKort(kort: HubKort) {
    const stil = SEKSJON_STIL[kort.seksjon];
    const synligeLenker = kort.underlenker.filter((l) => l.synlig !== false);
    return (
      <div
        key={kort.id}
        className="group flex flex-col gap-2.5 rounded-[9px] border bg-white p-4 transition-colors"
        style={{ borderColor: "#dde2ea" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = stil.aksent)}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#dde2ea")}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: stil.flis, color: stil.aksent }}
          >
            {kort.ikon}
          </span>
          <h3 className="text-[14.5px] font-semibold text-gray-900">{t(kort.tittelKey)}</h3>
        </div>
        <p className="text-[12.5px] leading-snug text-gray-500">{t(kort.beskrivelseKey)}</p>
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {synligeLenker.map((lenke) => (
            <Link
              key={lenke.labelKey}
              href={lenke.href}
              className="rounded-full border px-2.5 py-1 text-[12px] text-gray-600 transition-colors hover:text-gray-900"
              style={{ borderColor: "#dde2ea", backgroundColor: "#fafbfc" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = stil.aksent;
                e.currentTarget.style.backgroundColor = stil.flis;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#dde2ea";
                e.currentTarget.style.backgroundColor = "#fafbfc";
              }}
            >
              {t(lenke.labelKey)}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[980px] px-4 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-semibold text-gray-900">{t("innstillinger.tittel")}</h1>
          <p className="mt-1 text-[13.5px] text-gray-500">{t("innstillinger.undertekst")}</p>
        </div>
        <HjelpKnapp>
          <HjelpFane tittel={t("innstillinger.hjelp.tittel")}>
            <p>{t("innstillinger.hjelp.tekst")}</p>
          </HjelpFane>
        </HjelpKnapp>
      </div>

      {/* Søk + segmentert filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={sok}
            onChange={(e) => setSok(e.target.value)}
            placeholder={t("innstillinger.sok")}
            className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm text-gray-900 outline-none focus:border-sitedoc-primary"
            style={{ borderColor: "#dde2ea" }}
          />
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border" style={{ borderColor: "#dde2ea" }}>
          {(["alt", "firma", "prosjekt"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3.5 py-2 text-[13px] transition-colors ${
                filter === f ? "bg-sitedoc-primary text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {t(`innstillinger.filter.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* FIRMA */}
      {visFirma && synligeFirma.length > 0 && (
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              {t("innstillinger.seksjonFirma")}
            </h2>
            {valgtFirma && (
              <p className="text-[12px] text-gray-400">
                {t("innstillinger.gjelderFirma", { firma: valgtFirma.name })}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {synligeFirma.map(renderKort)}
          </div>
        </section>
      )}

      {/* PROSJEKT */}
      {visProsjekt && (
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              {t("innstillinger.seksjonProsjekt")}
            </h2>
            <p className="text-[12px] text-gray-400">
              {prosjektId
                ? t("innstillinger.gjelderProsjekt")
                : t("innstillinger.velgProsjekt")}
            </p>
          </div>
          {prosjektId && synligeProsjekt.length > 0 && (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {synligeProsjekt.map(renderKort)}
            </div>
          )}
        </section>
      )}

      {/* Tom-tilstand ved søk uten treff */}
      {!harNoenTreff && sokLavere && (
        <p className="py-8 text-center text-sm text-gray-400">{t("innstillinger.ingenTreff")}</p>
      )}
    </div>
  );
}
