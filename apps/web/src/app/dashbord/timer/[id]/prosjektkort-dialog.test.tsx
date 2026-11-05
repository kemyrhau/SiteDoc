// @vitest-environment jsdom
/**
 * Prosjektkort L1 (RETUR 14a, W7): inne i et kort er prosjektet låst i
 * raddialogen, og overlapp-meldingen navngir det andre kortet.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

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

// <dialog>.showModal finnes ikke i jsdom — innholdet er det som testes.
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
        if (navn === "useQuery") {
          const key = sti.join(".");
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({ mutate: () => {}, mutateAsync: async () => {}, isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

const rad = (id: string, projectId: string, fraTid: string, tilTid: string, timer: string) => ({
  id,
  projectId,
  lonnsartId: "l1",
  aktivitetId: "a1",
  externalCostObjectId: null,
  vehicleId: null,
  byggeplassId: null,
  fraTid,
  tilTid,
  timer,
  pauseMin: 0,
  beskrivelse: null,
  attestertStatus: "pending",
  erReise: false,
});

function rendre(modus: string) {
  h.data = {
    "timer.dagsseddel.hentMedId": {
      id: "s1",
      organizationId: "o1",
      dato: "2026-11-05T00:00:00.000Z",
      status: "draft",
      startAt: null,
      endAt: null,
      pauseMin: 0,
      beskrivelse: null,
      aktivitetId: "a1",
      aktivitet: { id: "a1", navn: "Arbeid" },
      attestertVed: null,
      lederKommentar: null,
      manglerMaskinforerbevis: false,
      byggeplassId: null,
      tillegg: [],
      maskiner: [],
      utlegg: [],
      timer: [rad("r1", "p1", "07:00", "11:00", "4"), rad("r2", "p2", "11:00", "15:00", "4")],
    },
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Barnehage", internalProjectNumber: "2050" },
    ],
    "organisasjon.hentArbeidstidDefaults": { timerRegistreringsmodus: modus },
    "timer.lonnsart.list": [{ id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true }],
    "timer.aktivitet.list": [{ id: "a1", navn: "Arbeid", aktiv: true }],
    "vareforbruk.hentMineForDato": [],
  };
  return render(<Side />);
}

function aapneNyRadIKort(kort: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(kort) }));
  fireEvent.click(screen.getByRole("button", { name: "timer.prosjektkort.nyTimer" }));
  return screen.getByRole("dialog");
}

describe("prosjektkort — raddialogen", () => {
  afterEach(cleanup);

  it("prosjektet er låst når raden legges til fra et kort", () => {
    rendre("prosjektkort");
    const dialog = aapneNyRadIKort("2050 — Barnehage");
    const prosjektValg = within(dialog).getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(prosjektValg.value).toBe("p2");
    expect(prosjektValg.disabled).toBe(true);
  });

  it("overlapp-meldingen navngir kortet den andre raden ligger på", () => {
    rendre("prosjektkort");
    const dialog = aapneNyRadIKort("2050 — Barnehage");
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "08:00" } });
    fireEvent.change(til!, { target: { value: "09:00" } });
    fireEvent.submit(dialog.querySelector("form")!);
    expect(dialog.textContent).toContain("timer.feil.overlappKort");
    expect(dialog.textContent).toContain('"kort":"2041 — Skole"');
  });
});
