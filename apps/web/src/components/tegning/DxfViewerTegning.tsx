"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RegisterVerden } from "@sitedoc/shared";
import { erGyldigRegisterVerden } from "@sitedoc/shared";

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

  useEffect(() => {
    let kansellert = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null;

    async function last() {
      setLaster(true);
      setFeil(null);
      const el = containerRef.current;
      if (!el) return;
      try {
        const { DxfViewer } = await import("dxf-viewer");
        // DxfViewers konstruktor overskriver containerens inline style til
        // position:relative UTEN høyde — mål rect FØR konstruksjon (samme funn
        // som harness-v3-compare, spike 0,5b-bildebeviset).
        const rect = el.getBoundingClientRect();
        viewer = new DxfViewer(el, { autoResize: false, colorCorrection: true, sceneOptions: { wireframeMesh: false } });
        await viewer.Load({ url: dxfUrl, fonts: ["/fonts/Arimo.ttf"] });
        if (kansellert) { viewer.Destroy?.(); return; }
        viewer.SetSize(Math.round(rect.width), Math.round(rect.height));
        if (viewer.SetClearColor) viewer.SetClearColor(0xffffff);

        // VEDTAK B: ikke-georeferert DWG vises SOM TEGNET. R=0 ved last; brukerens
        // rotasjonOverstyrt er en REN visningsrotasjon (kamera-up), ikke en ny fit.
        const R = rotasjonOverstyrt ?? 0;
        const rad = (R * Math.PI) / 180;
        viewer.camera.up.set(Math.sin(rad), Math.cos(rad), 0);

        // viewer.bounds er RÅ DXF-verdenskoordinater, scenen er origin-forskjøvet —
        // FitView/SetView gjør ingen origin-trekk selv (bekreftet i bunten).
        const b = viewer.bounds, o = viewer.origin;
        viewer.FitView(b.minX - o.x, b.maxX - o.x, b.minY - o.y, b.maxY - o.y, 0.05);
        const fitZoomBase = viewer.camera.right - viewer.camera.left;

        // Startutsnitt (RETUR, orkestrator 2026-10-13): regnes DIREKTE fra registerets
        // bygningsutstrekning (rutenett ekskludert), IKKE render.py sin SVG-startutsnitt-
        // brøk (annen koordinatramme: rotert/flippet/margin — kun gyldig for SVG-veien).
        const register = await fetch(registerWorldUrl).then((r) => r.json());
        if (kansellert) return;
        if (erGyldigRegisterVerden(register)) {
          const bu = beregnByggUtstrekning(register);
          if (bu) {
            const uMinX = bu.x0 - o.x, uMaxX = bu.x1 - o.x, uMinY = bu.y0 - o.y, uMaxY = bu.y1 - o.y;
            const margin = Math.max(uMaxX - uMinX, uMaxY - uMinY) * 0.02;
            const cam = viewer.camera;
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
          }
          if (viewer.controls) {
            const startBredde = viewer.camera.right - viewer.camera.left;
            const forhold = startBredde / fitZoomBase;
            viewer.controls.minZoom = 0.5 * forhold;
            viewer.controls.maxZoom = 50 * forhold;
          }
        }
        viewer.Render();
        setLaster(false);
      } catch (e) {
        if (!kansellert) {
          setFeil(e instanceof Error ? e.message : String(e));
          setLaster(false);
        }
      }
    }
    last();
    return () => {
      kansellert = true;
      viewer?.Destroy?.();
    };
  }, [dxfUrl, registerWorldUrl, rotasjonOverstyrt]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {laster && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500">
          {t("tegningsvelger.lasterTegning")}
        </div>
      )}
      {feil && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 p-4 text-center text-red-600">
          {feil}
        </div>
      )}
    </div>
  );
}
