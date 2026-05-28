"use client";

import { useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useFirma } from "@/kontekst/firma-kontekst";
import { Spinner, EmptyState, SearchInput } from "@sitedoc/ui";
import { ShieldAlert, AlertTriangle, ClipboardList, FileWarning, Clock } from "lucide-react";
import { KpiKort, MånedSøyler, FaggruppeBars } from "@/components/hms/visning";
import { AvvikTabell, SjaTabell, RuhTabell } from "@/components/hms/tabeller";
import { FirmaHurtigModal } from "@/components/hms/firma-hurtig-modal";
import type { DokumentRad } from "@/components/hms/types";
import { MultiComboks } from "@/components/ui/MultiComboks";

type Tab = "avvik" | "sja" | "ruh" | "statistikk";

const LUKKET = new Set(["closed", "approved", "cancelled"]);

function filtrerPaSok<T extends DokumentRad>(rader: T[], sok: string): T[] {
  const q = sok.trim().toLowerCase();
  if (!q) return rader;
  return rader.filter((r) => {
    const tittel = (r.title ?? "").toLowerCase();
    const lopenr = r.number ? String(r.number) : "";
    const prefix = (r.template.prefix ?? "").toLowerCase();
    const fullNr = `${prefix}-${lopenr}`.toLowerCase();
    return tittel.includes(q) || lopenr.includes(q) || fullNr.includes(q);
  });
}

export default function FirmaHmsSide() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { valgtFirma } = useFirma();
  const organizationId = valgtFirma?.id;

  // ----- URL-state -----
  const prosjektIder = useMemo(
    () => (searchParams.get("prosjekt") ?? "").split(",").filter(Boolean),
    [searchParams],
  );
  const byggeplassIder = useMemo(
    () => (searchParams.get("byggeplass") ?? "").split(",").filter(Boolean),
    [searchParams],
  );
  const aktivTab = (searchParams.get("tab") ?? "avvik") as Tab;
  const [tekstSok, setTekstSok] = useState("");
  const [hurtigRad, setHurtigRad] = useState<DokumentRad | null>(null);

  function settUrl(params: Record<string, string | undefined>) {
    const sp = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (!value) sp.delete(key);
      else sp.set(key, value);
    }
    router.replace(`?${sp.toString()}`);
  }

  function toggleProsjekt(pid: string) {
    const ny = prosjektIder.includes(pid)
      ? prosjektIder.filter((id) => id !== pid)
      : [...prosjektIder, pid];
    settUrl({ prosjekt: ny.length > 0 ? ny.join(",") : undefined, byggeplass: undefined });
  }
  function toggleByggeplass(bid: string) {
    const ny = byggeplassIder.includes(bid)
      ? byggeplassIder.filter((id) => id !== bid)
      : [...byggeplassIder, bid];
    settUrl({ byggeplass: ny.length > 0 ? ny.join(",") : undefined });
  }
  function tomFilter() {
    settUrl({ prosjekt: undefined, byggeplass: undefined });
  }

  // ----- Tilgang -----
  const harTilgangQuery = trpc.organisasjon.harHmsTilgang.useQuery(
    { organizationId: organizationId ?? "" },
    { enabled: !!organizationId },
  );

  const utils = trpc.useUtils();

  // ----- Data -----
  const oversiktQuery = trpc.hms.hentFirmaOversikt.useQuery(
    {
      organizationId: organizationId!,
      prosjektIds: prosjektIder.length > 0 ? prosjektIder : undefined,
      byggeplassIds: byggeplassIder.length > 0 ? byggeplassIder : undefined,
    },
    { enabled: !!organizationId && harTilgangQuery.data === true },
  );

  // Data-ekstraksjon + alle useMemo plassert FØR early returns slik at
  // hook-rekkefølgen er identisk i hver render (React-regel).
  const data = oversiktQuery.data;
  const prosjekter = data?.prosjekter ?? [];
  const dokumenter = data?.dokumenter ?? { avvik: [], sja: [], ruh: [] };
  const statistikk = data?.statistikk;

  // Byggeplass-alternativer kaskadert fra valgte prosjekter (eller alle hvis ingen valgt)
  const tilgjengeligeByggeplasser = useMemo(() => {
    const aktuelle = prosjektIder.length > 0
      ? prosjekter.filter((p) => prosjektIder.includes(p.id))
      : prosjekter;
    const map = new Map<string, { id: string; name: string; prosjektNavn: string }>();
    for (const p of aktuelle) {
      for (const b of p.byggeplasser) {
        map.set(b.id, { id: b.id, name: b.name, prosjektNavn: p.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [prosjekter, prosjektIder]);

  // Antall åpne avvik per byggeplass — beregnet klient-side for combobox-visning
  const apneAvvikPerByggeplass = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of dokumenter.avvik as DokumentRad[]) {
      if (LUKKET.has(t.status)) continue;
      const bid = t.drawing?.byggeplass?.id;
      if (!bid) continue;
      map[bid] = (map[bid] ?? 0) + 1;
    }
    return map;
  }, [dokumenter.avvik]);

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-gray-500">{t("firma.hms.ingenTilgang")}</p>
      </div>
    );
  }

  if (harTilgangQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (harTilgangQuery.data === false) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm text-amber-900">{t("firma.hms.ingenTilgang")}</p>
      </div>
    );
  }

  // Drill-ned: bygger til prosjekt-detalj basert på subdomain
  function drillNed(rad: DokumentRad) {
    const pid = rad.template.project?.id;
    if (!pid) return;
    const dest = rad.template.subdomain === "avvik"
      ? `/dashbord/${pid}/oppgaver/${rad.id}`
      : `/dashbord/${pid}/sjekklister/${rad.id}`;
    router.push(dest);
  }

  // Antall per tab — etter fritekst-søk
  const filtrertAvvik = filtrerPaSok(dokumenter.avvik as DokumentRad[], tekstSok);
  const filtrertSja = filtrerPaSok(dokumenter.sja as DokumentRad[], tekstSok);
  const filtrertRuh = filtrerPaSok(dokumenter.ruh as DokumentRad[], tekstSok);
  const antallAvvik = filtrertAvvik.length;
  const antallSja = filtrertSja.length;
  const antallRuh = filtrertRuh.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{t("firma.hms.tittel")}</h1>
        <p className="mt-1 text-sm text-gray-600">{t("firma.hms.beskrivelse")}</p>
      </div>

      {/* Fritekst-søk på tvers av faner */}
      <SearchInput
        verdi={tekstSok}
        onChange={setTekstSok}
        placeholder={t("firma.hms.sok.placeholder")}
      />

      {/* Filter-panel med combobox-er */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MultiComboks
          label={t("firma.hms.filter.prosjekt")}
          options={prosjekter.map((p) => ({
            id: p.id,
            name: p.name,
            antall: statistikk?.apneAvvikPerProsjekt[p.id] ?? 0,
          }))}
          valgte={prosjektIder}
          onToggle={toggleProsjekt}
          placeholderSok={t("firma.hms.sok.prosjekt")}
        />
        <MultiComboks
          label={t("firma.hms.filter.byggeplass")}
          options={tilgjengeligeByggeplasser.map((b) => ({
            id: b.id,
            name: b.name,
            antall: apneAvvikPerByggeplass[b.id] ?? 0,
            underTekst: b.prosjektNavn,
          }))}
          valgte={byggeplassIder}
          onToggle={toggleByggeplass}
          placeholderSok={t("firma.hms.sok.byggeplass")}
        />
      </div>

      {(prosjektIder.length > 0 || byggeplassIder.length > 0 || tekstSok.length > 0) && (
        <button
          type="button"
          onClick={() => { tomFilter(); setTekstSok(""); }}
          className="text-xs text-sitedoc-primary hover:underline"
        >
          {t("firma.hms.filter.tom")}
        </button>
      )}

      {/* Tab-bar */}
      <div className="flex gap-1 border-b border-gray-200">
        <TabKnapp aktiv={aktivTab === "avvik"} onClick={() => settUrl({ tab: "avvik" })}>
          <AlertTriangle className="h-4 w-4" />
          {t("hms.tab.avvik")} ({antallAvvik})
        </TabKnapp>
        <TabKnapp aktiv={aktivTab === "sja"} onClick={() => settUrl({ tab: "sja" })}>
          <ClipboardList className="h-4 w-4" />
          {t("hms.tab.sja")} ({antallSja})
        </TabKnapp>
        <TabKnapp aktiv={aktivTab === "ruh"} onClick={() => settUrl({ tab: "ruh" })}>
          <FileWarning className="h-4 w-4" />
          {t("hms.tab.ruh")} ({antallRuh})
        </TabKnapp>
        <TabKnapp aktiv={aktivTab === "statistikk"} onClick={() => settUrl({ tab: "statistikk" })}>
          <ShieldAlert className="h-4 w-4" />
          {t("hms.tab.statistikk")}
        </TabKnapp>
      </div>

      {/* Innhold */}
      {oversiktQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          {aktivTab === "avvik" && (
            <AvvikTabell
              rader={filtrertAvvik}
              onKlikk={drillNed}
              visProsjektKolonne
              visByggeplassKolonne
              onHurtigBehandle={setHurtigRad}
            />
          )}
          {aktivTab === "sja" && (
            <SjaTabell
              rader={filtrertSja}
              onKlikk={drillNed}
              visProsjektKolonne
              visByggeplassKolonne
            />
          )}
          {aktivTab === "ruh" && (
            <RuhTabell
              rader={filtrertRuh}
              onKlikk={drillNed}
              visProsjektKolonne
              visByggeplassKolonne
            />
          )}
          {aktivTab === "statistikk" && statistikk && (
            <StatistikkPanel
              statistikk={statistikk}
              prosjekter={prosjekter}
              antallAvvik={antallAvvik}
              antallSja={antallSja}
              antallRuh={antallRuh}
            />
          )}
          {aktivTab !== "statistikk" &&
            dokumenter.avvik.length === 0 &&
            dokumenter.sja.length === 0 &&
            dokumenter.ruh.length === 0 && (
              <EmptyState
                title={t("firma.hms.tom.dokumenter")}
                description=""
              />
            )}
        </div>
      )}

      {hurtigRad && organizationId && (
        <FirmaHurtigModal
          rad={hurtigRad}
          organizationId={organizationId}
          onLukk={() => setHurtigRad(null)}
          onSuksess={() => {
            void utils.hms.hentFirmaOversikt.invalidate();
            setHurtigRad(null);
          }}
        />
      )}
    </div>
  );
}

function TabKnapp({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        aktiv
          ? "border-sitedoc-primary text-sitedoc-primary"
          : "border-transparent text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}


function StatistikkPanel({
  statistikk,
  prosjekter,
  antallAvvik,
  antallSja,
  antallRuh,
}: {
  statistikk: {
    apneAvvikPerProsjekt: Record<string, number>;
    sjaFrekvensPerMaaned: Record<string, number>;
    ruhRatePerMaaned: Record<string, number>;
    saksbehandlingstidMedianDager: number | null;
  };
  prosjekter: Array<{ id: string; name: string }>;
  antallAvvik: number;
  antallSja: number;
  antallRuh: number;
}) {
  const { t } = useTranslation();

  const apneTotalt = Object.values(statistikk.apneAvvikPerProsjekt).reduce((s, n) => s + n, 0);

  const apneAvvikData = useMemo(() => {
    const map = new Map(prosjekter.map((p) => [p.id, p.name]));
    return Object.entries(statistikk.apneAvvikPerProsjekt)
      .map(([pid, antall]) => ({ navn: map.get(pid) ?? pid, antall }))
      .sort((a, b) => b.antall - a.antall);
  }, [statistikk.apneAvvikPerProsjekt, prosjekter]);

  // Bygg liste av siste 12 måneder
  const månederLabels = useMemo(() => {
    const result: string[] = [];
    const nå = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nå.getFullYear(), nå.getMonth() - i, 1);
      result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return result;
  }, []);

  const sjaData = månederLabels.map((m) => ({
    maned: m.slice(5),
    antall: statistikk.sjaFrekvensPerMaaned[m] ?? 0,
  }));
  const ruhData = månederLabels.map((m) => ({
    maned: m.slice(5),
    antall: statistikk.ruhRatePerMaaned[m] ?? 0,
  }));

  const medianTekst =
    statistikk.saksbehandlingstidMedianDager === null
      ? "—"
      : `${Math.round(statistikk.saksbehandlingstidMedianDager)} ${t("firma.hms.statistikk.saksbehandlingstidEnhet")}`;

  return (
    <div className="space-y-4">
      {/* KPI-rad */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <KpiKort
          ikon={<AlertTriangle className="h-6 w-6" />}
          tittel={t("hms.tab.avvik")}
          verdi={apneTotalt}
          variant={apneTotalt > 0 ? "warning" : "neutral"}
        />
        <KpiKort
          ikon={<ClipboardList className="h-6 w-6" />}
          tittel={t("hms.tab.sja")}
          verdi={antallSja}
        />
        <KpiKort
          ikon={<FileWarning className="h-6 w-6" />}
          tittel={t("hms.tab.ruh")}
          verdi={antallRuh}
        />
        <KpiKort
          ikon={<Clock className="h-6 w-6" />}
          tittel={t("firma.hms.statistikk.saksbehandlingstid")}
          verdi={medianTekst}
        />
      </div>

      {/* Grafer */}
      <FaggruppeBars
        data={apneAvvikData}
        label={t("firma.hms.statistikk.apneAvvik")}
        maks={10}
      />
      <MånedSøyler data={sjaData} label={t("firma.hms.statistikk.sjaFrekvens")} />
      <MånedSøyler data={ruhData} label={t("firma.hms.statistikk.ruhRate")} />

      {/* Stille reminder om antall avvik totalt (inkl. lukkede) */}
      <p className="text-xs italic text-gray-500">
        {/* Vises ikke i UI ellers — kun for sanitetssjekk i devtools */}
        {antallAvvik === 0 ? "" : ""}
      </p>
    </div>
  );
}
