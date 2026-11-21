// @vitest-environment jsdom
/**
 * w15f (web-timeforing-plan § 4.15 del H pkt. 24): pennen på en reiselinje på dagssiden.
 * Prosjektfeltet er åpent for en reiserad og låst for en arbeidsrad. Bytte av prosjekt tømmer
 * underprosjektet og foreslår byggeplass; linja «havner i» følger feltene; kallet sender prosjekt,
 * byggeplass og underprosjekt sammen. Uendret prosjekt sender ikke `projectId`.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown>, kall: [] as { sti: string; input: unknown }[] }));

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
            mutate: (input: unknown) => { h.kall.push({ sti: key, input }); },
            mutateAsync: async (input: unknown) => { h.kall.push({ sti: key, input }); return {}; },
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

const BYGGEPLASSER = [
  { id: "b1", name: "Blokk A", projectId: "p1" },
  { id: "b2", name: "Narvik", projectId: "p1" },
  { id: "b9", name: "Bjerkvik hovedbygg", projectId: "p2" },
];
type Rad = Record<string, unknown>;
const ARBEID1: Rad = { ...DAG7_SEDEL.timer[0]!, byggeplassId: "b1", externalCostObjectId: "e1" } as Rad;
const REISE: Rad = {
  ...DAG7_SEDEL.timer[0]!,
  id: "rr",
  kortId: "k1",
  lonnsartId: "lr",
  externalCostObjectId: "e1",
  byggeplassId: "b1",
  pauseMin: 0,
  beskrivelse: null,
  erReise: true,
  reiseKilde: "manuell",
  reiseRetning: "retur",
  fraTid: "15:00",
  tilTid: "15:30",
  timer: "0.5",
} as Rad;

function rendre(timer: Rad[]) {
  cleanup();
  h.kall.length = 0;
  h.data = {
    ...dag7Data("prosjektkort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, timer, maskiner: [], tillegg: [], utlegg: [] },
    "vareforbruk.hentMineForDato": [],
    "bygning.hentForFirma": BYGGEPLASSER,
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Bjerkvik skole", internalProjectNumber: "1060" },
    ],
    "organisasjon.hentArbeidstidDefaults": { timerRegistreringsmodus: "prosjektkort", reiseLonnsartId: "lr", reiseGrenser: [] },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ],
  };
  return render(<Side />);
}
function aapneForste() {
  const hode = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"))[0]!;
  if (hode.getAttribute("aria-expanded") !== "true") fireEvent.click(hode);
}
function pennenPaaReise() {
  const linje = document.querySelector('[data-reiselinje="rr"]') as HTMLElement;
  fireEvent.click(linje.querySelector('[title="handling.rediger"]')!);
  return screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
}
const prosjektFelt = (d: HTMLElement) =>
  Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "p2")) as HTMLSelectElement;
const byggeplassFelt = (d: HTMLElement) =>
  Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "b1" || o.value === "b9")) as HTMLSelectElement | undefined;
async function lagre(d: HTMLElement) {
  fireEvent.submit(d.querySelector("form")!);
  await Promise.resolve();
  await Promise.resolve();
}
const oppdaterKall = () => h.kall.filter((k) => k.sti === "timer.dagsseddel.oppdaterTimerRad").map((k) => k.input as Record<string, unknown>);

describe("w15f — pennen på reiselinja (del H pkt. 24)", () => {
  afterEach(cleanup);

  it("prosjektfeltet er åpent for en reiserad", () => {
    rendre([ARBEID1, REISE]);
    aapneForste();
    const d = pennenPaaReise();
    expect(prosjektFelt(d).disabled).toBe(false);
    expect(prosjektFelt(d).value).toBe("p1");
  });

  it("prosjektfeltet er låst for en arbeidsrad", () => {
    rendre([ARBEID1]);
    aapneForste();
    // L3a: arbeidslinja står i jobbskjemaet — blyanten i skjemaets hode.
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    const d = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(prosjektFelt(d).disabled).toBe(true);
  });

  it("bytte av prosjekt tømmer underprosjektet, foreslår byggeplass, og linja «havner i» følger", () => {
    rendre([ARBEID1, REISE]);
    aapneForste();
    const d = pennenPaaReise();
    expect(d.textContent).toContain('timer.rediger.reiseHavnerJobb{"sted":"Blokk A"}');
    fireEvent.change(prosjektFelt(d), { target: { value: "p2" } });
    // Én kandidat på p2 → den er valgt og står som tekst.
    expect(d.textContent).toContain("Bjerkvik hovedbygg");
    expect(byggeplassFelt(d)).toBeUndefined();
    expect(d.textContent).toContain("timer.rediger.reiseHavnerEget");
    expect(d.textContent).not.toContain("timer.rediger.reiseHavnerJobb");
  });

  it("kallet sender prosjekt, byggeplass og underprosjekt sammen", async () => {
    rendre([ARBEID1, REISE]);
    aapneForste();
    const d = pennenPaaReise();
    fireEvent.change(prosjektFelt(d), { target: { value: "p2" } });
    await lagre(d);
    const k = oppdaterKall();
    expect(k).toHaveLength(1);
    expect(k[0]).toMatchObject({ id: "rr", projectId: "p2", byggeplassId: "b9", externalCostObjectId: null });
  });

  it("uendret prosjekt sender ikke projectId", async () => {
    rendre([ARBEID1, REISE]);
    aapneForste();
    const d = pennenPaaReise();
    await lagre(d);
    const k = oppdaterKall();
    expect(k).toHaveLength(1);
    expect(k[0]).not.toHaveProperty("projectId");
  });
});
