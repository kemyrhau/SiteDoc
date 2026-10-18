// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";

// SVAR 3 (orkestrator 2026-10-18, relay/inbox-dokgen-arbeidstegning-f1.md): 100 % krasj
// på Kenneths telefon på ALLE tegninger etter at de var cachet (Cache Storage, RETUR 4).
// Rotårsak: `viewer.bounds`/`viewer.origin` settes FØRST etter at `viewer.Load()` har
// fullført en async worker-rundtur (node_modules kilde: DxfViewer.js:242-243), mens
// `viewerRef.current` settes RETT ETTER konstruksjon. Et cache-treff (fil + worker-bunt
// begge øyeblikkelige) gjør vinduet frem til viewer-konstruksjon kort nok at alt som
// leser scene/kamera i det vinduet ALLTID treffer det, mot aldri ved et ferskt
// nettverks-fetch (viewer fantes ikke ennå da varselet/effekten kom).
//
// RETUR krasjretting (Kontrollør, orkestrator 2026-10-18): guarden fantes først BARE i
// `tilpassKamera` (ResizeObserver-varselet). `kameraParametre` leser `viewer.origin`
// UTEN guard, og kalles ógså fra `tegnOverlegg()` via en `useEffect` som kjører hver
// gang `mmPrVerdenEnhet` endres — satt fra en `dxfBlob.text().then(...)`-kjede som er
// UAVHENGIG av `Load()`s timing. Andre test under speiler NØYAKTIG det Kontrollør målte
// på `DxfViewerTegning.tsx:161` (`senterX: o.x + cam.position.x`) med en produksjonsform-
// DXF (ekte `$INSUNITS`), uten noe ResizeObserver-varsel i det hele tatt.

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

// Produksjonsform-DXF-header (RETUR krasjretting punkt 2): ekte `$INSUNITS`-gruppekode-
// par (9/$INSUNITS, 70/4), slik en virkelig forenklet DXF fra render.py alltid har —
// IKKE en minimal tom fil. Trigger `setMmPrVerdenEnhet(1)` (insunitsTilMm(4) = 1 mm),
// som får useEffect-en (dep: mmPrVerdenEnhet) til å kalle tegnOverlegg() UAVHENGIG av
// Load()s/ResizeObserverens timing.
const DXF_MED_INSUNITS = ["0", "SECTION", "2", "HEADER", "9", "$INSUNITS", "70", "4", "0", "ENDSEC", "0", "EOF"].join(
  "\n",
);

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
      return new Blob([DXF_MED_INSUNITS], { type: "text/plain" });
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
    camera = { up: { set: vi.fn() }, right: 1, left: -1, top: 1, bottom: -1, zoom: 1, position: { x: 0, y: 0 } };
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

  it("$INSUNITS-triggert tegnOverlegg()/kameraParametre() FØR Load() er ferdig krasjer IKKE (RETUR krasjretting punkt 2)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dxfViewerMock = (await import("dxf-viewer")) as any;
    const onMaleKlarEndring = vi.fn();

    let krasjet: unknown = null;
    try {
      render(
        <DxfViewerTegning
          dxfUrl="https://x.test/fil3.dxf?sig=a"
          registerWorldUrl="https://x.test/fil3-register.json?sig=a"
          rotasjonOverstyrt={0}
          onMaleKlarEndring={onMaleKlarEndring}
        />,
      );
      // Ingen manuell ResizeObserver-triggering her — kun $INSUNITS-lesingen
      // (`dxfBlob.text().then(...)` → setMmPrVerdenEnhet → useEffect → tegnOverlegg()
      // → kameraParametre()) skal drive krasjen Kontrollør målte på linje ~161.
      await flush();
    } catch (e) {
      krasjet = e;
    }
    expect(krasjet).toBeNull();

    const viewer = dxfViewerMock.__instanser.at(-1);
    expect(viewer.bounds).toBeUndefined(); // fortsatt FØR Load() er ferdig
    // Beviser at $INSUNITS-veien faktisk kjørte i dette vinduet (ikke bare at
    // ingenting skjedde): kanMaleVerden(insunitsTilMm(4)=1) => true.
    expect(onMaleKlarEndring).toHaveBeenCalledWith(true);

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
