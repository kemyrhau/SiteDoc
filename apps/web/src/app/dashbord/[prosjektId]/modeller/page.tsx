"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button, Spinner } from "@sitedoc/ui";
import {
  Upload,
  Box,
  Loader2,
  AlertTriangle,
  X,
  ChevronRight,
  ChevronDown,
  Trash2,
  Scissors,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Typer                                                               */
/* ------------------------------------------------------------------ */

interface TegningRad {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  ifcMetadata: unknown;
  building: { id: string; name: string } | null;
}

interface EgenskapVerdi {
  value: unknown;
  type?: string;
}

interface EgenskapGruppe {
  navn: string;
  egenskaper: Record<string, EgenskapVerdi>;
}

interface ValgtObjekt {
  localId: number;
  kategori: string | null;
  attributter: Record<string, EgenskapVerdi>;
  relasjoner: EgenskapGruppe[];
}

interface TreNode {
  category: string | null;
  localId: number | null;
  children?: TreNode[];
  utvidet?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Hovedside                                                          */
/* ------------------------------------------------------------------ */

export default function ModellerSide() {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const utils = trpc.useUtils();

  const { data: _tegninger, isLoading } = trpc.tegning.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const tegninger = (_tegninger as TegningRad[] | undefined)?.filter(
    (t) => t.fileType?.toLowerCase() === "ifc",
  );

  const [valgtId, setValgtId] = useState<string | null>(null);
  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [spatialTre, setSpatialTre] = useState<TreNode | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [klippModus, setKlippModus] = useState(false);

  // Referanse til viewer-funksjoner for objekttre-interaksjon og klipping
  const viewerRef = useRef<{
    velgObjekt: (localId: number) => void;
    zoomTilObjekt: (localId: number) => void;
    opprettKlippeplan: () => void;
    fjernAlleKlippeplan: () => void;
    settKlipperSynlig: (synlig: boolean) => void;
  } | null>(null);

  const opprettMutation = trpc.tegning.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const slettMutation = trpc.tegning.slett.useMutation({
    onSuccess: () => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
      setValgtId(null);
      setValgtObjekt(null);
      setSpatialTre(null);
    },
  });

  async function handleFilValgt(e: React.ChangeEvent<HTMLInputElement>) {
    const fil = e.target.files?.[0];
    if (!fil || !prosjektId) return;

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
      opprettMutation.mutate({
        projectId: prosjektId,
        name: fil.name.replace(/\.[^.]+$/, ""),
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        fileSize: data.fileSize,
      });
    } catch {
      alert("Kunne ikke laste opp filen");
    } finally {
      setLasterOpp(false);
      e.target.value = "";
    }
  }

  const valgt = tegninger?.find((t) => t.id === valgtId) ?? null;

  function handleObjektValgt(obj: ValgtObjekt | null) {
    setValgtObjekt(obj);
  }

  function handleSpatialTre(tre: TreNode) {
    setSpatialTre(tre);
  }

  function handleTreKlikk(localId: number) {
    viewerRef.current?.velgObjekt(localId);
    viewerRef.current?.zoomTilObjekt(localId);
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1">
      {/* Sidepanel: liste + objekttre */}
      <div className="flex w-[280px] flex-col border-r border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Modeller</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".ifc"
              onChange={handleFilValgt}
              className="hidden"
              disabled={lasterOpp}
            />
            <span className="flex items-center gap-1 rounded bg-sitedoc-primary px-2.5 py-1.5 text-xs font-medium text-white hover:bg-sitedoc-primary/90">
              {lasterOpp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Last opp
            </span>
          </label>
        </div>

        {/* IFC-liste */}
        <div className="flex-1 overflow-y-auto">
          {(!tegninger || tegninger.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Box className="h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">Ingen IFC-modeller</p>
              <p className="text-xs text-gray-400">Last opp IFC-filer for 3D-visning</p>
            </div>
          )}

          {tegninger?.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setValgtId(t.id);
                setValgtObjekt(null);
                setSpatialTre(null);
              }}
              className={`flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                valgtId === t.id ? "bg-blue-50" : ""
              }`}
            >
              <Box className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-500">IFC</p>
              </div>
            </button>
          ))}

          {/* Objekttre */}
          {spatialTre && valgt && (
            <div className="border-t border-gray-200">
              <div className="px-4 py-2">
                <span className="text-xs font-semibold uppercase text-gray-500">Objekttre</span>
              </div>
              <ObjektTre
                node={spatialTre}
                nivaa={0}
                onKlikk={handleTreKlikk}
                valgtLocalId={valgtObjekt?.localId ?? null}
              />
            </div>
          )}
        </div>
      </div>

      {/* Hovedinnhold: viewer */}
      <div className="relative flex flex-1 flex-col bg-gray-100">
        {!valgt ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center text-gray-400">
              <Box className="mx-auto mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm">Velg en IFC-modell fra listen</p>
            </div>
          </div>
        ) : (
          <IfcViewer
            key={valgt.id}
            tegning={valgt}
            onObjektValgt={handleObjektValgt}
            onSpatialTre={handleSpatialTre}
            viewerRef={viewerRef}
            klippModus={klippModus}
            onKlippModusEndret={setKlippModus}
            onSlett={() => slettMutation.mutate({ id: valgt.id })}
          />
        )}

        {/* Flytende egenskapspanel */}
        {valgtObjekt && (
          <EgenskapsPopup objekt={valgtObjekt} onLukk={() => setValgtObjekt(null)} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Objekttre-komponent                                                 */
/* ------------------------------------------------------------------ */

function ObjektTre({
  node,
  nivaa,
  onKlikk,
  valgtLocalId,
}: {
  node: TreNode;
  nivaa: number;
  onKlikk: (localId: number) => void;
  valgtLocalId: number | null;
}) {
  const [utvidet, setUtvidet] = useState(nivaa < 2);
  const harBarn = node.children && node.children.length > 0;
  const erValgt = node.localId !== null && node.localId === valgtLocalId;

  // Vis kun noder med kategori
  if (!node.category) return null;

  // Forenkle kategorinavn: fjern "Ifc"-prefiks
  const visNavn = node.category.replace(/^Ifc/, "");

  return (
    <div>
      <button
        onClick={() => {
          if (harBarn) setUtvidet(!utvidet);
          if (node.localId !== null) onKlikk(node.localId);
        }}
        className={`flex w-full items-center gap-1 px-2 py-1 text-left text-xs hover:bg-gray-50 ${
          erValgt ? "bg-blue-50 text-blue-700" : "text-gray-700"
        }`}
        style={{ paddingLeft: `${nivaa * 12 + 8}px` }}
      >
        {harBarn ? (
          utvidet ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{visNavn}</span>
      </button>
      {utvidet &&
        node.children?.map((barn, i) => (
          <ObjektTre
            key={`${barn.localId ?? i}`}
            node={barn}
            nivaa={nivaa + 1}
            onKlikk={onKlikk}
            valgtLocalId={valgtLocalId}
          />
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Flytende egenskapspanel                                             */
/* ------------------------------------------------------------------ */

function EgenskapsPopup({
  objekt,
  onLukk,
}: {
  objekt: ValgtObjekt;
  onLukk: () => void;
}) {
  const kategoriNavn = objekt.kategori?.replace(/^Ifc/, "") ?? "Ukjent";

  return (
    <div className="absolute right-4 top-14 z-10 w-[320px] max-h-[calc(100%-72px)] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{kategoriNavn}</h3>
          {objekt.attributter["Name"] && (
            <p className="text-xs text-gray-500">
              {String(objekt.attributter["Name"].value)}
            </p>
          )}
        </div>
        <button
          onClick={onLukk}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grunnegenskaper */}
      <div className="border-b border-gray-100 px-4 py-2">
        <table className="w-full text-xs">
          <tbody>
            {Object.entries(objekt.attributter)
              .filter(([k]) => k !== "Name" && k !== "type")
              .map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {formaterVerdi(v.value)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Property sets / relasjoner */}
      {objekt.relasjoner.map((gruppe) => (
        <EgenskapsGruppeVis key={gruppe.navn} gruppe={gruppe} />
      ))}
    </div>
  );
}

function EgenskapsGruppeVis({ gruppe }: { gruppe: EgenskapGruppe }) {
  const [utvidet, setUtvidet] = useState(true);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setUtvidet(!utvidet)}
        className="flex w-full items-center gap-1 px-4 py-2 text-left hover:bg-gray-50"
      >
        {utvidet ? (
          <ChevronDown className="h-3 w-3 text-gray-400" />
        ) : (
          <ChevronRight className="h-3 w-3 text-gray-400" />
        )}
        <span className="text-xs font-semibold text-gray-700">{gruppe.navn}</span>
      </button>
      {utvidet && (
        <div className="px-4 pb-2">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(gruppe.egenskaper).map(([k, v]) => (
                <tr key={k}>
                  <td className="py-0.5 pr-2 text-gray-500">{k}</td>
                  <td className="py-0.5 font-medium text-gray-900">
                    {formaterVerdi(v.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formaterVerdi(v: unknown): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "boolean") return v ? "Ja" : "Nei";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

/* ------------------------------------------------------------------ */
/*  IFC Viewer — @thatopen/components                                   */
/* ------------------------------------------------------------------ */

interface IfcViewerProps {
  tegning: TegningRad;
  onObjektValgt: (obj: ValgtObjekt | null) => void;
  onSpatialTre: (tre: TreNode) => void;
  viewerRef: React.MutableRefObject<{
    velgObjekt: (localId: number) => void;
    zoomTilObjekt: (localId: number) => void;
    opprettKlippeplan: () => void;
    fjernAlleKlippeplan: () => void;
    settKlipperSynlig: (synlig: boolean) => void;
  } | null>;
  klippModus: boolean;
  onKlippModusEndret: (aktiv: boolean) => void;
  onSlett: () => void;
}

// Hjelpefunksjon: trekk ut egenskaper fra ItemData-array
function trekkUtEgenskaper(
  dataArray: Record<string, unknown>[],
): EgenskapGruppe[] {
  const grupper: EgenskapGruppe[] = [];
  for (const item of dataArray) {
    const navn =
      item["Name"] && typeof item["Name"] === "object" && "value" in (item["Name"] as Record<string, unknown>)
        ? String((item["Name"] as { value: unknown }).value)
        : "Egenskaper";
    const egenskaper: Record<string, EgenskapVerdi> = {};
    for (const [k, v] of Object.entries(item)) {
      if (k === "Name" || k === "type") continue;
      if (Array.isArray(v)) {
        // Nested children — rekursivt
        const barnGrupper = trekkUtEgenskaper(v as Record<string, unknown>[]);
        grupper.push(...barnGrupper);
      } else if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
        egenskaper[k] = v as EgenskapVerdi;
      }
    }
    if (Object.keys(egenskaper).length > 0) {
      grupper.push({ navn, egenskaper });
    }
  }
  return grupper;
}

function IfcViewer({ tegning, onObjektValgt, onSpatialTre, viewerRef, klippModus, onKlippModusEndret, onSlett }: IfcViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);

  // Stabil referanse for callbacks (unngå re-renders som trigger useEffect)
  const onObjektValgtRef = useRef(onObjektValgt);
  const onSpatialTreRef = useRef(onSpatialTre);
  onObjektValgtRef.current = onObjektValgt;
  onSpatialTreRef.current = onSpatialTre;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let renset = false;
    let componentsRef: unknown = null;

    // Dynamic import for SSR-kompatibilitet
    Promise.all([
      import("@thatopen/components"),
      import("three"),
    ])
      .then(async ([OBC, THREE]) => {
        if (renset) return;

        // Opprett components-instans
        const components = new OBC.Components();
        componentsRef = components;

        // Opprett verden
        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();

        // Scene
        world.scene = new OBC.SimpleScene(components);
        const scene = world.scene.three;
        (scene as InstanceType<typeof THREE.Scene>).background = new THREE.Color(0xf0f0f0);

        // Renderer
        world.renderer = new OBC.SimpleRenderer(components, container);

        // Kamera
        world.camera = new OBC.SimpleCamera(components);
        world.camera.controls?.setLookAt(20, 20, 20, 0, 0, 0);

        components.init();

        // Initialiser FragmentsManager med worker (påkrevd for IFC-lasting)
        const fragmentsManager = components.get(OBC.FragmentsManager);
        fragmentsManager.init("/fragments-worker.mjs");

        // Grid
        const grids = components.get(OBC.Grids);
        grids.create(world);

        // Clipper (klippeplan / snitt)
        const clipper = components.get(OBC.Clipper);
        clipper.setup();
        clipper.enabled = false; // Aktiveres av bruker

        // Sett opp IFC-laster
        const ifcLoader = components.get(OBC.IfcLoader);
        ifcLoader.settings.autoSetWasm = false;
        ifcLoader.settings.wasm = {
          path: "/",
          absolute: true,
        };
        await ifcLoader.setup();

        if (renset) return;

        // Hent IFC-fil
        const fileUrl = tegning.fileUrl.startsWith("/api")
          ? tegning.fileUrl
          : `/api${tegning.fileUrl}`;
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error("Kunne ikke hente IFC-fil");
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);

        if (renset) return;

        // Last IFC-modell
        const model = await ifcLoader.load(data, true, tegning.name);

        if (renset) return;

        // Tilpass kamera til modellen
        const bbox = model.box;
        const center = bbox.getCenter(new THREE.Vector3());
        const size = bbox.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        world.camera.controls?.setLookAt(
          center.x + maxDim,
          center.y + maxDim * 0.7,
          center.z + maxDim,
          center.x,
          center.y,
          center.z,
        );

        // Hent spatial structure for objekttre
        try {
          const spatial = await model.getSpatialStructure();
          if (spatial && !renset) {
            onSpatialTreRef.current(spatial as TreNode);
          }
        } catch {
          // Ikke kritisk om spatial structure feiler
        }

        // Raycaster for klikk-deteksjon
        // Hent renderer DOM-element og kamera for raycast
        const rendererDom = (world.renderer as unknown as { three: { domElement: HTMLCanvasElement } }).three.domElement;
        const threeCamera = (world.camera as unknown as { three: InstanceType<typeof THREE.PerspectiveCamera> }).three;

        // Highlight-materiale (RenderedFaces.TWO = 1)
        const highlightMaterial = {
          color: new THREE.Color(0x3b82f6),
          renderedFaces: 1 as unknown as import("@thatopen/fragments").RenderedFaces,
          opacity: 0.6,
          transparent: true,
        };

        let currentHighlight: { modelId: string; localIds: number[] } | null = null;

        async function resetHighlight() {
          if (!currentHighlight) return;
          try {
            const prevModel = fragmentsManager.list.get(currentHighlight.modelId);
            if (prevModel) {
              await prevModel.resetHighlight(currentHighlight.localIds);
            }
          } catch {
            // Ignorer feil ved reset
          }
          currentHighlight = null;
        }

        async function hentObjektData(hitModel: typeof model, localId: number): Promise<ValgtObjekt> {
          // Hent attributter og data
          const [itemsData] = await Promise.all([
            hitModel.getItemsData([localId]),
          ]);

          // Trekk ut grunnegenskaper fra første item
          const attributter: Record<string, EgenskapVerdi> = {};
          const relasjoner: EgenskapGruppe[] = [];

          if (itemsData.length > 0) {
            const item = itemsData[0] as Record<string, unknown>;
            for (const [k, v] of Object.entries(item)) {
              if (Array.isArray(v)) {
                // Barn-elementer = property sets
                const barnGrupper = trekkUtEgenskaper(v as Record<string, unknown>[]);
                relasjoner.push(...barnGrupper);
              } else if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
                attributter[k] = v as EgenskapVerdi;
              }
            }
          }

          // Finn kategori
          let kategori: string | null = null;
          try {
            const categories = await hitModel.getCategories();
            for (const cat of categories) {
              const items = await hitModel.getItemsOfCategories([new RegExp(`^${cat}$`)]);
              if (items[cat]?.includes(localId)) {
                kategori = cat;
                break;
              }
            }
          } catch {
            // Ikke kritisk
          }

          return { localId, kategori, attributter, relasjoner };
        }

        async function handleKlikk(event: MouseEvent) {
          if (renset) return;

          const rect = rendererDom.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          await resetHighlight();

          try {
            const hitResult = await fragmentsManager.raycast({
              camera: threeCamera,
              mouse: new THREE.Vector2(x, y),
              dom: rendererDom,
            });

            if (!hitResult) {
              onObjektValgtRef.current(null);
              return;
            }

            const { localId, fragments: hitModel } = hitResult;

            // Highlight
            await hitModel.highlight([localId], highlightMaterial);
            currentHighlight = { modelId: hitModel.modelId, localIds: [localId] };

            // Hent egenskaper
            const objekt = await hentObjektData(hitModel, localId);
            onObjektValgtRef.current(objekt);
          } catch (err) {
            console.warn("Kunne ikke hente objektegenskaper:", err);
            onObjektValgtRef.current(null);
          }
        }

        container.addEventListener("click", handleKlikk);

        // Viewer-referanser for objekttre
        viewerRef.current = {
          velgObjekt: async (localId: number) => {
            await resetHighlight();
            await model.highlight([localId], highlightMaterial);
            currentHighlight = { modelId: model.modelId, localIds: [localId] };

            const objekt = await hentObjektData(model, localId);
            onObjektValgtRef.current(objekt);
          },
          zoomTilObjekt: async (localId: number) => {
            try {
              const positions = await model.getPositions([localId]);
              if (positions.length > 0) {
                const pos = positions[0]!;
                world.camera.controls?.setLookAt(
                  pos.x + maxDim * 0.3,
                  pos.y + maxDim * 0.2,
                  pos.z + maxDim * 0.3,
                  pos.x,
                  pos.y,
                  pos.z,
                  true,
                );
              }
            } catch {
              // Feil ved zoom — ignorer
            }
          },
          opprettKlippeplan: async () => {
            clipper.enabled = true;
            await clipper.create(world);
          },
          fjernAlleKlippeplan: () => {
            clipper.deleteAll();
            clipper.enabled = false;
          },
          settKlipperSynlig: (synlig: boolean) => {
            clipper.enabled = synlig;
            clipper.visible = synlig;
          },
        };

        setLaster(false);

        return () => {
          container.removeEventListener("click", handleKlikk);
        };
      })
      .catch((err) => {
        if (!renset) {
          console.error("IFC viewer feil:", err);
          setFeil(err?.message ?? "Kunne ikke laste IFC-viewer");
          setLaster(false);
        }
      });

    return () => {
      renset = true;
      viewerRef.current = null;
      if (componentsRef && typeof (componentsRef as { dispose?: () => void }).dispose === "function") {
        try {
          (componentsRef as { dispose: () => void }).dispose();
        } catch {
          // Ignorer cleanup-feil
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tegning.id, tegning.fileUrl, tegning.name]);

  // Synkroniser klipp-modus med viewer
  useEffect(() => {
    viewerRef.current?.settKlipperSynlig(klippModus);
  }, [klippModus, viewerRef]);

  return (
    <div className="flex h-full flex-col">
      {/* Verktøylinje */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-2">
        <Box className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-900">{tegning.name}</span>
        <span className="text-xs text-gray-500">IFC</span>

        <div className="flex-1" />

        {/* Klippeplan-knapper */}
        <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
          <button
            onClick={() => {
              const nyModus = !klippModus;
              onKlippModusEndret(nyModus);
              if (nyModus) {
                viewerRef.current?.settKlipperSynlig(true);
              }
            }}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${
              klippModus
                ? "bg-sitedoc-primary text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            title="Snitt-modus — dobbeltklikk på en flate for å plassere klippeplan, dra for å flytte"
          >
            <Scissors className="h-3.5 w-3.5" />
            Snitt
          </button>
          {klippModus && (
            <button
              onClick={() => {
                viewerRef.current?.fjernAlleKlippeplan();
                onKlippModusEndret(false);
              }}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
              title="Fjern alle klippeplan"
            >
              Fjern alle
            </button>
          )}
        </div>

        <button
          onClick={onSlett}
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
          title="Slett modell"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 3D-viewer */}
      <div ref={containerRef} className="relative flex-1">
        {laster && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-100">
            <Loader2 className="h-10 w-10 animate-spin text-sitedoc-primary" />
            <p className="mt-3 text-sm font-medium text-gray-700">Laster IFC-modell...</p>
            <p className="text-xs text-gray-500">
              Parsing skjer lokalt i nettleseren. Større filer tar lengre tid.
            </p>
          </div>
        )}
        {feil && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-100">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <p className="mt-3 text-sm font-medium text-red-600">Kunne ikke laste modellen</p>
            <p className="text-xs text-gray-500">{feil}</p>
          </div>
        )}
      </div>
    </div>
  );
}
