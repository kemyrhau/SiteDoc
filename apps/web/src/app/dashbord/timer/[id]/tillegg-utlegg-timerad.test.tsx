// @vitest-environment jsdom
/**
 * Runde 6 timer (Kenneth 2026-11-27: «Varer, utlegg, tillegg som registreres og maskintimer, disse
 * må knyttes til menneskets timer · reisetid og knyttes til prosjekt»; «disse endringene gjelder
 * dagskort. Ikke rør prosjektkort registreringen»). Dagskortets tillegg- og utleggsvindu får
 * «Timerad»: prosjektets arbeid og reise, forvalgt når det er én, radens egen ved redigering.
 * Lagre krever valg; «Legg til» kommer med første timerad. Uten timerader (prosjektkort / fra en
 * jobb) ingen velger og payload som før. Dag #7 (`testdata-dag7.ts`): r1 og r2 på p1.
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
const dialog = () => screen.getByRole("dialog");
const lagre = () => within(dialog()).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
const velger = () => within(dialog()).getByTestId("timerad-velger") as HTMLSelectElement;

function nyttTillegg() {
  fireEvent.click(knapper("timer.detalj.leggTil")[0]!);
  fireEvent.click(within(dialog()).getByText("Smusstillegg"));
}
function nyttUtlegg() {
  fireEvent.click(knapper("timer.detalj.leggTil")[0]!);
  fireEvent.click(within(dialog()).getByText("Parkering"));
}
function redigerTillegg() {
  const li = screen.getByText("Smusstillegg").closest("li")!;
  fireEvent.click(within(li as HTMLElement).getByTitle("handling.rediger"));
}

afterEach(cleanup);

describe("Runde 6 — tillegg og utlegg på timerad i dagskortet", () => {
  it("nytt tillegg: velgeren viser prosjektets timerader, Lagre venter på valg, valget sendes", () => {
    rendre();
    nyttTillegg();
    const v = velger();
    expect(Array.from(v.options).map((o) => o.value)).toEqual(["", "r1", "r2"]);
    expect(v.value).toBe("");
    expect(lagre().disabled).toBe(true);
    fireEvent.change(v, { target: { value: "r2" } });
    expect(lagre().disabled).toBe(false);
    fireEvent.click(lagre());
    const kall = h.kall.find((k) => k.sti === "timer.dagsseddel.tilfoyTilleggRad");
    expect(kall?.input).toMatchObject({ projectId: "p1", tilleggId: "ti1", sheetTimerId: "r2" });
  });

  it("nytt utlegg: samme velger, valget sendes", () => {
    rendre();
    nyttUtlegg();
    fireEvent.change(velger(), { target: { value: "r1" } });
    fireEvent.click(lagre());
    const kall = h.kall.find((k) => k.sti === "timer.dagsseddel.tilfoyUtleggRad");
    expect(kall?.input).toMatchObject({ projectId: "p1", expenseCategoryId: "c1", sheetTimerId: "r1" });
  });

  it("redigering: radens egen timerad er valgt og sendes med", () => {
    rendre({ sedel: { tillegg: [{ ...DAG7_SEDEL.tillegg[0]!, sheetTimerId: "r1" }] } });
    redigerTillegg();
    expect(velger().value).toBe("r1");
    fireEvent.click(lagre());
    const kall = h.kall.find((k) => k.sti === "timer.dagsseddel.oppdaterTilleggRad");
    expect(kall?.input).toMatchObject({ id: "t1", sheetTimerId: "r1" });
  });

  it("én timerad i prosjektet: forvalgt; reise vises som reise; erstattet rad er ikke med", () => {
    const [r1, r2] = DAG7_SEDEL.timer;
    rendre({
      sedel: {
        timer: [
          { ...r1!, erReise: true, fraTid: "06:20", tilTid: "07:00", timer: "0.67" },
          { ...r2!, attestertStatus: "erstattet" },
        ],
        maskiner: [],
      },
    });
    nyttTillegg();
    const v = velger();
    expect(Array.from(v.options).map((o) => o.value)).toEqual(["", "r1"]);
    expect(v.value).toBe("r1");
    expect(v.options[1]!.textContent).toContain("timer.timeradValg.reise");
    expect(lagre().disabled).toBe(false);
  });

  it("prosjekt uten timerad: ingen «Legg til» under tillegg og utlegg", () => {
    rendre({ sedel: { timer: [], maskiner: [] }, data: { "vareforbruk.hentMineForDato": [] } });
    expect(screen.getByText("Smusstillegg")).toBeTruthy();
    expect(knapper("timer.detalj.leggTil")).toHaveLength(0);
  });
});
