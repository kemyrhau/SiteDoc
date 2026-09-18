import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Kø-frys-runden (2026-09-18, krav 3): bevis at mutex-flagget `prosessererRef`
 * ALLTID frigis når en opplasting kaster — slik at neste oppføring i køen
 * faktisk prosesseres etterpå.
 *
 * Bakgrunn: `prosesserNeste()` satte flagget true på ETT sted og nullstilte det
 * på ÅTTE steder manuelt uten `finally`. Krav 2 samlet nullstillingen i én
 * `finally`. Denne testen er kravets vakthund: fjerner du `finally`-linja
 * (`prosessererRef.current = false`) i `OpplastingsKoProvider.tsx`, blir flagget
 * stående true etter at den første opplastingen kaster, det rekursive kallet
 * returnerer umiddelbart på guarden, og oppføring nr. 2 blir ALDRI forsøkt →
 * `lastOppFil` kalles bare 1 gang og testen faller. Verifisert rød før grønn.
 *
 * Harness: samme node/vitest-konvensjon som resten av mobil-harnessen. React er
 * ikke tilgjengelig som renderer her, så hooks byttes ut med rene funksjoner og
 * SQLite-laget byttes ut med en liten in-memory fake som speiler nøyaktig de
 * drizzle-kjedene køen bruker. Den EKTE `prosesserNeste` kjøres — bare drivere
 * rundt den er byttet (samme prinsipp som at api-testene bytter serveren, ikke
 * logikken). RN-komponenten rendres aldri.
 */

// --- Delt tilstand som de hoistede mock-fabrikkene leser -------------------
const H = vi.hoisted(() => {
  // Ekte klasse så `feil instanceof OpplastingFeil` i koden treffer.
  class OpplastingFeil extends Error {
    kategori: "nett" | "hard";
    constructor(melding: string, kategori: "nett" | "hard") {
      super(melding);
      this.name = "OpplastingFeil";
      this.kategori = kategori;
    }
  }

  // Predikat-evaluator for de eq/or/and/lt-descriptorene drizzle-mocken lager.
  type Pred =
    | { op: "eq"; col: string; val: unknown }
    | { op: "lt"; col: string; val: number }
    | { op: "or"; parts: Pred[] }
    | { op: "and"; parts: Pred[] }
    | null;
  const evalPred = (rad: Record<string, unknown>, pred: Pred): boolean => {
    if (!pred) return true;
    switch (pred.op) {
      case "eq":
        return rad[pred.col] === pred.val;
      case "lt":
        return (rad[pred.col] as number) < pred.val;
      case "or":
        return pred.parts.some((p) => evalPred(rad, p));
      case "and":
        return pred.parts.every((p) => evalPred(rad, p));
      default:
        return true;
    }
  };

  // Minimal in-memory SQLite-erstatning: implementerer nøyaktig fluent-kjedene
  // `prosesserNeste`/`leggIKo`/`oppdaterTellere` bruker. Filtre tolkes via evalPred.
  const lagFakeDb = () => {
    const tab: Record<string, Array<Record<string, unknown>>> = {
      opplastingsKo: [],
      sjekklisteFeltdata: [],
      oppgaveFeltdata: [],
      sheetTilleggVedleggLocal: [],
      sheetUtleggVedleggLocal: [],
    };
    const rader = (t: { _tabell: string }) => tab[t._tabell];
    return {
      _tab: tab,
      select() {
        return {
          from(t: { _tabell: string }) {
            let pred: Pred = null;
            let ascCol: string | null = null;
            const q = {
              where(p: Pred) {
                pred = p;
                return q;
              },
              orderBy(o: { op: string; col: string } | undefined) {
                if (o && o.op === "asc") ascCol = o.col;
                return q;
              },
              limit() {
                return q;
              },
              all() {
                let r = rader(t).filter((x) => evalPred(x, pred));
                if (ascCol) {
                  const col = ascCol;
                  r = [...r].sort(
                    (a, b) =>
                      ((a[col] as number) ?? 0) - ((b[col] as number) ?? 0),
                  );
                }
                return r;
              },
            };
            return q;
          },
        };
      },
      update(t: { _tabell: string }) {
        let obj: Record<string, unknown> = {};
        let pred: Pred = null;
        const q = {
          set(o: Record<string, unknown>) {
            obj = o;
            return q;
          },
          where(p: Pred) {
            pred = p;
            return q;
          },
          run() {
            rader(t).forEach((x) => {
              if (evalPred(x, pred)) Object.assign(x, obj);
            });
          },
        };
        return q;
      },
      delete(t: { _tabell: string }) {
        let pred: Pred = null;
        const q = {
          where(p: Pred) {
            pred = p;
            return q;
          },
          run() {
            const arr = rader(t);
            const beholdt = arr.filter((x) => !evalPred(x, pred));
            arr.length = 0;
            arr.push(...beholdt);
          },
        };
        return q;
      },
      insert(t: { _tabell: string }) {
        let obj: Record<string, unknown> = {};
        const q = {
          values(o: Record<string, unknown>) {
            obj = o;
            return q;
          },
          run() {
            rader(t).push({ ...obj });
          },
        };
        return q;
      },
    };
  };

  // Tabell-markører: hvert kolonneoppslag gir { _tabell, _col } som drizzle-mocken leser.
  const lagTabell = (navn: string) =>
    new Proxy(
      { _tabell: navn },
      {
        get(_t, prop) {
          if (prop === "_tabell") return navn;
          return { _tabell: navn, _col: String(prop) };
        },
      },
    );

  return {
    OpplastingFeil,
    lagFakeDb,
    lagTabell,
    db: null as ReturnType<typeof lagFakeDb> | null,
    lastOppFil: vi.fn(),
    idTeller: { n: 0 },
  };
});

// --- Mocks -----------------------------------------------------------------
vi.mock("../db/schema", () => ({
  opplastingsKo: H.lagTabell("opplastingsKo"),
  sjekklisteFeltdata: H.lagTabell("sjekklisteFeltdata"),
  oppgaveFeltdata: H.lagTabell("oppgaveFeltdata"),
  sheetTilleggVedleggLocal: H.lagTabell("sheetTilleggVedleggLocal"),
  sheetUtleggVedleggLocal: H.lagTabell("sheetUtleggVedleggLocal"),
}));

vi.mock("../db/database", () => ({ hentDatabase: () => H.db }));

vi.mock("drizzle-orm", () => ({
  eq: (c: { _col: string }, v: unknown) => ({ op: "eq", col: c._col, val: v }),
  lt: (c: { _col: string }, v: number) => ({ op: "lt", col: c._col, val: v }),
  or: (...p: unknown[]) => ({ op: "or", parts: p }),
  and: (...p: unknown[]) => ({ op: "and", parts: p }),
  asc: (c: { _col: string }) => ({ op: "asc", col: c._col }),
}));

vi.mock("../services/opplasting", () => ({
  lastOppFil: H.lastOppFil,
  OpplastingFeil: H.OpplastingFeil,
}));

vi.mock("../services/lokalBilde", () => ({
  slettLokaltBilde: vi.fn(async () => {}),
}));

vi.mock("../services/bildeRegistrering", () => ({
  registrerBildeIDatabase: vi.fn(async () => {}),
  patchVedleggUrl: vi.fn(async () => true),
}));

vi.mock("./NettverkProvider", () => ({
  useNettverk: () => ({ erPaaNettet: true, tilkoblingstype: null }),
}));

vi.mock("../config/auth", () => ({ AUTH_CONFIG: { apiUrl: "http://test" } }));

vi.mock("expo-crypto", () => ({
  randomUUID: () => `ko-${H.idTeller.n++}`,
}));

vi.mock("expo-file-system/legacy", () => ({
  getInfoAsync: vi.fn(async () => ({ exists: true })),
}));

// Hooks byttes ut med rene funksjoner (rendres bare én gang → refs er stabile).
vi.mock("react", () => ({
  createContext: (def: unknown) => ({ _def: def, Provider: (props: unknown) => props }),
  useContext: () => ({}),
  useState: (init: unknown) => [typeof init === "function" ? (init as () => unknown)() : init, () => {}],
  useRef: (init: unknown) => ({ current: init }),
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useMemo: (fn: () => unknown) => fn(),
}));

// Automatisk JSX-runtime: fang elementet så vi kan lese context-verdien.
vi.mock("react/jsx-runtime", () => ({
  jsx: (type: unknown, props: unknown) => ({ type, props }),
  jsxs: (type: unknown, props: unknown) => ({ type, props }),
  Fragment: Symbol.for("Fragment"),
}));

import { OpplastingsKoProvider } from "./OpplastingsKoProvider";

interface KoKontekst {
  leggIKo: (o: Record<string, unknown>) => Promise<void>;
}

const basisOppforing = (vedleggId: string) => ({
  sjekklisteId: "sjl-1",
  objektId: "obj-1",
  vedleggId,
  lokalSti: `/tmp/${vedleggId}.jpg`,
  filnavn: `${vedleggId}.jpg`,
  mimeType: "image/jpeg",
});

// Drenér mikro- + makro-tasks så hele den rekursive await-kjeden får kjøre.
const drenér = async () => {
  for (let i = 0; i < 40; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
};

describe("OpplastingsKoProvider — mutex-flagget frigis alltid", () => {
  let realSetTimeout: typeof setTimeout;

  beforeEach(() => {
    H.db = H.lagFakeDb();
    H.idTeller.n = 0;
    H.lastOppFil.mockReset();
    // La korte tidsavbrudd (drenér sitt setTimeout(0)) gå gjennom, men slipp
    // IKKE køens backoff-planlegging (≥500ms) — den ville etterlatt en dinglende
    // timer etter testen. Vi trenger den ikke for å bevise invarianten.
    realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: (...a: unknown[]) => void,
      ms?: number,
    ) => (((ms ?? 0) < 50 ? realSetTimeout(fn, ms) : 0) as unknown)) as typeof setTimeout);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prosesserer neste oppføring etter at den første opplastingen kaster", async () => {
    // Første opplasting kaster (hard feil), resten lykkes.
    H.lastOppFil
      .mockImplementationOnce(async () => {
        throw new H.OpplastingFeil("simulert opplastingsfeil midt i kjeden", "hard");
      })
      .mockImplementation(async () => ({
        fileUrl: "https://srv/opp/f.jpg",
        fileName: "f.jpg",
        fileType: "image/jpeg",
        fileSize: 100,
      }));

    const element = OpplastingsKoProvider({ children: null }) as {
      props: { value: KoKontekst };
    };
    const ctx = element.props.value;

    // Legg to bilder i kø. Første leggIKo trigger prosessering (flagget settes);
    // andre ser flagget true og trigger ikke på nytt — den drives av rekursjonen.
    await ctx.leggIKo(basisOppforing("item1"));
    await ctx.leggIKo(basisOppforing("item2"));

    await drenér();

    const ko = H.db!._tab.opplastingsKo;
    const r1 = ko.find((r) => r.vedleggId === "item1");
    const r2 = ko.find((r) => r.vedleggId === "item2");

    // Kjernebeviset: BEGGE ble forsøkt → flagget ble frigitt mellom dem.
    // Uten `finally` blir flagget stående true og dette er 1, ikke 2.
    expect(H.lastOppFil).toHaveBeenCalledTimes(2);
    expect(r2?.status).toBe("fullfort");
    expect(r1?.status).toBe("feilet");
  });
});
