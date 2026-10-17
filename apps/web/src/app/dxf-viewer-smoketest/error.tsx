"use client";

import { useEffect } from "react";
import { sendTilApp } from "./send-til-app";

/**
 * RETUR F1+F2 mobil (Kenneth, 2026-10-17): «Application error» i RN sin WebView
 * på ALLE tegninger. Målt (Dokgen, WebKit + `window.ReactNativeWebView`-stub,
 * også reprodusert UTEN stubben — altså en pre-eksisterende race i
 * `DxfViewerTegning`/dxf-viewer-innlastingen, ikke RN-spesifikk): et
 * klientunntak tidlig i DXF/register-innlastingen (før `maleKlar`/
 * `laginventarKlar` når å sende) kastes under Reacts render/commit-fase — det
 * når ALDRI `window.onerror`/`unhandledrejection` (verifisert: ingen av dem
 * trigges), så `page.tsx` sin egen `påFeil`-lytter er blind for denne klassen.
 * Next sin DEFAULT rot-feilside («Application error …») vises i stedet — i RN
 * blir det en blank WebView uten noen vei ut.
 *
 * Denne segment-feilgrensen (`app/dxf-viewer-smoketest/error.tsx`, Next App
 * Router) FANGER render/commit-unntak som ikke når window-nivå, og sender
 * samme `{type:"feil"}`-melding RN allerede vet å tolke (`DxfViewerTegningMobil`
 * → `onLastFeil` → SVG-fallback). Retter ikke selve race-en i dxf-viewer-
 * innlastingen (egen sak) — gir bare brukeren en vei ut i stedet for en blank
 * flate.
 */
export default function DxfViewerSmoketestFeil({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    sendTilApp({ type: "feil", melding: error.message || "Ukjent feil i tegningsvisningen" });
  }, [error]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#f3f4f6",
        fontFamily: "sans-serif",
        color: "#374151",
        padding: 24,
        textAlign: "center",
      }}
    >
      <p>Kunne ikke vise tegningen.</p>
      <button
        type="button"
        onClick={reset}
        style={{
          borderRadius: 8,
          border: "1px solid #d1d5db",
          background: "#fff",
          padding: "8px 16px",
          fontSize: 13,
        }}
      >
        Prøv igjen
      </button>
    </div>
  );
}
