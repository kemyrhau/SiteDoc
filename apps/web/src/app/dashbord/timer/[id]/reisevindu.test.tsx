// @vitest-environment jsdom
/**
 * w15b (B42 A + Kenneths presisering 2026-11-21, web-timeforing-plan.md § 4.15 del B og G):
 * reisevinduet — systemet foreslår, arbeideren retter.
 *  - § 8.22 (svar 1A): ingen kontorreise; «Fra et annet kontor fra i dag» ved oppmøtestedet
 *    regner reisen fra kontoret og lagres som vanlig reise, perioden fra sedeldatoen.
 *  - Rettet start: slutten følger. Rettet slutt: står, timene = slutt − start.
 *  - «Hvor kjørte du til?»: bytt prosjekt → underprosjekt tomt, linja sier «Får eget kort …».
 *  - Overlapp med en annen rad sperrer Lagre med tekst som navngir raden.
 *  - Lagre sender tidene, timene og prosjektet som vist.
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
  /** Mutasjoner som avvises av serveren (O16 R3). */
  avvis: new Map<string, string>(),
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
              const kode = h.avvis.get(key);
              if (kode) throw Object.assign(new Error(kode), { data: { code: kode } });
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
  tilTid: "12:00",
  timer: "5",
  pauseMin: 0,
  beskrivelse: null,
  attestertStatus: "pending",
  erReise: false,
  kortId: "k1",
  createdAt: "2026-11-05T07:00:00.000Z",
  ...over,
});

function rendre({
  timer = [arbeid()] as Rad[],
  kontorer = 2,
  perioder = [FAST_TROMSO] as OppmotePeriodeInput[],
} = {}) {
  h.kall = [];
  h.utelat.clear();
  h.feil.clear();
  h.avvis.clear();
  const steder = [
    { id: "tromso", navn: "Kontor Tromsø", lat: 0, lng: 0, radiusM: 100 },
    { id: "narvik", navn: "Kontor Narvik", lat: 0, lng: 0, radiusM: 100 },
    { id: "alta", navn: "Kontor Alta", lat: 0, lng: 0, radiusM: 100 },
  ].slice(0, kontorer);
  h.data = {
    "timer.dagsseddel.hentMedId": {
      id: "s1",
      organizationId: "org1",
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
    "prosjekt.hentForTimer": [
      { id: "p1", name: "Sitedoc Boligfelt B12", internalProjectNumber: null },
      { id: "p2", name: "Prosjekt 1050", internalProjectNumber: null },
    ],
    "bygning.hentForFirma": [
      { id: "b1", projectId: "p1", name: "sommerfeldtsgt 65" },
      { id: "b2", projectId: "p2", name: "Byggeplass 1" },
    ],
    "eksternKostObjekt.list": [{ id: "eco1", proAdmId: "END-001", kortNavn: "Endring 1" }],
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
      ...REGEL,
    },
    "oppmotested.hentForFirma": steder,
    "oppmotested.hentMatriseForFirma": [
      { oppmotestedId: "tromso", byggeplassId: "b1", kjoretidMin: 4, avstandM: 2000 },
      { oppmotestedId: "tromso", byggeplassId: "b2", kjoretidMin: 35, avstandM: 30000 },
      { oppmotestedId: "narvik", byggeplassId: "b1", kjoretidMin: 230, avstandM: 250000 },
      { oppmotestedId: "alta", byggeplassId: "b1", kjoretidMin: 300, avstandM: 400000 },
    ],
    "oppmotested.hentKontorAvstanderForFirma": [
      { fraOppmotestedId: "narvik", tilOppmotestedId: "tromso", kjoretidMin: 180, avstandM: 250000 },
    ],
    "oppmotePeriode.hentMine": { perioder, trengerValg: false },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true, type: "ordinaer" },
      { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer" },
    ],
    "timer.aktivitet.list": [{ id: "a1", navn: "Arbeid", aktiv: true }],
    "vareforbruk.hentMineForDato": [],
  };
  render(<Side />);
  // Første jobb: åpne kortet hvis det er lukket, og «+ Reise» der.
  if (screen.queryAllByRole("button", { name: "timer.prosjektkort.nyReise" }).length === 0) {
    fireEvent.click(screen.getAllByRole("button", { name: /Sitedoc Boligfelt B12/ })[0]!);
  }
  fireEvent.click(screen.getAllByRole("button", { name: "timer.prosjektkort.nyReise" })[0]!);
  return screen.getByRole("dialog", { name: "timer.reiseKort.tittel" });
}

const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });
const start = (d: HTMLElement) => within(d).getByLabelText("timer.reiseKort.startKl") as HTMLInputElement;
const slutt = (d: HTMLElement) => within(d).getByLabelText("timer.reiseKort.sluttKl") as HTMLInputElement;
const lagreKnapp = (d: HTMLElement) => knapp(d, "handling.lagre") as HTMLButtonElement;
/** Kontorvalget skriver perioden først (async) — vent til raden er sendt. */
async function lagre(d: HTMLElement) {
  fireEvent.click(lagreKnapp(d));
  // O12 pkt 12 / pkt 9: svar «Ja, lagre» og «Behold arbeidstid» når dialogene åpnes.
  const sjekk = screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
  if (sjekk) fireEvent.click(within(sjekk).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
  const terskel = screen.queryByRole("dialog", { name: "timer.reiseKort.terskelDialog.tittel" });
  if (terskel) fireEvent.click(within(terskel).getByRole("button", { name: "timer.reiseKort.terskelDialog.beholdArbeidstid" }));
  await new Promise((r) => setTimeout(r, 0));
  return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
}

describe("w15b — reisevinduet: systemet foreslår, arbeideren retter", () => {
  afterEach(cleanup);

  it("O16 pkt 1: «Fra → Til» — oppmøtestedet er ett nedtrekk, fylt ut med dagens og merket «fast»", () => {
    const d = rendre();
    expect(within(d).queryByLabelText("timer.reiseKort.annetKontorFraIDag")).toBeNull();
    expect(d.textContent).not.toContain("timer.reiseKort.fraOppmotested");
    expect(d.textContent).not.toContain("timer.reiseKort.hvorTil");
    const sted = within(d).getByLabelText("timer.reiseKort.oppmotested") as HTMLSelectElement;
    expect(sted.value).toBe("tromso");
    expect(Array.from(sted.options).map((o) => o.value)).toEqual(["tromso", "narvik"]);
    expect(sted.options[0]!.textContent).toBe('timer.reiseKort.kontorFast{"navn":"Kontor Tromsø"}');
    // «Til byggeplass»: oppmøtestedet under «Fra», byggeplassen under «Til».
    const [fra, til] = Array.from(within(d).getByTestId("reise-fra-til").children).filter((c) => c.tagName === "DIV");
    expect(fra!.contains(sted)).toBe(true);
    expect(til!.textContent).toContain("Sitedoc Boligfelt B12 · sommerfeldtsgt 65");
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    const [fra2, til2] = Array.from(within(d).getByTestId("reise-fra-til").children).filter((c) => c.tagName === "DIV");
    expect(til2!.contains(within(d).getByLabelText("timer.reiseKort.oppmotested"))).toBe(true);
    expect(fra2!.textContent).toContain("Sitedoc Boligfelt B12");
    // Dagens kontor valgt: ingen blå boks.
    expect(within(d).queryByTestId("reise-oppmote-boks")).toBeNull();
  });

  it("O16 pkt 2: annet kontor ved «Til byggeplass» — reisen regnes derfra, «Gjelder fra» = sedelens dato", async () => {
    const d = rendre();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    expect(start(d).value).toBe("03:10");
    expect(slutt(d).value).toBe("07:00");
    expect(within(d).getByTestId("reise-oppmote-boks").textContent).toContain('timer.reiseKort.blirMidlertidig{"navn":"Kontor Narvik"}');
    expect((within(d).getByLabelText(/timer\.reiseKort\.gjelderFra/) as HTMLInputElement).value).toBe(DATO);
    expect(d.textContent).toContain("timer.reiseKort.foresIKortet");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", byggeplassId: "b1", fraTid: "03:10", tilTid: "07:00", reiseKjoretidMin: 230 });
    expect(input.reiseKilde).not.toBe("overforing");
    expect(input.reiseOppmotestedId).toBe("narvik");
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toEqual(
      expect.objectContaining({ handling: "start", oppmotestedId: "narvik", dato: DATO }),
    );
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).not.toHaveProperty("tilDato");
  });

  it("O16 pkt 2 (H2): annet kontor ved «Fra byggeplass» — «Gjelder fra» = dagen etter; rettet dato sendes", async () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    const fraFelt = within(d).getByLabelText(/timer\.reiseKort\.gjelderFra/) as HTMLInputElement;
    expect(fraFelt.value).toBe("2026-11-06");
    fireEvent.change(fraFelt, { target: { value: "2026-11-09" } });
    await lagre(d);
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({ handling: "start", oppmotestedId: "narvik", dato: "2026-11-09" });
  });

  it("O16 pkt 3: «Til og med» sendes som tilDato; før «Gjelder fra» sperrer Lagre", async () => {
    const d = rendre();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    const tom = within(d).getByLabelText(/timer\.reiseKort\.tilOgMed/) as HTMLInputElement;
    expect(tom.value).toBe("");
    fireEvent.change(tom, { target: { value: "2026-11-01" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    expect(within(d).getByTestId("reise-oppmote-sperre").textContent).toBe("timer.reiseKort.sperre.tilFoerFra");
    fireEvent.change(tom, { target: { value: "2026-11-20" } });
    await lagre(d);
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({ dato: DATO, tilDato: "2026-11-20" });
  });

  // O10 (§ 8.22): «Lagre» lagrer også kontorvalget når «Føres som» står på Arbeidstid (som før O8).
  it("annet kontor + Arbeidstid: «Lagre» skriver perioden og fører arbeidsraden", async () => {
    const d = rendre();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    fireEvent.click(within(d).getByRole("button", { name: "timer.reiseKort.arbeidstid" }));
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.lagreKontor" })).toBeNull();
    expect(within(d).queryByRole("button", { name: "handling.lukk" })).toBeNull();
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", tilTid: "07:00" });
    expect(input.reiseKilde).toBeUndefined();
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({
      handling: "start",
      oppmotestedId: "narvik",
      dato: DATO,
    });
  });

  it("negativkontroll: uten annet kontor kalles ikke oppmotePeriode.overforing", async () => {
    const d = rendre();
    expect(await lagre(d)).toBeDefined();
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(false);
  });

  // O7 (§ 8.22 punkt 4): på «Til byggeplass» står slutten fast når start rettes (før: fulgte).
  it("rettet start: slutten står (Til byggeplass); rettet slutt: står og gir timene", async () => {
    const d = rendre();
    expect(start(d).value).toBe("06:56");
    fireEvent.change(start(d), { target: { value: "06:00" } });
    expect(slutt(d).value).toBe("07:00");
    fireEvent.change(slutt(d), { target: { value: "06:30" } });
    expect(start(d).value).toBe("06:00");
    expect(slutt(d).value).toBe("06:30");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "06:00", tilTid: "06:30", timer: 0.5, projectId: "p1" });
  });

  it("bytt valg forkaster rettede tider (forslaget regnes på nytt)", () => {
    const d = rendre();
    fireEvent.change(start(d), { target: { value: "05:00" } });
    expect(start(d).value).toBe("05:00");
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(start(d).value).toBe("12:00");
    expect(slutt(d).value).toBe("12:04");
  });

  it("O12 pkt 3: «Hvor kjørte du til?» er kortets prosjekt og byggeplass som tekst; reisen lagres i kortet", async () => {
    const d = rendre();
    expect(within(d).queryByLabelText("timer.felt.prosjekt")).toBeNull();
    expect(d.textContent).toContain("Sitedoc Boligfelt B12 · sommerfeldtsgt 65");
    expect(d.textContent).toContain("timer.reiseKort.foresIKortet");
    expect(d.textContent).not.toMatch(/timer\.reiseKort\.havner(Jobb|Kort|Eget)/);
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", byggeplassId: "b1" });
  });

  it("overlapp med en annen rad: Lagre sperret, teksten navngir raden; ingen mutate", async () => {
    const d = rendre({ timer: [arbeid(), arbeid({ id: "r2", fraTid: "13:00", tilTid: "15:00", kortId: "k2" })] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    // Retur etter dagens slutt 15:00 → 15:00–15:04. Rett start til 14:00 → 14:00–14:04 kolliderer med 13:00–15:00.
    fireEvent.change(start(d), { target: { value: "14:00" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    const rod = d.querySelector("p.text-red-700")?.textContent ?? "";
    expect(rod).toContain("timer.feil.overlappKort");
    expect(rod).toContain('"annenFra":"13:00"');
    expect(rod).toContain('"kort":"Sitedoc Boligfelt B12"');
    expect(await lagre(d)).toBeUndefined();
  });

  it("slutt før start: Lagre sperret med tekst", () => {
    const d = rendre();
    fireEvent.change(slutt(d), { target: { value: "06:00" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    expect(d.querySelector("p.text-red-700")?.textContent).toBe("timer.feil.sluttForStart");
  });

  it("negativkontroll: forslaget uten retting gir ingen sperre", () => {
    const d = rendre();
    expect(lagreKnapp(d).disabled).toBe(false);
    expect(d.querySelector("p.text-red-700")).toBeNull();
  });

  it("tre kontorer: oppmøtestedet står på dagens; et annet velges i nedtrekket", () => {
    const d = rendre({ kontorer: 3 });
    const kontor = within(d).getByLabelText("timer.reiseKort.oppmotested") as HTMLSelectElement;
    expect(kontor.value).toBe("tromso");
    expect(Array.from(kontor.options).map((o) => o.value)).toEqual(["tromso", "narvik", "alta"]);
    fireEvent.change(kontor, { target: { value: "alta" } });
    expect(d.textContent).toContain('timer.reiseKort.forslag{"min":300}');
    expect(start(d).value).toBe("02:00");
  });
});

describe("gate (123) vilkår 1 — byggeplassperiodens første og siste dag", () => {
  afterEach(cleanup);
  const bp = (fraDato: string, tilDato: string | null): OppmotePeriodeInput => ({
    id: "pb",
    type: "byggeplass",
    fast: false,
    oppmotestedId: null,
    projectId: "p1",
    fraDato,
    tilDato,
  });
  // Hjemstedet over terskel (230 min til b1), så sporet viser hvilket kontor reisen regnes fra.
  const FAST_NARVIK: OppmotePeriodeInput = { ...FAST_TROMSO, id: "pn", oppmotestedId: "narvik" };
  const sperret = (d: HTMLElement) => {
    expect(lagreKnapp(d).disabled).toBe(true);
    expect(within(d).queryByLabelText("timer.reiseKort.startKl")).toBeNull();
    expect(d.textContent).toContain("timer.reiseKort.sperre.byggeplassPeriode");
  };

  it("første dag: Tur gir aktiv Lagre fra hjemkontoret, vanlig reise, ingen periodekall", async () => {
    const d = rendre({ perioder: [FAST_NARVIK, bp(DATO, "2026-11-10")] });
    expect(lagreKnapp(d).disabled).toBe(false);
    expect(start(d).value).toBe("03:10");
    expect(slutt(d).value).toBe("07:00");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", byggeplassId: "b1", fraTid: "03:10", tilTid: "07:00", reiseKjoretidMin: 230 });
    expect(input.reiseOppmotestedId).toBe("narvik");
    expect(input.reiseKilde).toBe("manuell");
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(false);
  });

  it("første dag: Retur er sperret (perioden gjelder resten av dagen)", () => {
    const d = rendre({ perioder: [FAST_TROMSO, bp(DATO, "2026-11-10")] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    sperret(d);
  });

  it("siste dag: Retur gir aktiv Lagre hjem til hjemkontoret", async () => {
    const d = rendre({ perioder: [FAST_NARVIK, bp("2026-11-01", DATO)] });
    sperret(d);
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(lagreKnapp(d).disabled).toBe(false);
    expect(start(d).value).toBe("12:00");
    expect(slutt(d).value).toBe("15:50");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "12:00", tilTid: "15:50", reiseKjoretidMin: 230, reiseKilde: "manuell", reiseRetning: "retur" });
    expect(input.reiseOppmotestedId).toBe("narvik");
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(false);
  });

  it("mellomdag: både Tur og Retur er sperret", async () => {
    const d = rendre({ perioder: [FAST_TROMSO, bp("2026-11-01", "2026-11-10")] });
    sperret(d);
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    sperret(d);
    expect(await lagre(d)).toBeUndefined();
  });
});

describe("O6 (§ 8.22) — «Antall timer» følger retningen", () => {
  afterEach(cleanup);
  const antall = (d: HTMLElement) => d.querySelector("#reise-antall") as HTMLInputElement;

  it("Til byggeplass: Slutt (jobbstart) står fast, Start flytter — Kenneths eksempel 07:00, antall 1 → 06:00–07:00", async () => {
    const d = rendre();
    expect(start(d).value).toBe("06:56");
    expect(slutt(d).value).toBe("07:00");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(start(d).value).toBe("06:00");
    expect(slutt(d).value).toBe("07:00");
    // Ingen overlapp-feil med jobben 07:00–12:00 (i dag: 06:56–07:56 og sperret).
    expect(d.querySelector("p.text-red-700")).toBeNull();
    expect(lagreKnapp(d).disabled).toBe(false);
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "06:00", tilTid: "07:00", timer: 1 });
  });

  it("Til byggeplass: nytt antall regnes fra samme faste slutt (1 → 1.5 gir 05:30–07:00)", () => {
    const d = rendre();
    fireEvent.change(antall(d), { target: { value: "1" } });
    fireEvent.change(antall(d), { target: { value: "1.5" } });
    expect(start(d).value).toBe("05:30");
    expect(slutt(d).value).toBe("07:00");
  });

  it("Fra byggeplass: Start står fast, Slutt = Start + antall (som før)", async () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(start(d).value).toBe("12:00");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(start(d).value).toBe("12:00");
    expect(slutt(d).value).toBe("13:00");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "12:00", tilTid: "13:00", timer: 1 });
  });

  it("Til byggeplass nær midnatt: Start klemmes til 00:00, feltet viser det som lagres (gate 136 vilkår 1)", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "00:30", tilTid: "05:00", timer: "4.5" })] });
    expect(slutt(d).value).toBe("00:30");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(start(d).value).toBe("00:00");
    expect(slutt(d).value).toBe("00:30");
    expect(antall(d).value).toBe("0.5");
    const lagret = (await lagre(d))!;
    expect(lagret).toMatchObject({ fraTid: "00:00", tilTid: "00:30", timer: 0.5 });
  });

  it("Fra byggeplass nær midnatt: Slutt klemmes til 23:59, feltet viser det som lagres (gate 136 vilkår 1)", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "18:00", tilTid: "23:29", timer: "5.48" })] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(start(d).value).toBe("23:29");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(start(d).value).toBe("23:29");
    expect(slutt(d).value).toBe("23:59");
    expect(antall(d).value).toBe("0.5");
    const lagret = (await lagre(d))!;
    expect(lagret).toMatchObject({ fraTid: "23:29", tilTid: "23:59", timer: 0.5 });
  });
});

describe("O7 (§ 8.22 punkt 4) — Start rettes: «Til byggeplass» holder Slutt", () => {
  afterEach(cleanup);
  const antall = (d: HTMLElement) => d.querySelector("#reise-antall") as HTMLInputElement;

  it("Til byggeplass: Slutt (07:00) står fast, antall = Slutt − Start", async () => {
    const d = rendre();
    expect(slutt(d).value).toBe("07:00");
    fireEvent.change(start(d), { target: { value: "06:00" } });
    expect(start(d).value).toBe("06:00");
    expect(slutt(d).value).toBe("07:00");
    expect(antall(d).value).toBe("1");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "06:00", tilTid: "07:00", timer: 1 });
  });

  it("Til byggeplass: Slutt står fast også etter et skrevet antall", () => {
    const d = rendre();
    fireEvent.change(antall(d), { target: { value: "1" } });
    fireEvent.change(start(d), { target: { value: "06:30" } });
    expect(slutt(d).value).toBe("07:00");
    expect(antall(d).value).toBe("0.5");
  });

  it("Til byggeplass nær midnatt: Start 00:00, Slutt 00:30 står, feltet viser det som lagres", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "00:30", tilTid: "05:00", timer: "4.5" })] });
    fireEvent.change(start(d), { target: { value: "00:00" } });
    expect(slutt(d).value).toBe("00:30");
    expect(antall(d).value).toBe("0.5");
    const lagret = (await lagre(d))!;
    expect(lagret).toMatchObject({ fraTid: "00:00", tilTid: "00:30", timer: 0.5 });
  });

  it("Fra byggeplass: Slutt følger Start som før (start + kjøretid)", () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    const sluttFoer = slutt(d).value;
    const spenn = (a: string, b: string) =>
      Number(b.slice(0, 2)) * 60 + Number(b.slice(3)) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));
    const varighet = spenn(start(d).value, sluttFoer);
    fireEvent.change(start(d), { target: { value: "13:00" } });
    expect(start(d).value).toBe("13:00");
    expect(spenn("13:00", slutt(d).value)).toBe(varighet);
  });

  it("Fra byggeplass: med skrevet antall følger Slutt Start + antall (som før)", () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(antall(d), { target: { value: "1" } });
    fireEvent.change(start(d), { target: { value: "13:00" } });
    expect(slutt(d).value).toBe("14:00");
  });
});

// O14 pkt 7 (R6) → O16 pkt 1: oppmøtestedet står under «Fra» ved «Til byggeplass», under «Til» ved «Fra byggeplass».
describe("O14 pkt 7 — oppmøtestedet følger retningen", () => {
  afterEach(cleanup);

  it("«Til byggeplass»: oppmøtestedet under «Fra»; «Fra byggeplass»: under «Til»", () => {
    const d = rendre();
    const side = () => {
      const [fra, til] = Array.from(within(d).getByTestId("reise-fra-til").children).filter((c) => c.tagName === "DIV");
      const sted = within(d).getByLabelText("timer.reiseKort.oppmotested");
      return fra!.contains(sted) ? "fra" : til!.contains(sted) ? "til" : null;
    };
    expect(side()).toBe("fra");
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(side()).toBe("til");
  });
});

// ── O16 (vedtak Reisevinduet pkt 1–2): tur 3, periodene og firmaadmins periode ──
describe("O16 — «Til annet oppmøtested» og periodene", () => {
  afterEach(cleanup);
  const egen = (sted: string, fraDato: string, tilDato: string | null = null): OppmotePeriodeInput => ({
    id: "pe",
    type: "kontor",
    fast: false,
    oppmotestedId: sted,
    projectId: null,
    fraDato,
    tilDato,
    kilde: "overforing",
  });
  const firmaets = (sted: string, fraDato: string, tilDato: string | null = null): OppmotePeriodeInput => ({
    ...egen(sted, fraDato, tilDato),
    id: "pa",
    kilde: "admin",
  });
  const overforing = () => h.kall.filter((k) => k.key === "oppmotePeriode.overforing").map((k) => k.input);

  it("pkt 4: tredje retning — kjøretid kontor–kontor før dagens første arbeid, lagres i kortet med sporet", async () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    expect(within(d).getByTestId("reise-fra-kontor").textContent).toBe('timer.reiseKort.kontorFast{"navn":"Kontor Tromsø"}');
    expect(lagreKnapp(d).disabled).toBe(true);
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "narvik" } });
    expect(start(d).value).toBe("04:00");
    expect(slutt(d).value).toBe("07:00");
    expect((within(d).getByLabelText(/timer\.reiseKort\.gjelderFra/) as HTMLInputElement).value).toBe(DATO);
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", byggeplassId: null, kortId: "k1", fraTid: "04:00", tilTid: "07:00", reiseKilde: "overforing" });
    expect(input.reiseRegel).toMatchObject({
      overforing: { fra: { type: "kontor", oppmotestedId: "tromso" }, til: { type: "kontor", oppmotestedId: "narvik" }, periodeId: "ny-periode" },
    });
    expect(overforing()).toEqual([expect.objectContaining({ handling: "start", oppmotestedId: "narvik", dato: DATO })]);
  });

  it("pkt 4: uten flere kontorer finnes ikke den tredje retningen", () => {
    const d = rendre({ kontorer: 1 });
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.tilAnnetOppmotested" })).toBeNull();
    expect(within(d).queryByLabelText("timer.reiseKort.oppmotested")).toBeNull();
  });

  it("R7a: tur 3 til det faste mens egen midlertidig gjelder — «Siste dag» etter kl. 12-regelen (hjemreise etter arbeid)", async () => {
    const d = rendre({ perioder: [FAST_TROMSO, egen("narvik", "2026-11-01")] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "tromso" } });
    expect(start(d).value).toBe("12:00");
    expect((within(d).getByLabelText(/timer\.reiseKort\.sisteDag/) as HTMLInputElement).value).toBe(DATO);
    await lagre(d);
    expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: DATO })]);
  });

  it("H3: «Fra byggeplass» til det faste — «Siste dag» = sedelens dato", async () => {
    const d = rendre({ perioder: [FAST_TROMSO, egen("narvik", "2026-11-01")] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    const sted = within(d).getByLabelText("timer.reiseKort.oppmotested") as HTMLSelectElement;
    expect(sted.value).toBe("narvik");
    expect(sted.options[0]!.textContent).toBe('timer.reiseKort.kontorMidlertidig{"navn":"Kontor Narvik"}');
    fireEvent.change(sted, { target: { value: "tromso" } });
    expect(within(d).getByTestId("reise-oppmote-boks").textContent).toContain('timer.reiseKort.avsluttesMidlertidig{"navn":"Kontor Narvik"}');
    expect((within(d).getByLabelText(/timer\.reiseKort\.sisteDag/) as HTMLInputElement).value).toBe(DATO);
    await lagre(d);
    expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: DATO })]);
  });

  it("R4: et valg som tømmer den egne perioden sier «fjernes», men sperrer ikke", async () => {
    const d = rendre({ perioder: [FAST_TROMSO, egen("narvik", DATO)] });
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "tromso" } });
    expect(within(d).getByTestId("reise-oppmote-fjernes").textContent).toContain("timer.reiseKort.periodeFjernes");
    expect(lagreKnapp(d).disabled).toBe(false);
    await lagre(d);
    expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: "2026-11-04" })]);
  });

  it("R7b: «Avslutt» spør om «Siste dag» med dagen før som forslag; rettet verdi sendes", () => {
    const d = rendre({ perioder: [FAST_TROMSO, egen("narvik", "2026-11-01")] });
    expect(within(d).getByTestId("reise-oppmote-periode").textContent).toContain("timer.reiseKort.midlertidigPeriode");
    fireEvent.click(knapp(d, "timer.reiseKort.avslutt"));
    expect(overforing()).toHaveLength(0);
    const sporsmal = within(d).getByTestId("reise-avslutt");
    const felt = within(sporsmal).getByLabelText("timer.reiseKort.sisteDag") as HTMLInputElement;
    expect(felt.value).toBe("2026-11-04");
    fireEvent.change(felt, { target: { value: "2026-11-03" } });
    fireEvent.click(within(sporsmal).getByRole("button", { name: "timer.reiseKort.avslutt" }));
    expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: "2026-11-03" })]);
  });

  // V2: to egne perioder, A 02–02 og B 04–∞, seddel 05 — kallet og «… fjernes» gjelder B.
  const toEgne = () => [FAST_TROMSO, { ...egen("narvik", "2026-11-02", "2026-11-02"), id: "pA" }, { ...egen("narvik", "2026-11-04"), id: "pB" }];
  for (const siste of ["2026-11-02", "2026-11-01"]) {
    it(`V2: «Siste dag» ${siste} før B startet — boksen sier at B fjernes, kallet navngir B`, async () => {
      const d = rendre({ perioder: toEgne() });
      fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "tromso" } });
      fireEvent.change(within(d).getByLabelText(/timer\.reiseKort\.sisteDag/), { target: { value: siste } });
      expect(within(d).getByTestId("reise-oppmote-fjernes").textContent).toContain("timer.reiseKort.periodeFjernes");
      await lagre(d);
      expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: siste, periodeId: "pB" })]);
    });
    it(`V2: «Avslutt» ${siste} sender perioden linja viser (B)`, () => {
      const d = rendre({ perioder: toEgne() });
      fireEvent.click(knapp(d, "timer.reiseKort.avslutt"));
      const sporsmal = within(d).getByTestId("reise-avslutt");
      fireEvent.change(within(sporsmal).getByLabelText("timer.reiseKort.sisteDag"), { target: { value: siste } });
      fireEvent.click(within(sporsmal).getByRole("button", { name: "timer.reiseKort.avslutt" }));
      expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: siste, periodeId: "pB" })]);
    });
  }
  it("V1: web sender medSluttdato på start", async () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "narvik" } });
    await lagre(d);
    expect(overforing()).toEqual([expect.objectContaining({ handling: "start", medSluttdato: true })]);
  });

  it("R8: firmaadmins periode — merket midlertidig, ingen «Avslutt»; valg av det faste sperrer Lagre", async () => {
    const d = rendre({ perioder: [FAST_TROMSO, firmaets("narvik", "2026-11-01")] });
    const linje = within(d).getByTestId("reise-oppmote-periode");
    expect(linje.textContent).toContain("timer.reiseKort.sattAvFirmaet");
    expect(within(linje).queryByRole("button")).toBeNull();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "tromso" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    expect(within(d).getByTestId("reise-oppmote-sperre").textContent).toContain("timer.reiseKort.sperre.adminAvsluttesIkke");
    expect(await lagre(d)).toBeUndefined();
    expect(overforing()).toHaveLength(0);
  });

  it("R3 klient: overlapp med firmaadmins periode med sluttdato sperrer Lagre med tekst", () => {
    const d = rendre({ kontorer: 3, perioder: [FAST_TROMSO, firmaets("alta", "2026-11-01", "2026-11-20")] });
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    expect(within(d).getByTestId("reise-oppmote-sperre").textContent).toContain("timer.reiseKort.sperre.overlapperFirma");
  });

  it("R3 server: serverens CONFLICT vises lesbart; raden skrives ikke", async () => {
    const d = rendre();
    h.avvis.set("oppmotePeriode.overforing", "CONFLICT");
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    expect(await lagre(d)).toBeUndefined();
    expect(overforing()).toHaveLength(1);
    expect(d.querySelector("p.text-red-600")?.textContent).toBe("timer.reiseKort.sperre.overlappServer");
  });
});
