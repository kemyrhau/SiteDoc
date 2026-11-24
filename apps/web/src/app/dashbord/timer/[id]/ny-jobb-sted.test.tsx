// @vitest-environment jsdom
/**
 * Retur O8 tillegg (plan § 8.22 punkt 4, Kenneth 2026-11-22): «+ Registrer timer · neste jobb,
 * samme eller annet prosjekt» — på en ny jobb (utkastet i skjemaet) åpner «Sted og aktivitet»
 * timevinduet for ny rad med prosjektet åpent, så prosjekt, byggeplass og aktivitet kan velges.
 * Dagen er #7 (`testdata-dag7.ts`) med bare jobb 1 (k1, 07:00–15:00 på p1).
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
  { id: "b1", name: "Skolebygg", projectId: "p1" },
  { id: "b3", name: "Hall A", projectId: "p2" },
  { id: "b4", name: "Hall B", projectId: "p2" },
];

/** Dagen med jobb 1; `eksisterte=1` åpner skjemaet for neste jobb (utkastet) på p1. */
function rendre(sok = "registrer=1&nyttProsjekt=p1&eksisterte=1") {
  h.sok = sok;
  h.kall = [];
  h.feil = {};
  h.svar = {};
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
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Skole", internalProjectNumber: "2041" },
      { id: "p2", name: "Idrettshall", internalProjectNumber: "3050" },
    ],
    "bygning.hentForFirma": BYGGEPLASSER,
    "vareforbruk.hentMineForDato": [],
  };
  return render(<Side />);
}

const prosjektValg = (d: HTMLElement) =>
  Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "p2"))!;
const byggeplassValg = (d: HTMLElement) =>
  Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "b3"));
const radKall = () => h.kall.filter((k) => k.sti === "timer.dagsseddel.tilfoyTimerRad").map((k) => k.input);
async function ventRad() {
  await vi.waitFor(() => expect(radKall().length).toBeGreaterThan(0));
  return radKall()[0]!;
}

/** Lønnsarten velges i timevinduet (som før), så Lagre sender raden. */
function fyllUtOgLagre(d: HTMLElement) {
  const art = Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "l1"))!;
  fireEvent.change(art, { target: { value: "l1" } });
  fireEvent.submit(d.querySelector("form")!);
}

/** Blyanten i utkastets hode. */
function aapneStedNy() {
  const skjema = screen.getByTestId("jobb-skjema");
  fireEvent.click(within(skjema).getByTitle("timer.jobbSkjema.aapneVinduHintNy"));
  return screen.getByRole("dialog", { name: "timer.detalj.tilfoyTimer" });
}

describe("retur O8 tillegg — ny jobb: prosjekt og byggeplass kan velges", () => {
  afterEach(cleanup);

  it("utkastet har «Sted og aktivitet»; vinduet har prosjekt (åpent, samme liste som timevinduet) og aktivitet", () => {
    rendre();
    const d = aapneStedNy();
    const prosjekt = prosjektValg(d);
    expect(prosjekt.disabled).toBe(false);
    expect(Array.from(prosjekt.options).map((o) => o.value)).toEqual(["p1", "p2"]);
    expect(prosjekt.value).toBe("p1");
    expect(d.textContent).toContain("timer.felt.aktivitet");
  });

  it("ny jobb på annet prosjekt lagres på det prosjektet med valgt byggeplass og utkastets kort-id", async () => {
    rendre();
    const d = aapneStedNy();
    fireEvent.change(prosjektValg(d), { target: { value: "p2" } });
    const bp = byggeplassValg(d)!;
    expect(Array.from(bp.options).map((o) => o.value)).toEqual(["", "b3", "b4"]);
    fireEvent.change(bp, { target: { value: "b4" } });
    fyllUtOgLagre(d);
    const input = await ventRad();
    expect(input).toMatchObject({ projectId: "p2", byggeplassId: "b4", fraTid: "15:00", tilTid: "16:00" });
    // Utkastets kort-id: en ny jobb, ikke jobb 1.
    expect(typeof input!.kortId).toBe("string");
    expect(input!.kortId).not.toBe("k1");
    // Underprosjektet hører til p1 og følger ikke med til p2.
    expect(input!.externalCostObjectId ?? null).toBeNull();
  });

  it("byggeplass kan byttes på samme prosjekt", async () => {
    rendre();
    h.data["bygning.hentForFirma"] = [...BYGGEPLASSER, { id: "b2", name: "Gymsal", projectId: "p1" }];
    cleanup();
    render(<Side />);
    const d = aapneStedNy();
    const bp = Array.from(d.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === "b2"))!;
    fireEvent.change(bp, { target: { value: "b2" } });
    fyllUtOgLagre(d);
    expect(await ventRad()).toMatchObject({ projectId: "p1", byggeplassId: "b2" });
  });

  it("tider rettet i skjemaet følger med til vinduet", async () => {
    rendre();
    const skjema = screen.getByTestId("jobb-skjema");
    fireEvent.change(within(skjema).getByLabelText("timer.jobbSkjema.til"), { target: { value: "17:30" } });
    const d = aapneStedNy();
    fyllUtOgLagre(d);
    expect(await ventRad()).toMatchObject({ fraTid: "15:00", tilTid: "17:30" });
  });

  it("vakt: lagret jobb som før — blyanten åpner «Rediger timer-rad» med prosjektet låst", () => {
    rendre("");
    const kort = screen.getAllByRole("button").find((b) => b.getAttribute("aria-expanded") != null);
    if (kort?.getAttribute("aria-expanded") !== "true") fireEvent.click(kort!);
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    const d = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(prosjektValg(d).disabled).toBe(true);
    expect(screen.queryByTitle("timer.jobbSkjema.aapneVinduHintNy")).toBeNull();
  });
});
