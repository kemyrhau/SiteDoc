// @vitest-environment jsdom
/**
 * O8 D (plan § 8.22, Kenneth 2026-11-22) — koblingen i siden: et lagret jobbkort på redigerbar dag
 * har nedtrekk for prosjekt og byggeplass i jobbskjemaet; nytt valg sender `flyttJobb` med kortets
 * id. Sendt dag: ingen nedtrekk. Dagen er #7 (`testdata-dag7.ts`, utkast, jobb k1 og k2).
 * Negativkontroll mot 9919242e: de to første røde, «sendt dag» grønn.
 * Kontrollør 138 vilkår 1: returnert dag med returnerte linjer (timer eller tillegg) har ingen
 * nedtrekk — serveren avviser flyttingen der. Returnert dag med ventende linjer har dem.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
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

function rendre(status = "draft", linjeStatus: { timer?: string; tillegg?: string } = {}) {
  h.sok = "";
  h.kall = [];
  h.feil = {};
  h.svar = { "timer.dagsseddel.flyttJobb": { kortId: "k-ny", antall: 2 } };
  h.data = {
    ...dag7Data("prosjektkort"),
    "timer.dagsseddel.hentMedId": {
      ...DAG7_SEDEL,
      status,
      timer: DAG7_SEDEL.timer.map((r) => ({ ...r, attestertStatus: linjeStatus.timer ?? r.attestertStatus })),
      tillegg: DAG7_SEDEL.tillegg.map((r) => ({ ...r, attestertStatus: linjeStatus.tillegg ?? r.attestertStatus })),
    },
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Bru", internalProjectNumber: "2042" },
    ],
    "bygning.hentForFirma": [{ id: "b2", projectId: "p2", name: "Brukar" }],
  };
  return render(<Side />);
}

const kortHoder = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-expanded") != null);
const aapneForste = () => {
  const k = kortHoder()[0]!;
  if (k.getAttribute("aria-expanded") !== "true") fireEvent.click(k);
};
const vent = () => new Promise((r) => setTimeout(r, 0));

afterEach(cleanup);

describe("O8 D — prosjekt og byggeplass i lagret jobbkort (siden)", () => {
  it("åpent kort har prosjekt-nedtrekk med jobbens prosjekt og firmaets prosjekter", () => {
    rendre();
    aapneForste();
    const skjema = within(screen.getByTestId("jobb-skjema"));
    const velger = skjema.getByRole("combobox", { name: "timer.felt.prosjekt" }) as HTMLSelectElement;
    expect(velger.value).toBe("p1");
    expect(Array.from(velger.options).map((o) => o.value)).toEqual(["p1", "p2"]);
  });

  it("nytt prosjekt flytter jobben: flyttJobb med sedel, kortets id og eneste byggeplass", async () => {
    rendre();
    aapneForste();
    const skjema = within(screen.getByTestId("jobb-skjema"));
    await act(async () => {
      fireEvent.change(skjema.getByRole("combobox", { name: "timer.felt.prosjekt" }), { target: { value: "p2" } });
      await vent();
    });
    const kall = h.kall.filter((k) => k.sti === "timer.dagsseddel.flyttJobb").map((k) => k.input);
    expect(kall).toHaveLength(1);
    expect(kall[0]).toMatchObject({ sheetId: "s1", projectId: "p2", byggeplassId: "b2" });
    expect(["k1", "k2"]).toContain(kall[0]!.kortId);
  });

  it("returnert dag, linjene venter: nedtrekket tilbys", () => {
    rendre("returned");
    aapneForste();
    expect(screen.getByRole("combobox", { name: "timer.felt.prosjekt" })).toBeTruthy();
  });

  it("returnert dag med returnerte timelinjer: ingen nedtrekk (serveren avviser)", () => {
    rendre("returned", { timer: "returnert" });
    aapneForste();
    expect(screen.getByTestId("jobb-skjema")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "timer.felt.prosjekt" })).toBeNull();
  });

  it("returnert tillegg i jobben: ingen nedtrekk", () => {
    rendre("returned", { tillegg: "returnert" });
    aapneForste();
    expect(screen.queryByRole("combobox", { name: "timer.felt.prosjekt" })).toBeNull();
  });

  it("sendt dag: ingen nedtrekk for prosjekt", () => {
    rendre("sent");
    aapneForste();
    expect(screen.queryByRole("combobox", { name: "timer.felt.prosjekt" })).toBeNull();
  });
});

/**
 * O12 pkt 18: jobben flyttes med en reise i kortet → vinduet viser reisens tider og ny kjøretid,
 * med «Flytt reisen med ny tid» / «Slett reisen» / «Avbryt». Ingenting endres før valget.
 */
describe("O12 pkt 18 — flytt jobben med reise", () => {
  const REISE = {
    ...DAG7_SEDEL.timer[0]!,
    id: "rt",
    lonnsartId: "lr",
    aktivitetId: null,
    externalCostObjectId: null,
    fraTid: "06:30",
    tilTid: "07:00",
    timer: "0.5",
    pauseMin: 0,
    beskrivelse: null,
    erReise: true,
    reiseKilde: "manuell",
    reiseRetning: "ut",
    reiseOppmotestedId: "o1",
    kortId: "k1",
  };
  function rendreMedReise(matrise: Array<{ oppmotestedId: string; byggeplassId: string; kjoretidMin: number }>) {
    rendre();
    cleanup();
    h.data = {
      ...h.data,
      "timer.dagsseddel.hentMedId": { ...(h.data["timer.dagsseddel.hentMedId"] as typeof DAG7_SEDEL), timer: [...DAG7_SEDEL.timer, REISE] },
      "oppmotested.hentMatriseForFirma": matrise,
      "oppmotePeriode.hentMine": { perioder: [] },
    };
    render(<Side />);
    aapneForste();
  }
  const flyttKall = () => h.kall.filter((k) => k.sti === "timer.dagsseddel.flyttJobb").map((k) => k.input);
  async function byttTilP2() {
    const skjema = within(screen.getAllByTestId("jobb-skjema")[0]!);
    await act(async () => {
      fireEvent.change(skjema.getByRole("combobox", { name: "timer.felt.prosjekt" }), { target: { value: "p2" } });
      await vent();
    });
  }

  it("vinduet viser gammel og ny tid; ingenting sendes før valget; «Flytt reisen med ny tid» sender tidene", async () => {
    rendreMedReise([{ oppmotestedId: "o1", byggeplassId: "b2", kjoretidMin: 45 }]);
    await byttTilP2();
    const vindu = screen.getByTestId("flytt-reise-vindu");
    expect(flyttKall()).toHaveLength(0);
    expect(within(vindu).getByTestId("flytt-reise-rad").textContent).toContain("06:30–07:00");
    expect(within(vindu).getByTestId("flytt-reise-rad").textContent).toContain("06:15–07:00");
    await act(async () => {
      fireEvent.click(within(vindu).getByRole("button", { name: "timer.jobbSkjema.flyttReise.flytt" }));
      await vent();
    });
    expect(flyttKall()).toHaveLength(1);
    expect(flyttKall()[0]).toMatchObject({
      projectId: "p2",
      byggeplassId: "b2",
      reise: { valg: "flytt", tider: [{ id: "rt", fraTid: "06:15", tilTid: "07:00", kjoretidMin: 45 }] },
    });
  });

  it("«Slett reisen» sender valg slett; «Avbryt» sender ingenting", async () => {
    rendreMedReise([{ oppmotestedId: "o1", byggeplassId: "b2", kjoretidMin: 45 }]);
    await byttTilP2();
    await act(async () => {
      fireEvent.click(within(screen.getByTestId("flytt-reise-vindu")).getByRole("button", { name: "handling.avbryt" }));
      await vent();
    });
    expect(screen.queryByTestId("flytt-reise-vindu")).toBeNull();
    expect(flyttKall()).toHaveLength(0);
    await byttTilP2();
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId("flytt-reise-vindu")).getByRole("button", { name: "timer.jobbSkjema.flyttReise.slett" }),
      );
      await vent();
    });
    expect(flyttKall()).toHaveLength(1);
    expect(flyttKall()[0]).toMatchObject({ projectId: "p2", reise: { valg: "slett" } });
  });

  it("mangler kjøretid: vinduet sier det; flytt beholder de gamle tidene (ingen tider sendt)", async () => {
    rendreMedReise([]);
    await byttTilP2();
    const rad = screen.getByTestId("flytt-reise-rad");
    expect(rad.textContent).toContain("timer.jobbSkjema.flyttReise.utenKjoretid");
    await act(async () => {
      fireEvent.click(
        within(screen.getByTestId("flytt-reise-vindu")).getByRole("button", { name: "timer.jobbSkjema.flyttReise.flytt" }),
      );
      await vent();
    });
    expect(flyttKall()[0]).toMatchObject({ reise: { valg: "flytt", tider: [] } });
  });

  it("negativkontroll: jobb uten reise flyttes uten vindu (som før)", async () => {
    rendre();
    aapneForste();
    await byttTilP2();
    expect(screen.queryByTestId("flytt-reise-vindu")).toBeNull();
    expect(flyttKall()).toHaveLength(1);
    expect(flyttKall()[0]).not.toHaveProperty("reise");
  });
});
