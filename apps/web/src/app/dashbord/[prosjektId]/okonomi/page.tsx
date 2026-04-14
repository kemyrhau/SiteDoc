"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { BarChart3, Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, RefreshCw, Plus, Pencil, FileSearch } from "lucide-react";
import { SpecPostTabell } from "@/components/mengde/spec-post-tabell";
import { Avviksanalyse } from "@/components/mengde/avviksanalyse";
import { NotatEditor, type NotatEditorRef } from "@/components/mengde/notat-editor";
import { NsKodePanel } from "@/components/mengde/ns-kode-panel";
import { MerknadEksport } from "@/components/mengde/merknad-eksport";
import { ImportSammenligning } from "@/components/mengde/import-sammenligning";
import { ImportDialog } from "@/components/mengde/import-dialog";
import { DebugErrorBoundary } from "@/components/error-boundary";
import { trpc } from "@/lib/trpc";

type Fane = "oversikt" | "avviksanalyse" | "rapport" | "dokumenter";
type DokType = "a_nota" | "t_nota";

export default function OkonomiSide() {
  const { t } = useTranslation();
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;
  const { data: session } = useSession();

  // Persist kontrakt/type/nr i localStorage
  const [kontraktId, setKontraktIdState] = useState<string | null>(null);
  const [dokType, setDokTypeState] = useState<DokType>("a_nota");
  const [valgtNotaNr, setValgtNotaNrState] = useState<number | null>(null);

  // Les fra localStorage ved mount
  useEffect(() => {
    const k = localStorage.getItem(`ftd-kontrakt-${prosjektId}`);
    const t = localStorage.getItem(`ftd-type-${prosjektId}`) as DokType | null;
    const n = localStorage.getItem(`ftd-nr-${prosjektId}`);
    if (k) setKontraktIdState(k);
    if (t) setDokTypeState(t);
    if (n) setValgtNotaNrState(parseInt(n, 10));
  }, [prosjektId]);

  const setKontraktId = (id: string | null) => {
    setKontraktIdState(id);
    if (id) localStorage.setItem(`ftd-kontrakt-${prosjektId}`, id);
    else localStorage.removeItem(`ftd-kontrakt-${prosjektId}`);
  };
  const setDokType = (t: DokType) => {
    setDokTypeState(t);
    localStorage.setItem(`ftd-type-${prosjektId}`, t);
  };
  const setValgtNotaNr = (n: number | null) => {
    setValgtNotaNrState(n);
    if (n !== null) localStorage.setItem(`ftd-nr-${prosjektId}`, String(n));
    else localStorage.removeItem(`ftd-nr-${prosjektId}`);
  };
  const [aktivFane, setAktivFane] = useState<Fane>("oversikt");
  const [valgtPostId, setValgtPostId] = useState<string | null>(null);
  const notatRef = useRef<NotatEditorRef>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [visNyKontrakt, setVisNyKontrakt] = useState(false);
  const [visRedigerKontrakt, setVisRedigerKontrakt] = useState(false);
  const [nyKontraktNavn, setNyKontraktNavn] = useState("");
  const [nyKontraktType, setNyKontraktType] = useState("");
  const [nyKontraktByggherre, setNyKontraktByggherre] = useState("");
  const [nyKontraktEntreprenor, setNyKontraktEntreprenor] = useState("");
  const [nyKontraktBygningId, setNyKontraktBygningId] = useState("");

  const { data: bygninger } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const { data: kontrakter } = trpc.kontrakt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  // Auto-velg kontrakt hvis det bare er én
  useEffect(() => {
    if (kontrakter && kontrakter.length === 1 && !kontraktId) {
      setKontraktId(kontrakter[0]!.id);
    }
  }, [kontrakter, kontraktId]);

  const utils2 = trpc.useUtils();

  const oppdaterKontrakt = trpc.kontrakt.oppdater.useMutation({
    onSuccess: () => {
      utils2.kontrakt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setVisRedigerKontrakt(false);
    },
  });

  const slettKontrakt = trpc.kontrakt.slett.useMutation({
    onSuccess: () => {
      utils2.kontrakt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setKontraktId(null);
      setVisRedigerKontrakt(false);
    },
  });

  const opprettKontrakt = trpc.kontrakt.opprett.useMutation({
    onSuccess: (ny) => {
      utils2.kontrakt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setKontraktId(ny.id);
      setVisNyKontrakt(false);
      setNyKontraktNavn("");
      setNyKontraktType("");
      setNyKontraktByggherre("");
      setNyKontraktEntreprenor("");
      setNyKontraktBygningId("");
    },
  });

  // @ts-ignore — Prisma Json-type (splitSources) trigger TS2589 i tRPC
  const dokumenterQuery = trpc.mengde.hentDokumenter.useQuery(
    { projectId: prosjektId },
    {
      enabled: !!prosjektId,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return false;
        return data.some(
          (d) =>
            d.processingState === "pending" ||
            d.processingState === "processing",
        )
          ? 3000
          : false;
      },
    },
  );
  const dokumenter = dokumenterQuery.data;

  // Finn dokumenter for valgt kontrakt, gruppert
  const kontraktDokumenter = useMemo(() => {
    if (!dokumenter || !kontraktId) return { budsjett: null, notas: [] };
    const filtrert = dokumenter.filter((d) => d.kontraktId === kontraktId);
    // Prioriter anbudsgrunnlag med flest poster — GAB har NS-koder men ufullstendige verdier
    const anbudsgrunnlag = filtrert.filter((d) => d.docType === "anbudsgrunnlag");
    const budsjett = anbudsgrunnlag[0] ?? null;
    const alleNotas = filtrert
      .filter((d) => d.docType === dokType && d.notaNr !== null)
      .sort((a, b) => (a.notaNr ?? 0) - (b.notaNr ?? 0));
    // Dedupliser per notaNr (behold første = nyeste opplastede)
    const sett = new Set<number>();
    const notas = alleNotas.filter((d) => {
      if (sett.has(d.notaNr!)) return false;
      sett.add(d.notaNr!);
      return true;
    });
    return { budsjett, notas };
  }, [dokumenter, kontraktId, dokType]);

  // Finn det valgte nota-dokumentet
  const valgtNotaDok = useMemo(
    () => kontraktDokumenter.notas.find((d) => d.notaNr === valgtNotaNr) ?? null,
    [kontraktDokumenter.notas, valgtNotaNr],
  );

  // Budsjett-poster (anbudsgrunnlag for valgt kontrakt)
  const budsjettDokId = kontraktDokumenter.budsjett?.id;
  const { data: budsjettPoster } = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, dokumentId: budsjettDokId },
    { enabled: !!prosjektId && !!budsjettDokId },
  );

  // Nota-poster (for sammenligning)
  const { data: notaPoster } = trpc.mengde.hentSpecPoster.useQuery(
    { projectId: prosjektId, dokumentId: valgtNotaDok?.id },
    { enabled: !!prosjektId && !!valgtNotaDok },
  );

  // Fallback: vis alle poster for kontrakten hvis ingen budsjett-dok finnes
  const { data: allePoster } = trpc.mengde.hentSpecPoster.useQuery(
    {
      projectId: prosjektId,
      kontraktId: kontraktId ?? undefined,
    },
    { enabled: !!prosjektId && !!kontraktId && !budsjettDokId },
  );

  const poster = budsjettPoster ?? allePoster;
  const valgtPost = poster?.find((p) => p.id === valgtPostId) ?? null;

  const handleVelgPost = useCallback((postId: string) => {
    if (notatRef.current?.erIReferanseModus && poster) {
      const post = poster.find((p) => p.id === postId);
      if (post) notatRef.current.leggTilReferanse(post);
    } else {
      setValgtPostId(postId);
    }
  }, [poster]);

  return (
    <div className="flex h-full flex-col">
      {/* Toppseksjon */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sitedoc-primary" />
          <h1 className="text-lg font-semibold">{t("okonomi.tittel")}</h1>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-3 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
        >
          <Upload className="h-4 w-4" />
          {t("handling.importer")}
        </button>
      </div>

      {/* Velgere + Nota-oppsummering */}
      <div className="flex items-start justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">{t("okonomi.kontrakt")}</label>
        <div className="flex items-center gap-1">
          <select
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            value={kontraktId ?? ""}
            onChange={(e) => {
              setKontraktId(e.target.value || null);
              setValgtNotaNr(null);
            }}
          >
            <option value="">{t("okonomi.velgKontrakt")}</option>
            {kontrakter?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.navn}
              </option>
            ))}
          </select>
          <button
            onClick={() => setVisNyKontrakt(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title={t("okonomi.nyKontrakt")}
          >
            <Plus className="h-4 w-4" />
          </button>
          {kontraktId && (
            <button
              onClick={() => setVisRedigerKontrakt(true)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              title={t("okonomi.redigerKontrakt")}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mx-1 h-4 w-px bg-gray-300" />

        <label className="text-xs text-gray-500">{t("okonomi.type")}</label>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          value={dokType}
          onChange={(e) => {
            setDokType(e.target.value as DokType);
            setValgtNotaNr(null);
          }}
        >
          <option value="a_nota">{t("okonomi.aNota")}</option>
          <option value="t_nota">{t("okonomi.tNota")}</option>
        </select>

        <label className="text-xs text-gray-500">{t("okonomi.nr")}</label>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          value={valgtNotaNr ?? ""}
          onChange={(e) => setValgtNotaNr(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">{t("okonomi.kunAnbud")}</option>
          {kontraktDokumenter.notas.map((d) => (
            <option key={d.id} value={d.notaNr!}>
              {d.notaType === "Sluttnota" ? t("okonomi.sluttnota") : d.notaNr}
            </option>
          ))}
        </select>
        </div>

        {/* Høyre: Nota-oppsummering */}
        <NotaOppsummering dok={valgtNotaDok} />
      </div>

      {/* Faner */}
      <div className="flex gap-1 border-b px-4">
        <FaneKnapp
          aktiv={aktivFane === "oversikt"}
          onClick={() => setAktivFane("oversikt")}
        >
          {t("okonomi.oversikt")}
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "avviksanalyse"}
          onClick={() => setAktivFane("avviksanalyse")}
        >
          {t("okonomi.avviksanalyse")}
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "rapport"}
          onClick={() => setAktivFane("rapport")}
        >
          {t("okonomi.rapport")}
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "dokumenter"}
          onClick={() => setAktivFane("dokumenter")}
        >
          {t("okonomi.dokumenter")}
          {dokumenter && dokumenter.length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px]">
              {dokumenter.length}
            </span>
          )}
        </FaneKnapp>
      </div>

      {/* Prosesseringsindikator */}
      {dokumenter && dokumenter.some((d) => d.processingState === "pending" || d.processingState === "processing") && (
        <div className="flex items-center gap-2 border-b bg-blue-50 px-4 py-2 text-xs text-blue-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>
            {(() => {
              const ventende = dokumenter.filter((d) => d.processingState === "pending" || d.processingState === "processing");
              return `Prosesserer ${ventende.length} ${ventende.length === 1 ? "dokument" : "dokumenter"}: ${ventende.map((d) => d.filename).join(", ")}`;
            })()}
          </span>
        </div>
      )}
      {dokumenter && dokumenter.some((d) => d.processingState === "failed") && (
        <div className="flex items-center gap-2 border-b bg-red-50 px-4 py-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>
            {(() => {
              const feilet = dokumenter.filter((d) => d.processingState === "failed");
              return `${feilet.length} ${feilet.length === 1 ? "dokument" : "dokumenter"} feilet: ${feilet.map((d) => `${d.filename}${d.processingError ? ` (${d.processingError})` : ""}`).join(", ")}`;
            })()}
          </span>
        </div>
      )}

      {/* Innhold */}
      {aktivFane === "oversikt" ? (
        <>
          {/* Tabell — fyller midten, scroller internt */}
          <div className="min-h-0 flex-1 px-4 pt-4">
            <DebugErrorBoundary>
              <SpecPostTabell
                  poster={poster ?? []}
                  sammenligningPoster={valgtNotaNr !== null ? (notaPoster ?? []) : undefined}
                  sammenligningLabel={valgtNotaNr !== null
                    ? (valgtNotaDok?.notaType === "Sluttnota" ? t("okonomi.sluttnota") : `${dokType === "a_nota" ? t("okonomi.aNota") : t("okonomi.tNota")} ${valgtNotaNr}`)
                    : undefined}
                  onVelgPost={handleVelgPost}
                  valgtPostId={valgtPostId}
                  prosjektId={prosjektId}
                  kontraktId={kontraktId}
                />
            </DebugErrorBoundary>
          </div>

          {/* Detaljpanel — alltid synlig i bunn */}
          <div className="shrink-0 border-t px-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded border p-3">
                <NotatEditor
                  ref={notatRef}
                  specPostId={valgtPostId}
                  eksternNotat={valgtPost?.eksternNotat ?? null}
                />
                {poster && (
                  <MerknadEksport
                    poster={poster}
                    kontraktNavn={kontrakter?.find((k) => k.id === kontraktId)?.navn ?? null}
                    kontraktId={kontraktId}
                    prosjektId={prosjektId}
                    notaType={valgtNotaDok?.notaType ?? null}
                    notaNr={valgtNotaNr}
                    brukerNavn={session?.user?.name ?? null}
                    entreprenorEpost={kontrakter?.find((k) => k.id === kontraktId)?.entreprenor ?? null}
                  />
                )}
              </div>
              <div className="space-y-3">
                <div className="rounded border p-3">
                  <NsKodePanel nsKode={valgtPost?.nsKode ?? null} prosjektId={prosjektId} />
                </div>
                {valgtPost?.postnr && (
                  <div className="rounded border p-3">
                    <DokumentasjonPanel
                      prosjektId={prosjektId}
                      kontraktId={kontraktId}
                      postnr={valgtPost.postnr}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {aktivFane === "avviksanalyse" ? (
            <div className="space-y-6">
              <ImportSammenligning
                prosjektId={prosjektId}
                dokumenter={dokumenter ?? []}
                kontraktId={kontraktId}
              />
            </div>
          ) : aktivFane === "rapport" ? (
            <RapportPanel prosjektId={prosjektId} kontraktId={kontraktId} />
          ) : (
            <DokumentListe
              dokumenter={kontraktId ? (dokumenter ?? []).filter((d) => d.kontraktId === kontraktId) : (dokumenter ?? [])}
              projectId={prosjektId}
              kontrakter={kontrakter ?? []}
            />
          )}
        </div>
      )}

      <ImportDialog
        projectId={prosjektId}
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          // Invalidere alle økonomi-data etter import
          utils2.mengde.hentDokumenter.invalidate({ projectId: prosjektId });
          utils2.mengde.hentSpecPoster.invalidate();
        }}
      />

      {/* Ny kontrakt modal */}
      {visNyKontrakt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setVisNyKontrakt(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3">
              <h2 className="text-base font-semibold">{t("okonomi.nyKontrakt")}</h2>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.kontraktnavn")}</label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="f.eks. Bygg Røstbakken"
                  value={nyKontraktNavn}
                  onChange={(e) => setNyKontraktNavn(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.kontrakttype")}</label>
                <select
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  value={nyKontraktType}
                  onChange={(e) => setNyKontraktType(e.target.value)}
                >
                  <option value="">{t("okonomi.velgType")}</option>
                  <option value="8405">NS 8405 — Utførelsesentreprise</option>
                  <option value="8406">NS 8406 — Forenklet utførelsesentreprise</option>
                  <option value="8407">NS 8407 — Totalentreprise</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.byggherre")}</label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="f.eks. Din Kommune"
                  value={nyKontraktByggherre}
                  onChange={(e) => setNyKontraktByggherre(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.entreprenor")}</label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="f.eks. Firma AS"
                  value={nyKontraktEntreprenor}
                  onChange={(e) => setNyKontraktEntreprenor(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">{t("tabell.bygning")}</label>
                <select
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  value={nyKontraktBygningId}
                  onChange={(e) => setNyKontraktBygningId(e.target.value)}
                >
                  <option value="">{t("okonomi.ingenBygning")}</option>
                  {bygninger?.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.number ? `${b.number} — ` : ""}{b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                onClick={() => setVisNyKontrakt(false)}
                className="rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                {t("handling.avbryt")}
              </button>
              <button
                onClick={() => {
                  if (nyKontraktNavn.trim()) {
                    opprettKontrakt.mutate({
                      projectId: prosjektId,
                      navn: nyKontraktNavn.trim(),
                      kontraktType: (nyKontraktType as "8405" | "8406" | "8407") || undefined,
                      byggherre: nyKontraktByggherre.trim() || undefined,
                      entreprenor: nyKontraktEntreprenor.trim() || undefined,
                      byggeplassId: nyKontraktBygningId || undefined,
                    });
                  }
                }}
                disabled={!nyKontraktNavn.trim()}
                className="rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
              >
                {t("handling.opprett")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rediger kontrakt modal */}
      {visRedigerKontrakt && kontraktId && (() => {
        const k = kontrakter?.find((c) => c.id === kontraktId);
        if (!k) return null;
        return (
          <RedigerKontraktModal
            kontrakt={k}
            bygninger={bygninger ?? []}
            onLagre={(data) => oppdaterKontrakt.mutate({ id: kontraktId, ...data })}
            onSlett={() => {
              if (confirm(`Slett kontrakt «${k.navn}»? Dokumenter og entrepriser mister kontraktkoblingen.`)) {
                slettKontrakt.mutate({ id: kontraktId });
              }
            }}
            onLukk={() => setVisRedigerKontrakt(false)}
          />
        );
      })()}
    </div>
  );
}

function RedigerKontraktModal({
  kontrakt,
  bygninger,
  onLagre,
  onSlett,
  onLukk,
}: {
  kontrakt: { id: string; navn: string; kontraktType: string | null; byggherre: string | null; entreprenor: string | null; byggeplassId: string | null };
  bygninger: Array<{ id: string; name: string; number: number | null }>;
  onLagre: (data: { navn?: string; kontraktType?: "8405" | "8406" | "8407" | null; byggherre?: string | null; entreprenor?: string | null; byggeplassId?: string | null }) => void;
  onSlett: () => void;
  onLukk: () => void;
}) {
  const { t } = useTranslation();
  const [navn, setNavn] = useState(kontrakt.navn);
  const [type, setType] = useState(kontrakt.kontraktType ?? "");
  const [byggherre, setByggherre] = useState(kontrakt.byggherre ?? "");
  const [entreprenor, setEntreprenor] = useState(kontrakt.entreprenor ?? "");
  const [bygningId, setBygningId] = useState(kontrakt.byggeplassId ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onLukk}>
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3">
          <h2 className="text-base font-semibold">{t("okonomi.redigerKontrakt")}</h2>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.kontraktnavn")}</label>
            <input type="text" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" value={navn} onChange={(e) => setNavn(e.target.value)} autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.kontrakttype")}</label>
            <select className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t("okonomi.velgType")}</option>
              <option value="8405">NS 8405 — Utførelsesentreprise</option>
              <option value="8406">NS 8406 — Forenklet utførelsesentreprise</option>
              <option value="8407">NS 8407 — Totalentreprise</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.byggherre")}</label>
            <input type="text" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" placeholder="f.eks. Din Kommune" value={byggherre} onChange={(e) => setByggherre(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("okonomi.entreprenor")}</label>
            <input type="text" className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm" placeholder="f.eks. Firma AS" value={entreprenor} onChange={(e) => setEntreprenor(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">{t("tabell.bygning")}</label>
            <select className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm" value={bygningId} onChange={(e) => setBygningId(e.target.value)}>
              <option value="">{t("okonomi.ingenBygning")}</option>
              {bygninger.map((b) => (
                <option key={b.id} value={b.id}>{b.number ? `${b.number} — ` : ""}{b.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <button onClick={onSlett} className="rounded px-3 py-1.5 text-sm text-red-500 hover:bg-red-50">{t("handling.slett")}</button>
          <div className="flex gap-2">
            <button onClick={onLukk} className="rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100">{t("handling.avbryt")}</button>
            <button
              onClick={() => onLagre({
                navn: navn.trim() || undefined,
                kontraktType: (type as "8405" | "8406" | "8407") || null,
                byggherre: byggherre.trim() || null,
                entreprenor: entreprenor.trim() || null,
                byggeplassId: bygningId || null,
              })}
              disabled={!navn.trim()}
              className="rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
            >
              {t("handling.lagre")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DokumentListe({
  dokumenter,
  projectId,
  kontrakter,
}: {
  kontrakter: Array<{ id: string; navn: string }>;
  dokumenter: Array<{
    id: string;
    filename: string;
    docType: string | null;
    notaType: string | null;
    notaNr: number | null;
    kontraktId: string | null;
    kontraktNavn: string | null;
    entreprenor: string | null;
    processingState: string;
    processingError: string | null;
    uploadedAt: string | Date;
    folder: { id: string; name: string } | null;
  }>;
  projectId: string;
}) {
  const { t } = useTranslation();
  const utils = trpc.useUtils();
  const slettMutation = trpc.mengde.fjernFraOkonomi.useMutation({
    onSuccess: () => utils.mengde.hentDokumenter.invalidate({ projectId }),
  });
  const reprosesserMutation = trpc.mengde.reprosesser.useMutation({
    onSuccess: () => {
      console.log("Reprosessering startet");
      utils.mengde.hentDokumenter.invalidate({ projectId });
    },
    onError: (err) => {
      console.error("Reprosessering feilet:", err.message);
      alert(`Reprosessering feilet: ${err.message}`);
    },
  });

  const oppdaterMutation = trpc.mengde.oppdaterDokument.useMutation({
    onSuccess: () => utils.mengde.hentDokumenter.invalidate({ projectId }),
  });

  const [redigerDokId, setRedigerDokId] = useState<string | null>(null);

  const DOC_TYPE_LABEL: Record<string, string> = {
    anbudsgrunnlag: t("okonomi.anbudsgrunnlag"),
    budsjett: t("okonomi.anbud"),
    a_nota: t("okonomi.aNota"),
    t_nota: t("okonomi.tNota"),
    mengdebeskrivelse: t("okonomi.mengdebeskrivelse"),
    annet: t("okonomi.dokument"),
  };

  if (dokumenter.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <FileText className="mb-2 h-8 w-8" />
        <div className="text-sm">{t("okonomi.ingenDokumenter")}</div>
        <div className="text-xs">{t("okonomi.klikkImporter")}</div>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs font-medium uppercase text-gray-500">
          <th className="px-3 py-2">{t("tabell.filnavn")}</th>
          <th className="px-3 py-2">{t("tabell.type")}</th>
          <th className="px-3 py-2">{t("tabell.nr")}</th>
          <th className="px-3 py-2">{t("tabell.mappe")}</th>
          <th className="px-3 py-2">{t("tabell.lastetOpp")}</th>
          <th className="px-3 py-2">{t("tabell.status")}</th>
          <th className="px-3 py-2 w-20"></th>
        </tr>
      </thead>
      <tbody>
        {dokumenter.map((dok) => (
          <tr key={dok.id} className="border-b hover:bg-gray-50">
            <td className="px-3 py-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400 shrink-0" />
              {dok.filename}
            </td>
            <td className="px-3 py-2">
              {redigerDokId === dok.id ? (
                <DokumentTypeEditor
                  dok={dok}
                  kontrakter={kontrakter}
                  onLagre={(data) => {
                    oppdaterMutation.mutate({ documentId: dok.id, ...data });
                    setRedigerDokId(null);
                  }}
                  onAvbryt={() => setRedigerDokId(null)}
                />
              ) : (
                <button
                  onClick={() => setRedigerDokId(dok.id)}
                  className="rounded px-2 py-0.5 text-left text-sm text-gray-600 hover:bg-gray-100"
                  title={t("okonomi.klikkForAaEndre")}
                >
                  <div>
                    {dok.notaType
                      ? `${dok.notaType}${dok.notaNr ? ` ${dok.notaNr}` : ""}`
                      : DOC_TYPE_LABEL[dok.docType ?? ""] ?? dok.docType ?? "—"}
                  </div>
                  {dok.kontraktNavn && (
                    <div className="text-xs text-gray-400 truncate max-w-[150px]">{dok.kontraktNavn}</div>
                  )}
                </button>
              )}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {dok.notaType === "Sluttnota" ? "S" : dok.notaNr ?? "—"}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {dok.folder?.name ?? "—"}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {new Date(dok.uploadedAt).toLocaleDateString("nb-NO")}
            </td>
            <td className="px-3 py-2">
              {dok.processingState === "pending" || dok.processingState === "processing" ? (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("handling.prosesserer")}
                </span>
              ) : dok.processingState === "completed" ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t("status.ferdig")}
                </span>
              ) : dok.processingState === "failed" ? (
                <span className="flex items-center gap-1 text-xs text-red-500" title={dok.processingError ?? ""}>
                  <AlertCircle className="h-3.5 w-3.5" />
                  {t("status.feilet")}
                </span>
              ) : null}
            </td>
            <td className="px-3 py-2 flex items-center gap-1">
              {dok.processingState === "failed" && (
                <button
                  onClick={() => reprosesserMutation.mutate({ documentId: dok.id })}
                  className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                  title={t("handling.provIgjen")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm(`Fjern «${dok.filename}» fra økonomi? Dokumentet beholdes i mapper.`)) {
                    slettMutation.mutate({ documentId: dok.id });
                  }
                }}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DokumentTypeEditor({
  dok,
  kontrakter,
  onLagre,
  onAvbryt,
}: {
  dok: { docType: string | null; notaType: string | null; notaNr: number | null; kontraktId: string | null; kontraktNavn: string | null };
  kontrakter: Array<{ id: string; navn: string }>;
  onLagre: (data: {
    docType?: "anbudsgrunnlag" | "a_nota" | "t_nota" | "mengdebeskrivelse" | "annet";
    notaType?: "A-Nota" | "T-Nota" | "Sluttnota" | null;
    notaNr?: number | null;
    kontraktId?: string | null;
    kontraktNavn?: string | null;
  }) => void;
  onAvbryt: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState(dok.docType ?? "annet");
  const [nr, setNr] = useState(dok.notaNr?.toString() ?? "");
  const [valgtKontraktId, setValgtKontraktId] = useState(dok.kontraktId ?? "");

  const erNota = type === "a_nota" || type === "t_nota";
  const valgtKontrakt = kontrakter.find((k) => k.id === valgtKontraktId);

  return (
    <div className="space-y-2 rounded border border-sitedoc-primary bg-blue-50/50 p-2">
      <select
        autoFocus
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option value="anbudsgrunnlag">{t("okonomi.anbudsgrunnlag")}</option>
        <option value="a_nota">{t("okonomi.aNota")}</option>
        <option value="t_nota">{t("okonomi.tNota")}</option>
        <option value="mengdebeskrivelse">{t("okonomi.mengdebeskrivelse")}</option>
        <option value="annet">{t("okonomi.annet")}</option>
      </select>

      {/* Kontrakt — for alle typer */}
      <select
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        value={valgtKontraktId}
        onChange={(e) => setValgtKontraktId(e.target.value)}
      >
        <option value="">{t("okonomi.velgKontrakt")}</option>
        {kontrakter.map((k) => (
          <option key={k.id} value={k.id}>{k.navn}</option>
        ))}
      </select>

      {/* Nota-nummer — kun for A-nota/T-nota */}
      {erNota && (
        <input
          type="number"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Nummer (f.eks. 4)"
          value={nr}
          onChange={(e) => setNr(e.target.value)}
        />
      )}

      <div className="flex gap-1">
        <button
          onClick={() =>
            onLagre({
              docType: type as "anbudsgrunnlag" | "a_nota" | "t_nota" | "mengdebeskrivelse" | "annet",
              notaType: type === "a_nota" ? "A-Nota" : type === "t_nota" ? "T-Nota" : null,
              notaNr: nr ? parseInt(nr, 10) : null,
              kontraktId: valgtKontraktId || null,
              kontraktNavn: valgtKontrakt?.navn ?? null,
            })
          }
          className="rounded bg-sitedoc-primary px-2 py-0.5 text-xs text-white"
        >
          {t("handling.lagre")}
        </button>
        <button
          onClick={onAvbryt}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          {t("handling.avbryt")}
        </button>
      </div>
    </div>
  );
}

function DokumentasjonPanel({
  prosjektId,
  kontraktId,
  postnr,
}: {
  prosjektId: string;
  kontraktId: string | null;
  postnr: string;
}) {
  const { t } = useTranslation();
  const { data: sider, isLoading } = trpc.mengde.hentDokumentasjonForPost.useQuery(
    { projectId: prosjektId, kontraktId: kontraktId ?? undefined, postnr },
    { enabled: !!postnr },
  );

  // Grupper per dokument
  const gruppert = useMemo(() => {
    if (!sider || sider.length === 0) return [];
    const map = new Map<string, { dok: (typeof sider)[0]["document"]; sider: number[] }>();
    for (const s of sider) {
      const entry = map.get(s.document.id);
      if (entry) {
        entry.sider.push(s.pageNumber);
      } else {
        map.set(s.document.id, { dok: s.document, sider: [s.pageNumber] });
      }
    }
    return Array.from(map.values()).map((g) => ({
      ...g,
      sider: g.sider.sort((a, b) => a - b),
    }));
  }, [sider]);

  const apnePdf = (fileUrl: string | null, side: number) => {
    if (!fileUrl) return;
    window.open(`/api${fileUrl}#page=${side}`, "_blank");
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
        <FileSearch className="h-3.5 w-3.5" />
        {t("okonomi.dokumentasjon")}
      </div>
      {isLoading ? (
        <div className="text-xs text-gray-400">{t("okonomi.soker")}</div>
      ) : gruppert.length === 0 ? (
        <div className="text-xs text-gray-400">Ingen dokumentasjon funnet for post {postnr}</div>
      ) : (
        <div className="space-y-1.5">
          {gruppert.map((g) => (
            <div key={g.dok.id} className="text-xs">
              <div className="font-medium text-gray-600 truncate" title={g.dok.filename}>
                {g.dok.notaType
                  ? `${g.dok.notaType}${g.dok.notaNr ? ` ${g.dok.notaNr}` : ""}`
                  : g.dok.filename}
              </div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {g.sider.map((side) => (
                  <button
                    key={side}
                    onClick={() => apnePdf(g.dok.fileUrl, side)}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-sitedoc-secondary hover:text-white"
                    title={`Åpne side ${side}`}
                  >
                    s.{side}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type RapportType = "innestaaende";

function RapportPanel({
  prosjektId,
  kontraktId,
}: {
  prosjektId: string;
  kontraktId: string | null;
}) {
  const { t } = useTranslation();
  const [rapportType, setRapportType] = useState<RapportType>("innestaaende");

  const { data: notas, isLoading } = trpc.mengde.hentNotaRapport.useQuery(
    { projectId: prosjektId, kontraktId: kontraktId! },
    { enabled: !!kontraktId },
  );

  if (!kontraktId) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-gray-400">
        {t("okonomi.velgKontraktForRapport")}
      </div>
    );
  }

  const fmt = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    const n = typeof v === "number" ? v : Number(v);
    if (isNaN(n)) return "—";
    return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const fmtDato = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dato = new Date(d);
    return dato.toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-xs text-gray-500">{t("okonomi.rapport")}:</label>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          value={rapportType}
          onChange={(e) => setRapportType(e.target.value as RapportType)}
        >
          <option value="innestaaende">{t("okonomi.innestaaende")}</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("okonomi.lasterRapport")}
        </div>
      ) : !notas || notas.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400">
          Ingen A-notas med header-data funnet for denne kontrakten.
          <br />
          <span className="text-xs">Importer A-notas på nytt for å ekstrahere header-verdier.</span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-500">
                <th className="whitespace-nowrap px-3 py-2">{t("okonomi.nota")}</th>
                <th className="whitespace-nowrap px-3 py-2">{t("okonomi.utfortPr")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.utfortTotalt")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.utfortForrige")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.utfortDenne")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.innestaaende")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.innestForrige")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.innestDenne")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.nettoDenne")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.mva")}</th>
                <th className="whitespace-nowrap px-3 py-2 text-right">{t("okonomi.sumInklMva")}</th>
              </tr>
            </thead>
            <tbody>
              {notas.map((n) => (
                <tr key={n.id} className="border-b hover:bg-gray-50">
                  <td className="whitespace-nowrap px-3 py-2 font-medium">
                    {n.notaType === "Sluttnota" ? t("okonomi.sluttnota") : `${n.notaType ?? t("okonomi.aNota")} ${n.notaNr}`}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{fmtDato(n.utfortPr)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(n.utfortTotalt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(n.utfortForrige)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">{fmt(n.utfortDenne)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(n.innestaaende)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(n.innestaaendeForrige)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">
                    <span className={Number(n.innestaaendeDenne) < 0 ? "text-red-600" : ""}>
                      {fmt(n.innestaaendeDenne)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-medium">{fmt(n.nettoDenne)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{fmt(n.mva)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums font-semibold">{fmt(n.sumInkMva)}</td>
                </tr>
              ))}
            </tbody>
            {notas.length > 1 && (
              <tfoot>
                <tr className="border-t-2 bg-gray-50 font-semibold">
                  <td className="px-3 py-2">{t("okonomi.totalt")}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(Math.max(...notas.map((n) => Number(n.utfortTotalt ?? 0))))}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(notas.reduce((s, n) => s + Number(n.utfortDenne ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(notas.reduce((s, n) => s + Number(n.innestaaendeDenne ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(notas.reduce((s, n) => s + Number(n.nettoDenne ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(notas.reduce((s, n) => s + Number(n.mva ?? 0), 0))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(notas.reduce((s, n) => s + Number(n.sumInkMva ?? 0), 0))}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  );
}

function NotaOppsummering({ dok }: { dok: { utfortTotalt?: unknown; utfortDenne?: unknown; innestaaende?: unknown; nettoDenne?: unknown; mva?: unknown; sumInkMva?: unknown } | null }) {
  const f = (v: unknown) => {
    if (v === null || v === undefined) return "—";
    const n = Number(v);
    if (isNaN(n)) return "—";
    return n.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const V = ({ label, verdi, uthevet }: { label: string; verdi: unknown; uthevet?: boolean }) => (
    <div className="flex items-baseline gap-1.5">
      <span className="text-gray-400 whitespace-nowrap">{label}</span>
      <span className={`font-mono whitespace-nowrap ${uthevet ? "font-semibold text-gray-900" : "text-gray-600"}`}>{f(dok ? verdi : null)}</span>
    </div>
  );

  return (
    <div className="text-[11px] leading-tight">
      <div className="flex gap-4">
        <V label="Utført totalt" verdi={dok?.utfortTotalt} />
        <V label="Denne" verdi={dok?.utfortDenne} uthevet />
        <V label="Innestående" verdi={dok?.innestaaende} />
      </div>
      <div className="flex gap-4 mt-0.5">
        <V label="Netto" verdi={dok?.nettoDenne} uthevet />
        <V label="Mva" verdi={dok?.mva} />
        <V label="Sum inkl." verdi={dok?.sumInkMva} uthevet />
      </div>
    </div>
  );
}

function FaneKnapp({
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
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
        aktiv
          ? "border-sitedoc-primary text-sitedoc-primary"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
