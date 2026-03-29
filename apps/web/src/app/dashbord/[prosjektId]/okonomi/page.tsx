"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { BarChart3, Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, RefreshCw, Plus } from "lucide-react";
import { SpecPostTabell } from "@/components/mengde/spec-post-tabell";
import { Avviksanalyse } from "@/components/mengde/avviksanalyse";
import { NotatEditor } from "@/components/mengde/notat-editor";
import { NsKodePanel } from "@/components/mengde/ns-kode-panel";
import { ImportDialog } from "@/components/mengde/import-dialog";
import { trpc } from "@/lib/trpc";

type Fane = "oversikt" | "avviksanalyse" | "dokumenter";
type DokType = "a_nota" | "t_nota";

export default function OkonomiSide() {
  const params = useParams<{ prosjektId: string }>();
  const prosjektId = params.prosjektId;

  const [kontraktId, setKontraktId] = useState<string | null>(null);
  const [dokType, setDokType] = useState<DokType>("a_nota");
  const [valgtNotaNr, setValgtNotaNr] = useState<number | null>(null);
  const [aktivFane, setAktivFane] = useState<Fane>("oversikt");
  const [valgtPostId, setValgtPostId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [visNyKontrakt, setVisNyKontrakt] = useState(false);
  const [nyKontraktNavn, setNyKontraktNavn] = useState("");
  const [nyKontraktType, setNyKontraktType] = useState("");
  const [nyKontraktByggherre, setNyKontraktByggherre] = useState("");
  const [nyKontraktEntreprenor, setNyKontraktEntreprenor] = useState("");

  const { data: kontrakter } = trpc.kontrakt.hentForProsjekt.useQuery(
    { projectId: prosjektId },
    { enabled: !!prosjektId },
  );

  const utils2 = trpc.useUtils();
  const opprettKontrakt = trpc.kontrakt.opprett.useMutation({
    onSuccess: (ny) => {
      utils2.kontrakt.hentForProsjekt.invalidate({ projectId: prosjektId });
      setKontraktId(ny.id);
      setVisNyKontrakt(false);
      setNyKontraktNavn("");
      setNyKontraktType("");
      setNyKontraktEntreprenor("");
    },
  });

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
    if (!dokumenter) return { budsjett: null, notas: [] };
    const filtrert = kontraktId
      ? dokumenter.filter((d) => d.kontraktId === kontraktId)
      : dokumenter;
    const budsjett = filtrert.find((d) => d.docType === "anbudsgrunnlag") ?? null;
    const notas = filtrert
      .filter((d) => d.docType === dokType && d.notaNr !== null)
      .sort((a, b) => (a.notaNr ?? 0) - (b.notaNr ?? 0));
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
    { enabled: !!prosjektId && !budsjettDokId },
  );

  const poster = budsjettPoster ?? allePoster;
  const valgtPost = poster?.find((p) => p.id === valgtPostId) ?? null;

  return (
    <div className="flex h-full flex-col">
      {/* Toppseksjon */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-sitedoc-primary" />
          <h1 className="text-lg font-semibold">Økonomi</h1>
        </div>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1.5 rounded bg-sitedoc-primary px-3 py-1.5 text-sm text-white hover:bg-sitedoc-secondary"
        >
          <Upload className="h-4 w-4" />
          Importer
        </button>
      </div>

      {/* Velgere */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <label className="text-xs text-gray-500">Kontrakt:</label>
        <div className="flex items-center gap-1">
          <select
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
            value={kontraktId ?? ""}
            onChange={(e) => {
              setKontraktId(e.target.value || null);
              setValgtNotaNr(null);
            }}
          >
            <option value="">Alle kontrakter</option>
            {kontrakter?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.navn}
              </option>
            ))}
          </select>
          <button
            onClick={() => setVisNyKontrakt(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Ny kontrakt"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-1 h-4 w-px bg-gray-300" />

        <label className="text-xs text-gray-500">Type:</label>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          value={dokType}
          onChange={(e) => {
            setDokType(e.target.value as DokType);
            setValgtNotaNr(null);
          }}
        >
          <option value="a_nota">A-Nota</option>
          <option value="t_nota">T-Nota</option>
        </select>

        <label className="text-xs text-gray-500">Nr:</label>
        <select
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
          value={valgtNotaNr ?? ""}
          onChange={(e) => setValgtNotaNr(e.target.value ? parseInt(e.target.value, 10) : null)}
        >
          <option value="">Kun budsjett</option>
          {kontraktDokumenter.notas.map((d) => (
            <option key={d.id} value={d.notaNr!}>
              {d.notaNr}
            </option>
          ))}
        </select>
      </div>

      {/* Faner */}
      <div className="flex gap-1 border-b px-4">
        <FaneKnapp
          aktiv={aktivFane === "oversikt"}
          onClick={() => setAktivFane("oversikt")}
        >
          Oversikt
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "avviksanalyse"}
          onClick={() => setAktivFane("avviksanalyse")}
        >
          Avviksanalyse
        </FaneKnapp>
        <FaneKnapp
          aktiv={aktivFane === "dokumenter"}
          onClick={() => setAktivFane("dokumenter")}
        >
          Dokumenter
          {dokumenter && dokumenter.length > 0 && (
            <span className="ml-1.5 rounded-full bg-gray-200 px-1.5 py-0.5 text-[10px]">
              {dokumenter.length}
            </span>
          )}
        </FaneKnapp>
      </div>

      {/* Innhold */}
      {aktivFane === "oversikt" ? (
        <>
          {/* Tabell — fyller midten, scroller internt */}
          <div className="min-h-0 flex-1 px-4 pt-4">
            <SpecPostTabell
              poster={poster ?? []}
              sammenligningPoster={valgtNotaNr !== null ? (notaPoster ?? []) : undefined}
              sammenligningLabel={valgtNotaNr !== null ? `${dokType === "a_nota" ? "A-Nota" : "T-Nota"} ${valgtNotaNr}` : undefined}
              onVelgPost={setValgtPostId}
              valgtPostId={valgtPostId}
            />
          </div>

          {/* Detaljpanel — alltid synlig i bunn */}
          <div className="shrink-0 border-t px-4 py-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded border p-3">
                <NotatEditor
                  specPostId={valgtPostId}
                  eksternNotat={valgtPost?.eksternNotat ?? null}
                />
              </div>
              <div className="rounded border p-3">
                <NsKodePanel nsKode={valgtPost?.nsKode ?? null} />
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {aktivFane === "avviksanalyse" ? (
            <Avviksanalyse projectId={prosjektId} />
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
        onClose={() => setImportOpen(false)}
      />

      {/* Ny kontrakt modal */}
      {visNyKontrakt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setVisNyKontrakt(false)}>
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3">
              <h2 className="text-base font-semibold">Ny kontrakt</h2>
            </div>
            <div className="space-y-3 p-5">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Kontraktnavn</label>
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
                <label className="mb-1 block text-xs font-medium text-gray-500">Kontrakttype</label>
                <select
                  className="w-full rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  value={nyKontraktType}
                  onChange={(e) => setNyKontraktType(e.target.value)}
                >
                  <option value="">Velg type...</option>
                  <option value="8405">NS 8405 — Utførelsesentreprise</option>
                  <option value="8406">NS 8406 — Forenklet utførelsesentreprise</option>
                  <option value="8407">NS 8407 — Totalentreprise</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Byggherre</label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="f.eks. Din Kommune"
                  value={nyKontraktByggherre}
                  onChange={(e) => setNyKontraktByggherre(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Entreprenør</label>
                <input
                  type="text"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
                  placeholder="f.eks. Firma AS"
                  value={nyKontraktEntreprenor}
                  onChange={(e) => setNyKontraktEntreprenor(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-3">
              <button
                onClick={() => setVisNyKontrakt(false)}
                className="rounded px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
              >
                Avbryt
              </button>
              <button
                onClick={() => {
                  if (nyKontraktNavn.trim()) {
                    opprettKontrakt.mutate({
                      projectId: prosjektId,
                      navn: nyKontraktNavn.trim(),
                      kontraktType: (nyKontraktType as "8405" | "8406" | "8407") || undefined,
                      entreprenor: nyKontraktEntreprenor.trim() || undefined,
                    });
                  }
                }}
                disabled={!nyKontraktNavn.trim()}
                className="rounded bg-sitedoc-primary px-4 py-1.5 text-sm text-white hover:bg-sitedoc-secondary disabled:opacity-50"
              >
                Opprett
              </button>
            </div>
          </div>
        </div>
      )}
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
    anbudsgrunnlag: "Anbudsgrunnlag",
    budsjett: "Budsjett",
    a_nota: "A-nota",
    t_nota: "T-nota",
    mengdebeskrivelse: "Mengdebeskrivelse",
    annet: "Dokument",
  };

  if (dokumenter.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <FileText className="mb-2 h-8 w-8" />
        <div className="text-sm">Ingen dokumenter importert ennå.</div>
        <div className="text-xs">Klikk «Importer» for å laste opp.</div>
      </div>
    );
  }

  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b text-xs font-medium uppercase text-gray-500">
          <th className="px-3 py-2">Filnavn</th>
          <th className="px-3 py-2">Type</th>
          <th className="px-3 py-2">Mappe</th>
          <th className="px-3 py-2">Lastet opp</th>
          <th className="px-3 py-2">Status</th>
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
                  title="Klikk for å endre"
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
              {dok.folder?.name ?? "—"}
            </td>
            <td className="px-3 py-2 text-gray-500">
              {new Date(dok.uploadedAt).toLocaleDateString("nb-NO")}
            </td>
            <td className="px-3 py-2">
              {dok.processingState === "pending" || dok.processingState === "processing" ? (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Prosesserer...
                </span>
              ) : dok.processingState === "completed" ? (
                <span className="flex items-center gap-1 text-xs text-green-600">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Ferdig
                </span>
              ) : dok.processingState === "failed" ? (
                <span className="flex items-center gap-1 text-xs text-red-500" title={dok.processingError ?? ""}>
                  <AlertCircle className="h-3.5 w-3.5" />
                  Feilet
                </span>
              ) : null}
            </td>
            <td className="px-3 py-2 flex items-center gap-1">
              {dok.processingState === "failed" && (
                <button
                  onClick={() => reprosesserMutation.mutate({ documentId: dok.id })}
                  className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                  title="Prøv igjen"
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
        <option value="anbudsgrunnlag">Anbudsgrunnlag</option>
        <option value="a_nota">A-nota</option>
        <option value="t_nota">T-nota</option>
        <option value="mengdebeskrivelse">Mengdebeskrivelse</option>
        <option value="annet">Annet</option>
      </select>

      {/* Kontrakt — for alle typer */}
      <select
        className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm"
        value={valgtKontraktId}
        onChange={(e) => setValgtKontraktId(e.target.value)}
      >
        <option value="">Velg kontrakt...</option>
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
          Lagre
        </button>
        <button
          onClick={onAvbryt}
          className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
        >
          Avbryt
        </button>
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
