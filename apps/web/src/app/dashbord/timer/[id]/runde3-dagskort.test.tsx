// @vitest-environment jsdom
/**
 * Runde 3 timer (2026-11-27, Kenneth: «ingen varelager og maskiner» i dagskort-modus → «Ja, egen
 * runde»): dagskortet får «+ Maskin» pr. bøtte og «+ Vare» pr. prosjektgruppe — samme vinduer som
 * prosjektkortet, prosjektet låst til gruppen. Uten arbeid ingen knapp (som prosjektkortet).
 * Dagens varer vises i gruppen. Dagen er #7 (`testdata-dag7.ts`): bøtte uten underprosjekt (r1,
 * 7,5 t) og TILL-001 (r2, 1 t, gravemaskin 1 t koblet), en vare på r2.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as Array<{ sti: string; input: unknown }>,
}));

vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ velgFirma: () => {} }) }));
vi.mock("@/kontekst/prosjekt-kontekst", () => ({ useProsjekt: () => ({ prosjektId: null }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => new URLSearchParams(),
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
            error: null,
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({
            mutate: (input: unknown) => h.kall.push({ sti: key, input }),
            mutateAsync: async () => ({}),
            isPending: false,
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

type Rad = Record<string, unknown>;

function rendre(over: { sedel?: Rad; data?: Record<string, unknown> } = {}) {
  cleanup();
  h.kall = [];
  h.data = {
    ...dag7Data("dagskort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, ...over.sedel },
    ...over.data,
  };
  return render(<Side />);
}

const knapper = (navn: string) => screen.queryAllByRole("button", { name: new RegExp(navn) });

afterEach(cleanup);

describe("VAKTTEST 2026-11-27 (Kenneth: «ok» pkt 1–3 + «merge runde 3 nå», runde 3) — Runde 3 — dagskortet får «+ Maskin» og «+ Vare»", () => {
  it("én «+ Maskin» pr. bøtte med arbeid og én «+ Vare» pr. prosjektgruppe", () => {
    rendre();
    expect(knapper("timer.detalj.tilfoyMaskin")).toHaveLength(2);
    expect(knapper("timer.detalj.tilfoyVare")).toHaveLength(1);
  });

  it("dagens vare vises i gruppen", () => {
    rendre();
    expect(screen.getByText("timer.detalj.varer")).toBeTruthy();
    expect(screen.getAllByText(/Pukk 6-32/).length).toBeGreaterThan(0);
  });

  it("uten arbeid (bare reise) er det ingen knapp — som prosjektkortet", () => {
    rendre({
      sedel: {
        timer: [{ ...DAG7_SEDEL.timer[0]!, erReise: true }],
        maskiner: [],
        tillegg: [],
        utlegg: [],
      },
      data: { "vareforbruk.hentMineForDato": [] },
    });
    expect(knapper("timer.detalj.tilfoyMaskin")).toHaveLength(0);
    expect(knapper("timer.detalj.tilfoyVare")).toHaveLength(0);
  });

  it("uten Varelager på prosjektet: «+ Maskin», men ingen «+ Vare»", () => {
    rendre({
      data: {
        "vareforbruk.katalogForFirma": { varer: [], prosjektIderMedVarelager: [] },
        "vareforbruk.hentMineForDato": [],
      },
    });
    expect(knapper("timer.detalj.tilfoyMaskin")).toHaveLength(2);
    expect(knapper("timer.detalj.tilfoyVare")).toHaveLength(0);
  });

  it("sendt dag: ingen knapper, varen vises fortsatt", () => {
    rendre({ sedel: { status: "sent" } });
    expect(knapper("timer.detalj.tilfoyMaskin")).toHaveLength(0);
    expect(knapper("timer.detalj.tilfoyVare")).toHaveLength(0);
    expect(screen.getAllByText(/Pukk 6-32/).length).toBeGreaterThan(0);
  });

  it("vare lagret fra dagskortet havner på gruppens prosjekt og timeradens underprosjekt", () => {
    rendre();
    fireEvent.click(knapper("timer.detalj.tilfoyVare")[0]!);
    const vindu = screen.getByRole("dialog", { name: "vareforbruk.modal.opprett" });
    // Prosjektet er låst (tekst, ikke velger).
    expect(within(vindu).getByText("2041 — Skole")).toBeTruthy();
    const [timerad, vare] = within(vindu).getAllByRole("combobox");
    fireEvent.change(timerad!, { target: { value: "r2" } });
    fireEvent.change(vare!, { target: { value: "va1" } });
    fireEvent.change(within(vindu).getByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(within(vindu).getByRole("button", { name: "timer.prosjektkort.vareLagre" }));
    const opprett = h.kall.find((k) => k.sti === "vareforbruk.opprett");
    expect(opprett?.input).toMatchObject({
      projectId: "p1",
      vareId: "va1",
      antall: 3,
      externalCostObjectId: "e1",
      dagsseddelId: "s1",
      sheetTimerId: "r2",
    });
  });

  it("«+ Maskin» åpner maskinvinduet med bøttens underprosjekt; maskin ≤ arbeid sperrer", () => {
    rendre();
    // Bøtte 2 = TILL-001: 1 t arbeid, gravemaskinen har alt 1 t.
    fireEvent.click(knapper("timer.detalj.tilfoyMaskin")[1]!);
    const vindu = screen.getByRole("dialog", { name: "timer.detalj.tilfoyMaskin" });
    const valg = within(vindu).getAllByRole("combobox") as HTMLSelectElement[];
    expect(valg.some((s) => s.value === "e1")).toBe(true);
    const lagre = within(vindu).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
    expect(lagre.disabled).toBe(true);
  });
});
