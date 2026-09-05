"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { useByggeplass } from "@/kontekst/byggeplass-kontekst";
import { Spinner, EmptyState, Modal, SearchInput } from "@sitedoc/ui";
import { Plus, ShieldAlert, AlertTriangle, ClipboardList, FileWarning } from "lucide-react";
import { OpprettMalVelger } from "@/components/OpprettMalVelger";
import { useSistBrukteMal } from "@/hooks/useSistBrukteMal";
import { hosPosisjon, type MineIder, type HosBucket } from "@/lib/hms-hos";
import { KpiKort, MånedSøyler, FaggruppeBars, formaterDato, hentDataVerdi } from "@/components/hms/visning";
import { AvvikTabell, SjaTabell, RuhTabell } from "@/components/hms/tabeller";
import { SonetonetSidehode } from "@/components/layout/SonetonetSidehode";
import { HmsTomBanner } from "@/components/hms/HmsTomBanner";
import type { DokumentRad } from "@/components/hms/types";

type Tab = "avvik" | "sja" | "ruh" | "statistikk";

interface MalRef { id: string; name: string; prefix: string | null; subdomain: string | null; category?: string; }

type Subdomain = "avvik" | "sja" | "ruh";

// DokumentRad + format-helpers + tabeller importeres fra @/components/hms.

const ÅPEN_STATUSER = new Set(["draft", "sent", "received", "in_progress", "responded", "rejected"]);

// Segmentert status-filter (Funn F): fast segmentert kontroll som følger avledet
// status (Hos N / terminal), ikke rå enum. «Lukket» alltid synlig m/ antall.
function HmsSegmentFilter({
  segmenter,
  valgt,
  onVelg,
}: {
  segmenter: { id: HosBucket | "apne"; label: string; antall: number }[];
  valgt: HosBucket | "apne";
  onVelg: (id: HosBucket | "apne") => void;
}) {
  return (
    <div className="flex w-fit overflow-hidden rounded-lg border border-gray-200 text-sm font-medium">
      {segmenter.map((s, i) => {
        const aktiv = s.id === valgt;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onVelg(s.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 transition-colors ${
              i > 0 ? "border-l border-gray-200" : ""
            } ${aktiv ? "bg-sitedoc-primary text-white" : "text-gray-600 hover:bg-gray-50"}`}
          >
            {s.label}
            <span className={aktiv ? "text-white/75" : "text-gray-400"}>{s.antall}</span>
          </button>
        );
      })}
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
  const { aktivByggeplass, standardTegning } = useByggeplass();

  const [aktivTab, setAktivTab] = useState<Tab>("avvik");
  // Segmentert status-filter (Ordre 2.3/Funn F): avledet status, ikke rå enum.
  // «apne» = alle ikke-terminale (default, bevarer «åpne først»); «lukket» alltid
  // synlig som eget segment så lukkede saker ikke forsvinner (Funn F-rotårsak).
  const [segment, setSegment] = useState<HosBucket | "apne">("apne");
  const [tekstSok, setTekstSok] = useState("");
  // Unifisert opprett-velger (Ordre 2.2/Funn E) — samme modell som sjekkliste/oppgave.
  const [visVelger, setVisVelger] = useState(false);
  const [opprettPending, setOpprettPending] = useState(false);

  const dokumenterQuery = trpc.hms.hentDokumenter.useQuery(
    { projectId: params.prosjektId, byggeplassId: aktivByggeplass?.id ?? undefined },
    { enabled: !!params.prosjektId },
  );
  const dokumenter = dokumenterQuery.data as
    | { avvik: DokumentRad[]; sja: DokumentRad[]; ruh: DokumentRad[] }
    | undefined;

  // Signaturliste-chip per SJA — flatt oppslag (checklist-id → «X av Y» + status).
  // Egen spørring for å holde CHECKLIST_SELECT grunn (TS2589, se hms.ts § SIGNATUR_CHIP).
  const { data: signaturChipListe } = trpc.signatur.hentChips.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const signaturChips = useMemo(() => {
    const map: Record<string, { signert: number; av: number; status: "ingen_runde" | "mangler" | "komplett" }> = {};
    for (const c of signaturChipListe ?? []) map[c.checklistId] = { signert: c.signert, av: c.av, status: c.status };
    return map;
  }, [signaturChipListe]);

  // Navne-lookup for person-/firma-felt (f.eks. RUH «Innmelder») — speiler
  // mønsteret i oppgave-/sjekkliste-lista: bruker-ID → navn.
  const { data: medlemmer } = trpc.medlem.hentForProsjekt.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const navneLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of (medlemmer as { user?: { id: string; name: string | null; email: string } }[] | undefined) ?? []) {
      if (m.user?.id) map.set(m.user.id, m.user.name ?? m.user.email);
    }
    return map;
  }, [medlemmer]);

  const { data: maler } = trpc.mal.hentForProsjekt.useQuery({ projectId: params.prosjektId });
  // «Meld HMS»-velger nøkles på category="hms" (opprett-organisering). subdomain
  // beholdes for å rute den nye til riktig tabell (avvik/ruh=oppgave, sja=sjekkliste).
  const hmsMaler = ((maler ?? []) as Array<MalRef>).filter((m) => m.category === "hms");
  // Velgbare HMS-maler (avvik/sja/ruh) → én HMS-nivå-1-seksjon i den unifiserte velgeren.
  const velgbareHmsMaler = useMemo(
    () => hmsMaler.filter((m) => m.subdomain === "avvik" || m.subdomain === "sja" || m.subdomain === "ruh"),
    [hmsMaler],
  );

  // Sist-brukt HMS-mal (per prosjekt + doctype «hms») — kun markørens startrad i
  // velgeren, aldri auto-opprett (Funn C / Ordre 1.4). Bruker-id fra flyt-info.
  const { data: minFlytInfo } = trpc.gruppe.hentMinFlytInfo.useQuery(
    { projectId: params.prosjektId },
    { enabled: !!params.prosjektId },
  );
  const { sistBrukt, settSistBrukt } = useSistBrukteMal(
    (minFlytInfo as { userId?: string } | undefined)?.userId,
  );
  const hmsMalNøkkel = `hms:${params.prosjektId}`;

  // Innlogget brukers flyt-identitet — viewer-relativt «Hos deg» i segment + kolonne.
  const mineIder = useMemo<MineIder | undefined>(() => {
    const info = minFlytInfo as
      | { userId?: string; gruppeIder?: string[]; faggruppeIder?: string[] }
      | undefined;
    if (!info?.userId) return undefined;
    return { brukerId: info.userId, gruppeIder: info.gruppeIder ?? [], faggruppeIder: info.faggruppeIder ?? [] };
  }, [minFlytInfo]);

  // Imperativ tRPC-call via utils.client — unngår TS2589 fra useMutation-typegen.
  // Kaster ved feil; velgOgOpprett håndterer feilmelding + pending-tilstand.
  async function handleOpprett(mal: MalRef) {
    const subdomain = mal.subdomain as Subdomain | null;
    if (subdomain === "avvik" || subdomain === "ruh") {
      // RUH bruker oppgave-flyt (vedtatt 2026-05-29) — samme som avvik.
      const resultat = (await utils.client.oppgave.opprett.mutate({
        templateId: mal.id,
        title: mal.name,
        priority: "medium",
        // Kontekst-default (V2): oppgave tar kun drawingId (byggeplass utledes
        // via tegning). Byggeplass-uten-aktiv-tegning droppes (sak B, backlog).
        drawingId: standardTegning?.id,
      })) as { id: string };
      await utils.hms.hentDokumenter.invalidate({ projectId: params.prosjektId });
      router.push(`/dashbord/${params.prosjektId}/oppgaver/${resultat.id}`);
    } else if (subdomain === "sja") {
      const resultat = (await utils.client.sjekkliste.opprett.mutate({
        templateId: mal.id,
        title: mal.name,
        // Kontekst-default (V2): sjekkliste.opprett tar begge felt.
        byggeplassId: aktivByggeplass?.id,
        drawingId: standardTegning?.id,
      })) as { id: string };
      await utils.hms.hentDokumenter.invalidate({ projectId: params.prosjektId });
      router.push(`/dashbord/${params.prosjektId}/sjekklister/${resultat.id}`);
    }
  }

  // Velg + opprett i ett (Funn C-interaksjon): oppretter, markerer sist-brukt, lukker velger.
  async function velgOgOpprett(mal: MalRef) {
    setOpprettPending(true);
    try {
      await handleOpprett(mal);
      settSistBrukt(hmsMalNøkkel, mal.id);
      setVisVelger(false);
    } catch (err) {
      const melding = err instanceof Error ? err.message : t("felles.ukjentFeil");
      alert(t("felles.feilOpprettelse", { melding }));
    } finally {
      setOpprettPending(false);
    }
  }

  const filtrer = (rader: DokumentRad[]) => {
    // Segment-filter på avledet «Hos»-bucket: «apne» = alt ikke-terminalt,
    // ellers eksakt bucket-match («deg»/«behandler»/«lukket»).
    let r = rader.filter((rad) => {
      const bucket = hosPosisjon(rad, mineIder).bucket;
      return segment === "apne" ? bucket !== "lukket" : bucket === segment;
    });
    const q = tekstSok.trim().toLowerCase();
    if (q) {
      r = r.filter((rad) => {
        const tittel = (rad.title ?? "").toLowerCase();
        const lopenr = rad.number != null ? String(rad.number) : "";
        const full = `${(rad.template?.prefix ?? "").toLowerCase()}-${lopenr}`;
        return tittel.includes(q) || lopenr.includes(q) || full.includes(q);
      });
    }
    return r;
  };

  const avvik = dokumenter?.avvik ?? [];
  const sja = dokumenter?.sja ?? [];
  const ruh = dokumenter?.ruh ?? [];

  // Segment-antall for aktiv fane (avledet «Hos»-bucket). «apne» teller alle
  // ikke-terminale; behandler-navnet leses fra flytens siste ledd (følger rename).
  const aktivFaneData = aktivTab === "avvik" ? avvik : aktivTab === "sja" ? sja : aktivTab === "ruh" ? ruh : [];
  const segmentData = useMemo(() => {
    const buckets = aktivFaneData.map((r) => hosPosisjon(r, mineIder));
    const tell = (pred: (b: (typeof buckets)[number]) => boolean) => buckets.filter(pred).length;
    return {
      apne: tell((b) => b.bucket !== "lukket"),
      deg: tell((b) => b.bucket === "deg"),
      behandler: tell((b) => b.bucket === "behandler"),
      lukket: tell((b) => b.bucket === "lukket"),
      behandlerNavn: buckets.find((b) => b.behandlerNavn)?.behandlerNavn ?? null,
    };
  }, [aktivFaneData, mineIder]);

  const segmenter: { id: HosBucket | "apne"; label: string; antall: number }[] = [
    { id: "apne", label: t("status.alleApne"), antall: segmentData.apne },
    { id: "deg", label: t("tabell.venterPaaDeg"), antall: segmentData.deg },
    {
      id: "behandler",
      label: t("hms.hos", { navn: segmentData.behandlerNavn ?? t("hms.segment.behandler") }),
      antall: segmentData.behandler,
    },
    { id: "lukket", label: t("status.lukket"), antall: segmentData.lukket },
  ];

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
      {/* Header — P1-C sonetonet sidehode (PROSJEKT = blå) */}
      <SonetonetSidehode sone="prosjekt">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-6 w-6 text-sitedoc-primary" />
            <h1 className="text-2xl font-semibold text-gray-900">{t("hms.tittel")}</h1>
          </div>
          {/* Ordre 2.2/Funn E: «+ Meld HMS» åpner den unifiserte velgeren (samme som
              sjekkliste/oppgave). Åpne-regelen (Ordre 1.4): ≥1 mal → alltid velger,
              0 maler → knapp av. */}
          <button
            type="button"
            onClick={() => setVisVelger(true)}
            disabled={velgbareHmsMaler.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-sitedoc-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            {t("hms.handling.meld")}
          </button>
        </div>
      </SonetonetSidehode>

      {/* Funn H — behandler-leddet tomt: roper til admin (selv-innkapslet) */}
      <HmsTomBanner prosjektId={params.prosjektId} />

      {/* Ordre 2.2/Funn E: unifisert opprett-velger. HMS-malene ligger i én egen
          nivå-1-seksjon (versal-header, flyt-løse → ingen nivå-2-underoverskrift =
          Kenneths gatede ALT 1). Interaksjon (markør/↑↓/Enter/«Opprett»/sist-brukt)
          eies av OpprettMalVelger — identisk med sjekkliste/oppgave. */}
      <Modal open={visVelger} onClose={() => setVisVelger(false)} title={t("oppgaver.velgMal")}>
        {velgbareHmsMaler.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">{t("hms.ingenMalerTilgjengelig")}</p>
        ) : (
          <OpprettMalVelger
            grupper={[
              {
                key: "__hms__",
                overskrift: { navn: t("maler.domain.hms") },
                sorterSist: true,
                undergrupper: [
                  {
                    key: "__hms__u",
                    maler: velgbareHmsMaler.map((m) => ({
                      radKey: `hms:${m.id}`,
                      malId: m.id,
                      malNavn: m.name,
                      prefix: m.prefix,
                      onVelg: () => velgOgOpprett(m),
                    })),
                  },
                ],
              },
            ]}
            sistBruktMalId={sistBrukt(hmsMalNøkkel)}
            opprettPending={opprettPending}
          />
        )}
      </Modal>

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

      {/* Segmentert status-filter + fritekst-søk (skjult på statistikk-fanen).
          Segmentene følger avledet «Hos»-status; «Lukket» alltid synlig (Funn F). */}
      {aktivTab !== "statistikk" && (
        <div className="flex flex-wrap items-center gap-3">
          <HmsSegmentFilter segmenter={segmenter} valgt={segment} onVelg={setSegment} />
          <SearchInput
            verdi={tekstSok}
            onChange={setTekstSok}
            placeholder={t("hms.sok.placeholder")}
            className="w-full sm:w-64"
          />
        </div>
      )}

      {/* Tab-innhold */}
      {aktivTab === "avvik" && (
        <AvvikTabell
          rader={filtrer(avvik)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
          visHosKolonne
          mineIder={mineIder}
        />
      )}
      {aktivTab === "sja" && (
        <SjaTabell
          rader={filtrer(sja)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/sjekklister/${rad.id}`)}
          visHosKolonne
          mineIder={mineIder}
          signaturChips={signaturChips}
        />
      )}
      {aktivTab === "ruh" && (
        <RuhTabell
          rader={filtrer(ruh)}
          onKlikk={(rad) => router.push(`/dashbord/${params.prosjektId}/oppgaver/${rad.id}`)}
          navneLookup={navneLookup}
          visHosKolonne
          mineIder={mineIder}
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
