// @vitest-environment jsdom
/**
 * Runde 7 timer (2026-11-27): maskin og vare som er koblet til en timerad, har timeradens
 * underprosjekt (Kenneth: «Ja, arv timeraden»). Dagen er #7 (`testdata-dag7.ts`), dagskort-modus:
 * bøtte uten underprosjekt (r1, 7,5 t) og TILL-001 (r2, 1 t, ECO e1).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

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

/** Døgnmaskin (utleie pr. døgn): kan stå uten timerad. */
const DOEGN = { id: "v2", kategori: "anleggsmaskin", type: "hoppetusse", merke: null, modell: null, internNavn: "Hoppetusse H-1", utleieEnhet: "doegn" };

/** Åpner maskinvinduet fra bøtte 2 (TILL-001), velger maskin og 1 t. */
function aapne(maskinNavn: RegExp) {
  const utstyr = (dag7Data("dagskort") as Record<string, unknown[]>)["maskin.equipment.list"]!;
  rendre({ sedel: { maskiner: [] }, data: { "vareforbruk.katalogForFirma": KATALOG, "maskin.equipment.list": [...utstyr, DOEGN] } });
  fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyMaskin/ })[1]!);
  const vindu = screen.getByRole("dialog", { name: "timer.detalj.tilfoyMaskin" });
  fireEvent.click(within(vindu).getByRole("button", { name: /timer\.velgUtstyr/ }));
  fireEvent.click(within(vindu).getByRole("button", { name: maskinNavn }));
  fireEvent.change(within(vindu).getAllByRole("spinbutton")[0]!, { target: { value: "1" } });
  return vindu;
}
const timeradValg = (vindu: HTMLElement) =>
  Array.from(vindu.querySelectorAll("select")).find((el) => el.textContent?.includes("timer.maskinTimerad.valg"))!;
const ecoFelt = (vindu: HTMLElement) => vindu.querySelector('[data-testid="maskin-underprosjekt"]');
const leggTilVare = (vindu: HTMLElement) => {
  fireEvent.click(within(vindu).getByRole("button", { name: /timer\.detalj\.tilfoyVare/ }));
  const l = vindu.querySelector<HTMLElement>("[data-varelinje]")!;
  fireEvent.change(l.querySelector("select")!, { target: { value: "va1" } });
  fireEvent.change(vindu.querySelector<HTMLElement>("[data-varelinje]")!.querySelector('input[type="number"]')!, { target: { value: "4" } });
};
const kallFor = (sti: string) => h.kall.filter((k) => k.sti === sti);

describe("Kenneth 2026-11-27: «Ja, arv timeraden» — maskinvinduet i dagskortet", () => {
  it("(a) timerad valgt: underprosjekt-feltet er borte, og maskin og vare sendes med timeradens underprosjekt", () => {
    const vindu = aapne(/Gravemaskin G-12/);
    expect(ecoFelt(vindu)).not.toBeNull();
    // r1 står uten underprosjekt — vinduet var åpnet fra TILL-001 (e1).
    fireEvent.change(timeradValg(vindu), { target: { value: "r1" } });
    expect(ecoFelt(vindu)).toBeNull();
    leggTilVare(vindu);
    fireEvent.submit(vindu.querySelector("form")!);
    expect(kallFor("timer.dagsseddel.maskin.tilfoy")[0]!.input).toMatchObject({ sheetTimerId: "r1", externalCostObjectId: null });
    const vareInput = kallFor("vareforbruk.opprett")[0]!.input;
    expect(vareInput).toMatchObject({ sheetTimerId: "r1", krevTimerad: true });
    expect(vareInput.externalCostObjectId ?? null).toBeNull();
  });

  it("(b) døgnmaskin uten timerad: underprosjekt-feltet står, og maskinen lagres med eget valg", () => {
    const vindu = aapne(/Hoppetusse H-1/);
    expect(timeradValg(vindu).value).toBe("");
    expect(ecoFelt(vindu)).not.toBeNull();
    fireEvent.submit(vindu.querySelector("form")!);
    expect(kallFor("timer.dagsseddel.maskin.tilfoy")).toHaveLength(1);
  });

  it("(c) vare på døgnmaskin uten timerad: stoppes med «Velg timerad for varen» — ingenting sendes", () => {
    const vindu = aapne(/Hoppetusse H-1/);
    leggTilVare(vindu);
    fireEvent.submit(vindu.querySelector("form")!);
    expect(vindu.textContent).toContain("timer.maskinVare.timeradForVare");
    expect(h.kall).toHaveLength(0);
  });
});
