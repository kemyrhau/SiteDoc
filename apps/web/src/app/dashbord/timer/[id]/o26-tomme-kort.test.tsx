// @vitest-environment jsdom
/**
 * O26 B (Kenneth 2026-11-26): «det opprettes tomme timelinjer som ikke vises som kladd. Når en
 * timerad slettes -> da må den slettes helt».
 * - Ett tomt kort pr. prosjekt: prosjektet fra «+ Registrer timer» (`nyttProsjekt`) som også
 *   har neste jobb som utkast i skjemaet, står ikke i tillegg som tomt prosjektkort — heller
 *   ikke etter «Gjenåpne».
 * - Slettet er borte: sletter brukeren jobben (eller siste rad), kommer prosjektet ikke tilbake
 *   som tomt kort.
 * Dagen er #7 (`testdata-dag7.ts`), med prosjekt p2 «Hall» uten rader.
 */
import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  sok: "",
  kall: [] as { sti: string; input: Record<string, unknown> }[],
}));

vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ velgFirma: () => {} }),
}));

vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => new URLSearchParams(h.sok),
  usePathname: () => "/dashbord/timer/s1",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

vi.mock("@sitedoc/ui", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {children}
      </div>
    ) : null,
}));

vi.mock("@/kontekst/byggeplass-kontekst", async (importActual) => ({
  ...(await importActual<Record<string, unknown>>()),
  useByggeplass: () => ({ aktivByggeplass: null, standardTegning: null }),
}));

// Mutasjonene kaller `onSuccess` som tRPC gjør etter et vellykket kall.
vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") {
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
            error: null,
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return (opts?: { onSuccess?: (d: unknown, i: unknown) => void }) => {
            const kjor = (input: Record<string, unknown>) => {
              h.kall.push({ sti: key, input });
              opts?.onSuccess?.({}, input);
              return {};
            };
            return {
              mutate: kjor,
              mutateAsync: async (input: Record<string, unknown>) => kjor(input),
              isPending: false,
              reset: () => {},
              error: null,
            };
          };
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

const P2_TITTEL = "2042 — Hall";

function data(sedel: Record<string, unknown>): Record<string, unknown> {
  return {
    ...dag7Data("prosjektkort"),
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Hall", internalProjectNumber: "2042" },
    ],
    "timer.dagsseddel.hentMedId": sedel,
    "timer.dagsseddel.slettKortOversikt": {
      innhold: { timer: 2, reise: 1, maskin: 1, varer: 0, tillegg: 0, utlegg: 0 },
      kanSlettes: true,
      grunn: null,
    },
    "vareforbruk.hentMineForDato": [],
  };
}

const kortHoder = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
const kortFor = (tittel: string) => kortHoder().filter((b) => b.textContent?.includes(tittel));

afterEach(cleanup);

describe("O26 B — ett tomt kort pr. prosjekt", () => {
  it("dagen fantes: «+ Registrer timer» på p2 gir ett kort for p2 (utkastet), ikke også et tomt kort", () => {
    h.sok = "registrer=1&nyttProsjekt=p2&eksisterte=1";
    h.kall = [];
    h.data = data({ ...DAG7_SEDEL });
    render(<Side />);
    expect(screen.getByTestId("jobb-skjema")).toBeTruthy();
    expect(kortFor(P2_TITTEL)).toHaveLength(1);
  });

  it("etter «Gjenåpne»: p2 gir ett kort, ikke tomt kort + utkast", () => {
    h.sok = "registrer=1&nyttProsjekt=p2&eksisterte=1";
    h.kall = [];
    h.data = data({ ...DAG7_SEDEL, status: "sent" });
    const { rerender } = render(<Side />);
    const d = screen.getByRole("dialog", { name: "timer.gjenaapne.bekreftTittel" });
    fireEvent.click(within(d).getByText("timer.gjenaapne.bekreftKnapp"));
    expect(h.kall.some((k) => k.sti === "timer.dagsseddel.gjenaapneDagsseddel")).toBe(true);
    // Serveren har gjenåpnet dagen.
    h.data = data({ ...DAG7_SEDEL, status: "draft" });
    act(() => rerender(<Side />));
    expect(screen.getByTestId("jobb-skjema")).toBeTruthy();
    expect(kortFor(P2_TITTEL)).toHaveLength(1);
  });
});

describe("O26 B — slettet er borte", () => {
  it("«Slett jobben» på prosjektet fra «Ny dagsseddel»: ingen tomme kort etterpå", () => {
    h.sok = "nyttProsjekt=p1";
    h.kall = [];
    const kunJobb1 = <T extends { kortId?: string | null }>(rader: readonly T[]) =>
      rader.filter((r) => r.kortId === "k1");
    h.data = data({
      ...DAG7_SEDEL,
      timer: kunJobb1(DAG7_SEDEL.timer),
      maskiner: kunJobb1(DAG7_SEDEL.maskiner),
      tillegg: kunJobb1(DAG7_SEDEL.tillegg),
      utlegg: kunJobb1(DAG7_SEDEL.utlegg),
    });
    const { rerender } = render(<Side />);
    expect(kortHoder()).toHaveLength(1);
    fireEvent.click(screen.getByTestId("slett-jobben"));
    const d = screen.getByRole("dialog", { name: "timer.slettKort.tittel" });
    fireEvent.click(within(d).getByText("timer.slettKort.knapp"));
    expect(h.kall.filter((k) => k.sti === "timer.dagsseddel.slettKort")).toHaveLength(1);
    // Serveren har slettet jobben: dagen har ingen rader igjen.
    h.data = data({ ...DAG7_SEDEL, timer: [], maskiner: [], tillegg: [], utlegg: [] });
    act(() => rerender(<Side />));
    expect(screen.queryAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))).toHaveLength(0);
  });

  it("siste rad slettet (dagen tømt utenfra): prosjektet kommer ikke tilbake som tomt kort", () => {
    h.sok = "nyttProsjekt=p1";
    h.kall = [];
    h.data = data({ ...DAG7_SEDEL });
    const { rerender } = render(<Side />);
    expect(kortHoder().length).toBeGreaterThan(0);
    h.data = data({ ...DAG7_SEDEL, timer: [], maskiner: [], tillegg: [], utlegg: [] });
    act(() => rerender(<Side />));
    expect(screen.queryAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))).toHaveLength(0);
  });

  it("vakt: «Ny dagsseddel» på et prosjekt uten rader viser fortsatt ett tomt kort", () => {
    h.sok = "nyttProsjekt=p2";
    h.kall = [];
    h.data = data({ ...DAG7_SEDEL });
    render(<Side />);
    expect(kortFor(P2_TITTEL)).toHaveLength(1);
  });
});
