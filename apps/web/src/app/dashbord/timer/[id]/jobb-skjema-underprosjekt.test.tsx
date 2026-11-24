// @vitest-environment jsdom
/**
 * Plan § 8.22 L3b — underprosjekt i hodet på jobbskjemaet (`JobbSkjema` rendret direkte).
 *   Raden vises bare når prosjektet har åpne underprosjekter (eller jobben står på et).
 *   ≤ 6 gir knapper, ellers søkbar nedtrekk. «Uten» er forvalgt.
 *   O8 (§ 8.22 punkt 3): grensen er plass, ikke antall — knapper så lenge «Uten» og alle
 *   underprosjektene får plass på én linje. Kan ikke bredden måles (jsdom), gjelder ≤ 6.
 *   Valget flytter HELE jobben (`flyttJobbEco`); ny jobb sender valget med når raden lages.
 */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Eco = { id: string; proAdmId: string; kortNavn: string; status: string; timerregistreringApen: boolean };

const h = vi.hoisted(() => ({
  kall: [] as { sti: string; input: Record<string, unknown> }[],
  feilMut: {} as Record<string, string>,
  ecoer: [] as Eco[],
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
        if (navn === "useQuery")
          return () => ({ data: key === "eksternKostObjekt.list" ? h.ecoer : undefined, error: null, isLoading: false });
        if (navn === "useMutation") {
          const logg = (input: Record<string, unknown>) => {
            h.kall.push({ sti: key, input });
            if (h.feilMut[key]) throw new Error(h.feilMut[key]);
            return { id: "ny" };
          };
          return () => ({ mutateAsync: async (input: Record<string, unknown>) => logg(input), isPending: false });
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
const FLYTT = "timer.dagsseddel.flyttJobbEco";
const TILFOY = "timer.dagsseddel.tilfoyTimerRad";
const LINJE: SkjemaLinje = { id: "r1", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, lonnsartId: "tl", timer: 7.5, beskrivelse: "Graving" };

const eco = (n: number, apen = true): Eco => ({
  id: `e${n}`,
  proAdmId: String(10 + n),
  kortNavn: `Grøft ${n}`,
  status: "aktiv",
  timerregistreringApen: apen,
});

function rendre(a: { ecoId?: string | null; ny?: boolean; ecoer: Eco[]; kanFlytte?: boolean }) {
  h.kall = [];
  h.ecoer = a.ecoer;
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
      ecoId={a.ecoId ?? null}
      organizationId="o1"
      rader47={[]}
      onUlagret={vi.fn()}
      kanFlytteUnderprosjekt={a.kanFlytte}
    />,
  );
}
const vent = () => new Promise((r) => setTimeout(r, 0));
const flyttKall = () => h.kall.filter((k) => k.sti === FLYTT).map((k) => k.input);
const knapp = (navn: string) => screen.getByRole("button", { name: navn });

afterEach(() => {
  cleanup();
  h.feilMut = {};
});

describe("R1 b1 — nedtrekket vises bare når flyttingen går gjennom", () => {
  it("lagret jobb som ikke kan flyttes (attestert linje): ingen underprosjektvalg", () => {
    rendre({ ecoer: [eco(1), eco(2)], kanFlytte: false });
    expect(screen.queryByTestId("skjema-underprosjekt")).toBeNull();
  });
  it("lagret jobb som kan flyttes: valgene står", () => {
    rendre({ ecoer: [eco(1), eco(2)], kanFlytte: true });
    expect(screen.getByTestId("skjema-underprosjekt")).toBeTruthy();
  });
  it("ny jobb: valget står uansett (ingenting å flytte)", () => {
    rendre({ ecoer: [eco(1), eco(2)], ny: true, kanFlytte: false });
    expect(screen.getByTestId("skjema-underprosjekt")).toBeTruthy();
  });
});

describe("L3b — underprosjekt i hodet", () => {
  it("skjult når prosjektet ikke har åpne underprosjekter (lukkede teller ikke)", () => {
    rendre({ ecoer: [eco(1, false)] });
    expect(screen.queryByTestId("skjema-underprosjekt")).toBeNull();
    cleanup();
    // Negativkontroll: med ett åpent vises raden.
    rendre({ ecoer: [eco(1)] });
    expect(screen.getByTestId("skjema-underprosjekt")).toBeTruthy();
  });

  it("≤ 6: knapper med «Uten» forvalgt; klikk flytter hele jobben", async () => {
    rendre({ ecoer: [eco(1), eco(2), eco(3, false)] });
    const rad = within(screen.getByTestId("skjema-underprosjekt"));
    expect(rad.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "timer.jobbSkjema.utenUnderprosjekt",
      "11 · Grøft 1",
      "12 · Grøft 2",
    ]);
    expect(knapp("timer.jobbSkjema.utenUnderprosjekt").getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("combobox", { name: "timer.jobbSkjema.underprosjekt" })).toBeNull();

    fireEvent.click(knapp("12 · Grøft 2"));
    await vent();
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", externalCostObjectId: "e2" }]);
  });

  it("jobb med underprosjekt: «Uten» sender null; valgt knapp er markert", async () => {
    rendre({ ecoId: "e1", ecoer: [eco(1), eco(2)] });
    expect(knapp("11 · Grøft 1").getAttribute("aria-pressed")).toBe("true");
    expect(knapp("timer.jobbSkjema.utenUnderprosjekt").getAttribute("aria-pressed")).toBe("false");
    // Klikk på det valgte gjør ingenting.
    fireEvent.click(knapp("11 · Grøft 1"));
    await vent();
    expect(flyttKall()).toEqual([]);
    fireEvent.click(knapp("timer.jobbSkjema.utenUnderprosjekt"));
    await vent();
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", externalCostObjectId: null }]);
  });

  it("jobben står på et lukket underprosjekt: vist valgt og låst, raden vises selv uten åpne", () => {
    rendre({ ecoId: "e9", ecoer: [eco(9, false)] });
    const lukket = knapp("19 · Grøft 9");
    expect(lukket.getAttribute("aria-pressed")).toBe("true");
    expect((lukket as HTMLButtonElement).disabled).toBe(true);
  });

  it("> 6: søkbar nedtrekk med «Uten» valgt; søket filtrerer; valg flytter jobben", async () => {
    rendre({ ecoer: [1, 2, 3, 4, 5, 6, 7].map((n) => eco(n)) });
    const velger = screen.getByRole<HTMLSelectElement>("combobox", { name: "timer.jobbSkjema.underprosjekt" });
    expect(velger.value).toBe("");
    expect(within(velger).getAllByRole("option")).toHaveLength(8);
    fireEvent.change(screen.getByLabelText("timer.jobbSkjema.sokUnderprosjekt"), { target: { value: "grøft 7" } });
    expect(within(velger).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "timer.jobbSkjema.utenUnderprosjekt",
      "17 · Grøft 7",
    ]);
    fireEvent.change(velger, { target: { value: "e7" } });
    await vent();
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", externalCostObjectId: "e7" }]);
  });

  it("feil fra serveren → «Ikke lagret»; «Prøv igjen» sender samme valg", async () => {
    h.feilMut[FLYTT] = "Underprosjektet er ikke åpent for timer-registrering";
    rendre({ ecoer: [eco(1)] });
    fireEvent.click(knapp("11 · Grøft 1"));
    await vent();
    expect(screen.getByTestId("ikke-lagret").textContent).toContain("Underprosjektet er ikke åpent");
    delete h.feilMut[FLYTT];
    fireEvent.click(screen.getByRole("button", { name: "timer.jobbSkjema.provIgjen" }));
    await vent();
    expect(flyttKall()).toEqual([
      { sheetId: "s1", kortId: "k1", externalCostObjectId: "e1" },
      { sheetId: "s1", kortId: "k1", externalCostObjectId: "e1" },
    ]);
    expect(screen.queryByTestId("ikke-lagret")).toBeNull();
  });

  it("ny jobb: valget lagres ikke alene, men følger raden når Til er fylt", async () => {
    rendre({ ny: true, ecoer: [eco(1)] });
    fireEvent.click(knapp("11 · Grøft 1"));
    await vent();
    expect(h.kall).toEqual([]);
    expect(knapp("11 · Grøft 1").getAttribute("aria-pressed")).toBe("true");
    const til = screen.getByLabelText("timer.jobbSkjema.til");
    fireEvent.change(til, { target: { value: "16:00" } });
    fireEvent.blur(til);
    await vent();
    expect(h.kall.find((k) => k.sti === TILFOY)?.input).toMatchObject({ kortId: "k1", externalCostObjectId: "e1" });
    expect(flyttKall()).toEqual([]);
  });
});

/**
 * O8 (§ 8.22 punkt 3): bredden mockes. Flaten (`underprosjekt-plass`) har `h.bredde` px; den
 * usynlige kopien av knappene er 100 px pr. valg. ResizeObserver mockes og kalles ved «resize».
 */
describe("O8 — underprosjekt: knapper så lenge de får plass på én linje, ellers nedtrekk", () => {
  const m = { bredde: 1000, observere: [] as Array<() => void> };
  const orig = {
    ro: globalThis.ResizeObserver,
    client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth"),
    offset: Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth"),
  };
  beforeEach(() => {
    m.observere = [];
    class RO {
      private cb: () => void;
      constructor(cb: () => void) {
        this.cb = cb;
        m.observere.push(() => this.cb());
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = RO as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.dataset.testid === "underprosjekt-plass" ? m.bredde : 0;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get(this: HTMLElement) {
        return this.hasAttribute("data-underprosjekt-maal") ? this.children.length * 100 : 0;
      },
    });
  });
  afterEach(() => {
    globalThis.ResizeObserver = orig.ro;
    if (orig.client) Object.defineProperty(HTMLElement.prototype, "clientWidth", orig.client);
    if (orig.offset) Object.defineProperty(HTMLElement.prototype, "offsetWidth", orig.offset);
  });
  const resize = (bredde: number) =>
    act(() => {
      m.bredde = bredde;
      m.observere.forEach((f) => f());
    });
  const nedtrekk = () => screen.queryByRole("combobox", { name: "timer.jobbSkjema.underprosjekt" });

  it("får plass (3 valg = 300 px i 1000 px): knapper", () => {
    m.bredde = 1000;
    rendre({ ecoer: [eco(1), eco(2)] });
    expect(nedtrekk()).toBeNull();
    expect(knapp("12 · Grøft 2")).toBeTruthy();
  });

  it("får ikke plass (3 valg = 300 px i 250 px): nedtrekk, selv om antallet er ≤ 6", () => {
    m.bredde = 250;
    rendre({ ecoer: [eco(1), eco(2)] });
    expect(nedtrekk()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "12 · Grøft 2" })).toBeNull();
  });

  it("8 valg i 2000 px: knapper, selv om antallet er > 6; klikk flytter hele jobben", async () => {
    m.bredde = 2000;
    rendre({ ecoer: [1, 2, 3, 4, 5, 6, 7].map((n) => eco(n)) });
    expect(nedtrekk()).toBeNull();
    expect(knapp("timer.jobbSkjema.utenUnderprosjekt").getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(knapp("17 · Grøft 7"));
    await vent();
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", externalCostObjectId: "e7" }]);
  });

  it("følger breddeendring: smalere → nedtrekk, bredere → knapper; ny måling på samme bredde bytter ikke (ingen flimring)", () => {
    m.bredde = 1000;
    rendre({ ecoer: [eco(1), eco(2)] });
    expect(nedtrekk()).toBeNull();
    resize(299);
    expect(nedtrekk()).toBeTruthy();
    // Kopien måles likt i begge visningene — samme bredde gir samme svar.
    resize(299);
    resize(299);
    expect(nedtrekk()).toBeTruthy();
    resize(300);
    expect(nedtrekk()).toBeNull();
    resize(300);
    expect(nedtrekk()).toBeNull();
  });

  it("nedtrekken har «Uten» forvalgt; valg flytter hele jobben", async () => {
    m.bredde = 100;
    rendre({ ecoer: [eco(1), eco(2)] });
    const velger = nedtrekk() as HTMLSelectElement;
    expect(velger.value).toBe("");
    fireEvent.change(velger, { target: { value: "e2" } });
    await vent();
    expect(flyttKall()).toEqual([{ sheetId: "s1", kortId: "k1", externalCostObjectId: "e2" }]);
  });
});
