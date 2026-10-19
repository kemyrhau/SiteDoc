// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// RETUR `ee884ff8` pkt 1 (INNSNEVRET, orkestrator 2026-10-19): "tegningen zoomer ut
// plutselig, som om noe oppdateres" under "Flytt punkt" på telefon. Rotårsak bevist mot
// ekte WebKit på test.sitedoc.no (WEBGL_lose_context mot den virkelige canvas-en):
// `webglcontextrestored` kaller `last()` re-entrant (uendret, eksisterende atferd),
// `hentFraTegningCache` treffer (stille, ingen nettverkskall — se skjermbildene i
// relay/inbox-orkestrator.md), og FØR denne fiksen satte `tilpassKamera()` kameraet
// TILBAKE til bygnings-fit — brukerens pågående panorament/zoom ble kastet uten varsel.
// Denne testen dekker nøyaktig den re-entrante stien: viewer.canvas fyrer det ekte
// DOM-eventet `webglcontextrestored`, samme vei produksjonskoden selv lytter på.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

vi.mock("@/lib/dxfWorkerFactory", () => ({
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

const DXF_MED_INSUNITS = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "EOF"].join(
  "\n",
);

vi.mock("@/lib/tegningFilCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/tegningFilCache")>();
  return {
    ...actual,
    hentFilMedCache: vi.fn(async (usignertSti: string) => {
      if (usignertSti.includes("register")) {
        return new Blob([JSON.stringify(REGISTER_JSON)], { type: "application/json" });
      }
      return new Blob([DXF_MED_INSUNITS], { type: "text/plain" });
    }),
  };
});

// Samme fake som dxf-viewer-cache-race.test.tsx, utvidet med en EKTE canvas-node —
// produksjonskoden lytter på `viewer.canvas.addEventListener("webglcontextrestored", …)`,
// og uten en ekte DOM-node (bare `undefined`) er den lytteren aldri satt opp.
vi.mock("dxf-viewer", () => {
  const instanser: FakeDxfViewer[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class FakeDxfViewer {
    canvas: HTMLCanvasElement = document.createElement("canvas");
    controls = { target: { set: vi.fn() }, update: vi.fn(), minZoom: 0, maxZoom: 0, enablePan: false };
    camera = {
      up: { set: vi.fn() },
      right: 1,
      left: -1,
      top: 1,
      bottom: -1,
      zoom: 1,
      position: { x: 0, y: 0, set: vi.fn() },
      updateProjectionMatrix: vi.fn(),
    };
    bounds: { minX: number; minY: number; maxX: number; maxY: number } | undefined = undefined;
    origin: { x: number; y: number } | undefined = undefined;
    SetSize = vi.fn();
    FitView = vi.fn();
    Render = vi.fn();
    SetClearColor = vi.fn();
    Subscribe = vi.fn();
    Unsubscribe = vi.fn();
    Destroy = vi.fn();
    private ferdigResolve: (() => void) | null = null;

    constructor() {
      // `cam.position.set(x, y, z)` i produksjonskoden må faktisk SKRIVE x/y, ikke
      // bare registrere kallet — speil en minimal, ekte settlogikk (ikke en ren spy).
      const cam = this.camera;
      cam.position.set = vi.fn((x: number, y: number) => {
        cam.position.x = x;
        cam.position.y = y;
      });
      instanser.push(this);
    }

    Load() {
      return new Promise<void>((resolve) => {
        this.ferdigResolve = resolve;
      });
    }

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

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).revokeObjectURL = vi.fn();
  // jsdom-elementer er 0×0 som default — `last()` kaller `tilpassKamera(el.getBounding-
  // ClientRect())` direkte (ikke via ResizeObserver), og uten dette hopper guarden
  // (`rect.width <= 0`) over akkurat den koden testen skal dekke.
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => "",
  } as DOMRect);
});

async function flush(ganger = 12) {
  for (let i = 0; i < ganger; i++) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await Promise.resolve();
    });
  }
}

describe("DxfViewerTegning — kamera overlever en stille webglcontextrestored-reload (RETUR ee884ff8 pkt 1)", () => {
  it("panorert kamera gjenopprettes EKSAKT etter re-entrant last(), ikke et nytt bygnings-fit", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfViewerMock = (await import("dxf-viewer")) as any;

    render(
      <DxfViewerTegning
        dxfUrl="https://x.test/fil.dxf?sig=a"
        registerWorldUrl="https://x.test/fil-register.json?sig=a"
        rotasjonOverstyrt={0}
      />,
    );
    await flush();

    expect(dxfViewerMock.__instanser.length).toBe(1);
    const forsteViewer = dxfViewerMock.__instanser[0];
    await act(async () => {
      forsteViewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();
    // 2×: den ubetingede full-DXF-fiten rett etter Load() (linje ~1277) + tilpassKamera()
    // sin egen FitView-fallback (REGISTER_JSON har ingen gyldig bygningsutstrekning her).
    expect(forsteViewer.FitView).toHaveBeenCalledTimes(2);

    // Brukeren panorerer/zoomer (samme effekt som et "Flytt punkt"-drag ville gitt).
    forsteViewer.camera.left = -40;
    forsteViewer.camera.right = 40;
    forsteViewer.camera.top = 25;
    forsteViewer.camera.bottom = -25;
    forsteViewer.camera.zoom = 3.5;
    forsteViewer.camera.position.x = 123;
    forsteViewer.camera.position.y = 456;

    // GPU-kontekst tapt og gjenopprettet — EKTE DOM-event på canvas-en, samme vei
    // produksjonskoden selv lytter på (ikke et direkte funksjonskall).
    await act(async () => {
      forsteViewer.canvas.dispatchEvent(new Event("webglcontextrestored"));
      await Promise.resolve();
    });
    await flush();

    expect(dxfViewerMock.__instanser.length).toBe(2); // last() kjørte re-entrant
    expect(forsteViewer.Destroy).toHaveBeenCalled(); // gammel instans ryddet

    const andreViewer = dxfViewerMock.__instanser[1];
    await act(async () => {
      andreViewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();

    // Det avgjørende: et NYTT bygnings-fit ville satt FitView på nytt og null-stilt
    // kameraet til aspektberegnede verdier — i stedet skal nøyaktig det panorerte
    // kameraet stå igjen.
    expect(andreViewer.camera.left).toBe(-40);
    expect(andreViewer.camera.right).toBe(40);
    expect(andreViewer.camera.top).toBe(25);
    expect(andreViewer.camera.bottom).toBe(-25);
    expect(andreViewer.camera.zoom).toBe(3.5);
    expect(andreViewer.camera.position.x).toBe(123);
    expect(andreViewer.camera.position.y).toBe(456);
  });

  it("FØRSTE last av en tegning får uendret bygnings-/DXF-fit (ingen gjenopprettet kamera å forveksle med)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfViewerMock = (await import("dxf-viewer")) as any;
    render(
      <DxfViewerTegning
        dxfUrl="https://x.test/fil-ny.dxf?sig=a"
        registerWorldUrl="https://x.test/fil-ny-register.json?sig=a"
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
    expect(viewer.FitView).toHaveBeenCalledTimes(2);
  });
});
