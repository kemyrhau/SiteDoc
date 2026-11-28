// @vitest-environment jsdom
/**
 * O14 pkt 2 og 3 (vedtak Reisevinduet pkt 17, R2/R3): i prosjektkort-visning åpner pennen på en
 * reise «Reise»-vinduet i redigering — reisetid og arbeidstid med reisemerke. Feltene står fra
 * raden; «Lagre» skriver raden med `oppdaterTimerRad` (ingen ny rad, ingen overføring).
 * Pkt 4 (R5): et kort med bare reise krever «Hva gjorde du?» (merket, sperren og feltet i «Reise»).
 * Pkt 3 (F9-vakten): en reise går aldri gjennom `brukOvertidForslag`, heller ikke sent på dagen
 * over normen. Dagskort-visning er uendret.
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OppmotePeriodeInput, ReiseRegelsett } from "@sitedoc/shared";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as Array<{ key: string; input: Record<string, unknown> }>,
  /** Oppslag som (ennå) ikke har svart: data undefined, ingen feil. */
  utelat: new Set<string>(),
  /** Oppslag som har feilet: data undefined, isError true. */
  feil: new Set<string>(),
}));

// w2: dagssiden leser prosjektet fra toppen (useProsjekt) for «+ Registrer timer».
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
            data:
              opt?.enabled === false || h.utelat.has(key) || h.feil.has(key)
                ? undefined
                : h.data[key],
            isError: h.feil.has(key),
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({
            mutate: (input: Record<string, unknown>) => h.kall.push({ key, input }),
            // Kontorvalget skriver perioden først og leser periodens id.
            mutateAsync: async (input: Record<string, unknown>) => {
              h.kall.push({ key, input });
              return { periode: { id: "ny-periode" } };
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

import Side from "./page";

const DATO = "2026-11-05";
const REGEL: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};
const FAST_TROMSO: OppmotePeriodeInput = {
  id: "pf",
  type: "kontor",
  fast: true,
  oppmotestedId: "tromso",
  projectId: null,
  fraDato: "2026-01-01",
  tilDato: null,
};

type Rad = Record<string, unknown>;
const arbeid = (over: Rad = {}): Rad => ({
  id: "r1",
  projectId: "p1",
  lonnsartId: "l1",
  aktivitetId: "a1",
  externalCostObjectId: "eco1",
  vehicleId: null,
  byggeplassId: "b1",
  fraTid: "07:00",
  tilTid: "15:00",
  timer: "7.5",
  pauseMin: 30,
  beskrivelse: "Forskaling",
  attestertStatus: "pending",
  erReise: false,
  reiseRetning: null,
  arbeidReiseRetning: null,
  kortId: "k1",
  createdAt: "2026-11-05T07:00:00.000Z",
  ...over,
});
/** Reisetid-reise hjem 15:00–15:30 i kortet k1. */
const REISETID = arbeid({
  id: "rr",
  lonnsartId: "lr",
  fraTid: "15:00",
  tilTid: "15:30",
  timer: "0.5",
  pauseMin: 0,
  beskrivelse: null,
  erReise: true,
  reiseKilde: "manuell",
  reiseRetning: "retur",
  createdAt: "2026-11-05T15:00:00.000Z",
});
/** Arbeidstid-reise (O12 pkt 16) til byggeplassen 06:56–07:00 på Ordinær. */
const ARBEIDSTIDREISE = arbeid({
  id: "ra",
  fraTid: "06:56",
  tilTid: "07:00",
  timer: "0.07",
  pauseMin: 0,
  beskrivelse: null,
  arbeidReiseRetning: "ut",
  createdAt: "2026-11-05T06:56:00.000Z",
});

function rendre(timer: Rad[], modus: "prosjektkort" | "dagskort" = "prosjektkort") {
  cleanup();
  h.kall = [];
  h.utelat.clear();
  h.feil.clear();
  h.data = {
    "timer.dagsseddel.hentMedId": {
      id: "s1",
      organizationId: "org1",
      userId: "u1",
      dato: `${DATO}T00:00:00.000Z`,
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
      timer,
    },
    "prosjekt.hentForTimer": [{ id: "p1", name: "Sitedoc Boligfelt B12", internalProjectNumber: null }],
    "bygning.hentForFirma": [{ id: "b1", projectId: "p1", name: "sommerfeldtsgt 65" }],
    "eksternKostObjekt.list": [
      { id: "eco1", proAdmId: "END-001", kortNavn: "Endring 1" },
      { id: "eco2", proAdmId: "TILL-001", kortNavn: "Tillegg 1" },
    ],
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: modus,
      reiseLonnsartId: "lr",
      reiseGrenser: [],
      ...REGEL,
    },
    "organisasjon.hentEffektivArbeidstid": { dagsnorm: 7.5, pauseReferanse: "ankomst", pauseEtterTimer: 4 },
    "oppmotested.hentForFirma": [
      { id: "tromso", navn: "Kontor Tromsø", lat: 0, lng: 0, radiusM: 100 },
      { id: "narvik", navn: "Kontor Narvik", lat: 0, lng: 0, radiusM: 100 },
    ],
    "oppmotested.hentMatriseForFirma": [{ oppmotestedId: "tromso", byggeplassId: "b1", kjoretidMin: 4, avstandM: 2000 }],
    "oppmotePeriode.hentMine": { perioder: [FAST_TROMSO], trengerValg: false },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true, type: "ordinaer", overtidsnivaa: null, rekkefolge: 1 },
      { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer", overtidsnivaa: null, rekkefolge: 2 },
      { id: "lo", navn: "Overtid 50%", aktiv: true, erStandardvalg: false, type: "ordinaer", overtidsnivaa: 50, rekkefolge: 3 },
    ],
    "timer.aktivitet.list": [{ id: "a1", navn: "Arbeid", aktiv: true }],
    "vareforbruk.hentMineForDato": [],
  };
  render(<Side />);
}

function aapneKort() {
  const hode = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
  for (const b of hode) if (b.getAttribute("aria-expanded") !== "true") fireEvent.click(b);
}
function pennenPaa(radId: string) {
  aapneKort();
  const linje = document.querySelector(`[data-reiselinje="${radId}"]`) as HTMLElement;
  expect(linje).not.toBeNull();
  fireEvent.click(linje.querySelector('[title="handling.rediger"]')!);
}
const reiseVindu = () => screen.getByRole("dialog", { name: "timer.reiseKort.tittel" });
const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });
const start = (d: HTMLElement) => within(d).getByLabelText("timer.reiseKort.startKl") as HTMLInputElement;
const slutt = (d: HTMLElement) => within(d).getByLabelText("timer.reiseKort.sluttKl") as HTMLInputElement;
const kall = (key: string) => h.kall.filter((k) => k.key === key).map((k) => k.input);

describe("O14 pkt 2 — pennen på en reise åpner «Reise» i redigering", () => {
  afterEach(cleanup);

  it("reisetid: feltene står fra raden; stedet er tekst; ingen «Annet kontor fra i dag»", () => {
    rendre([arbeid(), REISETID]);
    pennenPaa("rr");
    expect(screen.queryByRole("dialog", { name: "timer.detalj.redigerTimerRad" })).toBeNull();
    const d = reiseVindu();
    expect(knapp(d, "timer.reiseKort.retur").getAttribute("aria-pressed")).toBe("true");
    expect(start(d).value).toBe("15:00");
    expect(slutt(d).value).toBe("15:30");
    expect((within(d).getByLabelText("timer.felt.antallTimer") as HTMLInputElement).value).toBe("0.5");
    // O18 S5 A: en lagret Reisetid har ingen «Føres som» — «Arbeidstid» kan ikke velges.
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.arbeidstid" })).toBeNull();
    expect(within(d).queryByRole("button", { name: "timer.reisetid" })).toBeNull();
    expect((within(d).getByLabelText("timer.felt.underprosjekt") as HTMLSelectElement).value).toBe("eco1");
    expect(within(d).getByTestId("reise-kort-sted").textContent).toContain("Sitedoc Boligfelt B12 · sommerfeldtsgt 65");
    // O16 pkt 5: oppmøtestedet er tekst i redigering — ingen nedtrekk, ingen periode, ingen tredje retning.
    expect(within(d).queryByLabelText("timer.reiseKort.oppmotested")).toBeNull();
    expect(within(d).getByTestId("reise-fra-til").textContent).toContain('timer.reiseKort.kontorFast{"navn":"Kontor Tromsø"}');
    expect(within(d).queryByTestId("reise-oppmote-boks")).toBeNull();
    expect(within(d).queryByTestId("reise-oppmote-periode")).toBeNull();
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.tilAnnetOppmotested" })).toBeNull();
  });

  it("«Lagre» skriver raden: ny tid og underprosjekt, ingen lønnsart, ingen ny rad, ingen overføring", () => {
    rendre([arbeid(), REISETID]);
    pennenPaa("rr");
    const d = reiseVindu();
    fireEvent.change(slutt(d), { target: { value: "15:40" } });
    fireEvent.change(within(d).getByLabelText("timer.felt.underprosjekt"), { target: { value: "eco2" } });
    // Nytt underprosjekt gir eget kort med bare reise — «Hva gjorde du?» kreves (pkt 4).
    fireEvent.change(within(d).getByLabelText(/timer\.felt\.radBeskrivelse/), { target: { value: "Kjøring hjem" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    expect(kall("timer.dagsseddel.tilfoyTimerRad")).toHaveLength(0);
    expect(kall("oppmotePeriode.overforing")).toHaveLength(0);
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ id: "rr", fraTid: "15:00", tilTid: "15:40", pauseMin: 0, externalCostObjectId: "eco2", reiseRetning: "retur", beskrivelse: "Kjøring hjem" });
    expect(o[0]!.timer).toBeCloseTo(40 / 60, 5);
    expect(o[0]).not.toHaveProperty("lonnsartId");
    expect(o[0]).not.toHaveProperty("projectId");
  });

  it("arbeidstid med reisemerke: åpner «Reise»; bytte til Reisetid sender reisens lønnsart", () => {
    rendre([ARBEIDSTIDREISE, arbeid()]);
    pennenPaa("ra");
    const d = reiseVindu();
    expect(knapp(d, "timer.reiseKort.tur").getAttribute("aria-pressed")).toBe("true");
    expect(knapp(d, "timer.reiseKort.arbeidstid").getAttribute("aria-pressed")).toBe("true");
    expect(start(d).value).toBe("06:56");
    expect(slutt(d).value).toBe("07:00");
    fireEvent.click(knapp(d, "timer.reisetid"));
    fireEvent.click(knapp(d, "handling.lagre"));
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ id: "ra", lonnsartId: "lr", reiseRetning: "ut", fraTid: "06:56", tilTid: "07:00" });
  });

  it("uendret «Føres som» på en arbeidstid-reise: lønnsarten står, retningen sendes som reisemerke", () => {
    rendre([ARBEIDSTIDREISE, arbeid()]);
    pennenPaa("ra");
    const d = reiseVindu();
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    // Tidene står når retningen rettes.
    expect(start(d).value).toBe("06:56");
    fireEvent.click(knapp(d, "handling.lagre"));
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o[0]).toMatchObject({ id: "ra", arbeidReiseRetning: "retur" });
    expect(o[0]).not.toHaveProperty("lonnsartId");
  });

  it("dagskort-visning er uendret: pennen åpner «Rediger timer-rad»", () => {
    rendre([arbeid(), REISETID], "dagskort");
    // Reiseraden (0,5 t) er andre rad i dagskortet.
    const penn = screen.getAllByTitle("handling.rediger").find((b) => b.parentElement?.parentElement?.textContent?.includes("0,5"));
    expect(penn).toBeDefined();
    fireEvent.click(penn!);
    expect(screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" })).toBeDefined();
    expect(screen.queryByRole("dialog", { name: "timer.reiseKort.tittel" })).toBeNull();
  });
});

/** O16 pkt 4: «Til annet oppmøtested» Tromsø → Narvik 04:00–07:00 i kortet k1. */
const KONTORREISE = arbeid({
  id: "rk",
  lonnsartId: "lr",
  byggeplassId: null,
  fraTid: "04:00",
  tilTid: "07:00",
  timer: "3",
  pauseMin: 0,
  beskrivelse: null,
  erReise: true,
  reiseKilde: "overforing",
  reiseRetning: "ut",
  reiseRegel: {
    overforing: { fra: { type: "kontor", oppmotestedId: "tromso" }, til: { type: "kontor", oppmotestedId: "narvik" }, periodeId: "p9" },
  },
  createdAt: "2026-11-05T04:00:00.000Z",
});

describe("O16 pkt 5 (R5) — pennen på en kontor → kontor-reise", () => {
  afterEach(cleanup);

  it("bare den tredje retningen; Fra og Til er tekst; ingen periode", () => {
    rendre([arbeid(), KONTORREISE]);
    pennenPaa("rk");
    const d = reiseVindu();
    expect(knapp(d, "timer.reiseKort.tilAnnetOppmotested").getAttribute("aria-pressed")).toBe("true");
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.tur" })).toBeNull();
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.retur" })).toBeNull();
    expect(within(d).getByTestId("reise-fra-kontor").textContent).toBe("Kontor Tromsø");
    expect(within(d).getByTestId("reise-til-kontor-tekst").textContent).toBe("Kontor Narvik");
    expect(within(d).queryByLabelText("timer.reiseKort.tilKontorFelt")).toBeNull();
    expect(within(d).queryByTestId("reise-oppmote-boks")).toBeNull();
    expect(start(d).value).toBe("04:00");
    expect(slutt(d).value).toBe("07:00");
  });

  it("«Lagre» skriver bare tiden: ingen retning, ingen periode, sporet står", () => {
    rendre([arbeid(), KONTORREISE]);
    pennenPaa("rk");
    const d = reiseVindu();
    fireEvent.change(start(d), { target: { value: "04:30" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    expect(kall("oppmotePeriode.overforing")).toHaveLength(0);
    expect(kall("timer.dagsseddel.tilfoyTimerRad")).toHaveLength(0);
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ id: "rk", fraTid: "04:30", tilTid: "07:00" });
    expect(o[0]).not.toHaveProperty("reiseRetning");
    expect(o[0]).not.toHaveProperty("reiseKilde");
    expect(o[0]).not.toHaveProperty("reiseRegel");
  });
});

describe("O14 pkt 4 (R5) — et kort med bare reise krever beskrivelse", () => {
  afterEach(cleanup);
  const beskrivelseFelt = (d: HTMLElement) => within(d).getByLabelText(/timer\.felt\.radBeskrivelse/) as HTMLTextAreaElement;
  const lagreKnapp = (d: HTMLElement) => knapp(d, "handling.lagre") as HTMLButtonElement;

  it("kortet med bare reise uten tekst merkes «Mangler beskrivelse»; med tekst ikke", () => {
    rendre([REISETID]);
    expect(screen.queryAllByTestId("mangler-beskrivelse")).toHaveLength(1);
    rendre([{ ...REISETID, beskrivelse: "Kjøring hjem" }]);
    expect(screen.queryAllByTestId("mangler-beskrivelse")).toHaveLength(0);
  });

  it("reise i et kort med arbeid: kortet merkes ikke for reisen", () => {
    rendre([arbeid(), REISETID]);
    expect(screen.queryAllByTestId("mangler-beskrivelse")).toHaveLength(0);
  });

  it("pennen på reisen alene i kortet: «Hva gjorde du?» er påkrevd — Lagre sperret til tekst er skrevet", () => {
    rendre([REISETID]);
    pennenPaa("rr");
    const d = reiseVindu();
    expect(d.textContent).toContain("timer.felt.radBeskrivelse *");
    expect(lagreKnapp(d).disabled).toBe(true);
    fireEvent.change(beskrivelseFelt(d), { target: { value: "Kjøring hjem" } });
    expect(lagreKnapp(d).disabled).toBe(false);
    fireEvent.click(lagreKnapp(d));
    expect(kall("timer.dagsseddel.oppdaterTimerRad")[0]).toMatchObject({ id: "rr", beskrivelse: "Kjøring hjem" });
  });

  it("reise i et kort med arbeid: «Hva gjorde du?» er valgfritt", () => {
    rendre([arbeid(), REISETID]);
    pennenPaa("rr");
    const d = reiseVindu();
    expect(d.textContent).toContain("label.valgfritt");
    expect(lagreKnapp(d).disabled).toBe(false);
  });

  it("«+ Reise» fra en jobb med arbeid: valgfritt, og teksten lagres med reisen", async () => {
    rendre([arbeid()]);
    aapneKort();
    fireEvent.click(screen.getAllByRole("button", { name: "timer.prosjektkort.nyReise" })[0]!);
    const d = reiseVindu();
    expect(d.textContent).toContain("label.valgfritt");
    fireEvent.change(beskrivelseFelt(d), { target: { value: "Til byggeplass" } });
    // O18: turen er under terskel — primærknappen er «Før som reisetid likevel».
    fireEvent.click(knapp(d, "timer.reiseKort.forSomReisetidLikevel"));
    const sjekk = screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
    if (sjekk) fireEvent.click(within(sjekk).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(kall("timer.dagsseddel.tilfoyTimerRad")[0]).toMatchObject({ beskrivelse: "Til byggeplass" });
  });
});

describe("O14 pkt 3 — en reise går aldri gjennom overtidsforslaget (F9-vakten)", () => {
  afterEach(cleanup);

  it("arbeidstid-reise 17:30–17:34 etter overtid over normen: rettet tid lagres uten overtidsart og uten deling", async () => {
    const overtid = arbeid({ id: "ro", lonnsartId: "lo", fraTid: "15:00", tilTid: "17:30", timer: "2.5", pauseMin: 0, beskrivelse: null, createdAt: "2026-11-05T15:00:00.000Z" });
    const kveld = arbeid({ id: "rk", fraTid: "17:30", tilTid: "17:34", timer: "0.07", pauseMin: 0, beskrivelse: null, arbeidReiseRetning: "retur", createdAt: "2026-11-05T17:30:00.000Z" });
    rendre([arbeid(), overtid, kveld]);
    pennenPaa("rk");
    const d = screen.getByRole("dialog");
    const sluttFelt = Array.from(d.querySelectorAll('input[type="time"]')).find((i) => (i as HTMLInputElement).value === "17:34") as HTMLInputElement;
    fireEvent.change(sluttFelt, { target: { value: "17:40" } });
    const lagre = within(d).getByRole("button", { name: /handling\.lagre/ });
    const form = d.querySelector("form");
    if (form) fireEvent.submit(form);
    else fireEvent.click(lagre);
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const skrevet = h.kall.filter((k) => k.key === "timer.dagsseddel.oppdaterTimerRad" || k.key === "timer.dagsseddel.tilfoyTimerRad");
    expect(skrevet.length).toBeGreaterThan(0);
    // Ingen del av reisen får overtidsart, og ingen ny rad (deling) skrives.
    expect(skrevet.some((k) => k.input.lonnsartId === "lo")).toBe(false);
    expect(skrevet.filter((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")).toHaveLength(0);
    expect(skrevet.filter((k) => k.key === "timer.dagsseddel.oppdaterTimerRad")).toHaveLength(1);
  });
});

describe("O19 pkt 23 — en reise delt ved midnatt på sedelen", () => {
  afterEach(cleanup);
  /** Del 1 av «Fra byggeplass» 21:00–00:53: 21:00–24:00 på 05.11. */
  const DEL1 = arbeid({
    id: "rd",
    lonnsartId: "lr",
    fraTid: "21:00",
    tilTid: "24:00",
    timer: "3",
    pauseMin: 0,
    beskrivelse: null,
    erReise: true,
    reiseKilde: "manuell",
    reiseRetning: "retur",
    reiseRegel: { kategori: "reisetid", midnatt: { delId: "x", del: 1 } },
    createdAt: "2026-11-05T21:00:00.000Z",
  });
  const partner = (status = "draft") => ({ id: "rd2", sheetId: "s2", dato: "2026-11-06", fraTid: "00:00", tilTid: "00:53", status, del: 2 });
  const medPartner = (status?: string) => {
    rendre([arbeid({ tilTid: "21:00" }), DEL1]);
    h.data["timer.dagsseddel.finnReiseDel"] = partner(status);
  };

  it("linja viser «fortsetter 06.11»; negativkontroll: vanlig reise har ikke merket", () => {
    rendre([arbeid({ tilTid: "21:00" }), DEL1, REISETID]);
    aapneKort();
    const delt = document.querySelector('[data-reiselinje="rd"]')!;
    expect(delt.querySelector('[data-testid="reise-midnatt-merke"]')?.textContent).toBe(' · timer.reise.fortsetter{"dato":"06.11"}');
    expect(document.querySelector('[data-reiselinje="rr"] [data-testid="reise-midnatt-merke"]')).toBeNull();
  });

  it("pennen: 24:00 står som låst tekst (B2); nytt underprosjekt spør «Rett også delen 06.11?» — Ja skriver begge", async () => {
    medPartner();
    pennenPaa("rd");
    const d = reiseVindu();
    expect(within(d).getByTestId("reise-midnatt-laast").textContent).toBe("24:00");
    expect(start(d).value).toBe("21:00");
    fireEvent.change(within(d).getByLabelText("timer.felt.underprosjekt"), { target: { value: "eco2" } });
    fireEvent.change(within(d).getByLabelText(/timer\.felt\.radBeskrivelse/), { target: { value: "Hjem" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    const sporsmal = within(screen.getByTestId("reise-rett-del"));
    expect(screen.getByTestId("reise-rett-del").textContent).toContain('timer.reiseKort.rettDel.tekst{"dato":"06.11"}');
    fireEvent.click(sporsmal.getByRole("button", { name: "ja" }));
    await new Promise((r) => setTimeout(r, 0));
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o).toHaveLength(2);
    expect(o[0]).toEqual({ id: "rd2", externalCostObjectId: "eco2", beskrivelse: "Hjem" });
    expect(o[1]).toMatchObject({ id: "rd", fraTid: "21:00", tilTid: "24:00", timer: 3, externalCostObjectId: "eco2" });
  });

  it("«Nei» skriver bare denne delen", async () => {
    medPartner();
    pennenPaa("rd");
    const d = reiseVindu();
    fireEvent.change(within(d).getByLabelText("timer.felt.underprosjekt"), { target: { value: "eco2" } });
    fireEvent.change(within(d).getByLabelText(/timer\.felt\.radBeskrivelse/), { target: { value: "Hjem" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    fireEvent.click(within(screen.getByTestId("reise-rett-del")).getByRole("button", { name: "nei" }));
    await new Promise((r) => setTimeout(r, 0));
    expect(kall("timer.dagsseddel.oppdaterTimerRad").map((x) => x.id)).toEqual(["rd"]);
  });

  it("negativkontroll: bare Start rettet → ingen spørsmål; låst partner → ingen spørsmål og en merknad", async () => {
    medPartner();
    pennenPaa("rd");
    let d = reiseVindu();
    fireEvent.change(start(d), { target: { value: "21:30" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    expect(screen.queryByTestId("reise-rett-del")).toBeNull();
    expect(kall("timer.dagsseddel.oppdaterTimerRad")[0]).toMatchObject({ id: "rd", fraTid: "21:30", tilTid: "24:00", timer: 2.5 });

    medPartner("sent");
    pennenPaa("rd");
    d = reiseVindu();
    expect(within(d).getByTestId("reise-del-laast").textContent).toBe('timer.reiseKort.delLaast{"dato":"06.11"}');
    fireEvent.change(within(d).getByLabelText("timer.felt.underprosjekt"), { target: { value: "eco2" } });
    fireEvent.change(within(d).getByLabelText(/timer\.felt\.radBeskrivelse/), { target: { value: "Hjem" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    expect(screen.queryByTestId("reise-rett-del")).toBeNull();
    expect(kall("timer.dagsseddel.oppdaterTimerRad").map((x) => x.id)).toEqual(["rd"]);
  });

  it("sletting: «Slett begge» → fjernDeltReise; «Bare denne» → fjernTimerRad", () => {
    medPartner();
    aapneKort();
    const slett = () =>
      fireEvent.click(document.querySelector('[data-reiselinje="rd"]')!.querySelector('[title="handling.slett"]')!);
    slett();
    const m = screen.getByTestId("slett-delt-reise");
    expect(m.textContent).toContain('timer.reise.deltSlett.tekst{"fra":"00:00","til":"00:53","dato":"06.11"}');
    fireEvent.click(within(m).getByRole("button", { name: "timer.reise.deltSlett.slettBegge" }));
    expect(kall("timer.dagsseddel.fjernDeltReise")).toEqual([{ id: "rd" }]);
    fireEvent.click(within(m).getByRole("button", { name: "timer.reise.deltSlett.bareDenne" }));
    expect(kall("timer.dagsseddel.fjernTimerRad")).toEqual([{ id: "rd" }]);
  });

  it("sletting med låst partner: bare «Bare denne»", () => {
    medPartner("accepted");
    aapneKort();
    fireEvent.click(document.querySelector('[data-reiselinje="rd"]')!.querySelector('[title="handling.slett"]')!);
    const m = screen.getByTestId("slett-delt-reise");
    expect(m.textContent).toContain('timer.reise.deltSlett.laast{"dato":"06.11"}');
    expect(within(m).queryByRole("button", { name: "timer.reise.deltSlett.slettBegge" })).toBeNull();
  });

  it("negativkontroll: vanlig reise får ikke delt-modalen — runde 9: bekreftes i «Slette timeraden?»", () => {
    rendre([arbeid(), REISETID]);
    aapneKort();
    fireEvent.click(document.querySelector('[data-reiselinje="rr"]')!.querySelector('[title="handling.slett"]')!);
    expect(screen.queryByTestId("slett-delt-reise")).toBeNull();
    // Runde 9 (Kenneth 2026-11-28, ui-standarder § Slett-bekreftelse): ingen sletting før bekreftelse.
    expect(kall("timer.dagsseddel.fjernTimerRad")).toEqual([]);
    fireEvent.click(screen.getByText("timer.fjernTimerRad.bekreftRad"));
    expect(kall("timer.dagsseddel.fjernTimerRad")).toEqual([{ id: "rr" }]);
  });
});

// Runde 4 timer (Kenneth 2026-11-26: «annet sted, foreslå hjemmreise men ikke bloker annen
// registrering»): en lagret hjemreise fra «Annet sted» vises «{sted} → {oppmøtested}» og beholder
// retur når pennen lagrer.
describe("VAKTTEST 2026-11-27 (Kenneth: Godkjent steg 2–6 i testpanelet, runde 4) — Runde 4 — pennen på en hjemreise fra «Annet sted»", () => {
  afterEach(cleanup);
  const HJEM = arbeid({
    id: "rh",
    lonnsartId: "lr",
    byggeplassId: null,
    externalCostObjectId: null,
    fraTid: "15:30",
    tilTid: "18:30",
    timer: "3",
    pauseMin: 0,
    beskrivelse: "Kurs",
    erReise: true,
    reiseKilde: "manuell",
    reiseRetning: "retur",
    reiseOppmotestedId: "tromso",
    reiseRegel: { annetSted: { sted: "Bergen" } },
    kortId: "k9",
    createdAt: "2026-11-05T15:30:00.000Z",
  });

  it("reiselinja viser «Bergen → Kontor Tromsø»", () => {
    rendre([arbeid(), HJEM]);
    aapneKort();
    const linje = document.querySelector('[data-reiselinje="rh"]') as HTMLElement;
    expect(linje.textContent).toContain('timer.prosjektkort.reiseRute{"fra":"Bergen","til":"Kontor Tromsø"}');
  });

  it("pennen åpner «Hjemreise fra Bergen» (Fra = Bergen, Til = Kontor Tromsø); Lagre beholder retur", () => {
    rendre([arbeid(), HJEM]);
    pennenPaa("rh");
    const d = reiseVindu();
    expect(knapp(d, 'timer.reiseKort.hjemreiseFra{"sted":"Bergen"}').getAttribute("aria-pressed")).toBe("true");
    const ft = within(d).getByTestId("reise-fra-til");
    const [fraKol, tilKol] = Array.from(ft.querySelectorAll(":scope > div")) as HTMLElement[];
    expect(fraKol!.textContent).toContain("Bergen");
    expect(tilKol!.textContent).toContain("Kontor Tromsø");
    fireEvent.change(slutt(d), { target: { value: "19:00" } });
    fireEvent.click(knapp(d, "handling.lagre"));
    const o = kall("timer.dagsseddel.oppdaterTimerRad");
    expect(o).toHaveLength(1);
    expect(o[0]).toMatchObject({ id: "rh", tilTid: "19:00", reiseRetning: "retur" });
  });
});
