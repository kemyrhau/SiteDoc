// @vitest-environment jsdom
/**
 * ORDRE 2026-11-15 (18) RETUR — GATE (42) vilkår 1 og 3 (web `ByggeplassProvider`).
 *
 * 1. Byggeplass valgt i et annet prosjekt (KontekstChip: lagre for prosjekt B, så bytt
 *    prosjekt) skal stå. A1-standardvalget skal ikke overskrive det før lagret valg for B
 *    er lest inn.
 * 3. Prosjekt med 0 byggeplasser: resten fjernes uten sentinel — «Hele prosjektet» lagres
 *    bare ved eget trykk.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  prosjektId: "A" as string | null,
  lister: {} as Record<string, { id: string; name: string; number: number }[]>,
  lager: {} as Record<string, string>,
  brukerminne: [] as { projectId: string; nokkel: string; verdi: string }[],
}));

vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: h.prosjektId }),
}));
vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ valgtFirma: { id: "f1" } }),
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
import { HELE_PROSJEKTET_VALG } from "@sitedoc/shared";

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
  siste = null;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("vilkår 1 — valg i annet prosjekt overskrives ikke", () => {
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

  // Negativkontroll: uten lagret valg for B gjelder standardvalget fortsatt (c) første.
  it("negativkontroll: uten lagret valg for B velges første byggeplass", () => {
    h.prosjektId = "A";
    h.lager[NOKKEL] = JSON.stringify({ A: { id: "a1", name: "A1", number: 1 } });
    const { rerender } = render(tre());
    h.prosjektId = "B";
    rerender(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b1");
  });
});

describe("vilkår 3 — 0 byggeplasser lagres ikke som «Hele prosjektet»", () => {
  it("prosjekt uten byggeplasser med rest i lageret → nøkkelen fjernes, ingen sentinel", () => {
    h.prosjektId = "C";
    h.lager[NOKKEL] = JSON.stringify({ C: { id: "borte", name: "Borte", number: 9 } });
    render(tre());
    expect(siste?.aktivByggeplass).toBeNull();
    expect(siste?.erHeleProsjektet).toBe(false);
    expect("C" in lagret()).toBe(false);
  });

  it("får prosjektet byggeplasser senere, gjelder standardvalget", () => {
    h.prosjektId = "C";
    h.lager[NOKKEL] = JSON.stringify({ C: { id: "borte", name: "Borte", number: 9 } });
    const { rerender } = render(tre());
    h.lister.C = [{ id: "c1", name: "C1", number: 1 }];
    rerender(tre());
    expect(siste?.aktivByggeplass?.id).toBe("c1");
  });

  // Negativkontroll: eget trykk på «Hele prosjektet» lagrer fortsatt sentinel og huskes.
  it("negativkontroll: eget trykk på «Hele prosjektet» lagrer sentinel", () => {
    h.prosjektId = "B";
    render(tre());
    act(() => siste!.velgByggeplass(null));
    expect(lagret().B).toBe(HELE_PROSJEKTET_VALG);
    expect(siste?.erHeleProsjektet).toBe(true);
    expect(siste?.aktivByggeplass).toBeNull();
  });
});

/**
 * ORDRE 2026-11-15 (20) punkt 1: nye dokumenter får lagret/eget valg, ellers ingen byggeplass —
 * aldri A1-forvalget (c) «første». Velgeren (aktivByggeplass) viser fortsatt forvalget.
 */
describe("(20) opprettByggeplass — ingen gjett", () => {
  it("uten lagret valg: velgeren viser første, nye dokumenter får ingen byggeplass", () => {
    h.prosjektId = "B";
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b1");
    expect(siste?.opprettByggeplass).toBeNull();
    expect(siste?.opprettTegning).toBeNull();
    // Forvalget lagres ikke — ellers leses gjettet neste gang som lagret valg.
    expect("B" in lagret()).toBe(false);
  });

  it("lagret valg i nettleseren følger med nye dokumenter", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: { id: "b2", name: "B2", number: 2 } });
    render(tre());
    expect(siste?.opprettByggeplass?.id).toBe("b2");
  });

  it("sist brukt fra brukerminnet følger med nye dokumenter", () => {
    h.prosjektId = "B";
    h.brukerminne = [{ projectId: "B", nokkel: "sistBruktByggeplass", verdi: JSON.stringify("b2") }];
    render(tre());
    expect(siste?.aktivByggeplass?.id).toBe("b2");
    expect(siste?.opprettByggeplass?.id).toBe("b2");
  });

  it("eget valg i velgeren etter forvalget følger med nye dokumenter", () => {
    h.prosjektId = "B";
    render(tre());
    expect(siste?.opprettByggeplass).toBeNull();
    act(() => siste!.velgByggeplass({ id: "b1", name: "B1", number: 1 }));
    expect(siste?.opprettByggeplass?.id).toBe("b1");
    expect((lagret().B as { id: string }).id).toBe("b1");
  });

  it("«Hele prosjektet» valgt → ingen byggeplass", () => {
    h.prosjektId = "B";
    h.lager[NOKKEL] = JSON.stringify({ B: HELE_PROSJEKTET_VALG });
    render(tre());
    expect(siste?.opprettByggeplass).toBeNull();
  });
});
