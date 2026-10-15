"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RegisterVerden } from "@sitedoc/shared";
import { erGyldigRegisterVerden } from "@sitedoc/shared";
import { hentFilMedCache, usignertFilSti } from "@/lib/tegningFilCache";
import { hentDxfWorkerFactory } from "@/lib/dxfWorkerFactory";

/**
 * Leveranse 1 (TEGNING_MOTOR=dxfviewer): tegner forenklet DXF + O1-register direkte
 * via `dxf-viewer` (WebGL), som erstatning for SVG-visningen bak flagget (plan § 1-3,
 * relay/inbox-orkestrator.md). Lazy-lastet (dynamic import) — `dxf-viewer` drar med
 * seg en EGEN three.js-kopi (^0.186, direkte avhengighet) ved siden av 3D-viserens
 * ^0.183.2 (orkestrator-vedtak 2026-10-13: to kopier akseptert, så lenge denne siden
 * ikke drar dem inn i 3D-sidens bundle).
 *
 * Kun INITIELT kamera-oppsett (fit + startutsnitt + VEDTAK B-rotasjon) bygges her —
 * pan/zoom kommer "gratis" fra dxf-viewer sin egne OrbitControls. Objektklikk/lag-panel/
 * måling er leveranse 2/3/5 (plan § 12), ikke del av denne gaten.
 *
 * RETUR 4 (relay/inbox-dokgen-arbeidstegning-f1.md): `dxfUrl`/`registerWorldUrl` er
 * SIGNERT ved hver tRPC-emisjon (`signerUploadsOutput`, `hmac.ts`) — EN NY signatur pr.
 * `tegning.hentMedId`-kall, inkl. bakgrunns-refetch ved vindu-fokus (react-query v5
 * default). Effektens avhengigheter bruker derfor den USIGNERTE stien (stabil for
 * samme fil), ikke den signerte strengen — en bakgrunnsrefetch skal ALDRI rive ned og
 * bygge scenen på nytt. Selve nedlastingen går via `hentFilMedCache` (klient-cache,
 * usignert nøkkel; signert URL brukes kun ved cache-bom) — SVAR RETUR 4: ikke rør
 * `hmac.ts`, cache på klienten i stedet.
 *
 * Worker-bunt (orkestrator 2026-10-15, "worker-bunt med esbuild, GODKJENT"): DXF-parsing
 * flyttes av hovedtråden via `dxf-viewer`s `workerFactory`. Bunten er FRITTSTÅENDE —
 * bygget av `scripts/build-dxf-worker.mjs` (esbuild) FØR next dev/build, IKKE Next sin
 * egen webpack-worker-bundling (den native veien ga en manglende-chunk-defekt i en kald
 * build). `hentDxfWorkerFactory()` leser `public/workers/manifest.json` for gjeldende
 * hash-navn; svarer den ikke, eller feiler selve worker-lastingen (404/CSP), faller
 * Load()-kallet under tilbake til hovedtråden med en konsollmelding — aldri blank flate.
 */

export interface DxfViewerTegningProps {
  dxfUrl: string;
  registerWorldUrl: string;
  /** Brukerens visningsrotasjon i grader (DB: Drawing.rotasjonOverstyrt). VEDTAK B:
   * ikke-georeferert DWG vises SOM TEGNET — ingen auto-kamerarotasjon, kun denne. */
  rotasjonOverstyrt: number | null;
}

// Samme midlertidige heuristikk som harness-v3 (orkestrator-godkjent MVP, plan § 6):
// rutenett-/akselinjer ekskluderes fra byggutstrekningen via lagnavn-nøkkelord.
// Erstattes av en geometrisk regel (ingen lagnavn) i en egen leveranse FØR en
// kundetegning med annen rutenett-navngivning treffer veggen.
const RUTENETT_NOKKELORD = ["modullinj"];

function erRutenettObjekt(o: { kategori?: string; lag?: string }): boolean {
  const k = `${o.kategori ?? ""} ${o.lag ?? ""}`.toLowerCase();
  return RUTENETT_NOKKELORD.some((n) => k.includes(n));
}

function beregnByggUtstrekning(register: RegisterVerden) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const o of Object.values(register.objekter)) {
    if (!o.bbox || erRutenettObjekt(o)) continue;
    if (o.bbox[0] < x0) x0 = o.bbox[0];
    if (o.bbox[2] > x1) x1 = o.bbox[2];
    if (o.bbox[1] < y0) y0 = o.bbox[1];
    if (o.bbox[3] > y1) y1 = o.bbox[3];
  }
  return Number.isFinite(x0) ? { x0, x1, y0, y1 } : null;
}

export function DxfViewerTegning({ dxfUrl, registerWorldUrl, rotasjonOverstyrt }: DxfViewerTegningProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [laster, setLaster] = useState(true);
  const [feil, setFeil] = useState<string | null>(null);
  const [fremdriftProsent, setFremdriftProsent] = useState<number | null>(null);
  // Manuelt "Prøv igjen"-trykk (feilvisning) — teller inngår bevisst i avhengighetene
  // under: en brukerinitiert retry SKAL laste på nytt, i motsetning til signatur-churn.
  const [retryTeller, setRetryTeller] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const bygningRef = useRef<ReturnType<typeof beregnByggUtstrekning>>(null);
  const fitZoomBaseRef = useRef<number | null>(null);
  // Ferskeste SIGNERTE URL-er tilgjengelig for effekten uten å trigge et nytt effekt-løp
  // (se avhengighetene i useEffect under — kun den USIGNERTE stien trigger reload).
  const dxfUrlRef = useRef(dxfUrl);
  dxfUrlRef.current = dxfUrl;
  const registerWorldUrlRef = useRef(registerWorldUrl);
  registerWorldUrlRef.current = registerWorldUrl;
  const usignertDxfSti = usignertFilSti(dxfUrl);
  const usignertRegisterSti = usignertFilSti(registerWorldUrl);

  /** Kamera-fit til bygningsutstrekningen (eller hele DXF-en før registeret er lastet),
   * for den GJELDENDE containerstørrelsen. Kalt ved første last OG fra ResizeObserver —
   * RETUR (orkestrator 2026-10-14): container-høyden er 0 ved mount inntil den delte
   * dashbord-layouten har satt en definit høyde (tegningVisningshoyde.ts), og kan endre
   * seg senere (vindu/mobilpanel) — ett engangs-FitView holder ikke. */
  function tilpassKamera(rect: DOMRectReadOnly | DOMRect) {
    const viewer = viewerRef.current;
    if (!viewer || rect.width <= 0 || rect.height <= 0) return;
    viewer.SetSize(Math.round(rect.width), Math.round(rect.height));
    const o = viewer.origin;
    const bu = bygningRef.current;
    const cam = viewer.camera;
    if (bu) {
      const uMinX = bu.x0 - o.x, uMaxX = bu.x1 - o.x, uMinY = bu.y0 - o.y, uMaxY = bu.y1 - o.y;
      const margin = Math.max(uMaxX - uMinX, uMaxY - uMinY) * 0.02;
      const width = uMaxX - uMinX + margin * 2;
      const height = uMaxY - uMinY + margin * 2;
      const aspect = rect.width / rect.height;
      let finalWidth = width, finalHeight = height;
      if (finalHeight * aspect > finalWidth) finalWidth = finalHeight * aspect;
      else finalHeight = finalWidth / aspect;
      const cx = (uMinX + uMaxX) / 2, cy = (uMinY + uMaxY) / 2;
      cam.left = -finalWidth / 2; cam.right = finalWidth / 2;
      cam.top = finalHeight / 2; cam.bottom = -finalHeight / 2;
      cam.zoom = 1;
      cam.position.set(cx, cy, 1);
      cam.updateProjectionMatrix();
      if (viewer.controls) { viewer.controls.target.set(cx, cy, 0); viewer.controls.update(); }
    } else {
      // Registeret er ikke lastet ennå (eller ugyldig) — hele DXF-ens extents, samme
      // ramme som FØR registeret svarer.
      const b = viewer.bounds;
      viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y, 0.05);
    }
    if (viewer.controls && fitZoomBaseRef.current) {
      const startBredde = viewer.camera.right - viewer.camera.left;
      const forhold = startBredde / fitZoomBaseRef.current;
      viewer.controls.minZoom = 0.5 * forhold;
      viewer.controls.maxZoom = 50 * forhold;
    }
    viewer.Render();
  }

  useEffect(() => {
    let kansellert = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;
    let dxfBlobUrl: string | null = null;
    let fjernContextLytter: (() => void) | null = null;

    async function last() {
      // Rydd en FORRIGE instans FØR en ny bygges — `last()` kan kalles re-entrant fra
      // `webglcontextrestored` (ikke bare ved et nytt effekt-løp), og uten dette stables
      // flere canvas i samme container (DxfViewer.appendChild fjerner aldri en gammel).
      if (viewer) {
        fjernContextLytter?.();
        fjernContextLytter = null;
        viewer.Destroy?.();
        viewer = null;
        // RETUR 5 (nit, Kontrollør-gate e08784f0): Destroy() frigjør GL-konteksten
        // men fjerner ALDRI canvas-noden fra containeren — uten dette stabler hver
        // re-entrant last()-runde (webglcontextrestored) en ekstra (GL-løs) canvas.
        containerRef.current?.replaceChildren();
      }
      if (dxfBlobUrl) {
        URL.revokeObjectURL(dxfBlobUrl);
        dxfBlobUrl = null;
      }
      setLaster(true);
      setFeil(null);
      setFremdriftProsent(null);
      const el = containerRef.current;
      if (!el) return;
      try {
        // RETUR 4 punkt 1+3: hent fra klient-cache (usignert nøkkel) først; signert URL
        // brukes kun ved bom. Parallelt (ikke sekvensielt som før) — register-fetchen
        // venter ikke på at DXF-parsingen er ferdig.
        const [dxfBlob, registerBlob, workerFactory] = await Promise.all([
          hentFilMedCache(usignertDxfSti, dxfUrlRef.current, (fase, mottatt, total) => {
            if (kansellert) return;
            setFremdriftProsent(fase === "nedlasting" && total ? Math.round((mottatt / total) * 100) : null);
          }),
          hentFilMedCache(usignertRegisterSti, registerWorldUrlRef.current),
          hentDxfWorkerFactory(),
        ]);
        if (kansellert) return;
        dxfBlobUrl = URL.createObjectURL(dxfBlob);
        setFremdriftProsent(null);

        const { DxfViewer } = await import("dxf-viewer");
        viewer = new DxfViewer(el, { autoResize: false, colorCorrection: true, sceneOptions: { wireframeMesh: false } });
        viewerRef.current = viewer;
        bygningRef.current = null;
        fitZoomBaseRef.current = null;

        // RETUR 4 punkt 2: tapt WebGL-kontekst (f.eks. en bakgrunnsfane Chrome reklamerer
        // GPU-minne fra) skal ALDRI gi en stille blank flate. "lost" viser feil+"Prøv
        // igjen"; "restored" laster på nytt automatisk (blobene er alt cachet → raskt).
        const canvas: HTMLCanvasElement | undefined = viewer.canvas;
        if (canvas) {
          const paaContextTapt = (e: Event) => {
            e.preventDefault();
            if (kansellert) return;
            setFeil(t("tegningsvelger.feilWebglKontekstTapt"));
            setLaster(false);
          };
          const paaContextGjenopprettet = () => {
            if (!kansellert) last();
          };
          canvas.addEventListener("webglcontextlost", paaContextTapt, false);
          canvas.addEventListener("webglcontextrestored", paaContextGjenopprettet, false);
          fjernContextLytter = () => {
            canvas.removeEventListener("webglcontextlost", paaContextTapt);
            canvas.removeEventListener("webglcontextrestored", paaContextGjenopprettet);
          };
        }

        // Krav fra GODKJENT-posten (relay/inbox-dokgen-arbeidstegning-f1.md):
        // worker-veien er standard, men en 404/CSP-blokkert bunt skal ALDRI gi
        // blank flate — ett forsøk til på hovedtråden (samme viewer, Load()
        // nullstiller internt via Clear()), med en synlig konsollmelding.
        try {
          await viewer.Load({ url: dxfBlobUrl, fonts: ["/fonts/Arimo.ttf"], workerFactory: workerFactory ?? undefined });
        } catch (workerErr) {
          if (!workerFactory) throw workerErr;
          console.warn("[dxf-viewer] worker-bunt feilet, faller tilbake til hovedtråden", workerErr);
          if (kansellert) return;
          await viewer.Load({ url: dxfBlobUrl, fonts: ["/fonts/Arimo.ttf"] });
        }
        if (kansellert) { viewer.Destroy?.(); return; }
        if (viewer.SetClearColor) viewer.SetClearColor(0xffffff);

        // VEDTAK B: ikke-georeferert DWG vises SOM TEGNET. R=0 ved last; brukerens
        // rotasjonOverstyrt er en REN visningsrotasjon (kamera-up), ikke en ny fit.
        const R = rotasjonOverstyrt ?? 0;
        const rad = (R * Math.PI) / 180;
        viewer.camera.up.set(Math.sin(rad), Math.cos(rad), 0);

        // Mål/sett størrelsen FØR FitView (aspekt-korrekt fit) — kan være 0 her
        // (høyden settes av den delte dashbord-layouten i en annen komponent, se
        // tegningVisningshoyde.ts), ResizeObserveren under retter det opp.
        const initRect = el.getBoundingClientRect();
        if (initRect.width > 0 && initRect.height > 0) {
          viewer.SetSize(Math.round(initRect.width), Math.round(initRect.height));
        }

        // viewer.bounds er RÅ DXF-verdenskoordinater, scenen er origin-forskjøvet —
        // FitView/SetView gjør ingen origin-trekk selv (bekreftet i bunten).
        const b = viewer.bounds, o = viewer.origin;
        viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y, 0.05);
        fitZoomBaseRef.current = viewer.camera.right - viewer.camera.left;

        // Startutsnitt (RETUR, orkestrator 2026-10-13): regnes DIREKTE fra registerets
        // bygningsutstrekning (rutenett ekskludert), IKKE render.py sin SVG-startutsnitt-
        // brøk (annen koordinatramme: rotert/flippet/margin — kun gyldig for SVG-veien).
        const register = JSON.parse(await registerBlob.text());
        if (kansellert) return;
        if (erGyldigRegisterVerden(register)) {
          bygningRef.current = beregnByggUtstrekning(register);
        }
        tilpassKamera(el.getBoundingClientRect());
        setLaster(false);
      } catch (e) {
        if (!kansellert) {
          setFeil(e instanceof Error ? e.message : String(e));
          setLaster(false);
        }
      }
    }
    last();

    // RETUR (orkestrator 2026-10-14): containerens høyde er 0 ved mount (den delte
    // dashbord-layoutens høyde-effekt kjører i en annen komponent og settes FØR denne
    // useEffect-en, men vinduet/panelet kan endre størrelse SENERE — mobilpanel tvunget
    // synlig, vindu resizet, verktøylinje som vokser). Refit på HVER observerte endring,
    // ikke bare ved mount.
    const el = containerRef.current;
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (rect) tilpassKamera(rect);
      });
      ro.observe(el);
    }

    return () => {
      kansellert = true;
      ro?.disconnect();
      fjernContextLytter?.();
      viewer?.Destroy?.();
      if (dxfBlobUrl) URL.revokeObjectURL(dxfBlobUrl);
    };
    // RETUR 4 punkt 1: avhengig av den USIGNERTE stien (stabil for samme fil), ikke
    // dxfUrl/registerWorldUrl (signert på nytt ved hver tRPC-refetch — se filheaderen).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usignertDxfSti, usignertRegisterSti, rotasjonOverstyrt, retryTeller]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {laster && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          {fremdriftProsent !== null
            ? t("tegningsvelger.lasterTegningProsent", { prosent: fremdriftProsent })
            : t("tegningsvelger.lasterTegning")}
        </div>
      )}
      {feil && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-100 p-4 text-center text-red-600">
          <span>{feil}</span>
          <button
            type="button"
            onClick={() => setRetryTeller((n) => n + 1)}
            className="rounded border border-red-300 bg-white px-3 py-1 text-sm text-red-700 hover:bg-red-50"
          >
            {t("handling.provIgjen")}
          </button>
        </div>
      )}
    </div>
  );
}
