// @vitest-environment jsdom
/**
 * O8 D (plan § 8.22, Kenneth 2026-11-22): prosjekt og byggeplass er nedtrekk på et LAGRET jobbkort
 * (`JobbSkjema` rendret direkte). Endres de, flyttes hele jobben (`dagsseddel.flyttJobb`), og siden
 * får jobbens nye kort-id. Nytt prosjekt: byggeplass som for ny rad (eneste kandidat, ellers ingen).
 * Ny jobb (utkast) har ingen nedtrekk — der er flyten som før. Avvisning vises med serverens tekst.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  kall: [] as { sti: string; input: Record<string, unknown> }[],
  feilMut: {} as Record<string, string>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") return () => ({ data: undefined, error: null, isLoading: false });
        if (navn === "useMutation") {
          return () => ({
            mutateAsync: async (input: Record<string, unknown>) => {
              h.kall.push({ sti: key, input });
              if (h.feilMut[key]) throw new Error(h.feilMut[key]);
              return { kortId: "k-ny", antall: 3 };
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

import { JobbSkjema, type SkjemaLinje } from "./JobbSkjema";

const TL = { id: "tl", navn: "Timelønn", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 };
const FLYTT = "timer.dagsseddel.flyttJobb";
const LINJE: SkjemaLinje = { id: "r1", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, lonnsartId: "tl", timer: 7.5, beskrivelse: "Graving" };
const PROSJEKTER = [
  { id: "p1", navn: "101 — Kaia" },
  { id: "p2", navn: "202 — Brua" },
  { id: "p3", navn: "303 — Skolen" },
];
const BYGGEPLASSER = [
  { id: "b1a", projectId: "p1", name: "Kai nord" },
  { id: "b1b", projectId: "p1", name: "Kai sør" },
  { id: "b2", projectId: "p2", name: "Brukar" },
  { id: "b3a", projectId: "p3", name: "Bygg A" },
  { id: "b3b", projectId: "p3", name: "Bygg B" },
];

function rendre(a: { ny?: boolean; byggeplassId?: string | null } = {}) {
  h.kall = [];
  const onFlyttet = vi.fn();
  render(
    <JobbSkjema
      sheetId="s1"
      kortId="k1"
      linjer={a.ny ? [] : [LINJE]}
      ny={a.ny ? { projectId: "p1", aktivitetId: "a1", byggeplassId: null, lonnsartId: "tl", fraTid: "15:00", tilTid: "", pauseMin: 0 } : undefined}
      kilde={null}
      lonnsarter={[TL]}
      velgbareLonnsarter={[TL]}
      andreRader={[]}
      norm={7.5}
      pauseEtterTimer={4}
      fastPauseFra={null}
      datoTekst="25.11."
      projectId="p1"
      ecoId={null}
      byggeplassId={a.byggeplassId === undefined ? "b1a" : a.byggeplassId}
      organizationId="o1"
      rader47={[]}
      onUlagret={vi.fn()}
      stedValg={{ prosjekter: PROSJEKTER, byggeplasser: BYGGEPLASSER, onFlyttet }}
    />,
  );
  return { onFlyttet };
}
const vent = () => new Promise((r) => setTimeout(r, 0));
const flyttKall = () => h.kall.filter((k) => k.sti === FLYTT).map((k) => k.input);
const prosjekt = () => screen.getByRole("combobox", { name: "timer.felt.prosjekt" }) as HTMLSelectElement;
const byggeplass = () => screen.getByRole("combobox", { name: "timer.felt.byggeplass" }) as HTMLSelectElement;

afterEach(() => {
  cleanup();
  h.feilMut = {};
});

describe("O8 D — prosjekt og byggeplass på lagret jobbkort", () => {
  it("lagret jobb: nedtrekk med jobbens prosjekt og byggeplass valgt", () => {
    rendre();
    expect(prosjekt().value).toBe("p1");
    expect(Array.from(prosjekt().options).map((o) => o.textContent)).toEqual(PROSJEKTER.map((p) => p.navn));
    expect(byggeplass().value).toBe("b1a");
    expect(Array.from(byggeplass().options).map((o) => o.value)).toEqual(["", "b1a", "b1b"]);
  });

  it("ny jobb (utkast): ingen nedtrekk — flyten er som før", () => {
    rendre({ ny: true });
    expect(screen.queryByTestId("skjema-prosjekt")).toBeNull();
    expect(screen.queryByTestId("skjema-byggeplass")).toBeNull();
  });

  it("nytt prosjekt med én byggeplass: jobben flyttes dit, siden får ny kort-id", async () => {
    const { onFlyttet } = rendre();
    await act(async () => {
      fireEvent.change(prosjekt(), { target: { value: "p2" } });
      await vent();
    });
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", projectId: "p2", byggeplassId: "b2" }]);
    expect(onFlyttet).toHaveBeenCalledWith("k-ny");
  });

  it("nytt prosjekt med flere byggeplasser: ingen byggeplass gjettes", async () => {
    rendre();
    await act(async () => {
      fireEvent.change(prosjekt(), { target: { value: "p3" } });
      await vent();
    });
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", projectId: "p3", byggeplassId: null }]);
  });

  it("ny byggeplass i samme prosjekt: flyttes med prosjektet uendret", async () => {
    rendre();
    await act(async () => {
      fireEvent.change(byggeplass(), { target: { value: "b1b" } });
      await vent();
    });
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", projectId: "p1", byggeplassId: "b1b" }]);
  });

  it("avvist flytting viser serverens tekst; «Prøv igjen» sender samme valg", async () => {
    h.feilMut[FLYTT] = "Utlegget føres annerledes på dette prosjektet. Fjern det først.";
    const { onFlyttet } = rendre();
    await act(async () => {
      fireEvent.change(prosjekt(), { target: { value: "p2" } });
      await vent();
    });
    expect(screen.getByText(/Utlegget føres annerledes på dette prosjektet/)).toBeTruthy();
    expect(onFlyttet).not.toHaveBeenCalled();
    delete h.feilMut[FLYTT];
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /provIgjen|Prøv igjen/i }));
      await vent();
    });
    expect(flyttKall()).toHaveLength(2);
    expect(flyttKall()[1]).toEqual(flyttKall()[0]);
    expect(onFlyttet).toHaveBeenCalledWith("k-ny");
  });
});
