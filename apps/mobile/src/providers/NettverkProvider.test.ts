import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Nettverk-selvheling-runden (2026-09-18, krav 3): bevis at en fastlåst
 * `erPaaNettet=false` blir RETTET av selvhelingen selv om «tilbake online»-
 * hendelsen fra NetInfo aldri kommer.
 *
 * Bakgrunn: NettverkProvider oppdaterte tilstanden KUN via
 * `NetInfo.addEventListener`, som fyrer bare ved endring. En tapt reconnect-
 * hendelse (telefon låst mens nettet skifter) låste `erPaaNettet=false` for
 * godt, og da fryser alt som gater på nettet (opplastingskø, timer-sync, vær).
 *
 * Denne testen er vakthunden: fjerner du selvhelings-effektene i
 * NettverkProvider.tsx (AppState→active-refresh eller offline-intervallet),
 * blir tilstanden stående false og testen faller. Verifisert rød før grønn.
 *
 * Harness: samme node/vitest-konvensjon som mobil-harnessen. React er ikke
 * tilgjengelig som renderer, så vi kjører en LITEN hook-runtime som gjør det
 * nødvendige — indeksert useState/useRef/useCallback + useEffect med
 * deps-sammenligning, cleanup og synkron re-render ved setState. Den EKTE
 * NettverkProvider kjøres; bare React, NetInfo og AppState er byttet. RN-
 * komponenten rendres aldri visuelt.
 */

// --- Delt tilstand for mockene ---------------------------------------------
const H = vi.hoisted(() => ({
  // Fanget av NetInfo/AppState-mockene så testen kan fyre hendelser manuelt.
  netInfoListener: null as ((s: unknown) => void) | null,
  appStateHandler: null as ((s: string) => void) | null,
  appStateCurrent: "active" as string,
  refresh: vi.fn(),
}));

// --- NetInfo-mock ----------------------------------------------------------
vi.mock("@react-native-community/netinfo", () => ({
  default: {
    addEventListener: (fn: (s: unknown) => void) => {
      H.netInfoListener = fn;
      return () => {
        H.netInfoListener = null;
      };
    },
    refresh: H.refresh,
    fetch: H.refresh,
  },
}));

// --- react-native (AppState) -----------------------------------------------
vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return H.appStateCurrent;
    },
    addEventListener: (_type: string, fn: (s: string) => void) => {
      H.appStateHandler = fn;
      return {
        remove: () => {
          H.appStateHandler = null;
        },
      };
    },
  },
}));

// --- Liten hook-runtime i react-mocken -------------------------------------
type Hook = {
  v?: unknown;
  current?: unknown;
  deps?: unknown[] | undefined;
  cleanup?: (() => void) | null;
  nesteFn?: () => void | (() => void);
};

interface Runtime {
  hooks: Record<number, Hook>;
  i: number;
  effektKø: Hook[];
  render: () => { props: { value: unknown } };
  el?: { props: { value: unknown } };
}

let AKTIV: Runtime | null = null;

vi.mock("react", () => ({
  createContext: (def: unknown) => ({ _def: def, Provider: (p: unknown) => p }),
  useContext: () => ({}),
  useState: (init: unknown) => {
    const rt = AKTIV!;
    const i = rt.i++;
    if (!(i in rt.hooks))
      rt.hooks[i] = { v: typeof init === "function" ? (init as () => unknown)() : init };
    const h = rt.hooks[i];
    const setter = (nv: unknown) => {
      const v = typeof nv === "function" ? (nv as (p: unknown) => unknown)(h.v) : nv;
      if (!Object.is(v, h.v)) {
        h.v = v;
        rt.render(); // synkron re-render
      }
    };
    return [h.v, setter];
  },
  useRef: (init: unknown) => {
    const rt = AKTIV!;
    const i = rt.i++;
    if (!(i in rt.hooks)) rt.hooks[i] = { current: init };
    return rt.hooks[i];
  },
  useCallback: (fn: unknown) => fn,
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => {
    const rt = AKTIV!;
    const i = rt.i++;
    const h: Hook = rt.hooks[i] || (rt.hooks[i] = { deps: undefined, cleanup: null });
    const endret =
      h.deps === undefined ||
      !deps ||
      deps.length !== h.deps.length ||
      deps.some((d, k) => !Object.is(d, h.deps![k]));
    h.deps = deps;
    if (endret) {
      h.nesteFn = fn;
      rt.effektKø.push(h);
    }
  },
}));

vi.mock("react/jsx-runtime", () => ({
  jsx: (type: unknown, props: unknown) => ({ type, props }),
  jsxs: (type: unknown, props: unknown) => ({ type, props }),
  Fragment: Symbol.for("Fragment"),
}));

import { NettverkProvider, OFFLINE_REPROBE_MS } from "./NettverkProvider";

// Monter komponenten i runtimen. Effekter kjøres etter hver render; setState
// gir synkron re-render slik at deps-endrede effekter kjører på nytt.
function montér(): Runtime {
  const rt: Runtime = { hooks: {}, i: 0, effektKø: [], render: () => ({ props: { value: null } }) };
  rt.render = () => {
    rt.i = 0;
    rt.effektKø = [];
    AKTIV = rt;
    const el = NettverkProvider({ children: null }) as { props: { value: unknown } };
    AKTIV = null;
    for (const h of rt.effektKø) {
      if (h.cleanup) h.cleanup();
      const c = h.nesteFn!();
      h.cleanup = typeof c === "function" ? c : null;
    }
    rt.el = el;
    return el;
  };
  rt.render();
  return rt;
}

function avmontér(rt: Runtime) {
  for (const k of Object.keys(rt.hooks)) {
    const h = rt.hooks[Number(k)];
    if (h && h.cleanup) h.cleanup();
  }
}

const erPaaNettet = (rt: Runtime) =>
  (rt.el!.props.value as { erPaaNettet: boolean }).erPaaNettet;

const online = { isConnected: true, isInternetReachable: true, type: "wifi" };
const offline = { isConnected: false, isInternetReachable: false, type: "none" };

const drenér = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe("NettverkProvider — selvheling av fastlåst erPaaNettet", () => {
  beforeEach(() => {
    H.netInfoListener = null;
    H.appStateHandler = null;
    H.appStateCurrent = "active";
    H.refresh.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("AppState→active retter en fastlåst offline-tilstand når reconnect-hendelsen aldri kommer", async () => {
    const rt = montér();

    // Etabler offline via en NetInfo-hendelse …
    H.netInfoListener!(online);
    H.netInfoListener!(offline);
    expect(erPaaNettet(rt)).toBe(false);

    // … og så kommer «tilbake online»-hendelsen ALDRI via listeneren.
    // Enheten er reelt online igjen — refresh() vil avsløre det.
    H.refresh.mockResolvedValue(online);

    // Brukeren låser opp telefonen → appen blir aktiv.
    H.appStateHandler!("active");
    await drenér();

    // Uten selvhelingen ville dette fortsatt vært false.
    expect(erPaaNettet(rt)).toBe(true);
    avmontér(rt);
  });

  it("offline-intervallet re-prober og retter tilstanden mens appen står i forgrunn", async () => {
    vi.useFakeTimers();
    const rt = montér();

    H.netInfoListener!(online);
    H.netInfoListener!(offline);
    expect(erPaaNettet(rt)).toBe(false);

    // Reconnect-hendelsen kommer aldri; men enheten er online igjen.
    H.refresh.mockResolvedValue(online);

    // La offline-intervallet fyre én gang (drenerer også løftene).
    await vi.advanceTimersByTimeAsync(OFFLINE_REPROBE_MS + 100);

    expect(erPaaNettet(rt)).toBe(true);
    avmontér(rt);
  });
});
