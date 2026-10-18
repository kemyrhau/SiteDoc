// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// SVAR 3 (orkestrator 2026-10-18, relay/inbox-dokgen-arbeidstegning-f1.md): 100 % krasj
// på Kenneths telefon på ALLE tegninger etter at de var cachet (Cache Storage, RETUR 4).
// Rotårsak: ResizeObserver sitt FØRSTE varsel kan lande i vinduet mellom at
// `viewerRef.current` settes (rett etter `new DxfViewer(...)`) og at `viewer.Load()`
// har satt `scene.bounds`/`scene.origin` (async worker-rundtur) — et cache-treff gjør
// vinduet frem til viewer-konstruksjon kort nok at ResizeObserverens engangs-initial-
// varsel ALLTID lander der, i stedet for FØR viewer-instansen i det hele tatt finnes
// (som ved et ferskt nettverks-fetch). Denne testen simulerer nøyaktig det race-
// vinduet uten WebGL/ekte dxf-viewer-bunt — se DxfViewerTegning.tsx sin `tilpassKamera`.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

vi.mock("@/lib/dxfWorkerFactory", () => ({
  // Simulerer en allerede nedlastet/cachet worker-bunt: løses "øyeblikkelig".
  hentDxfWorkerFactory: vi.fn(async () => null),
}));

const REGISTER_JSON = {
  fil: "test.dxf",
  koordsys: "ukjent",
  antallObjekter: 0,
  antallLag: 0,
  antallElid: 0,
  objekter: {},
  elidIndex: {},
  laginventar: [],
};

vi.mock("@/lib/tegningFilCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/tegningFilCache")>();
  return {
    ...actual,
    // SVAR 3 sin hypotese: "øyeblikkelig hentFilMedCache (mock som løser synkront/
    // umiddelbart)" — speiler et varmt cache-treff i Cache Storage.
    hentFilMedCache: vi.fn(async (usignertSti: string) => {
      if (usignertSti.includes("register")) {
        return new Blob([JSON.stringify(REGISTER_JSON)], { type: "application/json" });
      }
      return new Blob(["0\nSECTION\n0\nENDSEC\n0\nEOF\n"], { type: "text/plain" });
    }),
  };
});

// Minimal fake av npm-pakken `dxf-viewer` — ingen WebGL/canvas. `bounds`/`origin` er
// UNDEFINED til testen selv kaller `__fullforLast()` (speiler at ekte DxfViewer.Load()
// setter dem internt FØRST etter worker-rundturen, se node_modules kildekoden).
vi.mock("dxf-viewer", () => {
  const instanser: FakeDxfViewer[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class FakeDxfViewer {
    canvas: HTMLCanvasElement | undefined = undefined;
    controls: unknown = undefined;
    camera = { up: { set: vi.fn() }, right: 1, left: -1 };
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | undefined = undefined;
    origin: { x: number; y: number } | undefined = undefined;
    SetSize = vi.fn();
    FitView = vi.fn();
    Render = vi.fn();
    SetClearColor = vi.fn();
    Destroy = vi.fn();
    private ferdigResolve: (() => void) | null = null;

    constructor() {
      instanser.push(this);
    }

    Load() {
      return new Promise<void>((resolve) => {
        this.ferdigResolve = resolve;
      });
    }

    /** Testhjelper: simulerer at worker-rundturen i Load() er ferdig — ekte bibliotek
     * setter bounds/origin på viewer-objektet FØR det resolver (se DxfViewer.js:242-243). */
    __fullforLast() {
      this.bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
      this.origin = { x: 0, y: 0 };
      this.ferdigResolve?.();
    }
  }

  return { DxfViewer: FakeDxfViewer, __instanser: instanser };
});

import { DxfViewerTegning } from "../DxfViewerTegning";

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let roCallback: ((entries: any[]) => void) | null = null;

beforeEach(() => {
  roCallback = null;
  // jsdom har ingen ResizeObserver (samme stubbing-mønster som
  // tegningVisningshoyde.test.tsx) — her kontrollerbar, så testen selv kan utløse
  // "FØRSTE varsel" akkurat i race-vinduet.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      constructor(cbk: (entries: any[]) => void) {
        roCallback = cbk;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // jsdom mangler createObjectURL/revokeObjectURL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).revokeObjectURL = vi.fn();
});

async function flush(ganger = 12) {
  for (let i = 0; i < ganger; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("DxfViewerTegning — ResizeObserver-varsel midt i Load() (cache-treff-race, SVAR 3)", () => {
  it("ResizeObserver-varsel FØR Load() er ferdig krasjer IKKE (viewer.bounds ennå undefined)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfViewerMock = (await import("dxf-viewer")) as any;

    render(
      <DxfViewerTegning
        dxfUrl="https://x.test/fil.dxf?sig=a"
        registerWorldUrl="https://x.test/fil-register.json?sig=a"
        rotasjonOverstyrt={0}
      />,
    );

    // Flush til viewer-instansen er konstruert (etter cache-hit + dynamic import),
    // men FØR vi lar Load() fullføre — nøyaktig race-vinduet SVAR 3 beskriver.
    await flush();
    expect(dxfViewerMock.__instanser.length).toBe(1);
    const viewer = dxfViewerMock.__instanser[0];
    expect(viewer.bounds).toBeUndefined(); // Load() er fortsatt ikke ferdig

    expect(roCallback).not.toBeNull();
    // Dette er krasjen SVAR 3 målte: uten fiksen leser tilpassKamera() viewer.origin.x
    // på et objekt der viewer.bounds/origin ennå er undefined.
    expect(() => {
      act(() => {
        roCallback!([{ contentRect: { width: 800, height: 600 } } as unknown]);
      });
    }).not.toThrow();

    // Load() fullfører etterpå (worker svarer) — komponenten skal laste helt ferdig
    // uten unntak, og det opprinnelige kamera-fitet (linje ~898 i komponenten) kjører.
    await act(async () => {
      viewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();
    expect(viewer.FitView).toHaveBeenCalled();
  });

  it("samme sekvens uten noe ResizeObserver-varsel (kontroll — alltid vært OK)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfViewerMock = (await import("dxf-viewer")) as any;
    render(
      <DxfViewerTegning
        dxfUrl="https://x.test/fil2.dxf?sig=a"
        registerWorldUrl="https://x.test/fil2-register.json?sig=a"
        rotasjonOverstyrt={0}
      />,
    );
    await flush();
    const viewer = dxfViewerMock.__instanser.at(-1);
    await act(async () => {
      viewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();
    expect(viewer.FitView).toHaveBeenCalled();
  });
});
