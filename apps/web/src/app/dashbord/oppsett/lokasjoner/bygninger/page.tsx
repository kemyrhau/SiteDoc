"use client";

import { useState, useRef, useCallback } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Input, Select, Textarea, Modal, Spinner, EmptyState } from "@siteflow/ui";
import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
} from "@siteflow/shared";
import {
  Plus,
  LayoutGrid,
  Copy,
  Trash2,
  Pencil,
  MoreVertical,
  X,
  Upload,
  Building2,
  FileText,
  ChevronDown,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  RedigerBygning — fullskjerm overlay for å redigere en bygning      */
/* ------------------------------------------------------------------ */

function RedigerBygning({
  bygningId,
  onLukk,
}: {
  bygningId: string;
  onLukk: () => void;
}) {
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();
  const filInputRef = useRef<HTMLInputElement>(null);
  const [visTilføyMeny, setVisTilføyMeny] = useState(false);
  const [visMerMeny, setVisMerMeny] = useState(false);
  const [valgtTegningId, setValgtTegningId] = useState<string | null>(null);

  // Zoom og panorering
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [erDraging, setErDraging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const forhåndsvisningRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.shiftKey) return;
    e.preventDefault();

    const container = forhåndsvisningRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // Musposisjon relativt til container (0–1)
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    setZoom((prev) => {
      const faktor = e.deltaY > 0 ? 0.9 : 1.1;
      const neste = Math.min(10, Math.max(0.1, prev * faktor));
      const skalaDiff = neste - prev;

      // Juster pan slik at zoom sentreres rundt musepekeren
      setPan((p) => ({
        x: p.x - skalaDiff * (mx - 0.5) * rect.width,
        y: p.y - skalaDiff * (my - 0.5) * rect.height,
      }));

      return neste;
    });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setErDraging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!erDraging) return;
    setPan({
      x: dragStart.current.panX + (e.clientX - dragStart.current.x),
      y: dragStart.current.panY + (e.clientY - dragStart.current.y),
    });
  }, [erDraging]);

  const handleMouseUp = useCallback(() => {
    setErDraging(false);
  }, []);

  const nullstillVisning = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Nullstill zoom ved bytte av tegning
  const velgTegning = useCallback((id: string | null) => {
    setValgtTegningId(id);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Opplastingstilstand
  const [lasterOpp, setLasterOpp] = useState(false);
  const [visMetadataModal, setVisMetadataModal] = useState(false);
  const [opplastetFil, setOpplastetFil] = useState<{
    fileUrl: string;
    fileName: string;
    fileType: string;
    fileSize: number;
  } | null>(null);

  // Metadata-skjema
  const [metaNavn, setMetaNavn] = useState("");
  const [metaTegningsnr, setMetaTegningsnr] = useState("");
  const [metaDisiplin, setMetaDisiplin] = useState("");
  const [metaType, setMetaType] = useState("");
  const [metaRevisjon, setMetaRevisjon] = useState("A");
  const [metaEtasje, setMetaEtasje] = useState("");
  const [metaMålestokk, setMetaMålestokk] = useState("");
  const [metaOpphav, setMetaOpphav] = useState("");
  const [metaBeskrivelse, setMetaBeskrivelse] = useState("");

  const { data: bygning } = trpc.bygning.hentMedId.useQuery({ id: bygningId });

  // Alle prosjekttegninger uten bygning (for tilknytning)
  const { data: alleTegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const tilknyttMutation = trpc.tegning.tilknyttBygning.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: bygningId });
      utils.tegning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
      utils.bygning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
    },
  });

  const opprettTegningMutation = trpc.tegning.opprett.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: bygningId });
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisMetadataModal(false);
      nullstillMetadata();
    },
  });

  function nullstillMetadata() {
    setOpplastetFil(null);
    setMetaNavn("");
    setMetaTegningsnr("");
    setMetaDisiplin("");
    setMetaType("");
    setMetaRevisjon("A");
    setMetaEtasje("");
    setMetaMålestokk("");
    setMetaOpphav("");
    setMetaBeskrivelse("");
  }

  async function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil) return;

    setLasterOpp(true);
    try {
      const formData = new FormData();
      formData.append("file", fil);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Opplasting feilet");
        return;
      }

      const data = await res.json();
      setOpplastetFil(data);
      setMetaNavn(fil.name.replace(/\.[^.]+$/, ""));
      setVisMetadataModal(true);
    } catch {
      alert("Kunne ikke laste opp filen");
    } finally {
      setLasterOpp(false);
      // Nullstill input slik at samme fil kan velges igjen
      e.target.value = "";
    }
  }

  function handleLagreTegning(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId || !opplastetFil) return;

    opprettTegningMutation.mutate({
      projectId: prosjektId,
      buildingId: bygningId,
      name: metaNavn,
      drawingNumber: metaTegningsnr || undefined,
      discipline: (metaDisiplin || undefined) as typeof DRAWING_DISCIPLINES[number] | undefined,
      drawingType: (metaType || undefined) as typeof DRAWING_TYPES[number] | undefined,
      revision: metaRevisjon || "A",
      floor: metaEtasje || undefined,
      scale: metaMålestokk || undefined,
      originator: metaOpphav || undefined,
      description: metaBeskrivelse || undefined,
      fileUrl: opplastetFil.fileUrl,
      fileType: opplastetFil.fileType,
      fileSize: opplastetFil.fileSize,
    });
  }

  const utilknyttede =
    alleTegninger?.filter((t) => !t.buildingId) ?? [];

  const tegninger = bygning?.drawings ?? [];
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">
            {bygning?.name ?? "Laster..."}
          </h2>
        </div>
        <button
          onClick={onLukk}
          className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Verktøylinje */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-6 py-2">
        <div className="relative">
          <Button
            size="sm"
            onClick={() => setVisTilføyMeny(!visTilføyMeny)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Tilføy
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {visTilføyMeny && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setVisTilføyMeny(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    filInputRef.current?.click();
                    setVisTilføyMeny(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="h-4 w-4" />
                  Last opp tegning
                </button>
                {utilknyttede.length > 0 && (
                  <>
                    <div className="my-1 border-t border-gray-100" />
                    <p className="px-4 py-1.5 text-xs font-medium text-gray-400">
                      Tilknytt eksisterende
                    </p>
                    {utilknyttede.map((tegning) => (
                      <button
                        key={tegning.id}
                        onClick={() => {
                          tilknyttMutation.mutate({
                            drawingId: tegning.id,
                            buildingId: bygningId,
                          });
                          setVisTilføyMeny(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4 text-gray-400" />
                        {tegning.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setVisMerMeny(!visMerMeny)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4" />
            Mer
          </button>
          {visMerMeny && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setVisMerMeny(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  disabled={!valgtTegningId}
                  onClick={() => {
                    if (valgtTegningId) {
                      tilknyttMutation.mutate({
                        drawingId: valgtTegningId,
                        buildingId: null,
                      });
                      setValgtTegningId(null);
                    }
                    setVisMerMeny(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Fjern tegning
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Skjult filinput for opplasting */}
      <input
        ref={filInputRef}
        type="file"
        accept=".pdf,.dwg,.dxf,.ifc,.png,.jpg,.jpeg"
        className="hidden"
        onChange={handleFilValgt}
      />

      {/* Opplastingsindikator */}
      {lasterOpp && (
        <div className="flex items-center gap-2 border-b border-gray-200 bg-blue-50 px-6 py-2 text-sm text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          Laster opp fil...
        </div>
      )}

      {/* To-kolonne innhold */}
      <div className="flex flex-1 overflow-hidden">
        {/* Venstre — tegningsliste */}
        <div className="flex w-[480px] flex-col border-r border-gray-200">
          <div className="flex-1 overflow-y-auto p-6">
            {tegninger.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {tegninger.map((tegning) => (
                  <li key={tegning.id}>
                    <button
                      onClick={() =>
                        velgTegning(
                          valgtTegningId === tegning.id ? null : tegning.id,
                        )
                      }
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        valgtTegningId === tegning.id
                          ? "bg-siteflow-primary/10 text-siteflow-primary"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      {tegning.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center pt-20">
                <p className="mb-6 text-xl text-gray-300">
                  Ingen tegninger eller modeller
                </p>
                <Button
                  variant="secondary"
                  onClick={() => filInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Last opp
                </Button>
                <p className="mt-2 text-xs text-gray-400">
                  IFC, DWG, PDF eller bilde
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Høyre — forhåndsvisning */}
        <div
          ref={forhåndsvisningRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={nullstillVisning}
          className="relative flex flex-1 overflow-hidden bg-gray-50"
          style={{ cursor: valgtTegning?.fileUrl ? (erDraging ? "grabbing" : "grab") : "default" }}
        >
          {valgtTegning?.fileUrl ? (
            <div
              className="flex min-h-full min-w-full items-center justify-center transition-transform duration-100 ease-out"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              {["png", "jpg", "jpeg"].includes(valgtTegning.fileType ?? "") ? (
                <img
                  src={`/api${valgtTegning.fileUrl}`}
                  alt={valgtTegning.name}
                  className="max-w-full object-contain"
                  draggable={false}
                />
              ) : (
                <iframe
                  src={`/api${valgtTegning.fileUrl}`}
                  title={valgtTegning.name}
                  className="h-[calc(100vh-120px)] w-[calc(100vw-480px)] border-0"
                />
              )}
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <LayoutGrid className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <p className="text-lg text-gray-400">
                  {valgtTegningId ? "Ingen fil tilgjengelig" : "Velg en tegning for forhåndsvisning"}
                </p>
              </div>
            </div>
          )}
          {valgtTegning?.fileUrl && zoom !== 1 && (
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white">
              {Math.round(zoom * 100)}%
            </div>
          )}
        </div>
      </div>

      {/* Metadata-modal for ny tegning */}
      <Modal
        open={visMetadataModal}
        onClose={() => {
          setVisMetadataModal(false);
          nullstillMetadata();
        }}
        title="Tegningsdetaljer"
      >
        <form onSubmit={handleLagreTegning} className="flex flex-col gap-4">
          <Input
            label="Navn"
            value={metaNavn}
            onChange={(e) => setMetaNavn(e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tegningsnummer"
              value={metaTegningsnr}
              onChange={(e) => setMetaTegningsnr(e.target.value)}
              placeholder="f.eks. ARK-P-101"
            />
            <Select
              label="Fagdisiplin"
              value={metaDisiplin}
              onChange={(e) => setMetaDisiplin(e.target.value)}
              placeholder="Velg disiplin"
              options={DRAWING_DISCIPLINES.map((d) => ({ value: d, label: d }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Tegningstype"
              value={metaType}
              onChange={(e) => setMetaType(e.target.value)}
              placeholder="Velg type"
              options={DRAWING_TYPES.map((t) => ({
                value: t,
                label: t.charAt(0).toUpperCase() + t.slice(1),
              }))}
            />
            <Input
              label="Revisjon"
              value={metaRevisjon}
              onChange={(e) => setMetaRevisjon(e.target.value)}
              placeholder="A"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Etasje"
              value={metaEtasje}
              onChange={(e) => setMetaEtasje(e.target.value)}
              placeholder="f.eks. 1. etasje"
            />
            <Input
              label="Målestokk"
              value={metaMålestokk}
              onChange={(e) => setMetaMålestokk(e.target.value)}
              placeholder="f.eks. 1:100"
            />
          </div>
          <Input
            label="Opphav (firma)"
            value={metaOpphav}
            onChange={(e) => setMetaOpphav(e.target.value)}
          />
          <Textarea
            label="Beskrivelse"
            value={metaBeskrivelse}
            onChange={(e) => setMetaBeskrivelse(e.target.value)}
            rows={2}
          />
          {opplastetFil && (
            <p className="text-xs text-gray-400">
              Fil: {opplastetFil.fileName} ({Math.round(opplastetFil.fileSize / 1024)} KB)
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVisMetadataModal(false);
                nullstillMetadata();
              }}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={opprettTegningMutation.isPending}>
              {opprettTegningMutation.isPending ? "Lagrer..." : "Lagre tegning"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PublisertBygningKort — kort med forhåndsvisning for publiserte     */
/* ------------------------------------------------------------------ */

function PublisertBygningKort({
  bygning,
  erValgt,
  onVelg,
  onRediger,
}: {
  bygning: {
    id: string;
    name: string;
    _count: { drawings: number };
  };
  erValgt: boolean;
  onVelg: () => void;
  onRediger: () => void;
}) {
  return (
    <button
      onClick={onVelg}
      onDoubleClick={onRediger}
      className={`flex w-[220px] flex-col overflow-hidden rounded-lg border bg-white text-left transition-shadow hover:shadow-md ${
        erValgt
          ? "border-siteflow-primary ring-1 ring-siteflow-primary"
          : "border-gray-200"
      }`}
    >
      {/* Forhåndsvisning-område */}
      <div className="flex h-[140px] items-center justify-center bg-gray-50">
        <LayoutGrid className="h-10 w-10 text-gray-300" />
      </div>
      {/* Navn */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-gray-900">
          {bygning.name}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function BygningerSide() {
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [visEndreNavnModal, setVisEndreNavnModal] = useState(false);
  const [nyNavn, setNyNavn] = useState("");
  const [endreNavn, setEndreNavn] = useState("");
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [redigerBygningId, setRedigerBygningId] = useState<string | null>(null);
  const [visMerMeny, setVisMerMeny] = useState(false);

  const { data: bygninger, isLoading } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMutation = trpc.bygning.opprett.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
      setVisModal(false);
      setNyNavn("");
    },
  });

  const slettMutation = trpc.bygning.slett.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
      setValgtId(null);
    },
  });

  const publiserMutation = trpc.bygning.publiser.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
    },
  });

  const oppdaterMutation = trpc.bygning.oppdater.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({
        projectId: prosjektId!,
      });
      setVisEndreNavnModal(false);
      setEndreNavn("");
    },
  });

  // Valgt bygning
  const valgtBygning = bygninger?.find((b) => b.id === valgtId) ?? null;

  // Del opp i publiserte og upubliserte
  const upubliserte = bygninger?.filter((b) => b.status === "unpublished") ?? [];
  const publiserte = bygninger?.filter((b) => b.status === "published") ?? [];

  function handleOpprett(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId) return;
    opprettMutation.mutate({
      name: nyNavn,
      projectId: prosjektId,
    });
  }

  function handleEndreNavn(e: React.FormEvent) {
    e.preventDefault();
    if (!valgtId) return;
    oppdaterMutation.mutate({ id: valgtId, name: endreNavn });
  }

  function handleSlettValgt() {
    if (!valgtId) return;
    slettMutation.mutate({ id: valgtId });
  }

  function apneEndreNavn() {
    if (!valgtBygning) return;
    setEndreNavn(valgtBygning.name);
    setVisEndreNavnModal(true);
    setVisMerMeny(false);
  }

  function hentStatus(bygning: { _count: { drawings: number } }) {
    if (bygning._count.drawings === 0) return "Bygningen er tom";
    return `${bygning._count.drawings} tegning${bygning._count.drawings !== 1 ? "er" : ""}`;
  }

  const harValgt = !!valgtBygning;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Verktøylinje — Dalux-stil */}
      <div className="mb-6 flex items-center gap-1 border-b border-gray-200 pb-3">
        <Button size="sm" onClick={() => setVisModal(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tilføy
        </Button>
        <button
          disabled={!harValgt}
          onClick={apneEndreNavn}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Copy className="h-4 w-4" />
          Endre navn
        </button>
        <button
          disabled={!harValgt}
          onClick={handleSlettValgt}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
          Slett
        </button>
        <button
          disabled={!harValgt}
          onClick={() => {
            if (valgtId) setRedigerBygningId(valgtId);
          }}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Pencil className="h-4 w-4" />
          Rediger
        </button>
        <div className="relative">
          <button
            onClick={() => setVisMerMeny(!visMerMeny)}
            className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm text-gray-500 transition-colors hover:bg-gray-100"
          >
            <MoreVertical className="h-4 w-4" />
            Mer
          </button>
          {visMerMeny && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setVisMerMeny(false)}
              />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  disabled={!harValgt}
                  onClick={() => {
                    if (valgtBygning) {
                      publiserMutation.mutate({ id: valgtBygning.id });
                    }
                    setVisMerMeny(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                >
                  Publiser
                </button>
                <button
                  disabled={!harValgt}
                  onClick={() => {
                    handleSlettValgt();
                    setVisMerMeny(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Slett bygning
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Innhold */}
      {!bygninger || bygninger.length === 0 ? (
        <EmptyState
          title="Ingen bygninger"
          description="Opprett din første bygning for å begynne å organisere tegninger."
        />
      ) : (
        <>
          {/* Upubliserte bygninger */}
          {upubliserte.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                Upubliserte bygninger
              </h3>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        Bygningsnavn
                      </th>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-gray-700">
                        Oppdatert av
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {upubliserte.map((bygning) => (
                      <tr
                        key={bygning.id}
                        onClick={() =>
                          setValgtId(
                            valgtId === bygning.id ? null : bygning.id,
                          )
                        }
                        onDoubleClick={() =>
                          setRedigerBygningId(bygning.id)
                        }
                        className={`cursor-pointer border-b border-gray-100 last:border-0 ${
                          valgtId === bygning.id
                            ? "bg-siteflow-primary/5"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-sm text-gray-900">
                          {bygning.name}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">
                          {hentStatus(bygning)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-sm text-gray-500">
                          &mdash;
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-3 text-sm text-gray-500">
                Bygninger vil <strong>automatisk</strong> bli gjort
                tilgjengelige når de er blitt utarbeidet.
              </p>
            </div>
          )}

          {/* Publiserte bygninger */}
          {publiserte.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                Publiserte bygninger
              </h3>
              <div className="flex flex-wrap gap-4">
                {publiserte.map((bygning) => (
                  <PublisertBygningKort
                    key={bygning.id}
                    bygning={bygning}
                    erValgt={valgtId === bygning.id}
                    onVelg={() =>
                      setValgtId(
                        valgtId === bygning.id ? null : bygning.id,
                      )
                    }
                    onRediger={() => setRedigerBygningId(bygning.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tilføy bygning modal */}
      <Modal
        open={visModal}
        onClose={() => setVisModal(false)}
        title="Tilføy bygning"
      >
        {opprettMutation.isPending ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleOpprett} className="flex flex-col gap-4">
            <Input
              label="Navn"
              value={nyNavn}
              onChange={(e) => setNyNavn(e.target.value)}
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setVisModal(false)}
              >
                Avbryt
              </Button>
              <Button type="submit">Tilføy bygning</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Endre navn modal */}
      <Modal
        open={visEndreNavnModal}
        onClose={() => setVisEndreNavnModal(false)}
        title="Endre navn"
      >
        <form onSubmit={handleEndreNavn} className="flex flex-col gap-4">
          <Input
            label="Nytt navn"
            value={endreNavn}
            onChange={(e) => setEndreNavn(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setVisEndreNavnModal(false)}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={oppdaterMutation.isPending}>
              Lagre
            </Button>
          </div>
        </form>
      </Modal>

      {/* Fullskjerm redigeringsvisning */}
      {redigerBygningId && (
        <RedigerBygning
          bygningId={redigerBygningId}
          onLukk={() => setRedigerBygningId(null)}
        />
      )}
    </div>
  );
}
