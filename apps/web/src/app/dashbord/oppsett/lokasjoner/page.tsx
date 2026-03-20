"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useProsjekt } from "@/kontekst/prosjekt-kontekst";
import { trpc } from "@/lib/trpc";
import { Button, Input, Select, Textarea, Modal, Spinner, EmptyState } from "@sitedoc/ui";
import {
  DRAWING_DISCIPLINES,
  DRAWING_TYPES,
} from "@sitedoc/shared";
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
  MapPin,
} from "lucide-react";
import { GeoReferanseEditor } from "@/components/GeoReferanseEditor";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

type TegningRad = {
  id: string;
  name: string;
  buildingId: string | null;
  fileUrl: string;
  fileType: string;
  floor?: string | null;
  geoReference?: unknown;
};

interface TegningGruppe {
  navn: string;
  tegninger: TegningRad[];
  ikon: "utomhus" | "etasje" | "uten";
}

/* ------------------------------------------------------------------ */
/*  grupperTegninger — grupperer tegninger etter Utomhus / etasje       */
/* ------------------------------------------------------------------ */

function grupperTegninger(tegninger: TegningRad[]): TegningGruppe[] {
  const utomhus: TegningRad[] = [];
  const etasjeMap: Record<string, TegningRad[]> = {};
  const utenEtasje: TegningRad[] = [];

  for (const t of tegninger) {
    if (t.geoReference) {
      utomhus.push(t);
    } else if (t.floor) {
      const etasje = t.floor;
      if (!etasjeMap[etasje]) etasjeMap[etasje] = [];
      etasjeMap[etasje]!.push(t);
    } else {
      utenEtasje.push(t);
    }
  }

  const grupper: TegningGruppe[] = [];

  if (utomhus.length > 0) {
    grupper.push({ navn: "Utomhus", tegninger: utomhus, ikon: "utomhus" });
  }

  const sortedEtasjer = Object.entries(etasjeMap).sort(([a], [b]) =>
    a.localeCompare(b, "nb-NO", { numeric: true }),
  );
  for (const [etasje, tegningerIGruppe] of sortedEtasjer) {
    grupper.push({ navn: etasje, tegninger: tegningerIGruppe, ikon: "etasje" });
  }

  if (utenEtasje.length > 0) {
    grupper.push({ navn: "Uten etasje", tegninger: utenEtasje, ikon: "uten" });
  }

  return grupper;
}

/* ------------------------------------------------------------------ */
/*  RedigerLokasjon — fullskjerm overlay for å redigere en lokasjon     */
/* ------------------------------------------------------------------ */

function RedigerLokasjon({
  lokasjonId,
  onLukk,
}: {
  lokasjonId: string;
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

  // Georeferanse-visning
  const [visGeoEditor, setVisGeoEditor] = useState(false);

  // Inline SVG for vector-effect:non-scaling-stroke
  const [svgInnhold, setSvgInnhold] = useState<string | null>(null);

  // Zoom via native event listener (React onWheel er passiv og kan ikke preventDefault)
  useEffect(() => {
    const container = forhåndsvisningRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width;
      const my = (e.clientY - rect.top) / rect.height;

      setZoom((prev) => {
        const faktor = e.deltaY > 0 ? 0.9 : 1.1;
        const neste = Math.min(50, Math.max(0.1, prev * faktor));
        const skalaDiff = neste - prev;

        setPan((p) => ({
          x: p.x - skalaDiff * (mx - 0.5) * rect.width,
          y: p.y - skalaDiff * (my - 0.5) * rect.height,
        }));

        return neste;
      });
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
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

  const velgTegning = useCallback((id: string | null) => {
    setValgtTegningId(id);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setVisGeoEditor(false);
    setSvgInnhold(null);
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

  const { data: lokasjon } = trpc.bygning.hentMedId.useQuery({ id: lokasjonId });

  // Hent SVG-innhold for inline rendering med zoom-justert linjetykkelse
  useEffect(() => {
    if (!valgtTegningId) { setSvgInnhold(null); return; }
    const tegning = (lokasjon?.drawings as TegningRad[] | undefined)?.find((t) => t.id === valgtTegningId);
    if (!tegning || (tegning.fileType ?? "") !== "svg" || !tegning.fileUrl) {
      setSvgInnhold(null);
      return;
    }
    fetch(`/api${tegning.fileUrl}`)
      .then((res) => res.text())
      .then((tekst) => {
        let tilpasset = tekst.replace(
          /<svg([^>]*)>/,
          (_match, attrs: string) => {
            const uten = attrs
              .replace(/\s*width="[^"]*"/g, "")
              .replace(/\s*height="[^"]*"/g, "");
            return `<svg${uten} width="100%" height="auto" style="display:block">`;
          },
        );
        // Fjern eksisterende <style> og erstatt med zoom-bevisst versjon
        tilpasset = tilpasset.replace(/<style>[^<]*<\/style>/g, "");
        tilpasset = tilpasset.replace(
          /(<svg[^>]*>)/,
          `$1\n<style>line,polyline,circle,path,ellipse,polygon{stroke-width:calc(1.5 / var(--svg-zoom, 1)) !important}</style>`,
        );
        setSvgInnhold(tilpasset);
      })
      .catch(() => setSvgInnhold(null));
  }, [valgtTegningId, lokasjon?.drawings]);

  const { data: alleTegninger } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const tilknyttMutation = trpc.tegning.tilknyttBygning.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: lokasjonId });
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const opprettTegningMutation = trpc.tegning.opprett.useMutation({
    onSuccess: () => {
      utils.bygning.hentMedId.invalidate({ id: lokasjonId });
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
      e.target.value = "";
    }
  }

  function handleLagreTegning(e: React.FormEvent) {
    e.preventDefault();
    if (!prosjektId || !opplastetFil) return;

    opprettTegningMutation.mutate({
      projectId: prosjektId,
      buildingId: lokasjonId,
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

  const utilknyttede = (alleTegninger as TegningRad[] | undefined)
    ?.filter((t) => !t.buildingId) ?? [];
  const tegninger = (lokasjon?.drawings ?? []) as TegningRad[];
  const valgtTegning = tegninger.find((t) => t.id === valgtTegningId) ?? null;
  const tegningGrupper = grupperTegninger(tegninger);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header + Verktøylinje (samlet rad) */}
      <div className="flex items-center gap-1 border-b border-gray-200 px-4 py-1.5">
        <div className="flex items-center gap-2 mr-3">
          <Building2 className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-900">
            {lokasjon?.name ?? "Laster..."}
          </span>
        </div>

        <div className="relative">
          <Button size="sm" onClick={() => setVisTilføyMeny(!visTilføyMeny)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Tilføy
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          {visTilføyMeny && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setVisTilføyMeny(false)} />
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
                            buildingId: lokasjonId,
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

        {valgtTegningId && (
          <button
            onClick={() => setVisGeoEditor(!visGeoEditor)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              visGeoEditor
                ? "bg-sitedoc-primary/10 text-sitedoc-primary font-medium"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            <MapPin className="h-4 w-4" />
            Georeferanse
          </button>
        )}

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
              <div className="fixed inset-0 z-10" onClick={() => setVisMerMeny(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  disabled={!valgtTegningId}
                  onClick={() => {
                    if (valgtTegningId) {
                      tilknyttMutation.mutate({ drawingId: valgtTegningId, buildingId: null });
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

        <div className="flex-1" />

        <button
          onClick={onLukk}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Skjult filinput */}
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
        {/* Venstre — tegningsliste gruppert */}
        <div className="flex w-[260px] flex-shrink-0 flex-col border-r border-gray-200">
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {tegninger.length > 0 ? (
              <div className="flex flex-col gap-4">
                {tegningGrupper.map((gruppe) => (
                  <div key={gruppe.navn}>
                    <div className="mb-1 flex items-center gap-2 px-3 py-1">
                      {gruppe.ikon === "utomhus" ? (
                        <MapPin className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      )}
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {gruppe.navn}
                      </span>
                      <span className="text-xs text-gray-400">
                        ({gruppe.tegninger.length})
                      </span>
                    </div>
                    <ul className="flex flex-col gap-0.5">
                      {gruppe.tegninger.map((tegning) => {
                        const harGeoRef = !!tegning.geoReference;
                        return (
                          <li key={tegning.id}>
                            <button
                              onClick={() => velgTegning(valgtTegningId === tegning.id ? null : tegning.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                valgtTegningId === tegning.id
                                  ? "bg-sitedoc-primary/10 text-sitedoc-primary"
                                  : "text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              <FileText className="h-4 w-4 flex-shrink-0 text-gray-400" />
                              <span className="flex-1">{tegning.name}</span>
                              {harGeoRef && (
                                <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                                  Georeferert
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center pt-12">
                <p className="mb-4 text-sm text-gray-300">
                  Ingen tegninger
                </p>
                <Button variant="secondary" onClick={() => filInputRef.current?.click()}>
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

        {/* Høyre — forhåndsvisning eller georeferanse-editor */}
        {visGeoEditor && valgtTegningId ? (
          <div className="flex-1 overflow-auto bg-gray-50 p-6">
            <GeoReferanseEditor
              tegningId={valgtTegningId}
              tegning={valgtTegning}
              onLagret={() => {
                utils.bygning.hentMedId.invalidate({ id: lokasjonId });
              }}
            />
          </div>
        ) : (
          <div
            ref={forhåndsvisningRef}
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
                {(valgtTegning.fileType ?? "") === "dwg" ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <p className="text-sm">DWG-filen må konverteres før den kan vises</p>
                  </div>
                ) : ["png", "jpg", "jpeg", "svg"].includes(valgtTegning.fileType ?? "") ? (
                  (valgtTegning.fileType ?? "") === "svg" && svgInnhold ? (
                    <div
                      className="max-w-full"
                      style={{ "--svg-zoom": zoom } as React.CSSProperties}
                      dangerouslySetInnerHTML={{ __html: svgInnhold }}
                    />
                  ) : (
                    <img
                      src={`/api${valgtTegning.fileUrl}`}
                      alt={valgtTegning.name}
                      className="max-w-full object-contain"
                      draggable={false}
                    />
                  )
                ) : (
                  <iframe
                    src={`/api${valgtTegning.fileUrl}`}
                    title={valgtTegning.name}
                    className="h-[calc(100vh-50px)] w-[calc(100vw-260px)] border-0"
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
        )}
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
/*  PublisertLokasjonKort                                               */
/* ------------------------------------------------------------------ */

function PublisertLokasjonKort({
  lokasjon,
  erValgt,
  onVelg,
  onRediger,
}: {
  lokasjon: {
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
          ? "border-sitedoc-primary ring-1 ring-sitedoc-primary"
          : "border-gray-200"
      }`}
    >
      <div className="flex h-[140px] items-center justify-center bg-gray-50">
        <Building2 className="h-10 w-10 text-gray-300" />
      </div>
      <div className="border-t border-gray-100 px-3 py-2.5">
        <p className="truncate text-sm font-medium text-gray-900">
          {lokasjon.name}
        </p>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function LokasjonerSide() {
  const { prosjektId } = useProsjekt();
  const utils = trpc.useUtils();
  const [visModal, setVisModal] = useState(false);
  const [visEndreNavnModal, setVisEndreNavnModal] = useState(false);
  const [nyNavn, setNyNavn] = useState("");
  const [endreNavn, setEndreNavn] = useState("");
  const [valgtId, setValgtId] = useState<string | null>(null);
  const [redigerLokasjonId, setRedigerLokasjonId] = useState<string | null>(null);
  const [visMerMeny, setVisMerMeny] = useState(false);

  const { data: lokasjoner, isLoading } = trpc.bygning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );

  const opprettMutation = trpc.bygning.opprett.useMutation({
    onSuccess: (_data: unknown, variabler: { name: string }) => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! }).then(() => {
        const oppdatert = utils.bygning.hentForProsjekt.getData({ projectId: prosjektId! });
        const nytt = oppdatert?.find((a) => a.name === variabler.name);
        if (nytt) setRedigerLokasjonId(nytt.id);
      });
      setVisModal(false);
      setNyNavn("");
    },
  });

  const slettMutation = trpc.bygning.slett.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setValgtId(null);
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  const publiserMutation = trpc.bygning.publiser.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const oppdaterMutation = trpc.bygning.oppdater.useMutation({
    onSuccess: () => {
      utils.bygning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setVisEndreNavnModal(false);
      setEndreNavn("");
    },
  });

  const valgtLokasjon = lokasjoner?.find((b) => b.id === valgtId) ?? null;
  const upubliserte = lokasjoner?.filter((b) => b.status === "unpublished") ?? [];
  const publiserte = lokasjoner?.filter((b) => b.status === "published") ?? [];

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
    if (!valgtId || !valgtLokasjon) return;
    if (!confirm(`Er du sikker på at du vil slette «${valgtLokasjon.name}»?`)) return;
    slettMutation.mutate({ id: valgtId });
  }

  function apneEndreNavn() {
    if (!valgtLokasjon) return;
    setEndreNavn(valgtLokasjon.name);
    setVisEndreNavnModal(true);
    setVisMerMeny(false);
  }

  const harValgt = !!valgtLokasjon;
  const erPublisert = valgtLokasjon?.status === "published";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      {/* Verktøylinje */}
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
            if (valgtId) setRedigerLokasjonId(valgtId);
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
              <div className="fixed inset-0 z-10" onClick={() => setVisMerMeny(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {harValgt && !erPublisert && (
                  <button
                    onClick={() => {
                      if (valgtLokasjon) {
                        publiserMutation.mutate({ id: valgtLokasjon.id });
                      }
                      setVisMerMeny(false);
                    }}
                    className="flex w-full items-center px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Publiser
                  </button>
                )}
                <button
                  disabled={!harValgt}
                  onClick={() => {
                    handleSlettValgt();
                    setVisMerMeny(false);
                  }}
                  className="flex w-full items-center px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50 disabled:opacity-40"
                >
                  Slett lokasjon
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Innhold */}
      {!lokasjoner || lokasjoner.length === 0 ? (
        <EmptyState
          title="Ingen lokasjoner"
          description="Opprett din første lokasjon for å begynne å organisere tegninger."
        />
      ) : (
        <>
          {/* Upubliserte lokasjoner */}
          {upubliserte.length > 0 && (
            <div className="mb-8">
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                Upubliserte lokasjoner
              </h3>

              <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-gray-700">
                        Navn
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
                    {upubliserte.map((lokasjon) => (
                      <tr
                        key={lokasjon.id}
                        onClick={() => setValgtId(valgtId === lokasjon.id ? null : lokasjon.id)}
                        onDoubleClick={() => setRedigerLokasjonId(lokasjon.id)}
                        className={`cursor-pointer border-b border-gray-100 last:border-0 ${
                          valgtId === lokasjon.id
                            ? "bg-sitedoc-primary/5"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-2.5 text-sm text-gray-900">
                          {lokasjon.name}
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-500">
                          Upublisert
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
                Lokasjoner vil <strong>automatisk</strong> bli gjort
                tilgjengelige når de er blitt utarbeidet.
              </p>
            </div>
          )}

          {/* Publiserte lokasjoner */}
          {publiserte.length > 0 && (
            <div>
              <h3 className="mb-3 text-lg font-bold text-gray-900">
                Publiserte lokasjoner
              </h3>
              <div className="flex flex-wrap gap-4">
                {publiserte.map((lokasjon) => (
                  <PublisertLokasjonKort
                    key={lokasjon.id}
                    lokasjon={lokasjon}
                    erValgt={valgtId === lokasjon.id}
                    onVelg={() => setValgtId(valgtId === lokasjon.id ? null : lokasjon.id)}
                    onRediger={() => setRedigerLokasjonId(lokasjon.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tilføy lokasjon modal */}
      <Modal
        open={visModal}
        onClose={() => setVisModal(false)}
        title="Tilføy lokasjon"
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
              <Button type="submit">Tilføy lokasjon</Button>
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
      {redigerLokasjonId && (
        <RedigerLokasjon
          lokasjonId={redigerLokasjonId}
          onLukk={() => setRedigerLokasjonId(null)}
        />
      )}
    </div>
  );
}
