// @vitest-environment jsdom
/**
 * Retur O8 tillegg 2 (b) (plan § 8.22 punkt 5, Kenneth 2026-11-22): «Slett jobben» nederst i det
 * åpne jobbkortet sletter ETT feilført kort — bekreftes i samme vindu som «Slett dagen»
 * (`SlettDagModal` med `kortId`), antallene fra `slettKortOversikt`. Bare på redigerbar dag.
 * Dagen er #7 (`testdata-dag7.ts`, utkast, jobb k1 og k2).
 *
 * Negativkontroll mot develop: ingen «Slett jobben» — de 2 første røde; «sendt dag» og vakten for «Slett dagen» grønne (fravær og uendret atferd).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as { sti: string; input: Record<string, unknown> }[],
  feil: {} as Record<string, unknown>,
  /** Svar fra en mutasjon pr. sti (standard `{ id: "ny" }`). */
  svar: {} as Record<string, unknown>,
  velgFirma: vi.fn(),
  sok: "",
}));

vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ velgFirma: h.velgFirma }),
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

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") {
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
            error: opt?.enabled === false ? null : (h.feil[key] ?? null),
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          const logg = (input: Record<string, unknown>) => {
            h.kall.push({ sti: key, input });
            return h.svar[key] ?? { id: "ny" };
          };
          return () => ({
            mutate: logg,
            mutateAsync: async (input: Record<string, unknown>) => logg(input),
            isPending: false,
            reset: () => {},
          });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

function rendre(status = "draft") {
  h.sok = "";
  h.kall = [];
  h.feil = {};
  h.svar = {};
  h.data = {
    ...dag7Data("prosjektkort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, status },
    "timer.dagsseddel.slettKortOversikt": {
      innhold: { timer: 2, reise: 1, maskin: 1, varer: 0, tillegg: 0, utlegg: 0 },
      kanSlettes: true,
      grunn: null,
    },
    "timer.dagsseddel.slettOversikt": {
      innhold: { timer: 4, reise: 1, maskin: 1, varer: 0, tillegg: 1, utlegg: 1 },
      kanSlettes: true,
      grunn: null,
    },
    "vareforbruk.hentMineForDato": [],
  };
  return render(<Side />);
}

const kortHoder = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-expanded") != null);
const aapneForste = () => {
  const k = kortHoder()[0]!;
  if (k.getAttribute("aria-expanded") !== "true") fireEvent.click(k);
};

afterEach(cleanup);

describe("Retur O8 (b) «Slett jobben»", () => {
  it("står bare i det åpne kortet — ett åpent kort, én knapp", () => {
    rendre();
    for (const k of kortHoder()) if (k.getAttribute("aria-expanded") === "true") fireEvent.click(k);
    expect(screen.queryAllByTestId("slett-jobben")).toHaveLength(0);
    aapneForste();
    expect(screen.getAllByTestId("slett-jobben")).toHaveLength(1);
  });

  it("vinduet viser kortets antall; bekreft sletter kortet med sedel-id og kort-id", () => {
    rendre();
    aapneForste();
    fireEvent.click(screen.getByTestId("slett-jobben"));
    const d = screen.getByRole("dialog", { name: "timer.slettKort.tittel" });
    const linjer = Array.from(within(d).getByTestId("slett-dag-innhold").querySelectorAll("li")).map((li) => li.textContent);
    expect(linjer).toEqual(["timer.slettDag.timer2", "timer.slettDag.maskin1", "timer.slettDag.reise1"]);
    fireEvent.click(within(d).getByText("timer.slettKort.knapp"));
    const kall = h.kall.filter((k) => k.sti === "timer.dagsseddel.slettKort").map((k) => k.input);
    expect(kall).toHaveLength(1);
    expect(kall[0]!.id).toBe(DAG7_SEDEL.id);
    expect(["k1", "k2"]).toContain(kall[0]!.kortId);
    expect(h.kall.some((k) => k.sti === "timer.dagsseddel.slett")).toBe(false);
  });

  it("sendt dag: ingen «Slett jobben»", () => {
    rendre("sent");
    aapneForste();
    expect(screen.queryAllByTestId("slett-jobben")).toHaveLength(0);
  });

  it("vakt: «Slett dagen» er uendret — samme vindu, slettOversikt, slett med sedel-id", () => {
    rendre();
    fireEvent.click(screen.getByText("timer.detalj.slett"));
    const d = screen.getByRole("dialog", { name: "timer.slettDag.tittel" });
    fireEvent.click(within(d).getByText("timer.slettDag.knapp"));
    expect(h.kall.filter((k) => k.sti === "timer.dagsseddel.slett").map((k) => k.input)).toEqual([{ id: DAG7_SEDEL.id }]);
    expect(h.kall.some((k) => k.sti === "timer.dagsseddel.slettKort")).toBe(false);
  });
});
