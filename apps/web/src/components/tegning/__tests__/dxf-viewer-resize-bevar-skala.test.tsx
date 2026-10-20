// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// Tillegg pkt 5 (orkestrator 2026-10-20, "«Sett punkt» registrerer ikke trykk
// sikkert"-posten): "utzoomingen ved flytt skjer FORTSATT etter f5d44e8f" — den
// forrige fiksen (webglcontextrestored-kontekst-tap) dekket kun ÉN vei. Den
// ANDRE: ResizeObserveren kalte ALLTID `tilpassKamera()` uten snapshot, som
// bygnings-refitter ved HVER størrelsesendring — også en triviell endring som
// RN-verktøyraden («+ Fortsett / Slett / Slett alle») som vises/forsvinner og
// endrer WebView-høyden. `viewer.SetSize()` (dxf-viewer sin EGEN metode) bevarer
// allerede senter+skala — feilen var at `tilpassKamera` overskrev det igjen.
//
// Denne testen fanger ResizeObserver-callbacken (i stedet for no-op-stubben de
// andre testfilene bruker) og trigger den MANUELT etter at det FØRSTE ekte
// bygnings-fitet har kjørt, med et bbox-register som gjør bygningsfit-grenen i
// `tilpassKamera` (den som overskriver cam.left/right/top/bottom DIREKTE) aktiv.
// Et nytt aspekt-forhold på resize-rect-en ville, med den gamle feilen, gitt NYE
// venstre/høyre/topp/bunn-verdier — med fiksen skal de stå helt uendret, og kun
// `SetSize` kalles.

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, v?: Record<string, unknown>) => (v ? `${k}:${JSON.stringify(v)}` : k),
  }),
}));

vi.mock("@/lib/dxfWorkerFactory", () => ({
  hentDxfWorkerFactory: vi.fn(async () => null),
}));

const REGISTER_MED_BYGG = {
  fil: "test.dxf",
  koordsys: "ukjent",
  antallObjekter: 1,
  antallLag: 0,
  antallElid: 0,
  objekter: { "1": { bbox: [0, 0, 100, 100] } },
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
        return new Blob([JSON.stringify(REGISTER_MED_BYGG)], { type: "application/json" });
      }
      return new Blob([DXF_MED_INSUNITS], { type: "text/plain" });
    }),
  };
});

vi.mock("dxf-viewer", () => {
  const instanser: FakeDxfViewer[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  class FakeDxfViewer {
    canvas: HTMLCanvasElement = document.createElement("canvas");
    canvasWidth = 400;
    canvasHeight = 300;
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
    SetSize = vi.fn((w: number, h: number) => {
      this.canvasWidth = w;
      this.canvasHeight = h;
    });
    FitView = vi.fn();
    Render = vi.fn();
    SetClearColor = vi.fn();
    Subscribe = vi.fn();
    Unsubscribe = vi.fn();
    Destroy = vi.fn();
    private ferdigResolve: (() => void) | null = null;

    constructor() {
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

let roCallback: ((entries: { contentRect: DOMRectReadOnly }[]) => void) | null = null;

beforeEach(() => {
  roCallback = null;
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(cb: (entries: { contentRect: DOMRectReadOnly }[]) => void) {
        roCallback = cb;
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).createObjectURL = vi.fn(() => "blob:fake");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis.URL as any).revokeObjectURL = vi.fn();
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

function rect(width: number, height: number): DOMRectReadOnly {
  return { width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => "" } as DOMRectReadOnly;
}

describe("DxfViewerTegning — ResizeObserver bevarer senter+skala etter første fit (Tillegg pkt 5)", () => {
  it("en resize ETTER at tegningen er lastet kaller KUN SetSize — kamera (bygningsfit-verdiene) er UENDRET", async () => {
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

    const viewer = dxfViewerMock.__instanser[0];
    await act(async () => {
      viewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();

    // Bygningsfiten (REGISTER_MED_BYGG har en gyldig bbox) har satt cam.left/right/
    // top/bottom DIREKTE til aspekt-800×600-spesifikke verdier — fang dem.
    const foerResize = {
      left: viewer.camera.left,
      right: viewer.camera.right,
      top: viewer.camera.top,
      bottom: viewer.camera.bottom,
      zoom: viewer.camera.zoom,
      posX: viewer.camera.position.x,
      posY: viewer.camera.position.y,
    };
    // 1× = den ubetingede full-DXF-fiten rett etter Load() (alltid, uansett register).
    // Bygningsfit-grenen i tilpassKamera (REGISTER_MED_BYGG har en gyldig bbox) setter
    // cam.left/right/top/bottom DIREKTE uten en egen FitView-kall, så den legger ikke
    // til et andre kall (i motsetning til et register UTEN gyldig byggutstrekning).
    expect(viewer.FitView).toHaveBeenCalledTimes(1);
    const fitViewKallFoer = viewer.FitView.mock.calls.length;
    const setSizeKallFoer = viewer.SetSize.mock.calls.length;

    // RN-verktøyraden vises/forsvinner → WebView-høyden endres. ANNET aspektforhold
    // enn 800×600 — en bygnings-refit HER ville gitt NYE venstre/høyre/topp/bunn.
    expect(roCallback).not.toBeNull();
    await act(async () => {
      roCallback!([{ contentRect: rect(800, 500) }]);
    });
    await flush();

    expect(viewer.SetSize).toHaveBeenCalledTimes(setSizeKallFoer + 1);
    expect(viewer.SetSize).toHaveBeenLastCalledWith(800, 500);
    // Det avgjørende: ingen ny bygningsfit — kameraet er BYTE-eksakt likt.
    expect(viewer.FitView).toHaveBeenCalledTimes(fitViewKallFoer);
    expect(viewer.camera.left).toBe(foerResize.left);
    expect(viewer.camera.right).toBe(foerResize.right);
    expect(viewer.camera.top).toBe(foerResize.top);
    expect(viewer.camera.bottom).toBe(foerResize.bottom);
    expect(viewer.camera.zoom).toBe(foerResize.zoom);
    expect(viewer.camera.position.x).toBe(foerResize.posX);
    expect(viewer.camera.position.y).toBe(foerResize.posY);
  });

  it("en resize FØR tegningen er lastet gjør FORTSATT et ekte bygnings-fit (høyde 0 ved mount-racen)", async () => {
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

    // Last() er IKKE ferdig ennå (viewerKlar() usann) — ResizeObserveren skal
    // fortsatt no-op'e trygt (eksisterende guard), ikke krasje.
    expect(roCallback).not.toBeNull();
    await act(async () => {
      roCallback!([{ contentRect: rect(800, 600) }]);
    });
    await flush();
    expect(viewer.SetSize).not.toHaveBeenCalled();

    await act(async () => {
      viewer.__fullforLast();
      await Promise.resolve();
    });
    await flush();
    // Den ordinære last()-fullføringen gjorde den FØRSTE, ekte tilpasningen.
    expect(viewer.camera.left).not.toBe(-1); // default-verdien er overskrevet av bygningsfit
  });
});
