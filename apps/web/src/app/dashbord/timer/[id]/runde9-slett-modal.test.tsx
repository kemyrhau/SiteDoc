// @vitest-environment jsdom
/**
 * Runde 9 (Kenneth 2026-11-28, ui-standarder § Slett-bekreftelse; orkestrator-godkjent løsning):
 * søppelbøtta på dagsseddelen sletter aldri direkte. Timerad og reise uten maskin, tillegg, maskin og
 * utlegg bekreftes i modal med radens navn; ingen mutasjon før «Slett rad». Timerad med maskin har
 * dagens modal («Slett rad og maskiner») uendret.
 *
 * Negativkontroll mot develop `c37a2790` (målt): timerad uten maskin, tillegg, maskin og utlegg muterte
 * rett ved klikk — 5 røde (timerad, Avbryt, tillegg, utlegg, maskin); vakten for raden med maskin grønn.
 */
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

function rendre() {
  h.sok = "";
  h.kall = [];
  h.feil = {};
  h.svar = {};
  h.data = dag7Data("dagskort");
  return render(<Side />);
}

afterEach(cleanup);

/** Åpner alle jobbkortene, så radene står. */
function aapneAlle() {
  for (const k of screen.getAllByRole("button").filter((b) => b.getAttribute("aria-expanded") === "false")) {
    fireEvent.click(k);
  }
}

/** Søppelbøtta på linja som inneholder `tekst`. */
function slettKnapp(tekst: string): HTMLElement {
  const knapper = screen.getAllByTitle("handling.slett").filter((b) => b.closest("li")?.textContent?.includes(tekst));
  expect(knapper.length).toBeGreaterThan(0);
  return knapper[0]!;
}

const muteringer = (sti: string) => h.kall.filter((k) => k.sti === sti).map((k) => k.input);

describe("Runde 9 — sletting bekreftes alltid i modal", () => {
  it("timerad uten maskin: modal med radens tid og lønnsart, ingen sletting før «Slett rad»", () => {
    rendre();
    aapneAlle();
    fireEvent.click(slettKnapp("07:00"));
    expect(muteringer("timer.dagsseddel.fjernTimerRad")).toHaveLength(0);
    const d = screen.getByRole("dialog", { name: "timer.fjernTimerRad.tittel" });
    expect(d.textContent).toContain("timer.fjernTimerRad.tekst");
    expect(d.textContent).toContain("07:00–15:00 · Timelønn");
    fireEvent.click(within(d).getByText("timer.fjernTimerRad.bekreftRad"));
    expect(muteringer("timer.dagsseddel.fjernTimerRad")).toEqual([{ id: "r1" }]);
  });

  it("Avbryt: raden står, ingen sletting", () => {
    rendre();
    aapneAlle();
    fireEvent.click(slettKnapp("07:00"));
    fireEvent.click(within(screen.getByRole("dialog", { name: "timer.fjernTimerRad.tittel" })).getByText("handling.avbryt"));
    expect(muteringer("timer.dagsseddel.fjernTimerRad")).toHaveLength(0);
  });

  it("vakt: timerad med maskin har dagens modal og sletter maskinene med", () => {
    rendre();
    aapneAlle();
    fireEvent.click(slettKnapp("15:00–16:00"));
    const d = screen.getByRole("dialog", { name: "timer.fjernTimerRad.tittel" });
    expect(d.textContent).toContain("timer.fjernTimerRad.maskiner");
    fireEvent.click(within(d).getByText("timer.fjernTimerRad.bekreft"));
    expect(muteringer("timer.dagsseddel.fjernTimerRad")).toEqual([{ id: "r2", slettMaskiner: true }]);
  });

  it.each([
    ["tillegg", "Smusstillegg", "timer.dagsseddel.fjernTilleggRad", "t1"],
    ["utlegg", "Parkering", "timer.dagsseddel.fjernUtleggRad", "u1"],
    ["maskin", "Volvo EC140", "timer.dagsseddel.maskin.fjern", "m0"],
  ])("%s: modal med radens navn, ingen sletting før «Slett rad»", (_type, navn, sti, id) => {
    rendre();
    aapneAlle();
    fireEvent.click(slettKnapp(navn));
    expect(muteringer(sti)).toHaveLength(0);
    const d = screen.getByRole("dialog", { name: "timer.slettRad.tittel" });
    expect(d.textContent).toContain(navn);
    fireEvent.click(within(d).getByText("timer.fjernTimerRad.bekreftRad"));
    const kall = muteringer(sti);
    expect(kall).toHaveLength(1);
    if (id) expect(kall[0]).toEqual({ id });
  });
});
