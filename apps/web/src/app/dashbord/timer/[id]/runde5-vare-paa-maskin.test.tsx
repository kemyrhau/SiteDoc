// @vitest-environment jsdom
/**
 * Runde 5 timer (2026-11-27): vare på maskinen (vedtak A) + flere varer i maskinvinduet.
 * Dagen er #7 (`testdata-dag7.ts`), dagskort-modus: bøtte uten underprosjekt (r1, 7,5 t) og TILL-001 (r2, 1 t, gravemaskin G-12 1 t).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, DAG7_VARER, dag7Data } from "./testdata-dag7";

const DAG7_VARER_0 = () => ({ ...DAG7_VARER[0]!, sheetMachineId: null as string | null });

type Kall = { sti: string; input: Record<string, unknown> };
type MutOpt = { onSuccess?: (d: unknown) => void; onError?: (e: { message: string }) => void };

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as Kall[],
  /** Mutasjoner som feiler (sti → melding). */
  feiler: {} as Record<string, string>,
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
          // Kaller onSuccess/onError (hook og kall) så kjeden maskin → vare kan måles.
          return (hookOpt?: MutOpt) => ({
            mutate: (input: Record<string, unknown>, kallOpt?: MutOpt) => {
              h.kall.push({ sti: key, input });
              const feil = h.feiler[key];
              if (feil) {
                hookOpt?.onError?.({ message: feil });
                kallOpt?.onError?.({ message: feil });
              } else {
                hookOpt?.onSuccess?.({ id: "ny" });
                kallOpt?.onSuccess?.({ id: "ny" });
              }
            },
            // Runde 5: maskinvinduet sender varelinjene med mutateAsync (samme logg og feil).
            mutateAsync: async (input: Record<string, unknown>) => {
              h.kall.push({ sti: key, input });
              const feil = h.feiler[key];
              if (feil) throw new Error(feil);
              return { id: "ny" };
            },
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

function rendre(over: { sedel?: Record<string, unknown>; data?: Record<string, unknown> } = {}) {
  cleanup();
  h.kall = [];
  h.feiler = {};
  h.data = {
    ...dag7Data("dagskort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, ...over.sedel },
    "modul.effektivTilstand": { maskin: true },
    ...over.data,
  };
  return render(<Side />);
}

afterEach(cleanup);

const KATALOG = {
  varer: [
    { id: "va1", navn: "Pukk 6-32", enhet: "m3", varenummer: null },
    { id: "va2", navn: "Bærelag 0-32", enhet: "tonn", varenummer: null },
  ],
  prosjektIderMedVarelager: ["p1"],
};

/** Bøtte 2 (TILL-001, r2, 1 t) uten maskiner, så maskin 1 t er lovlig. Fyller maskinvinduet. */
function nyMaskin() {
  rendre({ sedel: { maskiner: [] }, data: { "vareforbruk.katalogForFirma": KATALOG } });
  fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyMaskin/ })[1]!);
  const vindu = screen.getByRole("dialog", { name: "timer.detalj.tilfoyMaskin" });
  fireEvent.click(within(vindu).getByRole("button", { name: /timer\.velgUtstyr/ }));
  fireEvent.click(within(vindu).getByRole("button", { name: /Gravemaskin G-12/ }));
  const timerad = Array.from(vindu.querySelectorAll("select")).find((el) =>
    el.textContent?.includes("timer.maskinTimerad.valg"),
  )!;
  fireEvent.change(timerad, { target: { value: "r2" } });
  fireEvent.change(within(vindu).getAllByRole("spinbutton")[0]!, { target: { value: "1" } });
  return vindu;
}
const linjer = (vindu: HTMLElement) => Array.from(vindu.querySelectorAll<HTMLElement>("[data-varelinje]"));
/** Fyller linje nr. `i` med vare og mengde. */
function fyll(vindu: HTMLElement, i: number, vareId: string, antall: string) {
  const l = linjer(vindu)[i]!;
  fireEvent.change(l.querySelector("select")!, { target: { value: vareId } });
  fireEvent.change(linjer(vindu)[i]!.querySelector('input[type="number"]')!, { target: { value: antall } });
}
const leggTil = (vindu: HTMLElement) =>
  fireEvent.click(within(vindu).getByRole("button", { name: /timer\.detalj\.tilfoyVare/ }));
const stier = () => h.kall.map((k) => k.sti);
const vareKall = () => h.kall.filter((k) => k.sti === "vareforbruk.opprett");

describe(
  "VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 1–4 i testpanelet, runde 5) — Kenneth 2026-11-27: «savner nå en + linje for å legge til flere varer dersom både pukk og bærelag ble levert»",
  () => {
    it("(a) to linjer (pukk og bærelag): maskinen først, så begge varene med maskinens id, timerad og underprosjekt", async () => {
      const vindu = nyMaskin();
      fyll(vindu, 0, "va1", "4");
      leggTil(vindu);
      fyll(vindu, 1, "va2", "2");
      expect(vindu.textContent).toContain("(m3)");
      expect(vindu.textContent).toContain("(tonn)");
      fireEvent.submit(vindu.querySelector("form")!);
      expect(stier()).toEqual(["timer.dagsseddel.maskin.tilfoy", "vareforbruk.opprett", "vareforbruk.opprett"]);
      const felles = { projectId: "p1", externalCostObjectId: "e1", dagsseddelId: "s1", sheetTimerId: "r2", sheetMachineId: "ny" };
      expect(vareKall()[0]!.input).toMatchObject({ ...felles, vareId: "va1", antall: 4 });
      expect(vareKall()[1]!.input).toMatchObject({ ...felles, vareId: "va2", antall: 2 });
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("(b) × fjerner en linje, og en tom linje sendes ikke", () => {
      const vindu = nyMaskin();
      fyll(vindu, 0, "va1", "4");
      leggTil(vindu);
      fyll(vindu, 1, "va2", "2");
      leggTil(vindu); // tom tredje linje
      fireEvent.click(within(linjer(vindu)[0]!).getByRole("button", { name: "handling.fjern" }));
      expect(linjer(vindu)).toHaveLength(2);
      fireEvent.submit(vindu.querySelector("form")!);
      expect(vareKall().map((k) => k.input.vareId)).toEqual(["va2"]);
    });

    it("(c) én linje feiler: vinduet står, Lagre sender bare den — én maskin totalt", async () => {
      const vindu = nyMaskin();
      fyll(vindu, 0, "va1", "4");
      leggTil(vindu);
      fyll(vindu, 1, "va2", "2");
      // Bærelaget feiler første gang.
      let forsok = 0;
      const ekte = h.feiler;
      h.feiler = new Proxy(ekte, {
        get: (m, k: string) =>
          k === "vareforbruk.opprett" && h.kall.at(-1)?.input.vareId === "va2" && forsok++ === 0 ? "Feil fra server" : m[k],
      });
      fireEvent.submit(vindu.querySelector("form")!);
      await waitFor(() => expect(vindu.textContent).toContain("timer.maskinVare.vareFeilet"));
      // Pukken er lagret (låst), bærelaget står med feilen.
      expect((linjer(vindu)[0]!.querySelector("select") as HTMLSelectElement).disabled).toBe(true);
      expect(linjer(vindu)[1]!.textContent).toContain("Feil fra server");
      fireEvent.submit(vindu.querySelector("form")!);
      expect(stier()).toEqual([
        "timer.dagsseddel.maskin.tilfoy",
        "vareforbruk.opprett",
        "vareforbruk.opprett",
        "vareforbruk.opprett",
      ]);
      expect(vareKall().map((k) => k.input.vareId)).toEqual(["va1", "va2", "va2"]);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  },
);

describe("VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 1–4 i testpanelet, runde 5) — Kenneth 2026-11-27: «varer tilhører denne maskinen, men det kan jeg ikke se»", () => {
  // Varer-blokka: runde 3-blokka med overskriften «Varer».
  const varerBlokk = () =>
    Array.from(document.querySelectorAll<HTMLElement>("[data-runde3]")).find((el) =>
      el.querySelector("h3")?.textContent?.includes("timer.detalj.varer"),
    ) ?? null;
  const underMaskin = (id: string) => document.querySelector(`[data-maskinvarer="${id}"]`) as HTMLElement | null;
  const MED_MASKIN = { ...DAG7_VARER_0(), id: "f2", sheetMachineId: "m1", vare: { id: "va1", navn: "Grus 0-16", enhet: "m3" } };

  it("(d) vare ført fra maskinvinduet står innrykket under maskinen, ikke i Varer-blokka; den andre står i Varer-blokka", () => {
    rendre({ data: { "vareforbruk.hentMineForDato": [DAG7_VARER_0(), MED_MASKIN] } });
    expect(underMaskin("m1")?.textContent).toContain("Grus 0-16");
    expect(underMaskin("m1")?.querySelector('[title="handling.rediger"]')).not.toBeNull();
    expect(varerBlokk()?.textContent).not.toContain("Grus 0-16");
    expect(varerBlokk()?.textContent).toContain("Pukk 6-32");
  });

  it("(e) maskinen er slettet eller flyttet til annen timerad: varen står i Varer-blokka — den forsvinner aldri", () => {
    rendre({ data: { "vareforbruk.hentMineForDato": [{ ...MED_MASKIN, sheetMachineId: "borte" }] } });
    expect(varerBlokk()?.textContent).toContain("Grus 0-16");
    const sedel = DAG7_SEDEL;
    rendre({
      sedel: { maskiner: sedel.maskiner.map((m) => (m.id === "m1" ? { ...m, sheetTimerId: "r1" } : m)) },
      data: { "vareforbruk.hentMineForDato": [MED_MASKIN] },
    });
    expect(underMaskin("m1")).toBeNull();
    expect(varerBlokk()?.textContent).toContain("Grus 0-16");
  });

  it("(f) maskinen flyttet til et annet underprosjekt på samme timerad: varen står i Varer-blokka, ikke under maskinen", () => {
    const sedel = DAG7_SEDEL;
    rendre({
      sedel: { maskiner: sedel.maskiner.map((m) => (m.id === "m1" ? { ...m, externalCostObjectId: null } : m)) },
      data: { "vareforbruk.hentMineForDato": [MED_MASKIN] },
    });
    expect(underMaskin("m1")).toBeNull();
    expect(varerBlokk()?.textContent).toContain("Grus 0-16");
  });
});
