"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { Spinner, EmptyState } from "@sitedoc/ui";
import { Plus, ChevronDown, ShieldAlert, AlertTriangle, ClipboardList, FileWarning } from "lucide-react";
import { KpiKort, MånedSøyler, FaggruppeBars, formaterDato, hentDataVerdi } from "@/components/hms/visning";
import { AvvikTabell, SjaTabell, RuhTabell } from "@/components/hms/tabeller";
import type { DokumentRad } from "@/components/hms/types";

type Tab = "avvik" | "sja" | "ruh" | "statistikk";

interface MalRef { id: string; name: string; prefix: string | null; subdomain: string | null; }

type Subdomain = "avvik" | "sja" | "ruh";

// DokumentRad + format-helpers + tabeller importeres fra @/components/hms.

const ÅPEN_STATUSER = new Set(["draft", "sent", "received", "in_progress", "responded", "rejected"]);
const LUKKET_STATUSER = new Set(["approved", "closed", "cancelled"]);

function NyDropdown({
  alternativer,
  onClick,
}: {
  alternativer: { subdomain: Subdomain; mal: MalRef }[];
  onClick: (mal: MalRef) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        <Plus className="h-4 w-4" />
        {t("hms.handling.ny")}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-80 rounded-md border border-gray-200 bg-white shadow-lg">
          {alternativer.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">{t("hms.ingenMalerTilgjengelig")}</div>
          ) : (
            alternativer.map(({ subdomain, mal }) => (
              <button
                key={mal.id}
                onClick={() => { setOpen(false); onClick(mal); }}
                className="block w-full px-4 py-2 text-left hover:bg-gray-50"
              >
                <div className="text-sm font-semibold text-gray-900">{mal.name}</div>
                <div className="mt-0.5 text-xs text-gray-500">{t(`hms.hjelp.${subdomain}`)}</div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// KpiKort, MånedSøyler, FaggruppeBars importeres fra @/components/hms/visning.

function StatusFordeling({ data, label }: { data: { status: string; antall: number; farge: string }[]; label: string }) {
  const total = data.reduce((s, d) => s + d.antall, 0);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">{label}</h3>
      {total === 0 ? (
        <p className="text-sm text-gray-500">—</p>
      ) : (
        <>
          <div className="flex h-6 w-full overflow-hidden rounded">
            {data.map((d) => (
              <div
                key={d.status}
                title={`${d.status}: ${d.antall}`}
                style={{ width: `${(d.antall / total) * 100}%`, backgroundColor: d.farge }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1">
            {data.map((d) => (
              <div key={d.status} className="flex items-center gap-2 text-xs">
                <div className="h-3 w-3 rounded" style={{ backgroundColor: d.farge }} />
                <span className="text-gray-700">{d.status}</span>
                <span className="ml-auto text-gray-500">{d.antall}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function HmsSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const { aktivByggeplass } = useByggeplass();

  const [aktivTab, setAktivTab] = useState<Tab>("avvik");
  const [visAlle, setVisAlle] = useState(false);

  const dokumenterQuery = trpc.hms.hentDokumenter.useQuery(
    { projectId: params.prosjektId, byggeplassId: aktivByggeplass?.id ?? undefined },
    { enabled: !!params.prosjektId },
  );
  const dokumenter = dokumenterQuery.data as
    | { avvik: DokumentRad[]; sja: DokumentRad[]; ruh: DokumentRad[] }
    | undefined;

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  const hmsMaler = ((maler ?? []) as Array<MalRef & { domain?: string }>).filter((m) => m.subdomain != null);

  const opprettAlternativer = useMemo(() => {
    return hmsMaler
      .filter((m) => m.subdomain === "avvik" || m.subdomain === "sja" || m.subdomain === "ruh")
      .map((m) => ({ subdomain: m.subdomain as Subdomain, mal: m }));
  }, [hmsMaler]);

  // Imperativ tRPC-call via utils.client — unngår TS2589 fra useMutation-typegen.
  async function handleOpprett(mal: MalRef) {
    const subdomain = mal.subdomain as Subdomain | null;
    try {
      if (subdomain === "avvik") {
        const resultat = (await utils.client.oppgave.opprett.mutate({
          templateId: mal.id,
          title: mal.name,
          priority: "medium",
        })) as { id: string };
        await utils.hms.hentDokumenter.invalidate({ projectId: params.prosjektId });
        router.push(`/dashbord/${params.prosjektId}/oppgaver/${resultat.id}`);
      } else if (subdomain === "sja" || subdomain === "ruh") {
        const resultat = (await utils.client.sjekkliste.opprett.mutate({
          templateId: mal.id,
          title: mal.name,
        })) as { id: string };
        await utils.hms.hentDokumenter.invalidate({ projectId: params.prosjektId });
        router.push(`/dashbord/${params.prosjektId}/sjekklister/${resultat.id}`);
      }
    } catch (err) {
      const melding = err instanceof Error ? err.message : "Ukjent feil";
      alert(`Feil ved opprettelse: ${melding}`);
    }
  }

  const filtrer = (rader: DokumentRad[]) => {
    if (visAlle) return rader;
    return rader.filter((r) => ÅPEN_STATUSER.has(r.status));
  };

  const avvik = dokumenter?.avvik ?? [];
  const sja = dokumenter?.sja ?? [];
  const ruh = dokumenter?.ruh ?? [];

  // KPI: åpne avvik totalt + SJA siste 30 dager + RUH siste 30 dager
  const naa = Date.now();
  const tretti = 30 * 24 * 60 * 60 * 1000;
  const apneAvvik = avvik.filter((d) => ÅPEN_STATUSER.has(d.status)).length;
  const sjaSiste = sja.filter((d) => naa - new Date(d.createdAt).getTime() < tretti).length;
  const ruhSiste = ruh.filter((d) => naa - new Date(d.createdAt).getTime() < tretti).length;

  // Statistikk: avvik per måned (siste 6)
  const månederData = useMemo(() => {
    const nå = new Date();
    const months: { maned: string; antall: number; n: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(nå.getFullYear(), nå.getMonth() - i, 1);
      months.push({
        maned: d.toLocaleDateString("nb-NO", { month: "short" }),
        antall: 0,
        n: d,
      });
    }
    for (const a of avvik) {
      const opprettet = new Date(a.createdAt);
      for (let i = 0; i < months.length; i++) {
        const current = months[i];
        if (!current) continue;
        const start = current.n;
        const neste = months[i + 1];
        const slutt = neste ? neste.n : new Date(nå.getFullYear(), nå.getMonth() + 1, 1);
        if (opprettet >= start && opprettet < slutt) {
          current.antall++;
          break;
        }
      }
    }
    return months.map(({ maned, antall }) => ({ maned, antall }));
  }, [avvik]);

  // Statistikk: status-fordeling for avvik
  const statusData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of avvik) map.set(a.status, (map.get(a.status) ?? 0) + 1);
    const farger: Record<string, string> = {
      draft: "#9ca3af",
      sent: "#3b82f6",
      received: "#6366f1",
      in_progress: "#f59e0b",
      responded: "#8b5cf6",
      approved: "#10b981",
      closed: "#10b981",
      rejected: "#ef4444",
      cancelled: "#9ca3af",
    };
    return Array.from(map.entries()).map(([status, antall]) => ({
      status,
      antall,
      farge: farger[status] ?? "#9ca3af",
    }));
  }, [avvik]);

  // Statistikk: avvik per oppretter-faggruppe
  const faggruppeData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of avvik as unknown as Array<{ bestillerFaggruppe?: { name: string } | null }>) {
      const navn = a.bestillerFaggruppe?.name ?? "Uten faggruppe";
      map.set(navn, (map.get(navn) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([navn, antall]) => ({ navn, antall }))
      .sort((a, b) => b.antall - a.antall);
  }, [avvik]);

  if (dokumenterQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-sitedoc-primary" />
          <h1 className="text-2xl font-semibold text-gray-900">{t("hms.tittel")}</h1>
        </div>
        <NyDropdown alternativer={opprettAlternativer} onClick={handleOpprett} />
      </div>

      {/* KPI-bånd */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <KpiKort
          ikon={<AlertTriangle className="h-6 w-6" />}
          tittel={t("hms.kpi.apneAvvik")}
          verdi={apneAvvik}
          variant={apneAvvik > 0 ? "warning" : "neutral"}
        />
        <KpiKort
          ikon={<ClipboardList className="h-6 w-6" />}
          tittel={t("hms.kpi.sjaSisteManed")}
          verdi={sjaSiste}
        />
        <KpiKort
          ikon={<FileWarning className="h-6 w-6" />}
          tittel={t("hms.kpi.ruhSisteManed")}
          verdi={ruhSiste}
        />
      </div>

      {/* Tab-rad */}
      <div className="flex border-b border-gray-200">
        {(["avvik", "sja", "ruh", "statistikk"] as Tab[]).map((tab) => {
          const aktiv = aktivTab === tab;
          const antall = tab === "avvik" ? avvik.length : tab === "sja" ? sja.length : tab === "ruh" ? ruh.length : null;
          return (
            <button
              key={tab}
              onClick={() => setAktivTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                aktiv
                  ? "border-sitedoc-primary text-sitedoc-primary"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t(`hms.tabs.${tab}`)}
              {antall !== null && (
                <span className={`ml-2 inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                  aktiv ? "bg-sitedoc-primary text-white" : "bg-gray-100 text-gray-600"
                }`}>
                  {antall}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter-toggle (skjult på statistikk-fanen) */}
      {aktivTab !== "statistikk" && (
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={visAlle}
              onChange={(e) => setVisAlle(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-sitedoc-primary"
            />
            <span className="text-gray-700">{t("hms.filter.visAlle")}</span>
          </label>
        </div>
      )}

      {/* Tab-innhold */}
      {aktivTab === "avvik" && (
        <AvvikTabell
          rader={filtrer(avvik)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
        />
      )}
      {aktivTab === "sja" && (
        <SjaTabell
          rader={filtrer(sja)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
        />
      )}
      {aktivTab === "ruh" && (
        <RuhTabell
          rader={filtrer(ruh)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
        />
      )}
      {aktivTab === "statistikk" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <MånedSøyler data={månederData} label={t("hms.stat.avvikPerManed")} />
          <FaggruppeBars data={faggruppeData} label={t("hms.stat.avvikPerFaggruppe")} />
          <div className="md:col-span-2">
            <StatusFordeling data={statusData} label={t("hms.stat.statusFordeling")} />
          </div>
        </div>
      )}
    </div>
  );
}

// AvvikTabell, SjaTabell, RuhTabell importeres fra @/components/hms/tabeller.
