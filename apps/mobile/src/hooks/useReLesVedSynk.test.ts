import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * FUNN 2026-10-06 (gate krav 1): re-les-signalet som får timer-skjermene til å
 * vise «synced» uten at skjermen får fokus på nytt.
 *
 * Det finnes ingen RTL/komponent-render-harness i mobil-appen (kun vitest +
 * sql.js). En full render av `[id].tsx`/dag-lista drar inn drizzle, trpc,
 * expo-router og et titalls underkomponenter — upraktisk å mocke for å teste ÉN
 * effekt. Signalet er derfor ekstrahert til den delte hooken `useReLesVedSynk`,
 * og testes her ISOLERT mot den EKTE hooken (ikke en re-implementasjon).
 *
 * Harness: samme lille hook-runtime som `NettverkProvider.test.ts` — indeksert
 * useRef + useEffect med deps-sammenligning, cleanup, og en manuell `render()`
 * som driver (sistSynkronisert, reLes) som «props». React er byttet; hooken er
 * ekte.
 */

type Hook = {
  current?: unknown;
  deps?: unknown[] | undefined;
  cleanup?: (() => void) | null;
  nesteFn?: () => void | (() => void);
};
interface Runtime {
  hooks: Record<number, Hook>;
  i: number;
  effektKø: Hook[];
}
let AKTIV: Runtime | null = null;

vi.mock("react", () => ({
  useRef: (init: unknown) => {
    const rt = AKTIV!;
    const i = rt.i++;
    if (!(i in rt.hooks)) rt.hooks[i] = { current: init };
    return rt.hooks[i];
  },
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

import { useReLesVedSynk } from "./useReLesVedSynk";

// Uppercase-navn så rules-of-hooks godtar hook-kallet (samme grep som
// NettverkProvider.test.ts, som kaller provideren direkte). Returnerer null —
// hooken har ingen render-utgang.
function Harness({ sist, reLes }: { sist: number | null; reLes: () => void }) {
  useReLesVedSynk(sist, reLes);
  return null;
}

/** Monter + driv hooken. `render` kaller harness-komponenten og kjører effekt-køen. */
function lagRuntime() {
  const rt: Runtime = { hooks: {}, i: 0, effektKø: [] };
  return {
    render(sist: number | null, reLes: () => void) {
      rt.i = 0;
      rt.effektKø = [];
      AKTIV = rt;
      Harness({ sist, reLes });
      AKTIV = null;
      for (const h of rt.effektKø) {
        if (h.cleanup) h.cleanup();
        const c = h.nesteFn!();
        h.cleanup = typeof c === "function" ? c : null;
      }
    },
  };
}

/** Spion typet som () => void (vi.fn() alene gir en konstruerbar type TS avviser). */
const lagSpion = () => vi.fn(() => {});

describe("useReLesVedSynk — re-les når synken fullfører", () => {
  let reLes: ReturnType<typeof lagSpion>;
  beforeEach(() => {
    reLes = lagSpion();
  });

  it("🔴 kjører IKKE reLes ved første render (useFocusEffect har alt lest)", () => {
    const rt = lagRuntime();
    rt.render(1000, reLes); // synken kan alt ha fullført før mount
    expect(reLes).not.toHaveBeenCalled();
  });

  it("🔴 kjører reLes når sistSynkronisert endrer seg (synk fullført)", () => {
    const rt = lagRuntime();
    rt.render(1000, reLes); // mount
    rt.render(2000, reLes); // en synk fullførte → bump
    expect(reLes).toHaveBeenCalledTimes(1);
  });

  it("dekker null → tall (aldri synket før skjermen åpnet)", () => {
    const rt = lagRuntime();
    rt.render(null, reLes); // mount, aldri synket
    rt.render(1000, reLes); // første synk fullfører
    expect(reLes).toHaveBeenCalledTimes(1);
  });

  it("fyrer IKKE på en re-render der sistSynkronisert er uendret, selv med ny reLes-identitet", () => {
    // Kallstedene sender ofte en inline-closure (ny funksjon hver render). Lå den
    // i deps ville effekten fyrt hver render; ref-mønsteret hindrer det.
    const rt = lagRuntime();
    rt.render(1000, reLes); // mount
    rt.render(1000, lagSpion()); // re-render, uendret bump, ANNEN closure
    expect(reLes).not.toHaveBeenCalled();
  });

  it("bruker den FERSKESTE reLes når signalet endrer seg (ref, ikke stale)", () => {
    const rt = lagRuntime();
    const gammel = lagSpion();
    const ny = lagSpion();
    rt.render(1000, gammel); // mount
    rt.render(1000, ny); // re-render uten bump → ingen fyring, men ref oppdateres
    rt.render(2000, ny); // bump → skal kalle den FERSKE (ny), ikke gammel
    expect(gammel).not.toHaveBeenCalled();
    expect(ny).toHaveBeenCalledTimes(1);
  });
});
