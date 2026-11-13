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
      sheetTilleggLocal: [],
      sheetUtleggLocal: [],
      dagsseddelLocal: [],
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
    registrer: vi.fn(async (_p: Record<string, unknown>) => ({ ok: true }) as Record<string, unknown>),
    slettLokaltBilde: vi.fn(async (_s: string) => {}),
    effekter: [] as Array<() => unknown>,
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
  sheetTilleggLocal: H.lagTabell("sheetTilleggLocal"),
  sheetUtleggLocal: H.lagTabell("sheetUtleggLocal"),
  dagsseddelLocal: H.lagTabell("dagsseddelLocal"),
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
  slettLokaltBilde: H.slettLokaltBilde,
}));

vi.mock("../services/bildeRegistrering", () => ({
  registrerBildeIDatabase: H.registrer,
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
  // Effektene samles (kjøres aldri automatisk); funn 2-testene kjører dem eksplisitt.
  useEffect: (fn: () => unknown) => {
    H.effekter.push(fn);
  },
  useMemo: (fn: () => unknown) => fn(),
}));

// Automatisk JSX-runtime: fang elementet så vi kan lese context-verdien.
vi.mock("react/jsx-runtime", () => ({
  jsx: (type: unknown, props: unknown) => ({ type, props }),
  jsxs: (type: unknown, props: unknown) => ({ type, props }),
  Fragment: Symbol.for("Fragment"),
}));

import { OpplastingsKoProvider } from "./OpplastingsKoProvider";
import { varsleKoen } from "../lib/koTrigger";

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

/**
 * Telefontest A funn 2: en timer-kvittering (utlegg/tillegg) regnes ikke som ferdig før serveren
 * har bekreftet den. Før: registreringen ble avfyrt uten `await`, en NOT_FOUND (raden ikke pushet
 * ennå) ble svelget, og køen satte likevel `serverUrl` lokalt og slettet lokalfila — kvitteringen
 * fantes da verken på server eller telefon.
 */
describe.each([
  { type: "utlegg", felt: "sheetUtleggId", tabell: "sheetUtleggVedleggLocal", radTabell: "sheetUtleggLocal" },
  { type: "tillegg", felt: "sheetTilleggId", tabell: "sheetTilleggVedleggLocal", radTabell: "sheetTilleggLocal" },
] as const)("OpplastingsKoProvider — funn 2: $type-kvittering venter på serverens bekreftelse", ({ felt, tabell, radTabell }) => {
  let realSetTimeout: typeof setTimeout;

  beforeEach(() => {
    H.db = H.lagFakeDb();
    H.idTeller.n = 0;
    H.effekter.length = 0;
    H.lastOppFil.mockReset();
    H.lastOppFil.mockImplementation(async () => ({
      fileUrl: "/uploads/privat/k.jpg",
      fileName: "k.jpg",
      fileType: "image/jpeg",
      fileSize: 100,
    }));
    H.registrer.mockReset();
    H.slettLokaltBilde.mockClear();
    realSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation(((
      fn: (...a: unknown[]) => void,
      ms?: number,
    ) => (((ms ?? 0) < 50 ? realSetTimeout(fn, ms) : 0) as unknown)) as typeof setTimeout);
    vi.spyOn(globalThis, "setInterval").mockImplementation((() => 0) as unknown as typeof setInterval);
    H.db._tab[tabell].push({
      id: "kv-1",
      [felt]: "rad-1",
      lokalSti: "/tmp/kv-1.jpg",
      serverUrl: null,
      registrert: null,
      filnavn: "kv-1.jpg",
      mimeType: "image/jpeg",
      sistEndretLokalt: 1,
    });
    // Raden kvitteringen hører til, og sedelen dens, finnes lokalt (ikke pushet ennå).
    H.db._tab[radTabell].push({ id: "rad-1", dagsseddelId: "sedel-1", sistEndretLokalt: 1 });
    H.db._tab.dagsseddelLocal.push({ id: "sedel-1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function start() {
    const element = OpplastingsKoProvider({ children: null }) as { props: { value: KoKontekst } };
    // Kjør effektene (bl.a. abonnementet på køtriggeren).
    for (const fn of H.effekter) fn();
    return element.props.value;
  }

  const oppforing = () => ({
    [felt]: "rad-1",
    objektId: "rad-1",
    vedleggId: "kv-1",
    lokalSti: "/tmp/kv-1.jpg",
    filnavn: "kv-1.jpg",
    mimeType: "image/jpeg",
  });

  it("(a) NOT_FOUND: køen er ikke ferdig, lokal rad har ingen serverUrl og fila står", async () => {
    H.registrer.mockResolvedValue({ ok: false, grunn: "ikke_funnet", status: 404 });
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();

    expect(H.registrer).toHaveBeenCalledTimes(1);
    const ko = H.db!._tab.opplastingsKo[0];
    expect(ko.status).toBe("venter");
    // Opplastingen er gjort — URL-en huskes på køraden så neste forsøk ikke laster opp på nytt.
    expect(ko.serverUrl).toBe("/uploads/privat/k.jpg");
    const lokal = H.db!._tab[tabell][0];
    expect(lokal.serverUrl).toBeNull();
    expect(lokal.lokalSti).toBe("/tmp/kv-1.jpg");
    expect(H.slettLokaltBilde).not.toHaveBeenCalled();
  });

  it("(b) etter push: neste forsøk registrerer uten ny opplasting og fullfører", async () => {
    H.registrer.mockResolvedValueOnce({ ok: false, grunn: "ikke_funnet", status: 404 });
    H.registrer.mockResolvedValue({ ok: true });
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();
    expect(H.db!._tab.opplastingsKo[0].status).toBe("venter");

    // Synken har pushet raden → køen vekkes (backoff nulles).
    varsleKoen();
    await drenér();

    expect(H.lastOppFil).toHaveBeenCalledTimes(1);
    expect(H.registrer).toHaveBeenCalledTimes(2);
    expect(H.registrer.mock.calls[1][0]).toMatchObject({ [felt]: "rad-1", vedleggId: "kv-1", fileUrl: "/uploads/privat/k.jpg" });
    expect(H.db!._tab.opplastingsKo[0].status).toBe("fullfort");
    const lokal = H.db!._tab[tabell][0];
    expect(lokal.serverUrl).toBe("/uploads/privat/k.jpg");
    expect(lokal.registrert).toEqual(expect.any(Number));
    expect(lokal.lokalSti).toBeNull();
    expect(H.slettLokaltBilde).toHaveBeenCalledWith("/tmp/kv-1.jpg");
  });

  // V1 (gate 2026-11-13): 404 for en rad som er slettet (på web → pull fjernet den lokalt) er
  // permanent. Køraden og lokalfila ryddes, ellers prøves kvitteringen for alltid.
  it("V1: 404 og raden finnes ikke lokalt — køraden og lokalfila ryddes, ingen nye forsøk", async () => {
    H.registrer.mockResolvedValue({ ok: false, grunn: "ikke_funnet", status: 404 });
    H.db!._tab[radTabell].length = 0;
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();

    expect(H.registrer).toHaveBeenCalledTimes(1);
    expect(H.db!._tab.opplastingsKo).toHaveLength(0);
    expect(H.slettLokaltBilde).toHaveBeenCalledWith("/tmp/kv-1.jpg");

    varsleKoen();
    await drenér();
    expect(H.registrer).toHaveBeenCalledTimes(1);
    expect(H.lastOppFil).toHaveBeenCalledTimes(1);
  });

  it("V1: 404 og sedelen er slettet lokalt — køraden og lokalfila ryddes", async () => {
    H.registrer.mockResolvedValue({ ok: false, grunn: "ikke_funnet", status: 404 });
    H.db!._tab.dagsseddelLocal.length = 0;
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();

    expect(H.db!._tab.opplastingsKo).toHaveLength(0);
    expect(H.slettLokaltBilde).toHaveBeenCalledWith("/tmp/kv-1.jpg");
  });

  it("V1 negativkontroll: 404 og raden finnes men er ikke pushet — prøves igjen, ingenting ryddes", async () => {
    H.registrer.mockResolvedValue({ ok: false, grunn: "ikke_funnet", status: 404 });
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();
    expect(H.db!._tab.opplastingsKo).toHaveLength(1);
    expect(H.db!._tab.opplastingsKo[0].status).toBe("venter");

    varsleKoen();
    await drenér();
    expect(H.registrer).toHaveBeenCalledTimes(2);
    expect(H.db!._tab.opplastingsKo).toHaveLength(1);
    expect(H.db!._tab.opplastingsKo[0].status).toBe("venter");
    expect(H.slettLokaltBilde).not.toHaveBeenCalled();
  });

  it("hard feil (400) teller mot taket — status feilet, fila står", async () => {
    H.registrer.mockResolvedValue({ ok: false, grunn: "hard", status: 400 });
    const ctx = start();
    await ctx.leggIKo(oppforing());
    await drenér();
    expect(H.db!._tab.opplastingsKo[0].status).toBe("feilet");
    expect(H.db!._tab[tabell][0].serverUrl).toBeNull();
    expect(H.slettLokaltBilde).not.toHaveBeenCalled();
  });
});
