// @vitest-environment jsdom
/**
 * w3a (S1–S7): vinduene som åpnes fra en jobb arver prosjekt, byggeplass, underprosjekt og
 * kort-id og viser ikke de feltene. Reise beholder feltene, med jobbens sted forvalgt (S6 A).
 * Dagen er #7 (`testdata-dag7.ts`): jobb 2 (k2) er 15:00–16:00 på TILL-001 (e1).
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

import Side from "./page";

// Byggeplass b1 hører til p1 — jobb 2 står der, så arven er synlig i kallet.
const BYGGEPLASSER = [{ id: "b1", name: "Blokk A", projectId: "p1" }, { id: "b2", name: "Blokk B", projectId: "p1" }];

function rendre(modus = "prosjektkort") {
  const r2 = { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1" };
  h.kall = [];
  h.feil = {};
  h.svar = {};
  h.data = {
    ...dag7Data(modus),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, timer: [DAG7_SEDEL.timer[0]!, r2] },
    "bygning.hentForFirma": BYGGEPLASSER,
  };
  return render(<Side />);
}

/** Åpner jobb 2 (TILL-001) og trykker lenken i lenkeraden. */
function fraJobb2(lenke: string) {
  const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
  fireEvent.click(kort!);
  const lenker = screen.getAllByRole("button", { name: lenke });
  // Bare det åpne kortet viser lenkeraden (S8 A).
  expect(lenker).toHaveLength(1);
  fireEvent.click(lenker[0]!);
  return screen.getByRole("dialog");
}

/** Underprosjekt-nedtrekket i timevinduet (valget med «—» og TILL-001). */
function underprosjektValg(dialog: HTMLElement): HTMLSelectElement {
  const valg = Array.from(dialog.querySelectorAll("select")).find((s) =>
    Array.from(s.options).some((o) => o.value === "e1"),
  );
  expect(valg).toBeDefined();
  return valg!;
}

const STEDSFELT = ["timer.felt.prosjekt", "timer.felt.underprosjekt", "timer.felt.byggeplass", "timer.felt.timerad"];
function utenStedsfelt(dialog: HTMLElement) {
  for (const felt of STEDSFELT) expect(dialog.textContent).not.toContain(felt);
}

describe("w3a — vinduene arver jobben", () => {
  afterEach(cleanup);

  it("«+ Timer»: ingen prosjekt/byggeplass/timerad; underprosjekt lik jobbens → jobbens kort-id og sted (S1 A, O4)", async () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    for (const felt of ["timer.felt.prosjekt", "timer.felt.byggeplass", "timer.felt.timerad"]) {
      expect(dialog.textContent).not.toContain(felt);
    }
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "17:00" } });
    fireEvent.blur(til!);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.length).toBeGreaterThan(0));
    expect(h.kall[0]!.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Maskin»: ingen timerad/sted, koblet til jobbens arbeidsrad med kort-id (S3 A)", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyMaskin");
    utenStedsfelt(dialog);
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(/Gravemaskin G-12/));
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "0.5" } });
    fireEvent.submit(dialog.querySelector("form")!);
    const tilfoy = h.kall.find((k) => k.input.vehicleId === "v1");
    expect(tilfoy?.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      sheetTimerId: "r2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
      timer: 0.5,
    });
  });

  it("w3b: maskinvinduet fra jobben har bare Utstyr og Antall timer, og sender ikke fra–til, mengde eller enhet", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyMaskin");
    expect(dialog.querySelectorAll('input[type="time"]')).toHaveLength(0);
    for (const felt of ["timer.felt.startTid", "timer.felt.sluttTid", "timer.felt.mengde", "timer.felt.enhet"]) {
      expect(dialog.textContent).not.toContain(felt);
    }
    expect(dialog.textContent).toContain("timer.felt.utstyr");
    expect(dialog.textContent).toContain("timer.felt.antallTimer");
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(/Gravemaskin G-12/));
    // Jobb 2 har 1 t arbeid og gravemaskinen m1 på 1 t fra før: høyst 0 t.
    expect(within(dialog).getByTestId("maskin-hoyst").textContent).toContain('"timer":"0,0"');
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "0.5" } });
    // Over høyst: lagre er sperret.
    expect(within(dialog).getByRole("button", { name: "handling.lagre" })).toHaveProperty("disabled", true);
  });

  it("w3b (S1 A): Antall timer forhåndsutfylles med høyst — jobbens arbeid minus jobbens andre førermaskiner", () => {
    const sedel = { ...DAG7_SEDEL, maskiner: [] };
    rendre();
    h.data["timer.dagsseddel.hentMedId"] = { ...sedel, timer: [DAG7_SEDEL.timer[0]!, { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1" }] };
    cleanup();
    render(<Side />);
    const dialog = fraJobb2("timer.prosjektkort.nyMaskin");
    const antall = dialog.querySelector<HTMLInputElement>('input[type="number"]')!;
    expect(antall.value).toBe("1");
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(/Gravemaskin G-12/));
    fireEvent.submit(dialog.querySelector("form")!);
    const tilfoy = h.kall.find((k) => k.input.vehicleId === "v1");
    expect(tilfoy?.input).toMatchObject({ timer: 1, kortId: "k2" });
    for (const felt of ["fraTid", "tilTid", "mengde", "enhet"]) expect(tilfoy?.input).not.toHaveProperty(felt);
  });

  it("w3b: døgn-maskin fra jobben foreslås med jobbens arbeidstimer, uten høyst", () => {
    rendre();
    // O5: uten maskin ført på jobben er forslaget hele arbeidet.
    h.data["timer.dagsseddel.hentMedId"] = {
      ...(h.data["timer.dagsseddel.hentMedId"] as Record<string, unknown>),
      maskiner: [],
    };
    h.data["maskin.equipment.list"] = [
      ...(h.data["maskin.equipment.list"] as unknown[]),
      { id: "v2", kategori: "annet", type: "varmer", merke: "Heatwork", modell: "MB3", internNavn: "Tiner T-1", utleieEnhet: "doegn" },
    ];
    cleanup();
    render(<Side />);
    const dialog = fraJobb2("timer.prosjektkort.nyMaskin");
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(/Tiner T-1/));
    expect(dialog.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("1");
    expect(within(dialog).queryByTestId("maskin-hoyst")).toBeNull();
  });

  it("w3b: pennen på en maskin med mengde i jobben — lagrede fra–til, mengde og enhet sendes ikke (står urørt)", () => {
    rendre();
    const sedel = h.data["timer.dagsseddel.hentMedId"] as typeof DAG7_SEDEL;
    const m1 = { ...sedel.maskiner[0]!, fraTid: "15:00", tilTid: "16:00", mengde: "12", enhet: "m3" };
    h.data["timer.dagsseddel.hentMedId"] = { ...sedel, maskiner: [m1, sedel.maskiner[1]!] };
    cleanup();
    render(<Side />);
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    const blyant = screen
      .getAllByTitle("handling.rediger")
      .find((b) => b.closest("li")?.textContent?.includes("Gravemaskin G-12"));
    fireEvent.click(blyant!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerMaskinRad" });
    expect(dialog.querySelectorAll('input[type="time"]')).toHaveLength(0);
    expect(dialog.textContent).not.toContain("timer.felt.mengde");
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "0.75" } });
    fireEvent.submit(dialog.querySelector("form")!);
    const oppdater = h.kall.find((k) => k.input.id === "m1");
    expect(oppdater?.input).toMatchObject({ id: "m1", timer: 0.75 });
    for (const felt of ["fraTid", "tilTid", "mengde", "enhet"]) expect(oppdater?.input).not.toHaveProperty(felt);
  });

  it("§ 8.22 punkt 4: maskinvinduet uten jobb (dagskort) har ingen fra–til; lagrede fra–til sendes ikke, mengde står", () => {
    rendre("dagskort");
    const sedel = h.data["timer.dagsseddel.hentMedId"] as typeof DAG7_SEDEL;
    const lagret = { fraTid: "15:00", tilTid: "16:00", mengde: "12", enhet: "m3" };
    h.data["timer.dagsseddel.hentMedId"] = { ...sedel, maskiner: sedel.maskiner.map((m) => ({ ...m, ...lagret })) };
    cleanup();
    render(<Side />);
    const blyant = screen
      .getAllByTitle("handling.rediger")
      .find((b) => b.closest("li")?.textContent?.includes("Gravemaskin G-12"));
    fireEvent.click(blyant!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerMaskinRad" });
    expect(dialog.querySelectorAll('input[type="time"]')).toHaveLength(0);
    expect(dialog.textContent).not.toContain("timer.felt.startTid");
    expect(dialog.textContent).not.toContain("timer.felt.sluttTid");
    // Negativkontroll: uten jobb står mengde og enhet.
    expect(dialog.textContent).toContain("timer.felt.mengde");
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "0.75" } });
    // Maskinen krever timerad (d2c-1): velg den første.
    const timerad = Array.from(dialog.querySelectorAll("select")).find((el) =>
      el.textContent?.includes("timer.maskinTimerad.valg"),
    )!;
    fireEvent.change(timerad, { target: { value: timerad.options[1]!.value } });
    fireEvent.submit(dialog.querySelector("form")!);
    const oppdater = h.kall.find((k) => k.sti === "timer.dagsseddel.maskin.oppdater");
    expect(oppdater?.input).toMatchObject({ timer: 0.75, mengde: 12, enhet: "m3" });
    for (const felt of ["fraTid", "tilTid"]) expect(oppdater?.input).not.toHaveProperty(felt);
  });

  it("«+ Vare»: ingen prosjekt/timerad/byggeplass, varen følger jobbens første arbeidsrad (S2 A)", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyVareKort");
    utenStedsfelt(dialog);
    fireEvent.change(dialog.querySelector("select")!, { target: { value: "va1" } });
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.prosjektkort.vareLagre" }));
    expect(h.kall.at(-1)?.input).toMatchObject({
      projectId: "p1",
      vareId: "va1",
      antall: 3,
      kortId: "k2",
      sheetTimerId: "r2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Tillegg/Utlegg» → tillegg: stedet arves og kort-id sendes", () => {
    rendre();
    fraJobb2("timer.prosjektkort.leggTil");
    fireEvent.click(screen.getByText("Smusstillegg"));
    const dialog = screen.getByRole("dialog");
    utenStedsfelt(dialog);
    fireEvent.submit(dialog.querySelector("form")!);
    expect(h.kall.at(-1)?.input).toMatchObject({
      projectId: "p1",
      kortId: "k2",
      externalCostObjectId: "e1",
      byggeplassId: "b1",
    });
  });

  it("«+ Reise»: feltene står, med jobbens byggeplass og underprosjekt forvalgt (S6 A)", () => {
    rendre();
    h.data["organisasjon.hentArbeidstidDefaults"] = {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
    };
    h.data["timer.lonnsart.list"] = [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ];
    cleanup();
    render(<Side />);
    const dialog = fraJobb2("timer.prosjektkort.nyReise");
    const verdier = Array.from(dialog.querySelectorAll("select")).map((s) => s.value);
    expect(verdier).toContain("b1");
    expect(verdier).toContain("e1");
  });

  it("blyanten på jobbens timerlinje: «Rediger timer-rad» står med stedsfeltene (gate 107)", () => {
    rendre();
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    // L3a: timerlinja står i jobbskjemaet — blyanten i skjemaets hode åpner samme vindu.
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(dialog.textContent).toContain("timer.felt.prosjekt");
    expect(dialog.textContent).toContain("timer.felt.underprosjekt");
    expect(dialog.textContent).toContain("timer.felt.byggeplass");
    // Prosjektet står låst ved redigering, som før. Byggeplass og underprosjekt kan endres (A7).
    const prosjekt = Array.from(dialog.querySelectorAll("select")).find((s) => s.value === "p1");
    expect(prosjekt?.disabled).toBe(true);
    const ecoVelger = Array.from(dialog.querySelectorAll("select")).find((s) => s.value === "e1");
    expect(ecoVelger?.disabled).toBe(false);
  });

  it("blyanten på jobbens reiselinje: «Rediger timer-rad» står med stedsfeltene (gate 107, B34 B)", () => {
    rendre();
    const sedel = h.data["timer.dagsseddel.hentMedId"] as typeof DAG7_SEDEL;
    const reise = {
      ...sedel.timer[1]!,
      id: "r3",
      lonnsartId: "lr",
      fraTid: "16:00",
      tilTid: "16:30",
      timer: "0.5",
      erReise: true,
      reiseRetning: "retur",
      createdAt: "2026-11-20T16:00:00.000Z",
    };
    h.data["timer.dagsseddel.hentMedId"] = { ...sedel, timer: [...sedel.timer, reise] };
    h.data["organisasjon.hentArbeidstidDefaults"] = {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
    };
    h.data["timer.lonnsart.list"] = [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ];
    cleanup();
    render(<Side />);
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    const blyanter = screen.getAllByTitle("handling.rediger");
    // Reiselinjen (16:00–16:30) står som egen linje i jobben; blyanten i samme <li>.
    const reiseBlyant = blyanter.find((b) => b.closest("li")?.textContent?.includes("16:00–16:30"));
    expect(reiseBlyant).toBeDefined();
    fireEvent.click(reiseBlyant!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(dialog.textContent).toContain("timer.felt.prosjekt");
    expect(dialog.textContent).toContain("timer.felt.underprosjekt");
    expect(dialog.textContent).toContain("timer.felt.byggeplass");
    // Det er reiseraden som redigeres.
    expect(Array.from(dialog.querySelectorAll("input")).some((i) => i.value === "16:30")).toBe(true);
  });

  it("dagskort-modus: «Legg til timer-rad» har prosjekt- og underprosjektfeltet som før (S4 C)", () => {
    rendre("dagskort");
    fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyTimer/ })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("timer.felt.prosjekt");
    expect(dialog.textContent).toContain("timer.felt.underprosjekt");
  });
});

describe("O5 A — «+ Maskin» trekker fra maskintid ført på jobben (§ 8.22, Kenneth etter test d4bec43e)", () => {
  afterEach(cleanup);

  const HEATWORK = {
    id: "v2", kategori: "annet", type: "varmer", merke: "Heatwork", modell: "MB3", internNavn: "Tiner T-1", utleieEnhet: "doegn",
  };
  const m1 = DAG7_SEDEL.maskiner[0]!;
  /** Jobb 2 (k2) blir 15:00–21:00 = 6 t arbeid; `maskiner` er det som alt er ført på dagen. */
  function jobb6t(maskiner: unknown[]) {
    rendre();
    h.data["maskin.equipment.list"] = [...(h.data["maskin.equipment.list"] as unknown[]), HEATWORK];
    h.data["timer.dagsseddel.hentMedId"] = {
      ...DAG7_SEDEL,
      timer: [
        DAG7_SEDEL.timer[0]!,
        { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1", tilTid: "21:00", timer: "6" },
      ],
      maskiner,
    };
    cleanup();
    render(<Side />);
    return fraJobb2("timer.prosjektkort.nyMaskin");
  }
  function forslagFor(dialog: HTMLElement, navn: RegExp) {
    fireEvent.click(within(dialog).getAllByRole("button")[0]!);
    fireEvent.click(within(dialog).getByText(navn));
    return dialog.querySelector<HTMLInputElement>('input[type="number"]')!.value;
  }

  it("Kenneths eksempel: jobb 6 t, Volvo 3 t ført → Heatwork som maskin nr. 2 foreslås med 3 t", () => {
    const dialog = jobb6t([{ ...m1, timer: "3" }]);
    expect(forslagFor(dialog, /Tiner T-1/)).toBe("3");
  });

  it("førermaskin med Volvo 3 t ført: forslaget er 3 t (som høyst)", () => {
    const dialog = jobb6t([{ ...m1, timer: "3" }]);
    expect(forslagFor(dialog, /Gravemaskin G-12/)).toBe("3");
    expect(within(dialog).getByTestId("maskin-hoyst").textContent).toContain('"timer":"3,0"');
  });

  it("to maskiner ført (Volvo 3 t + Heatwork 1,5 t): forslaget er 1,5 t; maskinen uten jobb (m0) teller ikke", () => {
    const dialog = jobb6t([
      { ...m1, timer: "3" },
      { ...m1, id: "m2", vehicleId: "v2", timer: "1.5" },
      DAG7_SEDEL.maskiner[1]!,
    ]);
    expect(forslagFor(dialog, /Gravemaskin G-12/)).toBe("1.5");
    // Høyst trekker bare fra førermaskinene: 6 − 3 = 3 t.
    expect(within(dialog).getByTestId("maskin-hoyst").textContent).toContain('"timer":"3,0"');
  });

  it("aldri under 0: maskiner ført for mer enn jobbens arbeid gir tomt felt, ikke minus", () => {
    const dialog = jobb6t([
      { ...m1, timer: "4" },
      { ...m1, id: "m2", vehicleId: "v2", timer: "5" },
    ]);
    const verdi = forslagFor(dialog, /Tiner T-1/);
    expect(verdi).toBe("");
  });
});

describe("w3b — maskindelen i «Legg til» og «Rediger timer-rad» (prosjektkort-modus)", () => {
  afterEach(cleanup);

  function medMaskinModul(modus = "prosjektkort") {
    rendre(modus);
    h.data["modul.effektivTilstand"] = { maskin: true };
    cleanup();
    return render(<Side />);
  }
  function redigerJobb2Timerrad() {
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    // L3a: jobb 2 (15:00–16:00) står i jobbskjemaet — blyanten i skjemaets hode.
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    return screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
  }
  const stier = () => h.kall.map((k) => k.sti);

  it("Rediger: viser jobbens maskin (utstyr låst, antall kan rettes), uten Mengde og Enhet", () => {
    medMaskinModul();
    const dialog = redigerJobb2Timerrad();
    const linjer = within(dialog).getAllByTestId("jobb-maskin");
    expect(linjer).toHaveLength(1);
    expect(linjer[0]!.textContent).toContain("Volvo EC140 (Gravemaskin G-12)");
    expect(linjer[0]!.querySelector<HTMLInputElement>('input[type="number"]')!.value).toBe("1");
    expect(dialog.textContent).toContain("timer.maskinSeksjon.hintJobb");
    expect(dialog.textContent).not.toContain("timer.felt.mengde");
    expect(dialog.textContent).not.toContain("timer.felt.enhet");
  });

  it("Rediger: lavere antall lagres før raden; × fjerner maskinen", async () => {
    medMaskinModul();
    let dialog = redigerJobb2Timerrad();
    fireEvent.change(within(dialog).getByTestId("jobb-maskin").querySelector("input")!, { target: { value: "0.5" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(stier()).toContain("timer.dagsseddel.oppdaterTimerRad"));
    expect(stier()).toEqual(["timer.dagsseddel.maskin.oppdater", "timer.dagsseddel.oppdaterTimerRad"]);
    expect(h.kall[0]!.input).toEqual({ id: "m1", timer: 0.5 });

    cleanup();
    medMaskinModul();
    dialog = redigerJobb2Timerrad();
    fireEvent.click(within(dialog).getByTitle("timer.maskinSeksjon.fjern"));
    expect(within(dialog).queryAllByTestId("jobb-maskin")).toHaveLength(0);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(stier()).toContain("timer.dagsseddel.oppdaterTimerRad"));
    expect(h.kall[0]).toEqual({ sti: "timer.dagsseddel.maskin.fjern", input: { id: "m1" } });
  });

  it("Rediger: høyere antall over høyst sperrer Lagre; høyere innenfor lagres etter raden", async () => {
    medMaskinModul();
    let dialog = redigerJobb2Timerrad();
    const antall = () => within(dialog).getByTestId("jobb-maskin").querySelector("input")!;
    fireEvent.change(antall(), { target: { value: "1.5" } });
    expect(within(dialog).getByRole("button", { name: "handling.lagre" })).toHaveProperty("disabled", true);

    // Raden forlenges til 15:00–17:00 (2 t): 1,5 t er innenfor.
    cleanup();
    medMaskinModul();
    dialog = redigerJobb2Timerrad();
    // Plan § 8.22 L2: «Hva gjorde du?» er påkrevd i prosjektkort-modus — jobb 2 har ingen ennå.
    fireEvent.change(dialog.querySelector("textarea")!, { target: { value: "Graving" } });
    const til = dialog.querySelectorAll<HTMLInputElement>('input[type="time"]')[1]!;
    fireEvent.change(til, { target: { value: "17:00" } });
    fireEvent.blur(til);
    fireEvent.change(antall(), { target: { value: "1.5" } });
    expect(within(dialog).getByRole("button", { name: "handling.lagre" })).toHaveProperty("disabled", false);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(stier()).toContain("timer.dagsseddel.maskin.oppdater"));
    expect(stier()).toEqual(["timer.dagsseddel.oppdaterTimerRad", "timer.dagsseddel.maskin.oppdater"]);
  });

  it("«+ Timer» fra jobben: ny maskin foreslås med radens timer og lagres på den nye raden uten fra–til, mengde og enhet", async () => {
    medMaskinModul();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    // O3: jobbens maskin vises ikke i «Legg til timer-rad».
    expect(within(dialog).queryAllByTestId("jobb-maskin")).toHaveLength(0);
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "17:00" } });
    fireEvent.blur(til!);
    fireEvent.click(within(dialog).getByText("timer.maskinSeksjon.tittel"));
    fireEvent.click(within(dialog).getByRole("button", { name: /timer\.velgUtstyr/ }));
    fireEvent.click(within(dialog).getAllByText(/Gravemaskin G-12/).at(-1)!);
    // Radens timer: 1 t (høyst er også 1 t: jobben 2 t arbeid, m1 har 1 t).
    expect(within(dialog).getByTestId<HTMLInputElement>("ny-maskin-timer").value).toBe("1");
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(stier()).toContain("timer.dagsseddel.maskin.tilfoy"));
    expect(stier()).toEqual(["timer.dagsseddel.tilfoyTimerRad", "timer.dagsseddel.maskin.tilfoy"]);
    const maskin = h.kall[1]!.input;
    expect(maskin).toMatchObject({ vehicleId: "v1", timer: 1, sheetTimerId: "ny", kortId: "k2", projectId: "p1" });
    for (const felt of ["fraTid", "tilTid", "mengde", "enhet"]) expect(maskin).not.toHaveProperty(felt);
  });

  it("dagskort-modus: maskindelen er som før (ingen jobbens maskiner, Mengde og Enhet står)", () => {
    medMaskinModul("dagskort");
    fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyTimer/ })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    fireEvent.click(within(dialog).getByText("timer.maskinSeksjon.tittel"));
    expect(dialog.textContent).toContain("timer.felt.mengde");
    expect(dialog.textContent).toContain("timer.maskinSeksjon.hint");
    expect(dialog.textContent).not.toContain("timer.maskinSeksjon.hintJobb");
  });
});

describe("w3b — B37 A: lenken til der Varelager slås på", () => {
  afterEach(cleanup);

  function medVarelagerAv(rolle: { sitedoc?: boolean; adminFor?: string[] }) {
    rendre();
    delete h.data["vareforbruk.katalogForFirma"];
    h.feil["vareforbruk.katalogForFirma"] = { data: { code: "FORBIDDEN" } };
    h.data["bruker.hentMin"] = { role: rolle.sitedoc ? "sitedoc_admin" : "user" };
    h.data["organisasjon.hentTilgjengelige"] = (rolle.adminFor ?? []).map((id) => ({ id, name: id }));
    cleanup();
    render(<Side />);
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
  }

  it("firmaadministrator for sedelens firma: «+ Vare» skjult, lenke til firmaets moduler", () => {
    medVarelagerAv({ adminFor: ["o1"] });
    expect(screen.queryByRole("button", { name: "timer.prosjektkort.nyVareKort" })).toBeNull();
    const lenke = within(screen.getByTestId("varelager-lenke")).getByRole("link");
    expect(lenke.getAttribute("href")).toBe("/dashbord/firma/moduler");
    expect(lenke.textContent).toBe("timer.prosjektkort.slaaPaaVarelager");
  });

  it("lenken velger sedelens firma før navigeringen (modulsiden leser firmaet valgt i toppen)", () => {
    medVarelagerAv({ sitedoc: true });
    h.velgFirma.mockClear();
    const lenke = within(screen.getByTestId("varelager-lenke")).getByRole("link");
    fireEvent.click(lenke);
    expect(h.velgFirma).toHaveBeenCalledWith(DAG7_SEDEL.organizationId);
  });

  it("sitedoc_admin ser lenken", () => {
    medVarelagerAv({ sitedoc: true });
    expect(screen.getByTestId("varelager-lenke")).toBeTruthy();
  });

  it("arbeider, eller admin for et annet firma: ingen lenke, «+ Vare» skjult som i dag", () => {
    medVarelagerAv({});
    expect(screen.queryByTestId("varelager-lenke")).toBeNull();
    expect(screen.queryByRole("button", { name: "timer.prosjektkort.nyVareKort" })).toBeNull();
    cleanup();
    medVarelagerAv({ adminFor: ["o2"] });
    expect(screen.queryByTestId("varelager-lenke")).toBeNull();
  });

  it("Varelager på for firmaet, prosjektet av (S5 A): ingen lenke", () => {
    rendre();
    h.data["vareforbruk.katalogForFirma"] = { varer: [], prosjektIderMedVarelager: [] };
    h.data["bruker.hentMin"] = { role: "user" };
    h.data["organisasjon.hentTilgjengelige"] = [{ id: "o1", name: "o1" }];
    cleanup();
    render(<Side />);
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    expect(screen.queryByRole("button", { name: "timer.prosjektkort.nyVareKort" })).toBeNull();
    expect(screen.queryByTestId("varelager-lenke")).toBeNull();
  });

  it("Varelager på: «+ Vare» vises, ingen lenke", () => {
    rendre();
    h.data["organisasjon.hentTilgjengelige"] = [{ id: "o1", name: "o1" }];
    cleanup();
    render(<Side />);
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    expect(screen.getByRole("button", { name: "timer.prosjektkort.nyVareKort" })).toBeTruthy();
    expect(screen.queryByTestId("varelager-lenke")).toBeNull();
  });
});

describe("O3 — maskin i «Legg til timer-rad» starter tom, forslag = radens timer (§ 8.22 punkt 3)", () => {
  afterEach(cleanup);

  const HEATWORK = {
    id: "v2", kategori: "annet", type: "varmer", merke: "Heatwork", modell: "MB3", internNavn: "Tiner T-1", utleieEnhet: "doegn",
  };
  /** Dagen #7 med maskinmodul og Heatwork; `sedel` overstyrer det sedelen inneholder. */
  function medMaskiner(sedel: Record<string, unknown> = {}) {
    rendre();
    h.data["modul.effektivTilstand"] = { maskin: true };
    h.data["maskin.equipment.list"] = [...(h.data["maskin.equipment.list"] as unknown[]), HEATWORK];
    h.data["timer.dagsseddel.hentMedId"] = {
      ...(h.data["timer.dagsseddel.hentMedId"] as Record<string, unknown>),
      ...sedel,
    };
    cleanup();
    return render(<Side />);
  }
  /** «+ Timer» fra jobb 2 på TILL-001, 16:00–18:30 (2,5 t). Jobben har da 3,5 t arbeid. */
  function nyRad25() {
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "18:30" } });
    fireEvent.blur(til!);
    return dialog;
  }
  function velgUtstyr(dialog: HTMLElement, navn: RegExp) {
    // Uten maskiner på raden er maskindelen lukket.
    if (!within(dialog).queryByRole("button", { name: /timer\.velgUtstyr/ })) {
      fireEvent.click(within(dialog).getByText("timer.maskinSeksjon.tittel"));
    }
    fireEvent.click(within(dialog).getByRole("button", { name: /timer\.velgUtstyr/ }));
    fireEvent.click(within(dialog).getAllByText(navn).at(-1)!);
  }

  it("maskindelen viser ikke jobbens maskiner (jobb 2 har gravemaskinen m1)", () => {
    medMaskiner();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    expect(within(dialog).getByTestId("kort-maskindel")).toBeTruthy();
    expect(within(dialog).queryAllByTestId("jobb-maskin")).toHaveLength(0);
    expect(dialog.textContent).not.toContain("timer.maskinSeksjon.jobbensMaskiner");
  });

  it("førermaskin: forslaget er radens 2,5 t, ikke jobbens 3,5 t; feltet kan rettes", () => {
    medMaskiner({ maskiner: [] });
    const dialog = nyRad25();
    velgUtstyr(dialog, /Gravemaskin G-12/);
    const felt = within(dialog).getByTestId<HTMLInputElement>("ny-maskin-timer");
    expect(felt.value).toBe("2.5");
    fireEvent.change(felt, { target: { value: "2" } });
    expect(felt.value).toBe("2");
  });

  it("døgnmaskin (Heatwork): forslaget er radens 2,5 t, ikke jobbens 3,5 t", () => {
    medMaskiner({ maskiner: [] });
    const dialog = nyRad25();
    velgUtstyr(dialog, /Tiner T-1/);
    expect(within(dialog).getByTestId<HTMLInputElement>("ny-maskin-timer").value).toBe("2.5");
  });

  it("vakt: «Rediger timer-rad» er uendret — jobbens maskiner vises, og Heatwork foreslås med jobbens arbeid", () => {
    // Jobb 2 får en rad til (16:00–18:30, 2,5 t): jobbens arbeid er 3,5 t, raden r2 har 1 t.
    const r3 = { ...DAG7_SEDEL.timer[1]!, id: "r3", byggeplassId: "b1", fraTid: "16:00", tilTid: "18:30", timer: "2.5", createdAt: "2026-11-20T16:00:00.000Z" };
    medMaskiner({ timer: [DAG7_SEDEL.timer[0]!, { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1" }, r3] });
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    // To arbeidsrader: linjene står med penn (ikke jobbskjemaet). Første penn er r2 (15:00).
    fireEvent.click(screen.getAllByTitle("handling.rediger")[0]!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(dialog.querySelector<HTMLInputElement>('input[type="time"]')!.value).toBe("15:00");
    expect(within(dialog).getAllByTestId("jobb-maskin")).toHaveLength(1);
    velgUtstyr(dialog, /Tiner T-1/);
    expect(within(dialog).getByTestId<HTMLInputElement>("ny-maskin-timer").value).toBe("3.5");
  });
});

describe("O4 — underprosjekt i «Legg til timer-rad» (§ 8.22 punkt 7)", () => {
  afterEach(cleanup);

  async function lagre(dialog: HTMLElement) {
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "17:00" } });
    fireEvent.blur(til!);
    fireEvent.change(dialog.querySelector("textarea")!, { target: { value: "Opprydding" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.some((k) => k.sti === "timer.dagsseddel.tilfoyTimerRad")).toBe(true));
    return h.kall.find((k) => k.sti === "timer.dagsseddel.tilfoyTimerRad")!.input;
  }

  it("nedtrekket står med «—» forvalgt, ikke jobbens underprosjekt (TILL-001)", () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    expect(dialog.textContent).toContain("timer.felt.underprosjekt");
    const valg = underprosjektValg(dialog);
    expect(valg.value).toBe("");
    expect(valg.options[0]!.textContent).toBe("—");
  });

  it("prosjektet har ingen åpne underprosjekter: nedtrekket vises ikke", () => {
    rendre();
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    // Lista er tom (serveren gir bare åpne underprosjekter) når vinduet åpnes.
    h.data["eksternKostObjekt.list"] = [];
    fireEvent.click(screen.getByRole("button", { name: "timer.prosjektkort.nyTimer" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).not.toContain("timer.felt.underprosjekt");
  });

  it("annet underprosjekt enn jobbens («—» på jobb 2): raden får egen kort-id, ikke jobbens k2", async () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    const input = await lagre(dialog);
    expect(input).toMatchObject({ projectId: "p1", externalCostObjectId: null, byggeplassId: "b1" });
    expect(typeof input.kortId).toBe("string");
    expect(input.kortId).not.toBe("k2");
    expect(input.kortId).not.toBe("k1");
  });

  it("samme underprosjekt som jobben (TILL-001): jobbens kort-id k2", async () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    const input = await lagre(dialog);
    expect(input).toMatchObject({ kortId: "k2", externalCostObjectId: "e1" });
  });
});

describe("O5 B — overtid deles automatisk ved lagring i prosjektkort-modus (§ 8.22, Kenneth etter test d4bec43e)", () => {
  afterEach(cleanup);

  const TL = { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time", overtidsnivaa: null, rekkefolge: 1 };
  const OT = { id: "ot", navn: "Overtid 50 %", type: "ordinaer", aktiv: true, satsEnhet: "time", overtidsnivaa: 50, rekkefolge: 2 };
  const r2 = DAG7_SEDEL.timer[1]!;
  /** Jobb 2 (k2, TILL-001) er 07:00–13:30 med 30 min pause = 6 t; dagsnorm 7,5 t. `ekstra` er flere rader i jobben. */
  function dag6t(modus = "prosjektkort", ekstra: Record<string, unknown>[] = []) {
    rendre(modus);
    h.data["timer.lonnsart.list"] = [TL, OT];
    h.data["organisasjon.hentEffektivArbeidstid"] = { dagsnorm: 7.5, pauseReferanse: "ankomst", pauseEtterTimer: 4 };
    h.data["timer.dagsseddel.hentMedId"] = {
      ...DAG7_SEDEL,
      timer: [
        { ...r2, byggeplassId: "b1", fraTid: "07:00", tilTid: "13:30", timer: "6", pauseMin: 30, beskrivelse: "Graving" },
        ...ekstra.map((r) => ({ ...r2, byggeplassId: "b1", pauseMin: 0, beskrivelse: "Graving", ...r })),
      ],
      maskiner: [],
    };
    cleanup();
    return render(<Side />);
  }
  const valgMed = (dialog: HTMLElement, verdi: string) =>
    Array.from(dialog.querySelectorAll("select")).find((s) => Array.from(s.options).some((o) => o.value === verdi))!;
  function settTid(dialog: HTMLElement, fraV: string | null, tilV: string) {
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    if (fraV) {
      fireEvent.change(fra!, { target: { value: fraV } });
      fireEvent.blur(fra!);
    }
    fireEvent.change(til!, { target: { value: tilV } });
    fireEvent.blur(til!);
  }
  /** «+ Timer» fra jobb 2, 13:30–15:30 på Timelønn og jobbens underprosjekt. */
  function leggTil1330() {
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    fireEvent.change(valgMed(dialog, "l1"), { target: { value: "l1" } });
    fireEvent.change(valgMed(dialog, "a1"), { target: { value: "a1" } });
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    settTid(dialog, "13:30", "15:30");
    fireEvent.change(dialog.querySelector("textarea")!, { target: { value: "Opprydding" } });
    return dialog;
  }
  const timerKall = () =>
    h.kall.filter((k) => k.sti === "timer.dagsseddel.tilfoyTimerRad" || k.sti === "timer.dagsseddel.oppdaterTimerRad");
  /** Penn nr. `i` blant timerlinjene på jobb 2 (linjene står med penn når jobben har flere arbeidsrader). */
  function rediger(i: number) {
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
    // Bare timerlinjenes penner (varen på jobben har også penn).
    const penner = screen
      .getAllByTitle("handling.rediger")
      .filter((p) => p.parentElement?.parentElement?.textContent?.includes("timer.timerEnhet"));
    fireEvent.click(penner[i]!);
    return screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
  }

  it("«Legg til» 13:30–15:30 på en dag med 6 t: 1,5 t Timelønn + 0,5 t overtid, begge i jobbens kort", async () => {
    dag6t();
    const dialog = leggTil1330();
    // Opplysning, ikke knapp.
    expect(within(dialog).getByTestId("overtid-ved-lagring").textContent).toContain("timer.overtidForslag.delesVedLagring");
    expect(within(dialog).queryByRole("button", { name: "timer.overtidForslag.delKnapp" })).toBeNull();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(timerKall()).toHaveLength(2));
    const [normal, overtid] = timerKall();
    expect(normal).toMatchObject({
      sti: "timer.dagsseddel.tilfoyTimerRad",
      input: { fraTid: "13:30", tilTid: "15:00", timer: 1.5, lonnsartId: "l1", kortId: "k2", externalCostObjectId: "e1" },
    });
    expect(overtid).toMatchObject({
      sti: "timer.dagsseddel.tilfoyTimerRad",
      input: { fraTid: "15:00", tilTid: "15:30", timer: 0.5, lonnsartId: "ot", kortId: "k2", externalCostObjectId: "e1" },
    });
  });

  it("«Legg til» innenfor normen (13:30–14:30): én rad, ingen opplysning", async () => {
    dag6t();
    const dialog = leggTil1330();
    settTid(dialog, null, "14:30");
    expect(within(dialog).queryByTestId("overtid-ved-lagring")).toBeNull();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(timerKall()).toHaveLength(1));
    expect(timerKall()[0]!.input).toMatchObject({ fraTid: "13:30", tilTid: "14:30", timer: 1, lonnsartId: "l1" });
  });

  it("«Rediger» som flytter raden over normen (13:30–14:30 → 15:30) deler: raden kortes inn, overtiden blir ny rad", async () => {
    dag6t("prosjektkort", [{ id: "r3", fraTid: "13:30", tilTid: "14:30", timer: "1", createdAt: "2026-11-20T13:30:00.000Z" }]);
    const dialog = rediger(1);
    expect(dialog.querySelector<HTMLInputElement>('input[type="time"]')!.value).toBe("13:30");
    settTid(dialog, null, "15:30");
    expect(within(dialog).getByTestId("overtid-ved-lagring")).toBeTruthy();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(timerKall()).toHaveLength(2));
    const [normal, overtid] = timerKall();
    expect(normal).toMatchObject({
      sti: "timer.dagsseddel.oppdaterTimerRad",
      input: { id: "r3", fraTid: "13:30", tilTid: "15:00", timer: 1.5, lonnsartId: "l1" },
    });
    expect(overtid).toMatchObject({
      sti: "timer.dagsseddel.tilfoyTimerRad",
      input: { fraTid: "15:00", tilTid: "15:30", timer: 0.5, lonnsartId: "ot", kortId: "k2" },
    });
  });

  it("gate 134 V1: deling der varen ikke ble flyttet — kall 2 gjøres, vinduet står åpent med feilen", async () => {
    dag6t("prosjektkort", [{ id: "r3", fraTid: "13:30", tilTid: "14:30", timer: "1", createdAt: "2026-11-20T13:30:00.000Z" }]);
    h.svar["timer.dagsseddel.oppdaterTimerRad"] = { id: "r3", vareIkkeFlyttet: true };
    const dialog = rediger(1);
    settTid(dialog, null, "15:30");
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(within(dialog).getByText("timer.feil.vareIkkeFlyttet")).toBeTruthy());
    const [normal, overtid] = timerKall();
    expect(normal).toMatchObject({ sti: "timer.dagsseddel.oppdaterTimerRad", input: { id: "r3", tilTid: "15:00" } });
    expect(overtid).toMatchObject({ sti: "timer.dagsseddel.tilfoyTimerRad", input: { fraTid: "15:00", tilTid: "15:30", lonnsartId: "ot" } });
    expect(screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" })).toBe(dialog);
  });

  it("bevisst artsbytte står: overtidsdelen byttet til Timelønn på uendret tid lagres som Timelønn, uten ny deling", async () => {
    dag6t("prosjektkort", [
      { id: "r3", fraTid: "13:30", tilTid: "15:00", timer: "1.5", createdAt: "2026-11-20T13:30:00.000Z" },
      { id: "r4", fraTid: "15:00", tilTid: "15:30", timer: "0.5", lonnsartId: "ot", createdAt: "2026-11-20T15:00:00.000Z" },
    ]);
    const dialog = rediger(2);
    expect(dialog.querySelector<HTMLInputElement>('input[type="time"]')!.value).toBe("15:00");
    fireEvent.change(valgMed(dialog, "l1"), { target: { value: "l1" } });
    expect(within(dialog).queryByTestId("overtid-ved-lagring")).toBeNull();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(timerKall()).toHaveLength(1));
    expect(timerKall()[0]).toMatchObject({
      sti: "timer.dagsseddel.oppdaterTimerRad",
      input: { id: "r4", fraTid: "15:00", tilTid: "15:30", lonnsartId: "l1" },
    });
  });

  it("vakt: dagskort-modus har den gule boksen med «Del raden» og lagrer én rad uten knappen", async () => {
    dag6t("dagskort");
    fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyTimer/ })[0]!);
    const dialog = screen.getByRole("dialog");
    fireEvent.change(valgMed(dialog, "l1"), { target: { value: "l1" } });
    fireEvent.change(valgMed(dialog, "a1"), { target: { value: "a1" } });
    settTid(dialog, "13:30", "15:30");
    expect(within(dialog).getByRole("button", { name: "timer.overtidForslag.delKnapp" })).toBeTruthy();
    expect(within(dialog).queryByTestId("overtid-ved-lagring")).toBeNull();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(timerKall()).toHaveLength(1));
    expect(timerKall()[0]!.input).toMatchObject({ fraTid: "13:30", tilTid: "15:30", timer: 2, lonnsartId: "l1" });
  });
});

describe("O7 — reise-rad uten maskinseksjon (§ 8.22 punkt 3)", () => {
  afterEach(cleanup);

  /** Maskin-modul på, reise-lønnsart «lr». `medReise` legger en lagret reise (16:00–16:30) i jobb 2. */
  function medMaskinOgReise(medReise = false) {
    rendre();
    const sedel = h.data["timer.dagsseddel.hentMedId"] as typeof DAG7_SEDEL;
    if (medReise) {
      const reise = {
        ...sedel.timer[1]!,
        id: "r3",
        lonnsartId: "lr",
        fraTid: "16:00",
        tilTid: "16:30",
        timer: "0.5",
        erReise: true,
        reiseRetning: "retur",
        createdAt: "2026-11-20T16:00:00.000Z",
      };
      h.data["timer.dagsseddel.hentMedId"] = { ...sedel, timer: [...sedel.timer, reise] };
    }
    h.data["modul.effektivTilstand"] = { maskin: true };
    h.data["organisasjon.hentArbeidstidDefaults"] = {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
    };
    h.data["timer.lonnsart.list"] = [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ];
    cleanup();
    return render(<Side />);
  }
  function aapneJobb2() {
    const kort = screen.getAllByRole("button").find((b) => b.textContent?.includes("TILL-001"));
    fireEvent.click(kort!);
  }
  function redigerTimerrad() {
    aapneJobb2();
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.aapneVinduHint")[0]!);
    return screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
  }
  const lonnsartValg = (dialog: HTMLElement) =>
    Array.from(dialog.querySelectorAll("select")).find((s) =>
      Array.from(s.options).some((o) => o.value === "lr"),
    )!;
  const maskinKall = () => h.kall.filter((k) => k.sti.startsWith("timer.dagsseddel.maskin."));

  it("vakt: vanlig timer-rad viser maskinseksjonen med jobbens maskin som før", () => {
    medMaskinOgReise();
    const dialog = redigerTimerrad();
    expect(within(dialog).getByTestId("kort-maskindel")).toBeTruthy();
    expect(within(dialog).getAllByTestId("jobb-maskin")).toHaveLength(1);
    expect(dialog.textContent).toContain("timer.maskinSeksjon.jobbensMaskiner");
  });

  it("«+ Reise» (reisekortet): ingen maskinseksjon", () => {
    medMaskinOgReise();
    const dialog = fraJobb2("timer.prosjektkort.nyReise");
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    expect(dialog.textContent).not.toContain("timer.maskinSeksjon.tittel");
  });

  it("«Legg til timer-rad» med lønnsart reise: ingen maskinseksjon — verken jobbens maskiner eller «Velg utstyr»", () => {
    medMaskinOgReise();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    expect(within(dialog).getByTestId("kort-maskindel")).toBeTruthy();
    fireEvent.change(lonnsartValg(dialog), { target: { value: "lr" } });
    expect(dialog.textContent).toContain("timer.rediger.reiseHavner");
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    expect(within(dialog).queryAllByTestId("jobb-maskin")).toHaveLength(0);
    expect(dialog.textContent).not.toContain("timer.maskinSeksjon.tittel");
    expect(within(dialog).queryByRole("button", { name: /timer\.velgUtstyr/ })).toBeNull();
  });

  it("lagret reise: «Rediger timer-rad» har ingen maskinseksjon", () => {
    medMaskinOgReise(true);
    aapneJobb2();
    const reiseBlyant = screen
      .getAllByTitle("handling.rediger")
      .find((b) => b.closest("li")?.textContent?.includes("16:00–16:30"));
    fireEvent.click(reiseBlyant!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    expect(dialog.textContent).not.toContain("timer.maskinSeksjon.tittel");
  });

  it("bytte til reise mens vinduet er åpent skjuler seksjonen; tilbake viser den igjen", () => {
    medMaskinOgReise();
    const dialog = redigerTimerrad();
    expect(within(dialog).getByTestId("kort-maskindel")).toBeTruthy();
    fireEvent.change(lonnsartValg(dialog), { target: { value: "lr" } });
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    fireEvent.change(lonnsartValg(dialog), { target: { value: "l1" } });
    expect(within(dialog).getAllByTestId("jobb-maskin")).toHaveLength(1);
  });

  it("lagring etter bytte til reise: jobbens maskiner står urørt (ingen maskin-kall), også en rettet eller fjernet linje", async () => {
    medMaskinOgReise();
    let dialog = redigerTimerrad();
    fireEvent.change(within(dialog).getByTestId("jobb-maskin").querySelector("input")!, { target: { value: "0.5" } });
    fireEvent.change(lonnsartValg(dialog), { target: { value: "lr" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.map((k) => k.sti)).toContain("timer.dagsseddel.oppdaterTimerRad"));
    expect(maskinKall()).toEqual([]);
    expect(h.kall.find((k) => k.sti === "timer.dagsseddel.oppdaterTimerRad")!.input).toMatchObject({ lonnsartId: "lr" });

    cleanup();
    medMaskinOgReise();
    dialog = redigerTimerrad();
    fireEvent.click(within(dialog).getByTitle("timer.maskinSeksjon.fjern"));
    fireEvent.change(lonnsartValg(dialog), { target: { value: "lr" } });
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.map((k) => k.sti)).toContain("timer.dagsseddel.oppdaterTimerRad"));
    expect(maskinKall()).toEqual([]);
  });

  it("«Legg til timer-rad» med valgt utstyr før bytte til reise: ingen ny maskin opprettes", async () => {
    medMaskinOgReise();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    fireEvent.change(underprosjektValg(dialog), { target: { value: "e1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "16:30" } });
    fireEvent.blur(til!);
    fireEvent.click(within(dialog).getByText("timer.maskinSeksjon.tittel"));
    fireEvent.click(within(dialog).getByRole("button", { name: /timer\.velgUtstyr/ }));
    fireEvent.click(within(dialog).getAllByText(/Gravemaskin G-12/).at(-1)!);
    fireEvent.change(lonnsart!, { target: { value: "lr" } });
    expect(within(dialog).queryByTestId("kort-maskindel")).toBeNull();
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(h.kall.map((k) => k.sti)).toContain("timer.dagsseddel.tilfoyTimerRad"));
    expect(maskinKall()).toEqual([]);
  });
});
