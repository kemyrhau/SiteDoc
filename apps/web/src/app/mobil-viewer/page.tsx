"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Standalone IFC 3D-viewer for bruk i React Native WebView.
 *
 * Kommunikasjon:
 *   Inn (postMessage til vinduet):
 *     { type: "lastModeller", urls: string[], token?: string }
 *     { type: "toggleModell", index: number, synlig: boolean }
 *     { type: "klippmodus", aktiv: boolean }
 *
 *   Ut (postMessage fra vinduet — fanges av WebView.onMessage):
 *     { type: "klar" }
 *     { type: "modellLastet", index: number, navn: string, totalt: number }
 *     { type: "alleLastet", antall: number }
 *     { type: "objektValgt", data: { localId, modelId, kategori, attributter } }
 *     { type: "objektFjernet" }
 *     { type: "feil", melding: string }
 */

function sendTilApp(data: Record<string, unknown>) {
  try {
    const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify(data));
    window.parent?.postMessage(data, "*");
  } catch { /* */ }
}

export default function MobilViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Initialiserer...");
  const [antallLastet, setAntallLastet] = useState(0);
  const [totalt, setTotalt] = useState(0);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const container = containerRef.current;
    if (!container) return;

    let renset = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let componentsRef: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let propsApi: any = null;
    const openModelIds = new Map<string, number>();

    async function init() {
      const [OBC, THREE, WEBIFC] = await Promise.all([
        import("@thatopen/components"),
        import("three"),
        import("web-ifc"),
      ]);

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

      world.renderer = new OBC.SimpleRenderer(components, container!);
      world.camera = new OBC.SimpleCamera(components);
      world.camera.controls?.setLookAt(20, 20, 20, 0, 0, 0);

      // Optimaliser: Cap pixelratio til 1.5 for mobil (sparer GPU vesentlig)
      const threeRenderer = (world.renderer as unknown as { three: InstanceType<typeof THREE.WebGLRenderer> }).three;
      threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

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

      // Optimaliser: Init web-ifc API én gang
      propsApi = new WEBIFC.IfcAPI();
      propsApi.SetWasmPath("/", true);
      await propsApi.Init((_f: string) => "/web-ifc.wasm");

      const threeCamera = (world.camera as unknown as { three: InstanceType<typeof THREE.PerspectiveCamera> }).three;

      // Optimaliser: Pause render-loop når kamera er stille
      let animFrameId: number | null = null;
      let idleFrames = 0;
      const lastCamPos = new THREE.Vector3();
      const lastCamTarget = new THREE.Vector3();
      const tmpPos = new THREE.Vector3();
      const MAX_IDLE_FRAMES = 30; // Etter 30 stille frames → kun oppdater hvert 10. frame

      function updateLoop() {
        if (renset) return;

        // Sjekk om kamera har beveget seg
        threeCamera.getWorldPosition(tmpPos);
        if (tmpPos.distanceToSquared(lastCamPos) > 0.0001) {
          idleFrames = 0;
          lastCamPos.copy(tmpPos);
        } else {
          idleFrames++;
        }

        // Kjør fragmentoppdatering (alltid når kamera beveger seg, ellers sjeldnere)
        if (idleFrames < MAX_IDLE_FRAMES || idleFrames % 10 === 0) {
          fragmentsManager.core.update();
        }

        animFrameId = requestAnimationFrame(updateLoop);
      }
      updateLoop();

      // Optimaliser: Pause ved bakgrunn
      function handleVisibility() {
        if (document.hidden && animFrameId !== null) {
          cancelAnimationFrame(animFrameId);
          animFrameId = null;
        } else if (!document.hidden && animFrameId === null && !renset) {
          updateLoop();
        }
      }
      document.addEventListener("visibilitychange", handleVisibility);

      // State
      const modeller = new Map<number, unknown>();
      const synligeModeller = new Set<string>();
      const ifcDataMap = new Map<string, Uint8Array>();
      const totalBbox = new THREE.Box3();

      // Raycasting
      const rendererDom = threeRenderer.domElement;
      const highlightMaterial = {
        color: new THREE.Color(0x3b82f6),
        renderedFaces: 1 as unknown as import("@thatopen/fragments").RenderedFaces,
        opacity: 0.6,
        transparent: true,
      };
      let currentHighlight: { modelId: string; localIds: number[] } | null = null;
      let mouseDownPos: { x: number; y: number } | null = null;

      rendererDom.addEventListener("pointerdown", (e: PointerEvent) => {
        mouseDownPos = { x: e.clientX, y: e.clientY };
      });

      async function handleKlikk(event: MouseEvent) {
        if (renset) return;
        if (mouseDownPos) {
          const dx = event.clientX - mouseDownPos.x;
          const dy = event.clientY - mouseDownPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > 5) return;
        }

        if (currentHighlight) {
          try {
            const prevModel = fragmentsManager.list.get(currentHighlight.modelId);
            if (prevModel) await prevModel.resetHighlight(currentHighlight.localIds);
          } catch { /* */ }
          currentHighlight = null;
        }

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
            } catch { /* */ }
          }

          if (!hitResult) {
            sendTilApp({ type: "objektFjernet" });
            return;
          }

          const { localId, fragments: hitModel } = hitResult;

          try {
            await hitModel.highlight([localId], highlightMaterial);
            currentHighlight = { modelId: hitModel.modelId, localIds: [localId] };
          } catch { /* */ }

          const item = hitModel.getItem(localId);
          const kategori = await item.getCategory().catch(() => null);

          // Egenskaper via web-ifc (gjenbruker propsApi)
          const rawData = ifcDataMap.get(hitModel.modelId);
          let attributter: Record<string, unknown> = {};
          if (rawData && propsApi) {
            try {
              let modelId: number = openModelIds.get(hitModel.modelId) ?? -1;
              if (modelId === -1) {
                modelId = propsApi.OpenModel(rawData) as number;
                openModelIds.set(hitModel.modelId, modelId);
              }
              const itemProps = await propsApi.properties.getItemProperties(modelId, localId, true).catch(() => null);
              if (itemProps) {
                for (const [k, v] of Object.entries(itemProps)) {
                  if (v && typeof v === "object" && "value" in (v as Record<string, unknown>)) {
                    const val = (v as { value: unknown }).value;
                    if (val != null && val !== "") attributter[k] = val;
                  }
                }
              }
            } catch { /* */ }
          }

          sendTilApp({
            type: "objektValgt",
            data: { localId, modelId: hitModel.modelId, kategori, attributter,
              punkt: { x: hitResult.point.x, y: hitResult.point.y, z: hitResult.point.z } },
          });
        } catch {
          sendTilApp({ type: "objektFjernet" });
        }
      }

      rendererDom.addEventListener("click", handleKlikk);

      rendererDom.addEventListener("dblclick", async () => {
        if (!clipper.enabled || renset) return;
        await clipper.create(world);
      });

      /** Base64 → Uint8Array */
      function b64ToUint8(b64: string): Uint8Array {
        const bin = atob(b64);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }

      /** Uint8Array → Base64 (chunked for store data) */
      function uint8ToB64(data: Uint8Array): string {
        let bin = "";
        const chunk = 8192;
        for (let i = 0; i < data.length; i += chunk) {
          bin += String.fromCharCode(...data.subarray(i, i + chunk));
        }
        return btoa(bin);
      }

      /** Last og vis én modell (fra fragment-cache eller IFC) */
      async function lastEnModell(
        index: number,
        url: string,
        token: string | undefined,
        cachedFrag: string | undefined,
      ): Promise<boolean> {
        const fm = fragmentsManager as unknown as { list: Map<string, unknown> };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let model: any;
        let fraCache = false;

        // Prøv fragment-cache først (mye raskere enn IFC-parsing)
        if (cachedFrag) {
          try {
            setStatus(`Laster cachet ${index + 1}...`);
            const fragData = b64ToUint8(cachedFrag);
            model = await (fragmentsManager as unknown as { load: (b: ArrayBuffer, o: Record<string, unknown>) => Promise<unknown> })
              .load(fragData.buffer as ArrayBuffer, { modelId: `modell-${index}`, camera: threeCamera });
            fraCache = true;
          } catch {
            model = null; // Fallback til IFC
          }
        }

        // Fallback: Last og parse IFC
        if (!model) {
          setStatus(`Laster ned ${index + 1}...`);
          const headers: Record<string, string> = {};
          if (token) headers["Authorization"] = `Bearer ${token}`;

          const response = await fetch(url, { headers });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const ifcData = new Uint8Array(await response.arrayBuffer());
          if (renset) return false;

          setStatus(`Parser ${index + 1}...`);
          model = await ifcLoader.load(ifcData, true, `modell-${index}`);

          // Lagre IFC-data for egenskapssøk
          const fragModelId = (model as { modelId: string }).modelId;
          ifcDataMap.set(fragModelId, ifcData);

          // Skjul IfcSpace og IfcOpeningElement
          try {
            let mid: number = openModelIds.get(fragModelId) ?? -1;
            if (mid === -1) {
              mid = propsApi.OpenModel(ifcData) as number;
              openModelIds.set(fragModelId, mid);
            }
            const hideApi = propsApi as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number } };
            const skjulIds: number[] = [];
            for (const ifcType of [WEBIFC.IFCSPACE, WEBIFC.IFCOPENINGELEMENT]) {
              const lineIds = hideApi.GetLineIDsWithType(mid, ifcType);
              for (let si = 0; si < lineIds.size(); si++) skjulIds.push(lineIds.get(si));
            }
            if (skjulIds.length > 0) await model.setVisible(skjulIds, false);
          } catch { /* */ }

          // Eksporter fragment-buffer og send til app for caching
          try {
            const fragBuffer = await (model as { getBuffer: (raw?: boolean) => Promise<ArrayBuffer> }).getBuffer(false);
            const b64 = uint8ToB64(new Uint8Array(fragBuffer));
            sendTilApp({ type: "cacheFragment", url, data: b64 });
          } catch { /* Fragment-caching er valgfritt */ }
        }

        // Legg til i scene
        const mf = model as { object: InstanceType<typeof THREE.Object3D>; useCamera: (c: unknown) => void; box: InstanceType<typeof THREE.Box3>; modelId: string };
        scene.add(mf.object);
        mf.useCamera(threeCamera);
        modeller.set(index, model);
        synligeModeller.add(mf.modelId);
        totalBbox.union(mf.box);

        return fraCache;
      }

      // Modell-lasting — med fragment-cache støtte
      async function lastModeller(urls: string[], token?: string, cachedFragments?: Record<string, string>) {
        setTotalt(urls.length);
        setAntallLastet(0);
        setStatus("Laster modeller...");
        totalBbox.makeEmpty();

        let lastet = 0;
        for (let i = 0; i < urls.length; i++) {
          if (renset) return;
          try {
            const cachedFrag = cachedFragments?.[urls[i]!];
            await lastEnModell(i, urls[i]!, token, cachedFrag);
            lastet++;
            setAntallLastet(lastet);
            sendTilApp({ type: "modellLastet", index: i, navn: `modell-${i}`, totalt: urls.length });
          } catch (err) {
            sendTilApp({ type: "feil", melding: `Modell ${i + 1}: ${err instanceof Error ? err.message : String(err)}` });
          }
        }

        // Tilpass kamera og dybdebuffer
        if (!totalBbox.isEmpty()) {
          const center = totalBbox.getCenter(new THREE.Vector3());
          const size = totalBbox.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          threeCamera.near = maxDim * 0.001;
          threeCamera.far = maxDim * 20;
          threeCamera.updateProjectionMatrix();
          world.camera.controls?.setLookAt(
            center.x + maxDim, center.y + maxDim * 0.7, center.z + maxDim,
            center.x, center.y, center.z,
          );
        }

        setStatus("");
        sendTilApp({ type: "alleLastet", antall: lastet });
      }

      // Meldingshåndtering
      function handleMessage(event: MessageEvent) {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (msg.type === "lastModeller") {
          lastModeller(msg.urls, msg.token, msg.cachedFragments);
        } else if (msg.type === "toggleModell") {
          const model = modeller.get(msg.index) as { object?: InstanceType<typeof THREE.Object3D>; modelId?: string } | undefined;
          if (model?.object) {
            if (msg.synlig) { if (!model.object.parent) scene.add(model.object); }
            else scene.remove(model.object);
          }
          if (model?.modelId) {
            if (msg.synlig) synligeModeller.add(model.modelId as string);
            else synligeModeller.delete(model.modelId as string);
          }
        } else if (msg.type === "klippmodus") {
          clipper.enabled = msg.aktiv;
          clipper.visible = msg.aktiv;
          if (!msg.aktiv) clipper.deleteAll();
        } else if (msg.type === "flyTil") {
          const { x, y, z } = msg;
          // Plasser kamera på punktet, se mot byggets sentrum
          const senter = totalBbox.getCenter(new THREE.Vector3());
          const dx = senter.x - x;
          const dz = senter.z - z;
          const len = Math.sqrt(dx * dx + dz * dz) || 1;
          const kameraY = y + 1.6;
          world.camera.controls?.setLookAt(
            x, kameraY, z,
            x + (dx / len) * 5, kameraY, z + (dz / len) * 5,
            true,
          );
        }
      }

      window.addEventListener("message", handleMessage);
      sendTilApp({ type: "klar" });
      setStatus("Klar");

      const params = new URLSearchParams(window.location.search);
      const urlParam = params.get("urls");
      const tokenParam = params.get("token");
      if (urlParam) {
        const urls = urlParam.split(",").map((u) => u.trim()).filter(Boolean);
        if (urls.length > 0) lastModeller(urls, tokenParam ?? undefined);
      }

      return () => {
        window.removeEventListener("message", handleMessage);
        rendererDom.removeEventListener("click", handleKlikk);
        document.removeEventListener("visibilitychange", handleVisibility);
        if (animFrameId !== null) cancelAnimationFrame(animFrameId);
      };
    }

    init().catch((err) => {
      setStatus("Feil ved initialisering");
      sendTilApp({ type: "feil", melding: err instanceof Error ? err.message : String(err) });
    });

    return () => {
      renset = true;
      if (propsApi) {
        for (const mid of openModelIds.values()) {
          try { propsApi.CloseModel(mid); } catch { /* */ }
        }
      }
      if (componentsRef?.dispose) {
        try { componentsRef.dispose(); } catch { /* */ }
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-100">
      <div ref={containerRef} className="h-full w-full" />
      {status && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 pointer-events-none">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-sitedoc-primary border-t-transparent" />
          <p className="mt-3 text-sm font-medium text-gray-700">{status}</p>
          {totalt > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              {antallLastet}/{totalt} modeller
            </p>
          )}
        </div>
      )}
    </div>
  );
}
