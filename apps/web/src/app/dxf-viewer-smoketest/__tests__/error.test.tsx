// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

/**
 * RETUR F1+F2 mobil (Kenneth, 2026-10-17): «Application error» i RN sin
 * WebView på ALLE tegninger. Målt (Dokgen, WebKit + RN-stub, reprodusert både
 * med og UTEN stubben): et klientunntak tidlig i DXF/register-innlastingen
 * kastes under Reacts render/commit-fase og når ALDRI `window.onerror`/
 * `unhandledrejection` — `page.tsx` sin egen `påFeil`-lytter er blind for
 * denne klassen, og FØR denne fila fantes hadde RN ingen vei ut (blank
 * WebView, evig "mangler målegrunnlag"-banner). Rød uten `error.tsx`: Next
 * sin rot-feilside har ingen `useEffect` som poster `{type:"feil"}`.
 */

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import DxfViewerSmoketestFeil from "../error";

describe("dxf-viewer-smoketest error.tsx — RN-feilgrense", () => {
  it("poster {type:'feil'} til window.ReactNativeWebView ved et render-unntak", () => {
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView: { postMessage: (s: string) => void } }).ReactNativeWebView = {
      postMessage,
    };

    render(<DxfViewerSmoketestFeil error={new Error("boom")} reset={vi.fn()} />);

    expect(postMessage).toHaveBeenCalledTimes(1);
    const sendt = JSON.parse(postMessage.mock.calls[0]![0] as string);
    expect(sendt).toEqual({ type: "feil", melding: "boom" });
  });

  it("faller tilbake til en generisk melding når unntaket ikke har tekst", () => {
    const postMessage = vi.fn();
    (window as unknown as { ReactNativeWebView: { postMessage: (s: string) => void } }).ReactNativeWebView = {
      postMessage,
    };

    render(<DxfViewerSmoketestFeil error={new Error("")} reset={vi.fn()} />);

    const sendt = JSON.parse(postMessage.mock.calls[0]![0] as string);
    expect(sendt.melding).toBe("Ukjent feil i tegningsvisningen");
  });
});
