"use client";

import { useEffect, useRef, useState } from "react";
import { DxfViewerTegning, type DxfViewerTegningRef } from "@/components/tegning/DxfViewerTegning";
import type { TegningVerktoy } from "@sitedoc/shared";

/**
 * Mobil leveranse 1 (arbeidstegning-f1, "SVAR MOBILPLAN" i
 * relay/inbox-orkestrator.md): bar, auth-fri side for å røyketeste
 * `DxfViewerTegning` (ekte produksjonskomponent, ikke en egen harness) inne i
 * React Native sin WKWebView — samme mønster som `/mobil-viewer` (IFC) bruker
 * for RN-WebView-integrasjon. Siden gjør INGEN tRPC-kall selv; RN henter
 * signerte URL-er via tegning.hentForProsjekt (allerede innlogget bruker) og
 * poster dem inn.
 *
 * Kommunikasjon:
 *   Inn (postMessage til vinduet):
 *     { type: "start", dxfUrl: string, registerWorldUrl: string, rotasjonOverstyrt: number | null }
 *     { type: "rapporter" }  — be om siste måling nå
 *     { type: "maleVerktoy", verktoy: "flytt"|"linjal"|"polylinje"|"areal" }  — leveranse 3+4
 *     { type: "maleOrtho", på: boolean }
 *     { type: "maleSnap", på: boolean }
 *     { type: "maleFullfoer" }     — Fullfør (polylinje)
 *     { type: "maleGjenoppta" }    — Fortsett en ferdig måling
 *     { type: "maleSlettAktiv" }
 *     { type: "maleSlettAlle" }
 *
 *   Ut (postMessage fra vinduet — fanges av WebView.onMessage):
 *     { type: "klar" }
 *     { type: "metrics", fps: { median: number, lavest: number }, prøver: number }
 *     { type: "feil", melding: string }
 *     { type: "maleKlar", kanMale: boolean }  — leveranse 3+4: $INSUNITS lest, RN kan
 *                                                sperre/åpne måleknappene
 */

interface StartMelding {
  type: "start";
  dxfUrl: string;
  registerWorldUrl: string;
  rotasjonOverstyrt: number | null;
}

function sendTilApp(data: Record<string, unknown>) {
  try {
    const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } })
      .ReactNativeWebView;
    if (rn) rn.postMessage(JSON.stringify(data));
    window.parent?.postMessage(data, "*");
  } catch {
    /* RN-brua finnes ikke (f.eks. åpnet direkte i Mac-nettleser for feilsøking) */
  }
}

/** Rullerende 2s fps-vindu — median/lavest, uavhengig av DxfViewerTegning sin egen render-loop
 * (dxf-viewer/three.js kjører sin egen rAF; vi måler hovedtrådens faktiske frame-rate). */
function useFpsMaaling() {
  const prøverRef = useRef<number[]>([]);
  useEffect(() => {
    let sisteTid = performance.now();
    let rafId: number;
    function tick(nå: number) {
      const delta = nå - sisteTid;
      sisteTid = nå;
      if (delta > 0) {
        const fps = 1000 / delta;
        const liste = prøverRef.current;
        liste.push(fps);
        // Behold kun siste ~2s (antar ~60fps-tak → 150 prøver er god margin)
        if (liste.length > 150) liste.shift();
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return prøverRef;
}

export default function DxfViewerRøyktest() {
  const [melding, setMelding] = useState<StartMelding | null>(null);
  const prøverRef = useFpsMaaling();
  const viewerRef = useRef<DxfViewerTegningRef>(null);

  useEffect(() => {
    function rapporter() {
      const prøver = [...prøverRef.current].sort((a, b) => a - b);
      const median = prøver.length ? prøver[Math.floor(prøver.length / 2)]! : 0;
      const lavest = prøver.length ? prøver[0]! : 0;
      sendTilApp({
        type: "metrics",
        fps: { median: Math.round(median), lavest: Math.round(lavest) },
        prøver: prøver.length,
      });
    }

    function håndter(e: MessageEvent) {
      // RETUR leveranse 3+4 (Kontrollør, punkt 3): RN-bryggen (iOS WKWebView/Android)
      // injiserer meldingen uten ekte avsender-origin (e.origin === "" på begge
      // plattformer) — det godtas. En EKTE fremmed origin (f.eks. en innbygget
      // cross-origin-underramme som når samme lytter) avvises.
      if (e.origin && e.origin !== window.location.origin) return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "start") {
          setMelding(data as StartMelding);
        } else if (data.type === "rapporter") {
          rapporter();
        } else if (data.type === "maleVerktoy") {
          viewerRef.current?.settVerktoy(data.verktoy as TegningVerktoy);
        } else if (data.type === "maleOrtho") {
          viewerRef.current?.settOrtho(!!data.på);
        } else if (data.type === "maleSnap") {
          viewerRef.current?.settSnap(!!data.på);
        } else if (data.type === "maleFullfoer") {
          viewerRef.current?.fullfoerAktiv();
        } else if (data.type === "maleGjenoppta") {
          viewerRef.current?.gjenopptaAktiv();
        } else if (data.type === "maleSlettAktiv") {
          viewerRef.current?.slettAktiv();
        } else if (data.type === "maleSlettAlle") {
          viewerRef.current?.slettAlle();
        }
      } catch {
        /* Ikke JSON for oss — ignorer */
      }
    }
    // iOS WKWebView poster til window; Android til document. Begge koster lite å lytte på.
    window.addEventListener("message", håndter);
    document.addEventListener("message", håndter as unknown as EventListener);

    function påFeil(e: ErrorEvent) {
      sendTilApp({ type: "feil", melding: e.message });
    }
    window.addEventListener("error", påFeil);

    sendTilApp({ type: "klar" });
    return () => {
      window.removeEventListener("message", håndter);
      document.removeEventListener("message", håndter as unknown as EventListener);
      window.removeEventListener("error", påFeil);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#f3f4f6" }}>
      {melding ? (
        <DxfViewerTegning
          ref={viewerRef}
          dxfUrl={melding.dxfUrl}
          registerWorldUrl={melding.registerWorldUrl}
          rotasjonOverstyrt={melding.rotasjonOverstyrt}
          onMaleKlarEndring={(kanMale) => sendTilApp({ type: "maleKlar", kanMale })}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontFamily: "sans-serif",
          }}
        >
          Venter på tegning-URL fra appen …
        </div>
      )}
    </div>
  );
}
