// @vitest-environment jsdom
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

/**
 * R1 (Kenneth 2026-11-23) — klienten på dagssiden. Kenneths dag: 07–10 i B12 (k1), reise 12–15 og
 * arbeid 15–19 i Narvik (k3). (a) Vinduets overlappmelding sier at det er reisen og i hvilket kort
 * (byggeplass · fra–til); kortets hode viser reisen utenfor arbeidet. b1: en jobb med returnerte
 * linjer på egen returnert sedel kan flyttes; attestert linje gir ingen nedtrekk.
 */
import Side from "./page";

const BYGGEPLASSER = [
  { id: "b1", name: "B12", projectId: "p1" },
  { id: "b2", name: "Narvik", projectId: "p1" },
];
const R1 = { ...DAG7_SEDEL.timer[0]!, id: "r1", fraTid: "07:00", tilTid: "10:00", timer: "3", pauseMin: 0, byggeplassId: "b1", kortId: "k1", externalCostObjectId: null };
const REISE = { ...R1, id: "rr", fraTid: "12:00", tilTid: "15:00", byggeplassId: "b2", kortId: "k3", erReise: true, beskrivelse: null };
const NARVIK = { ...R1, id: "r3", fraTid: "15:00", tilTid: "19:00", timer: "4", byggeplassId: "b2", kortId: "k3", beskrivelse: null };

function rendre(status = "draft", linjeStatus?: string, tilleggStatus?: string) {
  h.kall = [];
  h.feil = {};
  h.svar = {};
  const st = (r: typeof R1) => ({ ...r, attestertStatus: linjeStatus ?? r.attestertStatus });
  h.data = {
    ...dag7Data("prosjektkort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, status, timer: [st(R1), REISE, NARVIK], tillegg: tilleggStatus ? [{ ...DAG7_SEDEL.tillegg[0]!, attestertStatus: tilleggStatus }] : [], maskiner: [] },
    "vareforbruk.hentMineForDato": [],
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Sitedoc Boligfelt", internalProjectNumber: "2041" },
      { id: "p2", name: "Bru", internalProjectNumber: "2042" },
    ],
    "bygning.hentForFirma": BYGGEPLASSER,
  };
  return render(<Side />);
}

const kortHoder = () => screen.getAllByRole("button").filter((b) => b.getAttribute("aria-expanded") != null);
const kortMed = (tekst: string) => kortHoder().find((b) => b.textContent?.includes(tekst));

afterEach(cleanup);

describe("R1 (a) — kortets hode viser reisen utenfor arbeidet", () => {
  it("Narvik-kortet: «reise 12:00–15:00» står i hodet ved arbeidet 15:00–19:00", () => {
    rendre();
    const hode = kortMed("Narvik")!;
    expect(hode.textContent).toContain("15:00–19:00");
    expect(hode.textContent).toContain('timer.prosjektkort.reiseTid{"fra":"12:00","til":"15:00"}');
  });
  it("kort uten reise: ingen reisetekst", () => {
    rendre();
    expect(kortMed("B12")!.textContent).not.toContain("timer.prosjektkort.reiseTid");
  });
});

describe("R1 (a) — vinduets overlappmelding sier hva og hvor", () => {
  it("07:00–15:00 på k1: «overlapper reisen 12:00–15:00 i kortet Narvik · 15:00–19:00»; ingen lagring", async () => {
    rendre();
    fireEvent.click(kortMed("B12")!);
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    const [, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(til!, { target: { value: "15:00" } });
    fireEvent.blur(til!);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(dialog.textContent).toContain("timer.feil.overlappReiseIKort"));
    expect(dialog.textContent).toContain('"annenFra":"12:00","annenTil":"15:00","kort":"Narvik · 15:00–19:00"');
    expect(h.kall.filter((k) => k.sti.startsWith("timer.dagsseddel."))).toHaveLength(0);
  });
});

describe("R1 b1 — flytting av egne returnerte linjer", () => {
  it("returnert dag, returnerte linjer: prosjekt-nedtrekket tilbys", () => {
    rendre("returned", "returnert");
    fireEvent.click(kortMed("B12")!);
    expect(within(screen.getByTestId("jobb-skjema")).getByRole("combobox", { name: "timer.felt.prosjekt" })).toBeTruthy();
  });
  it("attestert linje: ingen nedtrekk, heller ikke på returnert dag", () => {
    // Timelinja er returnert (skjemaet står), tillegget i samme jobb er attestert.
    rendre("returned", "returnert", "attestert");
    fireEvent.click(kortMed("B12")!);
    expect(screen.getByTestId("jobb-skjema")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "timer.felt.prosjekt" })).toBeNull();
  });
});
