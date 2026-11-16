// @vitest-environment jsdom
/**
 * Web `ByggeplassProvider` — ORDRE (18) RETUR vilkår 1, (20) og (22) «husk siste valg».
 *
 * (22): ny innsjekk → sist valgte → «Velg byggeplass» (null). Aldri «første»; gammel
 * streng-verdi fra før (22) i lageret leses som intet valg. Nyeste hendelse vinner.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prosjektId: "A" as string | null,
  lister: {} as Record<string, { id: string; name: string; number: number }[]>,
  lager: {} as Record<string, string>,
  brukerminne: [] as { projectId: string; nokkel: string; verdi: string; oppdatert: string }[],
  psi: false,
  status: null as null | { byggeplassId: string | null; innsjekkTid: string },
}));

vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: h.prosjektId }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashbord",
}));
vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        if (navn === "useQuery") {
          const key = sti.join(".");
          return (input?: { projectId?: string }, opt?: { enabled?: boolean }) => {
            if (opt?.enabled === false) return { data: undefined, isLoading: false };
            if (key === "bygning.hentForProsjekt") {
              return { data: h.lister[input?.projectId ?? ""], isLoading: false };
            }
            if (key === "brukerinnstilling.hent") return { data: h.brukerminne, isLoading: false };
            if (key === "modul.hentForProsjekt") {
              return { data: h.psi ? [{ moduleSlug: "psi", status: "aktiv" }] : [], isLoading: false };
            }
            if (key === "mannskap.minStatus") return { data: h.status, isLoading: false };
            return { data: undefined, isLoading: false };
          };
        }
        if (navn === "useMutation") return () => ({ mutate: () => {}, mutateAsync: async () => {} });
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import { ByggeplassProvider, useByggeplass } from "../byggeplass-kontekst";

/** Lest legacy-data: strengen eldre versjoner lagret (før TILLEGG (22)). */
const UTGAATT = "__hele_prosjektet__";

const NOKKEL = "sitedoc-aktiv-bygning";
type Kontekst = ReturnType<typeof useByggeplass>;
let siste: Kontekst | null = null;

function Leser() {
  siste = useByggeplass();
  return null;
}
const tre = () => (
  <ByggeplassProvider>
    <Leser />
  </ByggeplassProvider>
);
const lagret = (): Record<string, unknown> => JSON.parse(h.lager[NOKKEL] ?? "{}");
const T0 = Date.parse("2026-11-15T07:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();

beforeEach(() => {
  h.lager = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => h.lager[k] ?? null,
    setItem: (k: string, v: string) => {
      h.lager[k] = v;
    },
    removeItem: (k: string) => {
      delete h.lager[k];
    },
  });
  h.lister = {
    A: [{ id: "a1", name: "A1", number: 1 }],
    B: [
      { id: "b1", name: "B1", number: 1 },
      { id: "b2", name: "B2", number: 2 },
    ],
    C: [],
  };
  h.brukerminne = [];
  h.psi = false;
  h.status = null;
  siste = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("(18) vilkår 1 — valg i annet prosjekt overskrives ikke", () => {
  it("velg B2 i prosjekt B fra prosjekt A → B2 står etter prosjektbyttet", () => {
    h.prosjektId = "A";
    h.lager[NOKKEL] = JSON.stringify({ A: { id: "a1", name: "A1", number: 1 } });
    const { rerender } = render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("a1");

    // Som KontekstChip: lagre for B, deretter bytt prosjekt (B-lista ligger i cachen).
    act(() => siste!.velgByggeplass({ id: "b2", name: "B2", number: 2 }, "B"));
    h.prosjektId = "B";
    rerender(tre());

    expect(siste?.aktivByggeplass?.id).toBe("b2");
    expect((lagret().B as { id: string }).id).toBe("b2");
  });
});

describe("(22) aldri gjett — «Velg byggeplass»", () => {
  // Negativkontroll mot gammel atferd (A1 (c) «første»): uten valg og innsjekk → null.
  it("uten lagret valg og innsjekk: ingen byggeplass (ikke første)", () => {
    h.prosjektId = "B";
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
    expect(siste?.harByggeplasser).toBe(true);
    expect(siste?.byggeplasserLastet).toBe(true);
    expect("B" in lagret()).toBe(false);
  });

  it("gammel streng-verdi fra før (22) i lageret leses som intet valg", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: UTGAATT });
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
    expect(siste?.opprettByggeplass).toBeNull();
  });

  it("lagret byggeplass som ikke finnes i prosjektet → ingen byggeplass", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "borte", name: "Borte", number: 9 } });
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
  });

  it("prosjekt uten byggeplasser: harByggeplasser false, ingen valg", () => {
    h.prosjektId = "C";
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
    expect(siste?.harByggeplasser).toBe(false);
    expect(siste?.byggeplasserLastet).toBe(true);
  });
});

describe("(22) husk siste valg", () => {
  it("lagret valg i nettleseren gjelder etter last og følger nye dokumenter", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b2", name: "B2", number: 2, tid: T0 } });
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
    expect(siste?.opprettByggeplass?.id).toBe("b2");
  });

  it("eldre lagringsformat uten tid leses fortsatt", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b2", name: "B2", number: 2 } });
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
  });

  it("brukerminnet (annen enhet) brukes når nettleseren ikke har valg", () => {
    h.prosjektId = "B";
    h.brukerminne = [{ projectId: "B", nokkel: "sistBruktByggeplass", verdi: JSON.stringify("b2"), oppdatert: iso(T0) }];
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
    expect(siste?.opprettByggeplass?.id).toBe("b2");
  });

  it("nyeste av nettleser og brukerminne vinner", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b1", name: "B1", number: 1, tid: T0 } });
    h.brukerminne = [{ projectId: "B", nokkel: "sistBruktByggeplass", verdi: JSON.stringify("b2"), oppdatert: iso(T0 + 60_000) }];
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
  });

  // Negativkontroll: eldre brukerminne slår ikke nyere lokalt valg.
  it("negativkontroll: eldre brukerminne taper mot nyere lokalt valg", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b1", name: "B1", number: 1, tid: T0 + 60_000 } });
    h.brukerminne = [{ projectId: "B", nokkel: "sistBruktByggeplass", verdi: JSON.stringify("b2"), oppdatert: iso(T0) }];
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b1");
  });

  it("eget valg lagres med tid og følger nye dokumenter", () => {
    h.prosjektId = "B";
    render(tre());
    expect(siste?.opprettByggeplass).toBeNull();
    act(() => siste!.velgByggeplass({ id: "b1", name: "B1", number: 1 }));
    expect(siste?.aktivByggeplass?.id).toBe("b1");
    expect(siste?.opprettByggeplass?.id).toBe("b1");
    const rad = lagret().B as { id: string; tid: number };
    expect(rad.id).toBe("b1");
    expect(typeof rad.tid).toBe("number");
  });
});

describe("(22) innsjekk — nyeste hendelse vinner", () => {
  it("ny innsjekk på annen byggeplass åpner den", () => {
    h.prosjektId = "B";
    h.psi = true;
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b1", name: "B1", number: 1, tid: T0 } });
    h.status = { byggeplassId: "b2", innsjekkTid: iso(T0 + 60_000) };
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
    // Innsjekk-avledet filter setter ikke byggeplass på nye dokumenter (kun eget valg).
    expect(siste?.opprettByggeplass).toBeNull();
  });

  it("eget valg etter innsjekken står til neste innsjekk", () => {
    h.prosjektId = "B";
    h.psi = true;
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b1", name: "B1", number: 1, tid: T0 + 120_000 } });
    h.status = { byggeplassId: "b2", innsjekkTid: iso(T0 + 60_000) };
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b1");
  });

  it("innsjekk uten noe lagret valg gir byggeplassen", () => {
    h.prosjektId = "B";
    h.psi = true;
    h.status = { byggeplassId: "b2", innsjekkTid: iso(T0) };
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
  });

  // Negativkontroll: PSI ikke aktiv → innsjekk brukes ikke (minStatus kalles ikke).
  it("negativkontroll: PSI av → innsjekk ignoreres", () => {
    h.prosjektId = "B";
    h.psi = false;
    h.status = { byggeplassId: "b2", innsjekkTid: iso(T0) };
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
  });
});
