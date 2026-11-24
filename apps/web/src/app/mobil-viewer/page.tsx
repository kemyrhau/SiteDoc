"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  erGyldigBoks, finnUtliggere, orbitAvstandIBygg, trekkUtIfcEgenskaper, zoomSteg,
  type IfcEgenskapsGruppe, type IfcEnheter,
} from "@sitedoc/shared/tred";
import { hentIfcRaadata, lagRaadataLager, lesAttributter } from "./ifcRaadata";
import { beregnInnramming, dollyFartMobil, orbitAvstand, type Boks } from "./kameraInnramming";
import { DIAG_LAGRINGSNØKKEL, diagFraUrlEllerLager, lagDiagHemmeligTrykk } from "./diagnose";
import { lagTrykkTolk, type TrykkUtfall } from "./trykkTolk";
import { forstørrPilTreff } from "./snittPilTreff";
import { flyttSnittpilerTilMidten } from "@/lib/tredSnittPil";
import { hentModellEnheter, type IfcEgenskapsApi } from "@/lib/ifcEgenskaper";

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
 *     { type: "objektValgt", data: { localId, modelId, kategori, attributter, grupper, punkt } }
 *       grupper: IfcEgenskapsGruppe[] fra `trekkUtIfcEgenskaper` (@sitedoc/shared/tred), ren JSON
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
  // Diagnose (?diag=1 eller 5 trykk øverst til venstre, ORDRE 8 (iii)): bbox pr. modell,
  // robust boks og kameraverdier (M1–M3) + levende linje: flaten foran, radius, steg,
  // siste trykk og om modellen kom fra lagret kopi
  const [diagPå, setDiagPå] = useState(false);
  const diagPåRef = useRef(false);
  const [diag, setDiag] = useState<string | null>(null);
  const [diagLive, setDiagLive] = useState("");
  const { t } = useTranslation();
  // Objekter langt unna bygget (§ 3b punkt 3): skjult som standard, bryter vises bare når det finnes noen
  const [antallUtliggere, setAntallUtliggere] = useState(0);
  const [visUtliggere, setVisUtliggere] = useState(false);
  const settUtliggerSynlighetRef = useRef<((vis: boolean) => void) | null>(null);
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
    const enhetCache = new Map<number, IfcEnheter>();

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
      // Raycasteren som `clipper.create` bruker sporer fingeren (OBC `Mouse`: pointermove/touchstart)
      // først fra den opprettes. Opprettes den ved første dobbelttrykk, har den ingen posisjon og
      // skyter fra skjermmidten — første snitt havnet feil eller uteble. Samme grep som web (W2). ORDRE 10
      components.get(OBC.Raycasters).get(world);
      // Snittpilen flyttes dit planet krysser skjermmidten når kameraet har stoppet (§ 3d,
      // samme regel som web). Ikke mens pilen dras, og ikke mens en finger er nede.
      let snittDras = false;
      // Trykket startet på snittpilen (TransformControls grep den i samme pointerdown) — ORDRE 10
      let pilGrepet = false;
      clipper.onBeforeDrag.add(() => { snittDras = true; });
      clipper.onBeforeDrag.add(() => { pilGrepet = true; });
      // Større treffflate på pilen for fingre; synlig pil uendret (ORDRE 10)
      clipper.onAfterCreate.add((plan) => { forstørrPilTreff(plan.controls); });
      clipper.onAfterDrag.add(() => { snittDras = false; });
      const flyttSnittpiler = () => {
        const ctrl = world.camera.controls;
        if (snittDras || !clipper.enabled || !ctrl || ctrl.currentAction !== 0) return;
        const cam = world.camera.three;
        flyttSnittpilerTilMidten(clipper.list.values(), cam.position, cam.getWorldDirection(new THREE.Vector3()));
      };
      world.camera.controls?.addEventListener("rest", flyttSnittpiler);
      world.camera.controls?.addEventListener("sleep", flyttSnittpiler);
      // Holdes kameraet i ro før slipp, kom rest/sleep mens knappen var nede: slippet teller også
      world.camera.controls?.addEventListener("controlend", flyttSnittpiler);

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
      // Råfil pr. modell — fra IFC-veien direkte, fra cache-veien hentet i bakgrunnen (M5 (1))
      const raadata = lagRaadataLager();
      const totalBbox = new THREE.Box3();
      // Sentrum av den robuste boksen (uten utliggere) — brukes av flyTil
      let innrammingsSenter: InstanceType<typeof THREE.Vector3> | null = null;
      // Skalert til modellen ved innramming (erstatter OBC-standarden 6 m)
      let minDistanceNå = 0.05;
      // Avstand til orbit-punktet sist — brukes når midten av skjermen ikke treffer noe
      let sisteOrbitAvstand = 0;
      // Byggets boks uten utliggere (fra innrammingen) — orbit-punktet holdes innenfor (§ 3c (iv))
      let byggBoks: Boks | null = null;
      // Pr. modell: objekter langt unna (skjult som standard) og rom/åpninger (alltid skjult)
      const utliggerIds = new Map<string, number[]>();
      const skjulteRomIds = new Map<string, Set<number>>();
      let utliggereSynlige = false;
      diagPåRef.current = diagFraUrlEllerLager(window.location.search);
      setDiagPå(diagPåRef.current);
      // Levende diagnose (ORDRE 8 (iii)) — samles alltid, vises bare når diagnosen er på
      const live = {
        flateForan: null as number | null,
        flateTid: "",
        trykk: "–",
        kilder: new Map<number, string>(),
      };
      // Fingre som er nede (pointerId) — to eller flere = pinch
      const fingre = new Set<number>();
      let sisteLiveTegning = 0;
      const klokke = () => new Date().toLocaleTimeString("nb-NO", { hour12: false });
      function tegnLive(tving = false) {
        if (!diagPåRef.current) return;
        const nå = Date.now();
        if (!tving && nå - sisteLiveTegning < 250) return;
        sisteLiveTegning = nå;
        const ctrl = world.camera.controls;
        const radius = ctrl?.distance ?? NaN;
        const m = (v: number | null) => (v == null || !Number.isFinite(v) ? "–" : `${v.toFixed(2)} m`);
        const kilder = [...live.kilder].map(([i, k]) => `modell ${i + 1}: ${k}`).join(" · ");
        setDiagLive(
          `flate foran ${m(live.flateForan)}${live.flateTid ? ` (${live.flateTid})` : ""} · radius ${m(radius)}\n` +
          `steg ${m(zoomSteg(radius))} pr. 8 px pinch / hjulhakk · fingre ${fingre.size}\n` +
          `trykk ${live.trykk}\n` +
          (kilder || "modell: –"),
        );
      }

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

      /** Nærmeste treff blant synlige modeller i et skjermpunkt */
      async function raycastSynlige(x: number, y: number) {
        const raycastData = {
          camera: threeCamera,
          mouse: new THREE.Vector2(x, y),
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
        return hitResult;
      }

      // Orbit-punkt = flaten midt på skjermen (§ 3b punkt 1): ved hver ny berøring
      // (start av rotasjon, og etter pan/zoom) raycastes skjermsenteret, og treffet blir
      // orbit-punkt. Treffer midten ingenting, holdes samme avstand som sist langs
      // siktelinja. Kameraet flyttes ikke — bare punktet det dreier og zoomer rundt.
      let orbitRaycastPågår = false;
      let orbitPåNytt = false;
      async function settOrbitPunkt() {
        if (renset) return;
        if (orbitRaycastPågår) { orbitPåNytt = true; return; }
        orbitRaycastPågår = true;
        try {
          do {
            orbitPåNytt = false;
            const rect = rendererDom.getBoundingClientRect();
            const treff = await raycastSynlige(rect.left + rect.width / 2, rect.top + rect.height / 2);
            const ctrl = world.camera.controls;
            if (!ctrl || renset) break;
            const kamera = threeCamera.position;
            const treffAvstand = treff ? kamera.distanceTo(treff.point) : null;
            live.flateForan = treffAvstand;
            live.flateTid = klokke();
            const retning = threeCamera.getWorldDirection(new THREE.Vector3());
            // Står kameraet inne i bygget, kortes treff utenfor og bom til byggets vegg
            // (`orbitAvstandIBygg`, felles med web); deretter mobilens gulv 1,5·minDistance.
            // Ved bom: gjeldende radius, ikke sist satte avstand — etter zoom er den gamle
            // avstanden for lang og la punktet langt bak bygget (målt ORDRE 8: hver pinch
            // flyttet kameraet 166 m forbi E3). Radius er riktig etter pan, rotasjon og zoom.
            const forrige = Number.isFinite(ctrl.distance) && ctrl.distance > 0 ? ctrl.distance : sisteOrbitAvstand;
            const iBygg = orbitAvstandIBygg(kamera, retning, treffAvstand, forrige, byggBoks);
            const avstand = orbitAvstand(iBygg, forrige, minDistanceNå);
            const punkt = kamera.clone().addScaledVector(retning, avstand);
            ctrl.setOrbitPoint(punkt.x, punkt.y, punkt.z);
            sisteOrbitAvstand = avstand;
          } while (orbitPåNytt && !renset);
        } catch { /* Orbit-punkt er en forbedring — gesten virker uten */ }
        finally { orbitRaycastPågår = false; }
      }

      // Zoom-fart etter avstanden til flaten midt på skjermen (§ 3b punkt 2):
      // orbit-punktet ligger på den flaten, så avstanden dit styrer dolly-farten.
      // Kurven er felles med web (`zoomSteg` / `dollyFartForAvstand` i @sitedoc/shared).
      // Pinch zoomer mot skjermmidten, ikke mot fingrene — PRØVE (§ 3b punkt 2b, Kenneth
      // 2026-11-17). OBC setter true som standard; slett linja for å gå tilbake.
      // Pinch: camera-controls teller 16 px fingeravstand pr. enhet, ikke 8 — farten
      // dobles mens to fingre er nede (`dollyFartMobil`, ORDRE 8 (i)).
      if (world.camera.controls) world.camera.controls.dollyToCursor = false;
      world.camera.controls?.addEventListener("update", () => {
        const ctrl = world.camera.controls;
        if (ctrl) ctrl.dollySpeed = dollyFartMobil(ctrl.distance, fingre.size);
        tegnLive();
      });
      // Diagnose: flaten foran måles på nytt når kameraet har stoppet (orbit-punktet røres ikke)
      world.camera.controls?.addEventListener("sleep", () => {
        if (!diagPåRef.current || renset) return;
        const rect = rendererDom.getBoundingClientRect();
        void raycastSynlige(rect.left + rect.width / 2, rect.top + rect.height / 2).then((treff) => {
          live.flateForan = treff ? threeCamera.position.distanceTo(treff.point) : null;
          live.flateTid = klokke();
          tegnLive(true);
        }).catch(() => { /* diagnose */ });
      });

      // Med saksen aktiv tolkes trykkene her i stedet for click/dblclick (ORDRE 10):
      // enkelttrykk utenfor pilen = objektvalg (etter dobbelttrykk-vinduet), dobbelttrykk = snitt.
      const trykkTolk = lagTrykkTolk();
      let enkeltTimer: ReturnType<typeof setTimeout> | null = null;
      const utførEnkelt = (p: { x: number; y: number } | null) => {
        if (!p || !clipper.enabled || renset) return;
        void velgObjektPå(p.x, p.y, klokke(), performance.now(), "saks · ");
      };
      const lagSnitt = async (tekst: string) => {
        try {
          const plan = await clipper.create(world);
          live.trykk = `${tekst} → ${plan ? "snitt laget" : "traff ingen flate"}`;
        } catch { live.trykk = `${tekst} → feil`; }
        tegnLive(true);
      };
      const vedTolketSlipp = (u: TrykkUtfall) => {
        if (!clipper.enabled) return; // uten saks: click som før
        const tid = klokke();
        if (u.type === "venter") {
          if (enkeltTimer) clearTimeout(enkeltTimer);
          enkeltTimer = setTimeout(() => { enkeltTimer = null; utførEnkelt(trykkTolk.utløp(performance.now())); }, u.fristMs + 20);
          live.trykk = `${tid} saks · trykk, venter ${u.fristMs} ms på dobbelttrykk`;
        } else if (u.type === "dobbelt") {
          if (enkeltTimer) { clearTimeout(enkeltTimer); enkeltTimer = null; }
          live.trykk = `${tid} saks · dobbelttrykk (${u.mellomromMs} ms mellom) → snitt`;
          void lagSnitt(`${tid} saks · dobbelttrykk (${u.mellomromMs} ms mellom)`);
        } else if (u.type === "pil") {
          live.trykk = `${tid} saks · trykk på snittpilen, ikke objektvalg`;
        } else if (u.grunn !== "fingre igjen") {
          live.trykk = `${tid} saks · ikke et trykk (${u.grunn})`;
        }
        tegnLive(true);
      };

      const slippFinger = (e: PointerEvent) => { fingre.delete(e.pointerId); };
      rendererDom.addEventListener("pointerdown", (e: PointerEvent) => {
        if (e.pointerType === "touch") fingre.add(e.pointerId);
        if (e.isPrimary) pilGrepet = false;
        mouseDownPos = { x: e.clientX, y: e.clientY };
        live.trykk = `${klokke()} ned · venter på klikk`;
        tegnLive(true);
        void settOrbitPunkt();
        const løst = trykkTolk.ned(e.pointerId, e.clientX, e.clientY, performance.now());
        if (løst) {
          if (enkeltTimer) { clearTimeout(enkeltTimer); enkeltTimer = null; }
          utførEnkelt(løst);
        }
      });
      rendererDom.addEventListener("pointerup", slippFinger);
      rendererDom.addEventListener("pointercancel", slippFinger);
      rendererDom.addEventListener("pointerup", (e: PointerEvent) => {
        vedTolketSlipp(trykkTolk.opp(e.pointerId, e.clientX, e.clientY, performance.now(), pilGrepet));
      });
      rendererDom.addEventListener("pointercancel", (e: PointerEvent) => { trykkTolk.avbryt(e.pointerId); });

      // Slå diagnosen av/på fra appen uten OTA: 5 raske trykk øverst til venstre (huskes)
      const hemmeligTrykk = lagDiagHemmeligTrykk(() => {
        diagPåRef.current = !diagPåRef.current;
        try { localStorage.setItem(DIAG_LAGRINGSNØKKEL, diagPåRef.current ? "1" : "0"); } catch { /* */ }
        setDiagPå(diagPåRef.current);
        tegnLive(true);
      });
      const vedHemmeligTrykk = (e: PointerEvent) => hemmeligTrykk(e.clientX, e.clientY, Date.now());
      window.addEventListener("pointerdown", vedHemmeligTrykk, true);

      async function handleKlikk(event: MouseEvent) {
        if (renset) return;
        // Med saksen aktiv tar trykk-tolken over (ORDRE 10)
        if (clipper.enabled) return;
        const klikkStart = performance.now();
        const klikkTid = klokke();
        if (mouseDownPos) {
          const dx = event.clientX - mouseDownPos.x;
          const dy = event.clientY - mouseDownPos.y;
          if (Math.sqrt(dx * dx + dy * dy) > 5) {
            live.trykk = `${klikkTid} klikk · flyttet > 5 px, ikke et trykk`;
            tegnLive(true);
            return;
          }
        }
        await velgObjektPå(event.clientX, event.clientY, klikkTid, klikkStart, "");
      }

      /** Objektvalg i et skjermpunkt: utheving + `objektValgt`/`objektFjernet` til appen */
      async function velgObjektPå(x: number, y: number, klikkTid: string, klikkStart: number, kilde: "" | "saks · ") {
        const ms = () => `${Math.round(performance.now() - klikkStart)} ms`;

        if (currentHighlight) {
          try {
            const prevModel = fragmentsManager.list.get(currentHighlight.modelId);
            if (prevModel) await prevModel.resetHighlight(currentHighlight.localIds);
          } catch { /* */ }
          currentHighlight = null;
        }

        try {
          const hitResult = await raycastSynlige(x, y);

          if (!hitResult) {
            sendTilApp({ type: "objektFjernet" });
            live.trykk = `${klikkTid} ${kilde}klikk · traff ingenting → objektFjernet (${ms()})`;
            tegnLive(true);
            return;
          }

          const { localId, fragments: hitModel } = hitResult;

          try {
            await hitModel.highlight([localId], highlightMaterial);
            currentHighlight = { modelId: hitModel.modelId, localIds: [localId] };
          } catch { /* */ }

          const item = hitModel.getItem(localId);
          const kategori = await item.getCategory().catch(() => null);

          // Egenskaper via web-ifc (gjenbruker propsApi). Venter på råfila hvis den
          // fortsatt hentes i bakgrunnen (modell lastet fra fragment-cache).
          const rawData = await raadata.hent(hitModel.modelId);
          let attributter: Record<string, unknown> = {};
          // W3/M5 (2): samme uttrekk som egenskapskortet på web (attributter, egenskapssett, type, mengder)
          let grupper: IfcEgenskapsGruppe[] = [];
          if (rawData && propsApi) {
            try {
              const modelId = åpneIfc(hitModel.modelId, rawData);
              const api = propsApi as unknown as IfcEgenskapsApi;
              const [itemProps, egenskapssett, typer] = await Promise.all([
                api.properties.getItemProperties(modelId, localId, true).catch(() => null),
                api.properties.getPropertySets(modelId, localId, true).catch(() => []),
                api.properties.getTypeProperties(modelId, localId, true).catch(() => []),
              ]);
              attributter = lesAttributter(itemProps);
              const enheter = hentModellEnheter(api, modelId, WEBIFC.IFCUNITASSIGNMENT, enhetCache);
              grupper = trekkUtIfcEgenskaper({ objekt: itemProps, egenskapssett, typer, enheter });
            } catch { /* */ }
          }

          sendTilApp({
            type: "objektValgt",
            data: { localId, modelId: hitModel.modelId, kategori, attributter, grupper,
              punkt: { x: hitResult.point.x, y: hitResult.point.y, z: hitResult.point.z } },
          });
          live.trykk = `${klikkTid} ${kilde}klikk · objektValgt ${kategori ?? "uten kategori"}, ` +
            `${Object.keys(attributter).length} egenskaper, ${grupper.length} grupper, råfil ${rawData ? "ja" : "nei"} (${ms()})`;
          tegnLive(true);
        } catch {
          sendTilApp({ type: "objektFjernet" });
          live.trykk = `${klikkTid} ${kilde}klikk · feil → objektFjernet (${ms()})`;
          tegnLive(true);
        }
      }

      rendererDom.addEventListener("click", handleKlikk);

      // Dobbelttrykk med saksen aktiv lager snitt via trykk-tolken over (ORDRE 10), ikke `dblclick`:
      // nettleserens dblclick kom i tillegg til to click (objektvalg) og var upålitelig på iOS.

      /** Åpne råfila i web-ifc én gang pr. modell */
      function åpneIfc(fragModelId: string, ifcData: Uint8Array): number {
        let mid: number = openModelIds.get(fragModelId) ?? -1;
        if (mid === -1) {
          mid = propsApi.OpenModel(ifcData) as number;
          openModelIds.set(fragModelId, mid);
        }
        return mid;
      }

      /** Skjul IfcSpace og IfcOpeningElement (krever råfila) */
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function skjulRomOgÅpninger(model: any, ifcData: Uint8Array) {
        try {
          const mid = åpneIfc((model as { modelId: string }).modelId, ifcData);
          const hideApi = propsApi as unknown as { GetLineIDsWithType: (m: number, t: number) => { size: () => number; get: (i: number) => number } };
          const skjulIds: number[] = [];
          for (const ifcType of [WEBIFC.IFCSPACE, WEBIFC.IFCOPENINGELEMENT]) {
            const lineIds = hideApi.GetLineIDsWithType(mid, ifcType);
            for (let si = 0; si < lineIds.size(); si++) skjulIds.push(lineIds.get(si));
          }
          skjulteRomIds.set((model as { modelId: string }).modelId, new Set(skjulIds));
          if (skjulIds.length > 0) await model.setVisible(skjulIds, false);
        } catch { /* */ }
      }

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
        let kildeTekst = "IFC";
        const lastStart = performance.now();

        // Prøv fragment-cache først (mye raskere enn IFC-parsing)
        if (cachedFrag) {
          try {
            setStatus(`Laster cachet ${index + 1}...`);
            const fragData = b64ToUint8(cachedFrag);
            model = await (fragmentsManager as unknown as { load: (b: ArrayBuffer, o: Record<string, unknown>) => Promise<unknown> })
              .load(fragData.buffer as ArrayBuffer, { modelId: `modell-${index}`, camera: threeCamera });
            fraCache = true;
            kildeTekst = "lagret kopi";
          } catch {
            model = null; // Fallback til IFC
            kildeTekst = "lagret kopi feilet → IFC";
          }
        }

        // Fallback: Last og parse IFC
        if (!model) {
          setStatus(`Laster ned ${index + 1}...`);
          const ifcData = await hentIfcRaadata(url, token);
          if (renset) return false;

          setStatus(`Parser ${index + 1}...`);
          model = await ifcLoader.load(ifcData, true, `modell-${index}`);

          // Lagre IFC-data for egenskapssøk
          const fragModelId = (model as { modelId: string }).modelId;
          raadata.sett(fragModelId, ifcData);

          // Skjul IfcSpace og IfcOpeningElement
          await skjulRomOgÅpninger(model, ifcData);

          // Eksporter fragment-buffer og send til app for caching
          try {
            const fragBuffer = await (model as { getBuffer: (raw?: boolean) => Promise<ArrayBuffer> }).getBuffer(false);
            const b64 = uint8ToB64(new Uint8Array(fragBuffer));
            sendTilApp({ type: "cacheFragment", url, data: b64 });
          } catch { /* Fragment-caching er valgfritt */ }
        }

        live.kilder.set(index, `${kildeTekst} (${Math.round(performance.now() - lastStart)} ms)`);
        tegnLive(true);

        // Legg til i scene
        const mf = model as { object: InstanceType<typeof THREE.Object3D>; useCamera: (c: unknown) => void; box: InstanceType<typeof THREE.Box3>; modelId: string };
        scene.add(mf.object);
        mf.useCamera(threeCamera);
        modeller.set(index, model);
        synligeModeller.add(mf.modelId);
        totalBbox.union(mf.box);

        // Cache-veien: hent råfila i bakgrunnen (ingen ny geometri-parsing) for
        // objektinfo og skjuling av IfcSpace/IfcOpening. Visningen venter ikke på den.
        if (fraCache) {
          void raadata.hentIBakgrunn(mf.modelId, () => hentIfcRaadata(url, token)).then((data) => {
            if (data && !renset) void skjulRomOgÅpninger(model, data);
          });
        }

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

        // Tilpass kamera og dybdebuffer til en robust boks (uten utliggere), M1–M3
        await rammInn();

        setStatus("");
        sendTilApp({ type: "alleLastet", antall: lastet });
      }

      /** Vis/skjul objekter langt unna. Rom/åpninger forblir skjult uansett. */
      async function settUtliggerSynlighet(vis: boolean) {
        utliggereSynlige = vis;
        for (const [modelId, ids] of utliggerIds) {
          const model = fragmentsManager.list.get(modelId);
          if (!model) continue;
          const rom = skjulteRomIds.get(modelId);
          const aktuelle = vis && rom ? ids.filter((id) => !rom.has(id)) : ids;
          if (aktuelle.length === 0) continue;
          try { await model.setVisible(aktuelle, vis); } catch { /* */ }
        }
      }
      settUtliggerSynlighetRef.current = (vis: boolean) => { void settUtliggerSynlighet(vis); };

      /** Ramme inn synlige modeller fra objektboksene, uten utliggere. Faller tilbake til samlet boks. */
      async function rammInn() {
        // Objektboksene til alle synlige modeller, med hvem de tilhører
        const alle: Boks[] = [];
        const eiere: { modelId: string; localId: number }[] = [];
        const diagLinjer: string[] = [];
        const f = (v: number) => v.toFixed(1);
        const beskriv = (b: Boks) =>
          `str ${f(b.max.x - b.min.x)}×${f(b.max.y - b.min.y)}×${f(b.max.z - b.min.z)} ` +
          `senter (${f((b.min.x + b.max.x) / 2)}, ${f((b.min.y + b.max.y) / 2)}, ${f((b.min.z + b.max.z) / 2)})`;
        for (const [index, m] of modeller) {
          const mf = m as {
            modelId: string; box: Boks;
            getItemsIdsWithGeometry: () => Promise<number[]>;
            getBoxes: (ids?: number[]) => Promise<Boks[]>;
          };
          if (!synligeModeller.has(mf.modelId)) continue;
          let ids: number[] = [];
          let bokser: Boks[] = [];
          try {
            ids = await mf.getItemsIdsWithGeometry();
            bokser = await mf.getBoxes(ids);
          } catch { ids = []; bokser = []; /* faller tilbake til mf.box */ }
          if (bokser.length !== ids.length) { ids = []; bokser = []; }
          bokser.forEach((b, i) => { alle.push(b); eiere.push({ modelId: mf.modelId, localId: ids[i]! }); });
          const r = finnUtliggere(bokser);
          diagLinjer.push(`modell ${index + 1}: bbox ${beskriv(mf.box)}`);
          if (r) diagLinjer.push(`  robust ${beskriv(r.boks)} · ${r.utliggere.length}/${r.antall} utliggere`);
        }
        const robust = finnUtliggere(alle);
        const boks: Boks | null = robust?.boks ?? (totalBbox.isEmpty() ? null : totalBbox);

        // Objekter langt unna bygget: registrer pr. modell og skjul (standard)
        utliggerIds.clear();
        for (const i of robust?.utliggere ?? []) {
          const e = eiere[i]!;
          const liste = utliggerIds.get(e.modelId) ?? [];
          liste.push(e.localId);
          utliggerIds.set(e.modelId, liste);
        }
        setAntallUtliggere(robust?.utliggere.length ?? 0);
        await settUtliggerSynlighet(utliggereSynlige);

        if (!boks) return;

        // Objektboksene som er med i innrammingen (gyldige, ikke utliggere)
        const utliggerSett = new Set(robust?.utliggere ?? []);
        const med = robust ? alle.filter((b, i) => !utliggerSett.has(i) && erGyldigBoks(b)) : [];
        const inn = beregnInnramming(boks, threeCamera.fov, threeCamera.aspect || 1, med);
        threeCamera.near = inn.near;
        threeCamera.far = inn.far;
        threeCamera.updateProjectionMatrix();
        minDistanceNå = inn.minDistance;
        byggBoks = { min: { x: boks.min.x, y: boks.min.y, z: boks.min.z }, max: { x: boks.max.x, y: boks.max.y, z: boks.max.z } };
        sisteOrbitAvstand = inn.avstand;
        innrammingsSenter = new THREE.Vector3(inn.target.x, inn.target.y, inn.target.z);
        const ctrl = world.camera.controls;
        if (ctrl) {
          ctrl.minDistance = inn.minDistance;
          ctrl.setLookAt(
            inn.posisjon.x, inn.posisjon.y, inn.posisjon.z,
            inn.target.x, inn.target.y, inn.target.z,
          );
        }

        if (!totalBbox.isEmpty()) diagLinjer.push(`samlet bbox ${beskriv(totalBbox)}`);
        if (robust) diagLinjer.push(`samlet robust ${beskriv(robust.boks)} · ${robust.utliggere.length}/${robust.antall} utliggere`);
        // De tre største objektene i innrammingen — finner tomt/terreng som gjør modellen liten
        const størst = alle
          .map((b, i) => ({ b, i, s: Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z) }))
          .filter((o) => !utliggerSett.has(o.i) && Number.isFinite(o.s))
          .sort((a, c) => c.s - a.s)
          .slice(0, 3);
        for (const o of størst) {
          const e = eiere[o.i]!;
          let kat: string | null = null;
          try { kat = await fragmentsManager.list.get(e.modelId)?.getItem(e.localId).getCategory() ?? null; } catch { /* */ }
          diagLinjer.push(`  stor: ${kat ?? "#" + e.localId} ${beskriv(o.b)}`);
        }
        diagLinjer.push(`kamera avstand ${f(inn.avstand)} near ${inn.near.toFixed(3)} far ${f(inn.far)} minDistance ${inn.minDistance.toFixed(3)}`);
        setDiag(diagLinjer.join("\n"));
        if (diagPåRef.current) console.log("[mobil-viewer diag]\n" + diagLinjer.join("\n"));
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
          // Trykk fra før saksen ble slått av/på skal ikke tolkes etterpå (RETUR 1, ORDRE 10)
          trykkTolk.nullstill();
          if (enkeltTimer) { clearTimeout(enkeltTimer); enkeltTimer = null; }
          if (!msg.aktiv) clipper.deleteAll();
        } else if (msg.type === "flyTil") {
          const { x, y, z } = msg;
          // Plasser kamera på punktet, se mot byggets sentrum
          const senter = innrammingsSenter ?? totalBbox.getCenter(new THREE.Vector3());
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
        window.removeEventListener("pointerdown", vedHemmeligTrykk, true);
        rendererDom.removeEventListener("click", handleKlikk);
        if (enkeltTimer) clearTimeout(enkeltTimer);
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
      {antallUtliggere > 0 && (
        <label className="absolute right-2 top-2 flex items-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow">
          <input
            type="checkbox"
            className="h-4 w-4 accent-sitedoc-primary"
            checked={visUtliggere}
            onChange={(e) => {
              setVisUtliggere(e.target.checked);
              settUtliggerSynlighetRef.current?.(e.target.checked);
            }}
          />
          {t("3d.visObjekterLangtUnna")} ({antallUtliggere})
        </label>
      )}
      {diagPå && (
        <pre className="pointer-events-none absolute left-2 top-2 max-w-[90vw] whitespace-pre-wrap rounded bg-white/90 p-2 text-[10px] leading-tight text-gray-800">
          {[diagLive, diag].filter(Boolean).join("\n")}
        </pre>
      )}
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
