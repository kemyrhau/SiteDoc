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
            return { id: "ny" };
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

const STEDSFELT = ["timer.felt.prosjekt", "timer.felt.underprosjekt", "timer.felt.byggeplass", "timer.felt.timerad"];
function utenStedsfelt(dialog: HTMLElement) {
  for (const felt of STEDSFELT) expect(dialog.textContent).not.toContain(felt);
}

describe("w3a — vinduene arver jobben", () => {
  afterEach(cleanup);

  it("«+ Timer»: ingen stedsfelt, raden lagres med jobbens kort-id og sted (S1 A)", async () => {
    rendre();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    utenStedsfelt(dialog);
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
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
    fireEvent.click(screen.getAllByTitle("handling.rediger")[0]!);
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
    const blyant = screen
      .getAllByTitle("handling.rediger")
      .find((b) => b.closest("li")?.textContent?.includes("15:00–16:00"));
    fireEvent.click(blyant!);
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
    const til = dialog.querySelectorAll<HTMLInputElement>('input[type="time"]')[1]!;
    fireEvent.change(til, { target: { value: "17:00" } });
    fireEvent.blur(til);
    fireEvent.change(antall(), { target: { value: "1.5" } });
    expect(within(dialog).getByRole("button", { name: "handling.lagre" })).toHaveProperty("disabled", false);
    fireEvent.submit(dialog.querySelector("form")!);
    await vi.waitFor(() => expect(stier()).toContain("timer.dagsseddel.maskin.oppdater"));
    expect(stier()).toEqual(["timer.dagsseddel.oppdaterTimerRad", "timer.dagsseddel.maskin.oppdater"]);
  });

  it("«+ Timer» fra jobben: ny maskin foreslås med høyst og lagres på den nye raden uten fra–til, mengde og enhet", async () => {
    medMaskinModul();
    const dialog = fraJobb2("timer.prosjektkort.nyTimer");
    // Jobbens maskin vises også ved ny rad (A13).
    expect(within(dialog).getAllByTestId("jobb-maskin")).toHaveLength(1);
    const [lonnsart, aktivitet] = Array.from(dialog.querySelectorAll("select"));
    fireEvent.change(lonnsart!, { target: { value: "l1" } });
    fireEvent.change(aktivitet!, { target: { value: "a1" } });
    const [fra, til] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
    fireEvent.change(fra!, { target: { value: "16:00" } });
    fireEvent.blur(fra!);
    fireEvent.change(til!, { target: { value: "17:00" } });
    fireEvent.blur(til!);
    fireEvent.click(within(dialog).getByRole("button", { name: /timer\.velgUtstyr/ }));
    fireEvent.click(within(dialog).getAllByText(/Gravemaskin G-12/).at(-1)!);
    // Jobben: 1 t + 1 t arbeid, gravemaskinen m1 har 1 t → høyst 1 t.
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
