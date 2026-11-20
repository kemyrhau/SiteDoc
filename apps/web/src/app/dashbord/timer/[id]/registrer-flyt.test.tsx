// @vitest-environment jsdom
/**
 * w15a (B41 A, plan § 4.15 del G): kortet som ble laget eller valgt, er åpent når dagen vises.
 * - «+ Registrer timer» på ny dag (`?registrer=1&nyttProsjekt=p1`): jobbens kort er åpent,
 *   ingen vindu åpnes, og adressen ryddes (omlasting kjører ikke flyten igjen).
 * - Dagen fantes (`&eksisterte=1`): «Legg til timer-rad» åpnes som før, og adressen ryddes.
 * - «Ny dagsseddel» (`?nyttProsjekt=p1`, uten `registrer`): jobbens kort er åpent.
 * Dagen har én jobb (k1) på p1 — kopi av #7 uten jobb 2.
 */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  sok: "",
  replace: vi.fn(),
}));

vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ velgFirma: () => {} }),
}));

vi.mock("@/kontekst/prosjekt-kontekst", () => ({
  useProsjekt: () => ({ prosjektId: null }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: h.replace, back: () => {} }),
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
            error: null,
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

const RETUR = "/dashbord/timer/mine";

/** Dagen med bare jobb 1 (k1) på p1. */
function rendre(sok: string) {
  h.sok = sok;
  h.replace.mockClear();
  const kunJobb1 = <T extends { kortId?: string | null }>(rader: readonly T[]) =>
    rader.filter((r) => r.kortId === "k1");
  h.data = {
    ...dag7Data("prosjektkort"),
    "timer.dagsseddel.hentMedId": {
      ...DAG7_SEDEL,
      timer: kunJobb1(DAG7_SEDEL.timer),
      maskiner: kunJobb1(DAG7_SEDEL.maskiner),
      tillegg: kunJobb1(DAG7_SEDEL.tillegg),
      utlegg: kunJobb1(DAG7_SEDEL.utlegg),
    },
    "vareforbruk.hentMineForDato": [],
  };
  return render(<Side />);
}

/** Kortets overskrift-knapp (har `aria-expanded`). */
function kortknapper() {
  return screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
}

describe("w15a — kortet er åpent etter «+ Registrer timer»", () => {
  afterEach(cleanup);

  it("ny dag: jobbens kort er åpent, ingen vindu, adressen ryddes (retur står)", async () => {
    rendre(`registrer=1&nyttProsjekt=p1&retur=${encodeURIComponent(RETUR)}`);
    const knapper = kortknapper();
    expect(knapper).toHaveLength(1);
    expect(knapper[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1));
    const [adresse, valg] = h.replace.mock.calls[0]!;
    expect(adresse).toBe(`/dashbord/timer/s1?retur=${encodeURIComponent(RETUR)}`);
    expect(valg).toEqual({ scroll: false });
  });

  it("dagen fantes: «Legg til timer-rad» åpnes som før, og adressen ryddes", async () => {
    rendre("registrer=1&nyttProsjekt=p1&eksisterte=1");
    expect(screen.getByRole("dialog")).toBeTruthy();
    await vi.waitFor(() => expect(h.replace).toHaveBeenCalledTimes(1));
    expect(h.replace.mock.calls[0]![0]).toBe("/dashbord/timer/s1");
  });

  it("«Ny dagsseddel» (nyttProsjekt uten registrer): jobbens kort er åpent", () => {
    rendre("nyttProsjekt=p1");
    const knapper = kortknapper();
    expect(knapper).toHaveLength(1);
    expect(knapper[0]!.getAttribute("aria-expanded")).toBe("true");
    expect(h.replace).not.toHaveBeenCalled();
  });
});
