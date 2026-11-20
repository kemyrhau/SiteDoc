// @vitest-environment jsdom
/**
 * w3a (S1–S7): vinduene som åpnes fra en jobb arver prosjekt, byggeplass, underprosjekt og
 * kort-id og viser ikke de feltene. Reise beholder feltene, med jobbens sted forvalgt (S6 A).
 * Dagen er #7 (`testdata-dag7.ts`): jobb 2 (k2) er 15:00–16:00 på TILL-001 (e1).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as { sti: string; input: Record<string, unknown> }[],
}));

vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: null }),
}));

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
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          const logg = (input: Record<string, unknown>) => {
            h.kall.push({ sti: key, input });
            return { id: "ny" };
          };
          return () => ({
            mutate: logg,
            mutateAsync: async (input: Record<string, unknown>) => logg(input),
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

// Byggeplass b1 hører til p1 — jobb 2 står der, så arven er synlig i kallet.
const BYGGEPLASSER = [{ id: "b1", name: "Blokk A", projectId: "p1" }, { id: "b2", name: "Blokk B", projectId: "p1" }];

function rendre(modus = "prosjektkort") {
  const r2 = { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1" };
  h.kall = [];
  h.data = {
    ...dag7Data(modus),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, timer: [DAG7_SEDEL.timer[0]!, r2] },
    "bygning.hentForFirma": BYGGEPLASSER,
  };
  return render(<Side />);
}

/** Åpner jobb 2 (TILL-001) og trykker lenken i lenkeraden. */
function fraJobb2(lenke: string) {
  const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
  fireEvent.click(kort!);
  const lenker = screen.getAllByRole("button", { name: lenke });
  // Bare det åpne kortet viser lenkeraden (S8 A).
  expect(lenker).toHaveLength(1);
  fireEvent.click(lenker[0]!);
  return screen.getByRole("dialog");
}

const STEDSFELT = ["timer.felt.prosjekt", "timer.felt.underprosjekt", "timer.felt.byggeplass", "timer.felt.timerad"];
function utenStedsfelt(dialog: HTMLElement) {
  for (const felt of STEDSFELT) expect(dialog.textContent).not.toContain(felt);
}

describe("w3a — vinduene arver jobben", () => {
  afterEach(cleanup);

  it("«+ Timer»: ingen stedsfelt, raden lagres med jobbens kort-id og sted (S1 A)", async () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    utenStedsfelt(dialog);
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "17:00" } });
    fireEvent.blur(til!);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.length).toBeGreaterThan(0));
    expect(h.kall[0]!.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Maskin»: ingen timerad/sted, koblet til jobbens arbeidsrad med kort-id (S3 A)", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyMaskin");
    utenStedsfelt(dialog);
    // Fra–til foreslås fra jobbens spenn.
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    expect([fra!.value, til!.value]).toEqual(["15:00", "16:00"]);
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(/Gravemaskin G-12/));
    fireEvent.submit(dialog.querySelector("form")!);
    const tilfoy = h.kall.find((k) => k.input.vehicleId === "v1");
    expect(tilfoy?.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      sheetTimerId: "r2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Vare»: ingen prosjekt/timerad/byggeplass, varen følger jobbens første arbeidsrad (S2 A)", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyVareKort");
    utenStedsfelt(dialog);
    fireEvent.change(dialog.querySelector("select")!, { target: { value: "va1" } });
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.prosjektkort.vareLagre" }));
    expect(h.kall.at(-1)?.input).toMatchObject({
      projectId: "p1",
      vareId: "va1",
      antall: 3,
      kortId: "k2",
      sheetTimerId: "r2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Tillegg/Utlegg» → tillegg: stedet arves og kort-id sendes", () => {
    rendre();
    fraJobb2("timer.prosjektkort.leggTil");
    fireEvent.click(screen.getByText("Smusstillegg"));
    const dialog = screen.getByRole("dialog");
    utenStedsfelt(dialog);
    fireEvent.submit(dialog.querySelector("form")!);
    expect(h.kall.at(-1)?.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Reise»: feltene står, med jobbens byggeplass og underprosjekt forvalgt (S6 A)", () => {
    rendre();
    h.data["organisasjon.hentArbeidstidDefaults"] = {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
    };
    h.data["timer.lonnsart.list"] = [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ];
    cleanup();
    render(<Side />);
    const dialog = fraJobb2("timer.prosjektkort.nyReise");
    const verdier = Array.from(dialog.querySelectorAll("select")).map((s) => s.value);
    expect(verdier).toContain("b1");
    expect(verdier).toContain("e1");
  });

  it("blyanten på jobbens timerlinje åpner vinduet uten stedsfelt (S7 A)", () => {
    rendre();
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    fireEvent.click(screen.getAllByTitle("handling.rediger")[0]!);
    utenStedsfelt(screen.getByRole("dialog"));
  });

  it("dagskort-modus: «Legg til timer-rad» har prosjekt- og underprosjektfeltet som før (S4 C)", () => {
    rendre("dagskort");
    fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyTimer/ })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("timer.felt.prosjekt");
    expect(dialog.textContent).toContain("timer.felt.underprosjekt");
  });
});
