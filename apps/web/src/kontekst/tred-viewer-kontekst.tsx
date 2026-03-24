"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";
import { useBygning as useBygningKontekst } from "@/kontekst/bygning-kontekst";
import type {
  TegningRad,
  PunktSkyRad,
  ValgtObjekt,
  SkjultObjekt,
  AktivtFilter,
  ModellStatus,
  ViewerAPI,
  EgenskapVerdi,
  EgenskapGruppe,
} from "@/app/dashbord/[prosjektId]/3d-visning/typer";
import { INTERNE_FELT, ifcFilCache } from "@/app/dashbord/[prosjektId]/3d-visning/konstanter";
import {
  hentNavn,
  hentVerdi,
  settWebifcKonstanter,
  finnIfcTypeKode,
} from "@/app/dashbord/[prosjektId]/3d-visning/hjelpefunksjoner";

/* ------------------------------------------------------------------ */
/*  Kontekst-type                                                       */
/* ------------------------------------------------------------------ */

interface TreDViewerKontekstType {
  erInitialisert: boolean;
  tegninger: TegningRad[];
  punktskyer: PunktSkyRad[];
  modellStatuser: ModellStatus[];
  valgtObjekt: ValgtObjekt | null;
  skjulteObjekter: SkjultObjekt[];
  aktiveFiltre: AktivtFilter[];
  klippModus: boolean;
  lasterTegninger: boolean;
  lasterPunktskyer: boolean;
  viewerRef: React.MutableRefObject<ViewerAPI | null>;
  setValgtObjekt: (obj: ValgtObjekt | null) => void;
  setKlippModus: (aktiv: boolean) => void;
  toggleSynlighet: (id: string) => void;
  soloModell: (id: string) => void;
  oppdaterModellStatus: (id: string, status: Partial<ModellStatus>) => void;
  skjulObjektOgLeggTil: (obj: ValgtObjekt) => Promise<void>;
  leggTilFilter: (filter: AktivtFilter) => Promise<void>;
  fjernFilter: (filter: AktivtFilter) => Promise<void>;
  fjernSkjultObjekt: (obj: SkjultObjekt) => Promise<void>;
  nullstillAlt: () => Promise<void>;
  lastOppIfc: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  lasterOpp: boolean;
}

const TreDViewerKontekst = createContext<TreDViewerKontekstType | null>(null);

export function useTreDViewer() {
  const ctx = useContext(TreDViewerKontekst);
  if (!ctx) throw new Error("useTreDViewer må brukes innenfor TreDViewerProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Provider                                                            */
/* ------------------------------------------------------------------ */

export function TreDViewerProvider({ children }: { children: ReactNode }) {
  const { prosjektId } = useParams<{ prosjektId: string }>();
  const { aktivBygning } = useBygningKontekst();

  const utils = trpc.useUtils();

  // IFC-modeller — filtrert på aktiv bygning
  const { data: _tegninger, isLoading: lasterTegninger } = trpc.tegning.hentForProsjekt.useQuery(
    {
      projectId: prosjektId!,
      ...(aktivBygning?.id ? { buildingId: aktivBygning.id } : {}),
    },
    { enabled: !!prosjektId },
  );
  const tegninger = (_tegninger as TegningRad[] | undefined)?.filter(
    (t) => t.fileType?.toLowerCase() === "ifc",
  ) ?? [];

  // Punktskyer
  const { data: _punktskyer, isLoading: lasterPunktskyer } = trpc.punktsky.hentForProsjekt.useQuery(
    { projectId: prosjektId! },
    { enabled: !!prosjektId },
  );
  const punktskyer = (_punktskyer as PunktSkyRad[] | undefined)?.filter(
    (ps) => ps.conversionStatus === "done" && ps.potreeUrl,
  ) ?? [];

  // State
  const [valgtObjekt, setValgtObjekt] = useState<ValgtObjekt | null>(null);
  const [lasterOpp, setLasterOpp] = useState(false);
  const [klippModus, setKlippModus] = useState(false);
  const [modellStatuser, setModellStatuser] = useState<ModellStatus[]>([]);
  const [skjulteObjekter, setSkjulteObjekter] = useState<SkjultObjekt[]>([]);
  const [aktiveFiltre, setAktiveFiltre] = useState<AktivtFilter[]>([]);
  const [erInitialisert] = useState(false);

  const viewerRef = useRef<ViewerAPI | null>(null);

  const opprettMutation = trpc.tegning.opprett.useMutation({
    onSuccess: (_data: unknown) => {
      utils.tegning.hentForProsjekt.invalidate({ projectId: prosjektId! });
    },
  });

  const lastOppIfc = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  }, [prosjektId, opprettMutation]);

  const toggleSynlighet = useCallback((id: string) => {
    setModellStatuser((prev) => {
      const oppdatert = prev.map((m) =>
        m.id === id ? { ...m, synlig: !m.synlig } : m,
      );
      const modell = oppdatert.find((m) => m.id === id);
      if (modell) viewerRef.current?.toggleModell(id, modell.synlig);
      return oppdatert;
    });
  }, []);

  const soloModell = useCallback((id: string) => {
    setModellStatuser((prev) => {
      const kunDenne = prev.filter((m) => m.synlig).length === 1 && prev.find((m) => m.id === id)?.synlig;
      if (kunDenne) {
        return prev.map((m) => {
          viewerRef.current?.toggleModell(m.id, true);
          return { ...m, synlig: true };
        });
      }
      return prev.map((m) => {
        const synlig = m.id === id;
        viewerRef.current?.toggleModell(m.id, synlig);
        return { ...m, synlig };
      });
    });
  }, []);

  const oppdaterModellStatus = useCallback((id: string, status: Partial<ModellStatus>) => {
    setModellStatuser((prev) => {
      const finnes = prev.find((m) => m.id === id);
      if (finnes) return prev.map((m) => (m.id === id ? { ...m, ...status } : m));
      return [...prev, { id, synlig: true, laster: false, feil: null, ...status }];
    });
  }, []);

  const skjulObjektOgLeggTil = useCallback(async (objekt: ValgtObjekt) => {
    await viewerRef.current?.skjulObjekt(objekt.modelId, objekt.localId);
    setSkjulteObjekter((prev) => [
      ...prev,
      {
        modelId: objekt.modelId,
        localId: objekt.localId,
        kategori: objekt.kategori ?? "Ukjent",
        navn: objekt.attributter["Name"]
          ? String(objekt.attributter["Name"].value)
          : `#${objekt.localId}`,
      },
    ]);
    setValgtObjekt(null);
  }, []);

  const leggTilFilter = useCallback(async (filter: AktivtFilter) => {
    setAktiveFiltre((prev) => {
      if (prev.some((f) => f.type === filter.type && f.verdi === filter.verdi)) return prev;
      return [...prev, filter];
    });
    if (filter.type === "kategori") {
      const kode = finnIfcTypeKode(filter.verdi);
      if (kode !== null) await viewerRef.current?.skjulAlleAvKategori(kode);
    } else if (filter.type === "lag") {
      await viewerRef.current?.skjulAlleAvLag(filter.verdi);
    } else if (filter.type === "system") {
      await viewerRef.current?.skjulAlleAvSystem(filter.verdi);
    }
  }, []);

  const fjernFilter = useCallback(async (filter: AktivtFilter) => {
    setAktiveFiltre((prev) => prev.filter((f) => !(f.type === filter.type && f.verdi === filter.verdi)));
    if (filter.type === "kategori") {
      const kode = finnIfcTypeKode(filter.verdi);
      if (kode !== null) await viewerRef.current?.visAlleAvKategori(kode);
    } else if (filter.type === "lag") {
      await viewerRef.current?.visAlleAvLag(filter.verdi);
    } else if (filter.type === "system") {
      await viewerRef.current?.visAlleAvSystem(filter.verdi);
    }
  }, []);

  const fjernSkjultObjekt = useCallback(async (obj: SkjultObjekt) => {
    setSkjulteObjekter((prev) => prev.filter((o) => !(o.modelId === obj.modelId && o.localId === obj.localId)));
    await viewerRef.current?.visObjekt(obj.modelId, obj.localId);
  }, []);

  const nullstillAlt = useCallback(async () => {
    // Les aktive filtre og skjulte objekter fra state direkte
    setAktiveFiltre((prevFiltre) => {
      // Kjør asynkrone operasjoner etter state-oppdatering
      (async () => {
        for (const f of prevFiltre) {
          if (f.type === "kategori") {
            const kode = finnIfcTypeKode(f.verdi);
            if (kode !== null) await viewerRef.current?.visAlleAvKategori(kode);
          } else if (f.type === "lag") {
            await viewerRef.current?.visAlleAvLag(f.verdi);
          } else if (f.type === "system") {
            await viewerRef.current?.visAlleAvSystem(f.verdi);
          }
        }
      })();
      return [];
    });
    setSkjulteObjekter((prevObjekter) => {
      (async () => {
        for (const obj of prevObjekter) {
          await viewerRef.current?.visObjekt(obj.modelId, obj.localId);
        }
      })();
      return [];
    });
  }, []);

  return (
    <TreDViewerKontekst.Provider
      value={{
        erInitialisert,
        tegninger,
        punktskyer,
        modellStatuser,
        valgtObjekt,
        skjulteObjekter,
        aktiveFiltre,
        klippModus,
        lasterTegninger,
        lasterPunktskyer,
        viewerRef,
        setValgtObjekt,
        setKlippModus,
        toggleSynlighet,
        soloModell,
        oppdaterModellStatus,
        skjulObjektOgLeggTil,
        leggTilFilter,
        fjernFilter,
        fjernSkjultObjekt,
        nullstillAlt,
        lastOppIfc,
        lasterOpp,
      }}
    >
      {children}
    </TreDViewerKontekst.Provider>
  );
}

/* ------------------------------------------------------------------ */
/*  ViewerCanvas — eksportert for bruk i 3d-visning/page.tsx            */
/*  Three.js/OBC scene som lever i konteksten                          */
/* ------------------------------------------------------------------ */

export function ViewerCanvas({
  erSynlig: _erSynlig,
}: {
  erSynlig: boolean;
}) {
  const {
    tegninger,
    viewerRef,
    klippModus,
    setValgtObjekt,
    oppdaterModellStatus,
  } = useTreDViewer();

  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);
  const [antallLastet, setAntallLastet] = useState(0);
  const [lasterNavn, setLasterNavn] = useState<string | null>(null);

  const onObjektValgtRef = useRef(setValgtObjekt);
  onObjektValgtRef.current = setValgtObjekt;
  const onModellStatusRef = useRef(oppdaterModellStatus);
  onModellStatusRef.current = oppdaterModellStatus;

  const tegningerIds = tegninger.map((t) => t.id).join(",");

  useEffect(() => {
    const container = containerRef.current;
    if (!container || tegninger.length === 0) return;

    let renset = false;
    let componentsRef: unknown = null;
    let propsApiRef: {
      OpenModel: (data: Uint8Array) => number;
      CloseModel: (id: number) => void;
      SetWasmPath: (p: string) => void;
      Init: () => Promise<void>;
      properties: {
        getItemProperties: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>>;
        getPropertySets: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>[]>;
        getTypeProperties: (m: number, id: number, r?: boolean) => Promise<Record<string, unknown>[]>;
      };
    } | null = null;
    const openModelIds = new Map<string, number>();
    const ifcDataMapRef = new Map<string, Uint8Array>();

    Promise.all([
      import("@thatopen/components"),
      import("three"),
      import("web-ifc"),
    ])
      .then(async ([OBC, THREE, WEBIFC]) => {
        if (renset) return;

        const components = new OBC.Components();
        componentsRef = components;

        const worlds = components.get(OBC.Worlds);
        const world = worlds.create();

        const simpleScene = new OBC.SimpleScene(components);
        world.scene = simpleScene;
        (simpleScene as unknown as { setup: (c: unknown) => void }).setup({
          backgroundColor: new THREE.Color(0xf0f0f0),
          ambientLight: { color: new THREE.Color("white"), intensity: 1 },
          directionalLight: { color: new THREE.Color("white"), intensity: 1.5, position: new THREE.Vector3(5, 10, 3) },
        });
        const scene = world.scene.three;

        world.renderer = new OBC.SimpleRenderer(components, container);
        world.camera = new OBC.SimpleCamera(components);
        world.camera.controls?.setLookAt(20, 20, 20, 0, 0, 0);

        components.init();

        const fragmentsManager = components.get(OBC.FragmentsManager);
        fragmentsManager.init("/fragments-worker.mjs");

        const grids = components.get(OBC.Grids);
        grids.create(world);

        const clipper = components.get(OBC.Clipper);
        clipper.setup();
        clipper.enabled = false;

        const ifcLoader = components.get(OBC.IfcLoader);
        ifcLoader.settings.autoSetWasm = false;
        ifcLoader.settings.wasm = { path: "/", absolute: true };
        await ifcLoader.setup();

        if (renset) return;

        const threeCamera = (world.camera as unknown as { three: InstanceType<typeof THREE.PerspectiveCamera> }).three;

        const modellMap = new Map<string, unknown>();
        const tegningTilModelId = new Map<string, string>();
        const synligeModeller = new Set<string>();
        const ifcDataMap = ifcDataMapRef;
        const totalBbox = new THREE.Box3();
        let lastet = 0;

        for (const tegning of tegninger) {
          onModellStatusRef.current(tegning.id, { laster: true, feil: null });
        }

        const nedlastinger = await Promise.all(
          tegninger.map(async (tegning) => {
            try {
              const fileUrl = tegning.fileUrl.startsWith("/api")
                ? tegning.fileUrl
                : `/api${tegning.fileUrl}`;
              const cached = ifcFilCache.get(fileUrl);
              if (cached) return { tegning, data: cached, feil: null };
              const response = await fetch(fileUrl);
              if (!response.ok) throw new Error("Kunne ikke hente fil");
              const buffer = await response.arrayBuffer();
              const data = new Uint8Array(buffer);
              ifcFilCache.set(fileUrl, data);
              return { tegning, data, feil: null };
            } catch (err) {
              return { tegning, data: null, feil: err instanceof Error ? err.message : String(err) };
            }
          }),
        );

        if (renset) return;

        for (const { tegning, data, feil } of nedlastinger) {
          if (renset) return;
          if (!data || feil) {
            console.error(`Kunne ikke laste ${tegning.name}:`, feil);
            onModellStatusRef.current(tegning.id, { laster: false, feil: feil ?? "Ukjent feil" });
            continue;
          }
          setLasterNavn(tegning.name);
          try {
            const model = await ifcLoader.load(data, true, tegning.name);
            const fm = model as { object: InstanceType<typeof THREE.Object3D>; useCamera: (c: unknown) => void; box: InstanceType<typeof THREE.Box3> };
            scene.add(fm.object);
            fm.useCamera(threeCamera);
            modellMap.set(tegning.id, model);
            const fragModelId = (model as { modelId: string }).modelId;
            ifcDataMap.set(fragModelId, data);
            tegningTilModelId.set(tegning.id, fragModelId);
            synligeModeller.add(fragModelId);
            totalBbox.union(fm.box);

            // Skjul abstrakte IFC-elementer
            try {
              if (!propsApiRef) {
                const api = new WEBIFC.IfcAPI();
                api.SetWasmPath("/", true);
                await api.Init((_f) => "/web-ifc.wasm");
                propsApiRef = api;
              }
              let mid = openModelIds.get(fragModelId);
              if (mid === undefined) {
                mid = propsApiRef.OpenModel(data);
                openModelIds.set(fragModelId, mid);
              }
              const hideApi = propsApiRef as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number } };
              const skjulTyper = [WEBIFC.IFCSPACE, WEBIFC.IFCOPENINGELEMENT];
              const skjulIds: number[] = [];
              for (const ifcType of skjulTyper) {
                const lineIds = hideApi.GetLineIDsWithType(mid, ifcType);
                for (let si = 0; si < lineIds.size(); si++) skjulIds.push(lineIds.get(si));
              }
              if (skjulIds.length > 0) await model.setVisible(skjulIds, false);
            } catch { /* Ikke kritisk */ }

            lastet++;
            setAntallLastet(lastet);
            onModellStatusRef.current(tegning.id, { laster: false, synlig: true });
          } catch (err) {
            console.error(`Kunne ikke laste ${tegning.name}:`, err);
            onModellStatusRef.current(tegning.id, { laster: false, feil: err instanceof Error ? err.message : String(err) });
          }
        }
        setLasterNavn(null);
        if (renset) return;

        // Tilpass kamera
        if (!totalBbox.isEmpty()) {
          const center = totalBbox.getCenter(new THREE.Vector3());
          const size = totalBbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          world.camera.controls?.setLookAt(
            center.x + maxDim, center.y + maxDim * 0.7, center.z + maxDim,
            center.x, center.y, center.z,
          );
        }

        // Tile-lasting update-løkke
        let animFrameId: number | null = null;
        function updateLoop() {
          if (renset) return;
          fragmentsManager.core.update();
          animFrameId = requestAnimationFrame(updateLoop);
        }
        updateLoop();

        // Raycasting
        const rendererDom = (world.renderer as unknown as { three: { domElement: HTMLCanvasElement } }).three.domElement;
        const highlightMaterial = {
          color: new THREE.Color(0x3b82f6),
          renderedFaces: 1 as unknown as import("@thatopen/fragments").RenderedFaces,
          opacity: 0.6,
          transparent: true,
        };
        let currentHighlight: { modelId: string; localIds: number[] } | null = null;

        // 3D-markør
        let markerMesh: InstanceType<typeof THREE.Mesh> | null = null;
        function placeMarker(point: InstanceType<typeof THREE.Vector3>) {
          removeMarker();
          const geo = new THREE.SphereGeometry(0.15, 16, 16);
          const mat = new THREE.MeshBasicMaterial({ color: 0xef4444, depthTest: false });
          markerMesh = new THREE.Mesh(geo, mat);
          markerMesh.position.copy(point);
          markerMesh.renderOrder = 999;
          scene.add(markerMesh);
        }
        function removeMarker() {
          if (markerMesh) {
            scene.remove(markerMesh);
            markerMesh.geometry.dispose();
            (markerMesh.material as InstanceType<typeof THREE.MeshBasicMaterial>).dispose();
            markerMesh = null;
          }
        }

        let mouseDownPos: { x: number; y: number } | null = null;
        let sisteKlikkPunkt3D: { x: number; y: number; z: number } | null = null;
        rendererDom.addEventListener("pointerdown", (e: PointerEvent) => {
          mouseDownPos = { x: e.clientX, y: e.clientY };
        });

        async function resetHighlight() {
          removeMarker();
          if (!currentHighlight) return;
          try {
            const prevModel = fragmentsManager.list.get(currentHighlight.modelId);
            if (prevModel) await prevModel.resetHighlight(currentHighlight.localIds);
          } catch { /* Ignorer */ }
          currentHighlight = null;
        }

        async function handleKlikk(event: MouseEvent) {
          if (renset) return;
          if (mouseDownPos) {
            const dx = event.clientX - mouseDownPos.x;
            const dy = event.clientY - mouseDownPos.y;
            if (Math.sqrt(dx * dx + dy * dy) > 5) return;
          }
          await resetHighlight();
          try {
            const raycastData = {
              camera: threeCamera,
              mouse: new THREE.Vector2(event.clientX, event.clientY),
              dom: rendererDom,
            };
            let hitResult: Awaited<ReturnType<typeof fragmentsManager.raycast>> = undefined;
            for (const [mid, model] of fragmentsManager.list) {
              if (!synligeModeller.has(mid)) continue;
              try {
                const result = await model.raycast(raycastData);
                if (result && (!hitResult || result.distance < hitResult.distance)) hitResult = result;
              } catch { /* Noen modeller kan feile */ }
            }
            if (!hitResult) {
              removeMarker();
              onObjektValgtRef.current(null);
              return;
            }
            const { localId, fragments: hitModel } = hitResult;
            placeMarker(hitResult.point);
            sisteKlikkPunkt3D = { x: hitResult.point.x, y: hitResult.point.y, z: hitResult.point.z };
            try {
              await hitModel.highlight([localId], highlightMaterial);
              currentHighlight = { modelId: hitModel.modelId, localIds: [localId] };
            } catch { /* Highlight kan feile */ }

            const item = hitModel.getItem(localId);
            const kategori = await item.getCategory().catch(() => null);
            const expressId = localId;
            onObjektValgtRef.current({ localId, modelId: hitModel.modelId, kategori, attributter: {}, relasjoner: [] });

            // Hent egenskaper on-demand
            const rawData = ifcDataMap.get(hitModel.modelId);
            if (rawData) {
              try {
                if (!propsApiRef) {
                  const api = new WEBIFC.IfcAPI();
                  api.SetWasmPath("/", true);
                  await api.Init((_fileName) => "/web-ifc.wasm");
                  propsApiRef = api;
                }
                let modelId = openModelIds.get(hitModel.modelId);
                if (modelId === undefined) {
                  modelId = propsApiRef.OpenModel(rawData);
                  openModelIds.set(hitModel.modelId, modelId);
                }

                const [itemProps, propertySets, typeProps, materials] = await Promise.all([
                  propsApiRef.properties.getItemProperties(modelId, expressId, true).catch(() => null),
                  propsApiRef.properties.getPropertySets(modelId, expressId, true).catch(() => []),
                  propsApiRef.properties.getTypeProperties(modelId, expressId, true).catch(() => []),
                  (propsApiRef.properties as unknown as { getMaterialsProperties: (m: number, id: number, r?: boolean, t?: boolean) => Promise<Record<string, unknown>[]> })
                    .getMaterialsProperties(modelId, expressId, true, true).catch(() => []),
                ]);

                // Foreldre via IfcRelAggregates
                let parentProps: Record<string, unknown> | null = null;
                let parentPropertySets: Record<string, unknown>[] = [];
                let parentTypeProps: Record<string, unknown>[] = [];
                let parentMaterials: Record<string, unknown>[] = [];
                try {
                  const api = propsApiRef as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number }; GetLine: (m: number, id: number) => Record<string, unknown>; properties: typeof propsApiRef.properties };
                  const relAggIds = api.GetLineIDsWithType(modelId, WEBIFC.IFCRELAGGREGATES);
                  for (let i = 0; i < relAggIds.size(); i++) {
                    const relId = relAggIds.get(i);
                    const rel = api.GetLine(modelId, relId);
                    const relatedObjects = rel.RelatedObjects as Array<{ value: number }> | undefined;
                    if (Array.isArray(relatedObjects) && relatedObjects.some((o) => o.value === expressId)) {
                      const parentId = (rel.RelatingObject as { value: number })?.value;
                      if (parentId) {
                        [parentProps, parentPropertySets, parentTypeProps, parentMaterials] = await Promise.all([
                          api.properties.getItemProperties(modelId, parentId, true).catch(() => null),
                          api.properties.getPropertySets(modelId, parentId, true).catch(() => []),
                          api.properties.getTypeProperties(modelId, parentId, true).catch(() => []),
                          (api.properties as unknown as { getMaterialsProperties: (m: number, id: number, r?: boolean, t?: boolean) => Promise<Record<string, unknown>[]> })
                            .getMaterialsProperties(modelId, parentId, true, true).catch(() => []),
                        ]);
                        break;
                      }
                    }
                  }
                } catch { /* Ikke kritisk */ }

                // Type, Layer, System
                let typeName: string | null = null;
                let layerName: string | null = null;
                let systemName: string | null = null;
                try {
                  const api2 = propsApiRef as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number }; GetLine: (m: number, id: number) => Record<string, unknown> };
                  const targetIds = parentProps ? [expressId, (parentProps.expressID as number)] : [expressId];
                  const relTypeIds = api2.GetLineIDsWithType(modelId, WEBIFC.IFCRELDEFINESBYTYPE);
                  for (let i = 0; i < relTypeIds.size() && !typeName; i++) {
                    const rel = api2.GetLine(modelId, relTypeIds.get(i));
                    const relObj = rel.RelatedObjects as Array<{ value: number }> | undefined;
                    if (Array.isArray(relObj) && relObj.some((o) => targetIds.includes(o.value))) {
                      const relType = rel.RelatingType as { value: number } | undefined;
                      if (relType?.value) {
                        const typeObj = api2.GetLine(modelId, relType.value);
                        const tn = typeObj.Name as { value: unknown } | undefined;
                        if (tn && typeof tn === "object" && "value" in tn && tn.value) typeName = String(tn.value);
                      }
                    }
                  }
                  // Layer
                  const subReprIds = new Set<number>();
                  for (const props of [itemProps, parentProps]) {
                    if (!props) continue;
                    const reprRef = props.Representation as { value: number } | Record<string, unknown> | undefined;
                    if (!reprRef) continue;
                    const reprId = typeof reprRef === "object" && "value" in reprRef ? (reprRef as { value: number }).value : null;
                    const reprExprId = reprRef && typeof reprRef === "object" && "expressID" in reprRef ? (reprRef as { expressID: number }).expressID : reprId;
                    if (reprExprId) {
                      subReprIds.add(reprExprId);
                      try {
                        const reprObj = api2.GetLine(modelId, reprExprId);
                        const reps = reprObj.Representations as Array<{ value: number }> | undefined;
                        if (Array.isArray(reps)) for (const r of reps) subReprIds.add(r.value);
                      } catch { /* ignorér */ }
                    }
                  }
                  const layerIds = api2.GetLineIDsWithType(modelId, WEBIFC.IFCPRESENTATIONLAYERASSIGNMENT);
                  for (let i = 0; i < layerIds.size() && !layerName; i++) {
                    const layer = api2.GetLine(modelId, layerIds.get(i));
                    const assigned = layer.AssignedItems as Array<{ value: number }> | undefined;
                    if (Array.isArray(assigned) && assigned.some((a) => subReprIds.has(a.value))) {
                      const ln = layer.Name as { value: unknown } | undefined;
                      if (ln && typeof ln === "object" && "value" in ln && ln.value) layerName = String(ln.value);
                    }
                  }
                  // System
                  const relGroupIds = api2.GetLineIDsWithType(modelId, WEBIFC.IFCRELASSIGNSTOGROUP);
                  for (let i = 0; i < relGroupIds.size(); i++) {
                    const rel = api2.GetLine(modelId, relGroupIds.get(i));
                    const relObj = rel.RelatedObjects as Array<{ value: number }> | undefined;
                    if (Array.isArray(relObj) && relObj.some((o) => targetIds.includes(o.value))) {
                      const group = rel.RelatingGroup as { value: number } | undefined;
                      if (group?.value) {
                        const groupObj = api2.GetLine(modelId, group.value);
                        const gn = groupObj.Name as { value: unknown } | undefined;
                        if (gn && typeof gn === "object" && "value" in gn && gn.value) { systemName = String(gn.value); break; }
                      }
                    }
                  }
                } catch { /* Ikke kritisk */ }

                const allPropertySets = [...propertySets, ...parentPropertySets];
                const allTypeProps = [...typeProps, ...parentTypeProps];
                const allMaterials = [...materials, ...parentMaterials];

                const attributter: Record<string, EgenskapVerdi> = {};
                if (itemProps) {
                  const nameVal = itemProps["Name"];
                  if (nameVal && typeof nameVal === "object" && "value" in (nameVal as Record<string, unknown>)) {
                    const n = (nameVal as { value: unknown }).value;
                    if (n != null && n !== "") attributter["Name"] = { value: n };
                  }
                  for (const [k, v] of Object.entries(itemProps)) {
                    if (INTERNE_FELT.has(k)) continue;
                    if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
                      const val = (v as { value: unknown }).value;
                      if (val === null || val === undefined || val === "") continue;
                      attributter[k] = { value: val };
                    }
                  }
                }
                if (typeName) attributter["Type"] = { value: typeName };
                if (layerName) attributter["Layer"] = { value: layerName };
                if (systemName) attributter["System"] = { value: systemName };

                const relasjoner: EgenskapGruppe[] = [];
                relasjoner.push({
                  navn: "Klikk på koordinater",
                  egenskaper: {
                    "Øst (X)": { value: hitResult.point.x },
                    "Nord (Y)": { value: hitResult.point.y },
                    "Høyde (Z)": { value: hitResult.point.z },
                  },
                });

                if (parentProps) {
                  const foreldreAttr: Record<string, EgenskapVerdi> = {};
                  for (const [k, v] of Object.entries(parentProps)) {
                    if (INTERNE_FELT.has(k)) continue;
                    if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
                      const val = (v as { value: unknown }).value;
                      if (val === null || val === undefined || val === "") continue;
                      foreldreAttr[k] = { value: val };
                    }
                  }
                  if (Object.keys(foreldreAttr).length > 0) {
                    let parentTypeName = "Overordnet element";
                    if (parentProps.type != null) {
                      const tc = Number(parentProps.type);
                      for (const [name, code] of Object.entries(WEBIFC)) {
                        if (code === tc && typeof name === "string" && name.startsWith("IFC") && name === name.toUpperCase()) {
                          let clean = name.substring(3);
                          clean = clean.replace(/STANDARDCASE$|ELEMENTEDCASE$|TYPE$/, "");
                          parentTypeName = clean.charAt(0) + clean.slice(1).toLowerCase();
                          break;
                        }
                      }
                    }
                    relasjoner.push({ navn: parentTypeName, egenskaper: foreldreAttr });
                  }
                }

                // PropertySets
                for (const pset of [...allPropertySets, ...allTypeProps]) {
                  const psetNavn = pset.Name && typeof pset.Name === "object" && "value" in (pset.Name as Record<string, unknown>)
                    ? String((pset.Name as { value: unknown }).value) : "Egenskaper";
                  const egenskaper: Record<string, EgenskapVerdi> = {};
                  const hasProps = pset.HasProperties as Record<string, unknown>[] | undefined;
                  if (Array.isArray(hasProps)) {
                    for (const prop of hasProps) {
                      const propNavn = hentNavn(prop);
                      const nestedProps = prop.HasProperties as Record<string, unknown>[] | undefined;
                      if (Array.isArray(nestedProps)) {
                        for (const nested of nestedProps) {
                          const nestedNavn = hentNavn(nested);
                          const nestedVerdi = hentVerdi(nested);
                          if (nestedVerdi !== null) egenskaper[`${propNavn}.${nestedNavn}`] = { value: nestedVerdi };
                        }
                      } else {
                        const verdi = hentVerdi(prop);
                        if (verdi !== null) egenskaper[propNavn] = { value: verdi };
                      }
                    }
                  }
                  const hasQuant = (pset.Quantities ?? pset.HasQuantities) as Record<string, unknown>[] | undefined;
                  if (Array.isArray(hasQuant)) {
                    for (const q of hasQuant) {
                      const qNavn = hentNavn(q);
                      const verdi = hentVerdi(q);
                      if (verdi !== null) egenskaper[qNavn] = { value: verdi };
                    }
                  }
                  const hasTemplates = pset.HasPropertyTemplates as Record<string, unknown>[] | undefined;
                  if (Array.isArray(hasTemplates)) {
                    for (const tmpl of hasTemplates) {
                      const tmplNavn = hentNavn(tmpl);
                      const verdi = hentVerdi(tmpl);
                      if (verdi !== null) egenskaper[tmplNavn] = { value: verdi };
                    }
                  }
                  if (Object.keys(egenskaper).length > 0) relasjoner.push({ navn: psetNavn, egenskaper });
                }

                // Materialer
                if (allMaterials.length > 0) {
                  const matEgenskaper: Record<string, EgenskapVerdi> = {};
                  for (const mat of allMaterials) {
                    if (mat.Name && typeof mat.Name === "object" && "value" in (mat.Name as Record<string, unknown>)) {
                      const matNavn = String((mat.Name as { value: unknown }).value);
                      if (matNavn) matEgenskaper["Materiale"] = { value: matNavn };
                    }
                    const forLayerSet = mat.ForLayerSet as Record<string, unknown> | undefined;
                    const layers = (mat.MaterialLayers ?? forLayerSet?.MaterialLayers) as Record<string, unknown>[] | undefined;
                    if (Array.isArray(layers)) {
                      for (const layer of layers) {
                        const layerMat = layer.Material as Record<string, unknown> | undefined;
                        const layerMatName = layerMat?.Name && typeof layerMat.Name === "object" && "value" in (layerMat.Name as Record<string, unknown>)
                          ? String((layerMat.Name as { value: unknown }).value) : null;
                        const thickness = layer.LayerThickness && typeof layer.LayerThickness === "object" && "value" in (layer.LayerThickness as Record<string, unknown>)
                          ? (layer.LayerThickness as { value: unknown }).value : null;
                        if (layerMatName) {
                          const label = thickness != null ? `${layerMatName} (${thickness} mm)` : layerMatName;
                          matEgenskaper[`Lag ${Object.keys(matEgenskaper).length + 1}`] = { value: label };
                        }
                      }
                    }
                    const forProfileSet = mat.ForProfileSet as Record<string, unknown> | undefined;
                    const profiles = (mat.MaterialProfiles ?? forProfileSet?.MaterialProfiles) as Record<string, unknown>[] | undefined;
                    if (Array.isArray(profiles)) {
                      for (const prof of profiles) {
                        const profMat = prof.Material as Record<string, unknown> | undefined;
                        const profName = profMat?.Name && typeof profMat.Name === "object" && "value" in (profMat.Name as Record<string, unknown>)
                          ? String((profMat.Name as { value: unknown }).value) : null;
                        if (profName) matEgenskaper["Materiale"] = { value: profName };
                        const profile = prof.Profile as Record<string, unknown> | undefined;
                        if (profile) {
                          for (const [pk, pv] of Object.entries(profile)) {
                            if (INTERNE_FELT.has(pk) || pk === "ProfileName" || pk === "ProfileType") continue;
                            if (pv && typeof pv === "object" && "value" in (pv as Record<string, unknown>)) {
                              const val = (pv as { value: unknown }).value;
                              if (val != null && val !== "") matEgenskaper[pk] = { value: val };
                            }
                          }
                          const profNameVal = profile.ProfileName;
                          if (profNameVal && typeof profNameVal === "object" && "value" in (profNameVal as Record<string, unknown>)) {
                            const pn = (profNameVal as { value: unknown }).value;
                            if (pn) matEgenskaper["Profil"] = { value: pn };
                          }
                        }
                      }
                    }
                  }
                  if (Object.keys(matEgenskaper).length > 0) relasjoner.push({ navn: "Materialer", egenskaper: matEgenskaper });
                }

                // IFC-typekode -> lesbart navn
                let ifcType: string | null = null;
                if (itemProps?.type != null) {
                  const typeCode = Number(itemProps.type);
                  for (const [name, code] of Object.entries(WEBIFC)) {
                    if (code === typeCode && typeof name === "string" && name.startsWith("IFC") && name === name.toUpperCase()) {
                      let clean = name.substring(3);
                      clean = clean.replace(/STANDARDCASE$|ELEMENTEDCASE$|TYPE$/, "");
                      ifcType = clean.charAt(0) + clean.slice(1).toLowerCase();
                      break;
                    }
                  }
                }
                const endeligKategori = kategori ?? ifcType;
                onObjektValgtRef.current({ localId, modelId: hitModel.modelId, kategori: endeligKategori, attributter, relasjoner });
              } catch (err) {
                console.warn("Kunne ikke hente IFC-egenskaper:", err);
              }
            }
          } catch (err) {
            console.warn("Kunne ikke hente objektegenskaper:", err);
            onObjektValgtRef.current(null);
          }
        }

        rendererDom.addEventListener("click", handleKlikk);

        async function handleDblKlikk() {
          if (!clipper.enabled || renset) return;
          await clipper.create(world);
        }
        rendererDom.addEventListener("dblclick", handleDblKlikk);

        // Cache WEBIFC-konstanter
        settWebifcKonstanter(WEBIFC as unknown as Record<string, number>);

        // Hjelpefunksjoner for filter
        async function hentIderForType(ifcTypeKode: number): Promise<Map<string, number[]>> {
          const resultat = new Map<string, number[]>();
          if (!propsApiRef) return resultat;
          const api = propsApiRef as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number } };
          for (const [fragId, webifcId] of openModelIds.entries()) {
            try {
              const lineIds = api.GetLineIDsWithType(webifcId, ifcTypeKode);
              const ids: number[] = [];
              for (let i = 0; i < lineIds.size(); i++) ids.push(lineIds.get(i));
              if (ids.length > 0) resultat.set(fragId, ids);
            } catch { /* ignorér */ }
          }
          return resultat;
        }

        async function hentIderForLag(lagNavn: string): Promise<Map<string, number[]>> {
          const resultat = new Map<string, number[]>();
          if (!propsApiRef) return resultat;
          const api = propsApiRef as unknown as {
            GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number };
            GetLine: (m: number, id: number) => Record<string, unknown>;
          };
          for (const [fragId, webifcId] of openModelIds.entries()) {
            try {
              const layerLineIds = api.GetLineIDsWithType(webifcId, WEBIFC.IFCPRESENTATIONLAYERASSIGNMENT);
              const elementIds = new Set<number>();
              for (let i = 0; i < layerLineIds.size(); i++) {
                const layer = api.GetLine(webifcId, layerLineIds.get(i));
                const ln = layer.Name as { value: unknown } | undefined;
                if (!ln || String(ln.value) !== lagNavn) continue;
                const assigned = layer.AssignedItems as Array<{ value: number }> | undefined;
                if (!Array.isArray(assigned)) continue;
                const reprIds = new Set(assigned.map((a) => a.value));
                for (const [_name, code] of Object.entries(WEBIFC)) {
                  if (typeof code !== "number" || code < 100) continue;
                  try {
                    const prodIds = api.GetLineIDsWithType(webifcId, code);
                    for (let pi = 0; pi < prodIds.size(); pi++) {
                      const pid = prodIds.get(pi);
                      try {
                        const prod = api.GetLine(webifcId, pid);
                        const repr = prod.Representation as { value: number } | undefined;
                        if (repr && reprIds.has(repr.value)) { elementIds.add(pid); continue; }
                        if (repr?.value) {
                          try {
                            const reprObj = api.GetLine(webifcId, repr.value);
                            const reps = reprObj.Representations as Array<{ value: number }> | undefined;
                            if (Array.isArray(reps) && reps.some((r) => reprIds.has(r.value))) elementIds.add(pid);
                          } catch { /* ignorér */ }
                        }
                      } catch { /* ignorér */ }
                    }
                  } catch { /* ignorér */ }
                }
              }
              if (elementIds.size > 0) resultat.set(fragId, [...elementIds]);
            } catch { /* ignorér */ }
          }
          return resultat;
        }

        async function hentIderForSystem(systemNavn: string): Promise<Map<string, number[]>> {
          const resultat = new Map<string, number[]>();
          if (!propsApiRef) return resultat;
          const api = propsApiRef as unknown as {
            GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number };
            GetLine: (m: number, id: number) => Record<string, unknown>;
          };
          for (const [fragId, webifcId] of openModelIds.entries()) {
            try {
              const relGroupIds = api.GetLineIDsWithType(webifcId, WEBIFC.IFCRELASSIGNSTOGROUP);
              const elementIds: number[] = [];
              for (let i = 0; i < relGroupIds.size(); i++) {
                const rel = api.GetLine(webifcId, relGroupIds.get(i));
                const group = rel.RelatingGroup as { value: number } | undefined;
                if (!group?.value) continue;
                try {
                  const groupObj = api.GetLine(webifcId, group.value);
                  const gn = groupObj.Name as { value: unknown } | undefined;
                  if (!gn || String(gn.value) !== systemNavn) continue;
                } catch { continue; }
                const relObj = rel.RelatedObjects as Array<{ value: number }> | undefined;
                if (Array.isArray(relObj)) for (const o of relObj) elementIds.push(o.value);
              }
              if (elementIds.length > 0) resultat.set(fragId, elementIds);
            } catch { /* ignorér */ }
          }
          return resultat;
        }

        // Viewer-referanser
        viewerRef.current = {
          toggleModell: (tegningId: string, synlig: boolean) => {
            const model = modellMap.get(tegningId) as { object?: InstanceType<typeof THREE.Object3D> } | undefined;
            if (model?.object) {
              if (synlig) { if (!model.object.parent) scene.add(model.object); }
              else scene.remove(model.object);
            }
            const fragId = tegningTilModelId.get(tegningId);
            if (fragId) {
              if (synlig) synligeModeller.add(fragId);
              else synligeModeller.delete(fragId);
            }
          },
          fjernAlleKlippeplan: () => { clipper.deleteAll(); clipper.enabled = false; },
          settKlipperSynlig: (synlig: boolean) => { clipper.enabled = synlig; clipper.visible = synlig; },
          skjulObjekt: async (mid: string, lid: number) => {
            const model = fragmentsManager.list.get(mid);
            if (model) await model.setVisible([lid], false);
          },
          visObjekt: async (mid: string, lid: number) => {
            const model = fragmentsManager.list.get(mid);
            if (model) await model.setVisible([lid], true);
          },
          skjulAlleAvKategori: async (kategoriKode: number) => {
            const iderPerModell = await hentIderForType(kategoriKode);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, false);
            }
          },
          visAlleAvKategori: async (kategoriKode: number) => {
            const iderPerModell = await hentIderForType(kategoriKode);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, true);
            }
          },
          skjulAlleAvLag: async (lagNavn: string) => {
            const iderPerModell = await hentIderForLag(lagNavn);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, false);
            }
          },
          visAlleAvLag: async (lagNavn: string) => {
            const iderPerModell = await hentIderForLag(lagNavn);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, true);
            }
          },
          skjulAlleAvSystem: async (systemNavn: string) => {
            const iderPerModell = await hentIderForSystem(systemNavn);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, false);
            }
          },
          visAlleAvSystem: async (systemNavn: string) => {
            const iderPerModell = await hentIderForSystem(systemNavn);
            for (const [fragId, ids] of iderPerModell) {
              const model = fragmentsManager.list.get(fragId);
              if (model && ids.length > 0) await model.setVisible(ids, true);
            }
          },
          flyTil: (x: number, y: number, z: number) => {
            world.camera.controls?.setLookAt(
              x + 5, y + 5, z + 5,
              x, y, z,
              true, // enableTransition — smooth fly
            );
          },
          sisteKlikkPunkt: () => sisteKlikkPunkt3D,
          settEtasjeKlipp: (nedre: number, øvre: number) => {
            const threeRenderer = (world.renderer as unknown as { three: { localClippingEnabled: boolean; clippingPlanes: unknown[] } }).three;
            threeRenderer.localClippingEnabled = true;
            const planes = [
              new THREE.Plane(new THREE.Vector3(0, 1, 0), -nedre),
              new THREE.Plane(new THREE.Vector3(0, -1, 0), øvre),
            ];
            // Sett globalt på renderer
            threeRenderer.clippingPlanes = planes;
            // Sett også på alle materialer (fragment-materialer trenger dette)
            const scene = (world.scene as unknown as { three: { traverse: (fn: (obj: unknown) => void) => void } }).three;
            scene.traverse((obj: unknown) => {
              const mesh = obj as { isMesh?: boolean; material?: { clippingPlanes: unknown[] } | Array<{ clippingPlanes: unknown[] }> };
              if (!mesh.isMesh || !mesh.material) return;
              if (Array.isArray(mesh.material)) mesh.material.forEach((m) => { m.clippingPlanes = planes; });
              else mesh.material.clippingPlanes = planes;
            });
          },
          fjernEtasjeKlipp: () => {
            const threeRenderer = (world.renderer as unknown as { three: { clippingPlanes: unknown[] } }).three;
            threeRenderer.clippingPlanes = [];
            const scene = (world.scene as unknown as { three: { traverse: (fn: (obj: unknown) => void) => void } }).three;
            scene.traverse((obj: unknown) => {
              const mesh = obj as { isMesh?: boolean; material?: { clippingPlanes: null } | Array<{ clippingPlanes: null }> };
              if (!mesh.isMesh || !mesh.material) return;
              if (Array.isArray(mesh.material)) mesh.material.forEach((m) => { m.clippingPlanes = null; });
              else mesh.material.clippingPlanes = null;
            });
          },
        };

        setLaster(false);

        return () => {
          rendererDom.removeEventListener("click", handleKlikk);
          rendererDom.removeEventListener("dblclick", handleDblKlikk);
          if (animFrameId !== null) cancelAnimationFrame(animFrameId);
        };
      })
      .catch((err) => {
        if (!renset) {
          console.error("IFC viewer feil:", err);
          setLaster(false);
        }
      });

    return () => {
      renset = true;
      viewerRef.current = null;
      if (propsApiRef) {
        for (const mid of openModelIds.values()) {
          try { propsApiRef.CloseModel(mid); } catch { /* */ }
        }
        openModelIds.clear();
        propsApiRef = null;
      }
      if (componentsRef && typeof (componentsRef as { dispose?: () => void }).dispose === "function") {
        try { (componentsRef as { dispose: () => void }).dispose(); } catch { /* */ }
      }
    };
  }, [tegningerIds]); // eslint-disable-line

  useEffect(() => {
    viewerRef.current?.settKlipperSynlig(klippModus);
  }, [klippModus, viewerRef]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {laster && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-100">
          <Loader2 className="h-10 w-10 animate-spin text-sitedoc-primary" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Laster modeller ({antallLastet}/{tegninger.length})...
          </p>
          {lasterNavn && (
            <p className="mt-1 text-xs font-medium text-sitedoc-secondary">{lasterNavn}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Parsing skjer lokalt i nettleseren. Større filer tar lengre tid.
          </p>
        </div>
      )}
    </div>
  );
}
