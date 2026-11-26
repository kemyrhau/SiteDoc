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
  /** O18 S1: kjøretid Narvik → b1 (230 = over terskel). */
  narvikMin = 230,
  /** O20: firmaets reiseregel (terskel). */
  regel = REGEL,
  /** O20 TILLEGG: dagsnorm 7,5 t og overtidsart «lot» (O5). */
  o5 = false,
  /** O21: firmaets kjøretid Tromsø → b1 mangler i tabellen. */
  utenKjoretid = false,
  /** R7 (runde 1 timer): firmaets visningsmodus. */
  modus = "prosjektkort",
  /** Runde 2 («Annet sted»): firmaets interne prosjekter finnes i prosjektlisten. */
  internt = false,
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
      ...(internt
        ? [
            { id: "pv", name: "Verksted/maskinvedlikehold", internalProjectNumber: null, type: "internt" },
            { id: "pi", name: "Internt arbeid", internalProjectNumber: null, type: "internt" },
          ]
        : []),
    ],
    "bygning.hentForFirma": [
      { id: "b1", projectId: "p1", name: "sommerfeldtsgt 65" },
      { id: "b2", projectId: "p2", name: "Byggeplass 1" },
    ],
    "eksternKostObjekt.list": [{ id: "eco1", proAdmId: "END-001", kortNavn: "Endring 1" }],
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: modus,
      reiseLonnsartId: "lr",
      reiseGrenser: [],
      ...regel,
    },
    "oppmotested.hentForFirma": steder,
    "oppmotested.hentMatriseForFirma": [
      ...(utenKjoretid ? [] : [{ oppmotestedId: "tromso", byggeplassId: "b1", kjoretidMin: 4, avstandM: 2000 }]),
      { oppmotestedId: "tromso", byggeplassId: "b2", kjoretidMin: 35, avstandM: 30000 },
      { oppmotestedId: "narvik", byggeplassId: "b1", kjoretidMin: narvikMin, avstandM: 250000 },
      { oppmotestedId: "alta", byggeplassId: "b1", kjoretidMin: 300, avstandM: 400000 },
    ],
    "oppmotested.hentKontorAvstanderForFirma": [
      { fraOppmotestedId: "narvik", tilOppmotestedId: "tromso", kjoretidMin: 180, avstandM: 250000 },
    ],
    "oppmotePeriode.hentMine": { perioder, trengerValg: false },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true, type: "ordinaer" },
      { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer" },
      ...(o5 ? [{ id: "lot", navn: "Overtid 50 %", aktiv: true, erStandardvalg: false, type: "ordinaer", overtidsnivaa: 50, rekkefolge: 2 }] : []),
    ],
    ...(o5
      ? { "organisasjon.hentEffektivArbeidstid": { dagsnorm: 7.5, startTid: "07:00", sluttTid: "15:00", pauseMin: 30, pauseReferanse: "ankomst" } }
      : {}),
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
/** O18 (pkt 20): under terskel er primærknappen «Før som reisetid likevel», ellers «Lagre». */
const lagreKnapp = (d: HTMLElement) =>
  (within(d).queryByRole("button", { name: "handling.lagre" }) ??
    knapp(d, "timer.reiseKort.forSomReisetidLikevel")) as HTMLButtonElement;
/** Kontorvalget skriver perioden først (async) — vent til raden er sendt. */
async function lagre(d: HTMLElement) {
  fireEvent.click(lagreKnapp(d));
  // O12 pkt 12: svar «Ja, lagre» når dialogen åpnes.
  const sjekk = screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
  if (sjekk) fireEvent.click(within(sjekk).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
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
  it("annet kontor over terskel: «Lagre» skriver perioden og fører reisen", async () => {
    const d = rendre();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    // O18: «Arbeidstid» er ikke et valg for ny reise.
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.arbeidstid" })).toBeNull();
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.lagreOppmotested" })).toBeNull();
    expect(within(d).queryByRole("button", { name: "handling.lukk" })).toBeNull();
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", tilTid: "07:00", reiseKilde: "manuell" });
    expect(input).not.toHaveProperty("arbeidReiseRetning");
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({
      handling: "start",
      oppmotestedId: "narvik",
      dato: DATO,
    });
  });

  // O18 S1 (Kenneth «s1 ja»): under terskel lagrer «Lagre oppmøtested» bare stedsbyttet.
  it("O18 S1: annet kontor under terskel — «Lagre oppmøtested» skriver perioden, ingen rad", async () => {
    const d = rendre({ narvikMin: 10 });
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    expect(within(d).getByTestId("reise-oppmote-boks")).toBeTruthy();
    expect(within(d).getByTestId("reise-under-terskel")).toBeTruthy();
    expect(within(d).queryByRole("button", { name: "handling.lagre" })).toBeNull();
    fireEvent.click(knapp(d, "timer.reiseKort.lagreOppmotested"));
    await new Promise((r) => setTimeout(r, 0));
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({
      handling: "start",
      oppmotestedId: "narvik",
      dato: DATO,
    });
    expect(h.kall.some((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")).toBe(false);
  });

  it("O18 S1: annet kontor under terskel — «Før som reisetid likevel» skriver perioden og reisen", async () => {
    const d = rendre({ narvikMin: 10 });
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ lonnsartId: "lr", reiseKilde: "manuell", reiseOppmotestedId: "narvik" });
    expect(input).not.toHaveProperty("arbeidReiseRetning");
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({ oppmotestedId: "narvik" });
  });

  it("O18 S1 negativkontroll: uten annet kontor finnes ikke «Lagre oppmøtested»", () => {
    const d = rendre();
    expect(within(d).getByTestId("reise-under-terskel")).toBeTruthy();
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.lagreOppmotested" })).toBeNull();
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

  it("O19 pkt 24: «Til byggeplass» nær midnatt — Start går over midnatt, reisen deles (ingen klemming)", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "00:30", tilTid: "05:00", timer: "4.5" })] });
    expect(slutt(d).value).toBe("00:30");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(start(d).value).toBe("23:30");
    expect(slutt(d).value).toBe("00:30");
    expect(antall(d).value).toBe("1");
    expect(within(d).getByTestId("reise-midnatt-boks").textContent).toBe(
      'timer.reiseKort.startetKveldenFoer{"fra":"23:30","dato1":"04.11","til":"00:30","dato2":"05.11"}',
    );
    expect(await lagre(d)).toBeUndefined();
    expect(h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyDeltReise")?.input).toMatchObject({
      sheetId: "s1",
      vei: "bak",
      del1: { fraTid: "23:30", tilTid: "24:00" },
      del2: { fraTid: "00:00", tilTid: "00:30" },
      reiseKilde: "manuell",
    });
  });

  it("O19 pkt 23: «Fra byggeplass» nær midnatt — Slutt går over midnatt, reisen deles fram", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "18:00", tilTid: "23:29", timer: "5.48" })] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(start(d).value).toBe("23:29");
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(slutt(d).value).toBe("00:29");
    expect(antall(d).value).toBe("1");
    expect(within(d).getByTestId("reise-midnatt-boks").textContent).toBe(
      'timer.reiseKort.delesVedMidnatt{"fra":"23:29","dato1":"05.11","til":"00:29","dato2":"06.11"}',
    );
    expect(await lagre(d)).toBeUndefined();
    expect(h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyDeltReise")?.input).toMatchObject({
      vei: "fram",
      del1: { fraTid: "23:29", tilTid: "24:00" },
      del2: { fraTid: "00:00", tilTid: "00:29" },
    });
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
  // O17 pkt 22: «Avslutt» med «Siste dag» før periodens start — linja sier «… fjernes» før trykket,
  // regnet fra samme plan som kallet (B, aldri A).
  for (const siste of ["2026-11-03", "2026-11-02", "2026-11-01"]) {
    it(`O17 pkt 22: «Avslutt» ${siste} — linja sier at B fjernes før trykket, kallet navngir B`, () => {
      const d = rendre({ perioder: toEgne() });
      fireEvent.click(knapp(d, "timer.reiseKort.avslutt"));
      const sporsmal = within(d).getByTestId("reise-avslutt");
      expect(within(sporsmal).queryByTestId("reise-oppmote-fjernes")).toBeNull();
      fireEvent.change(within(sporsmal).getByLabelText("timer.reiseKort.sisteDag"), { target: { value: siste } });
      const tekst = within(sporsmal).getByTestId("reise-oppmote-fjernes").textContent ?? "";
      expect(tekst).toContain("timer.reiseKort.periodeFjernes");
      expect(tekst).toContain('"navn":"Kontor Narvik"');
      expect(tekst).toContain("04.11");
      expect(tekst).not.toContain("02.11");
      expect(overforing()).toHaveLength(0);
      fireEvent.click(within(sporsmal).getByRole("button", { name: "timer.reiseKort.avslutt" }));
      expect(overforing()).toEqual([expect.objectContaining({ handling: "slutt", dato: siste, periodeId: "pB" })]);
    });
  }
  it("O17 pkt 22: «Avslutt» 04 (forslaget, = periodens start) og 06 — perioden lukkes, ingen «fjernes»", () => {
    const d = rendre({ perioder: toEgne() });
    fireEvent.click(knapp(d, "timer.reiseKort.avslutt"));
    const sporsmal = within(d).getByTestId("reise-avslutt");
    for (const siste of ["2026-11-04", "2026-11-06"]) {
      fireEvent.change(within(sporsmal).getByLabelText("timer.reiseKort.sisteDag"), { target: { value: siste } });
      expect(within(sporsmal).queryByTestId("reise-oppmote-fjernes")).toBeNull();
    }
  });
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

describe("O19 — reisevinduet: pkt 20, 23–25", () => {
  afterEach(cleanup);
  const antall = (d: HTMLElement) => d.querySelector("#reise-antall") as HTMLInputElement;
  const deltKall = () => h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyDeltReise")?.input;
  const narvikEgen: OppmotePeriodeInput = {
    id: "pe",
    type: "kontor",
    fast: false,
    oppmotestedId: "narvik",
    projectId: null,
    fraDato: DATO,
    tilDato: null,
    kilde: "overforing",
  };
  /** Kontorreisen Tromsø → Narvik 04:00–07:00 i kortet (pkt 21). */
  const kontorreise = (over: Rad = {}): Rad =>
    arbeid({
      id: "r0",
      lonnsartId: "lr",
      erReise: true,
      fraTid: "04:00",
      tilTid: "07:00",
      timer: "3",
      reiseKilde: "overforing",
      reiseRetning: "ut",
      reiseRegel: { overforing: { fra: { type: "kontor", oppmotestedId: "tromso" }, til: { type: "kontor", oppmotestedId: "narvik" } } },
      createdAt: "2026-11-05T04:00:00.000Z",
      ...over,
    });

  it("pkt 20: teksten under terskel står i en blå boks", () => {
    const d = rendre();
    expect(within(d).getByTestId("reise-under-terskel").className).toContain("bg-blue-50");
  });

  it("pkt 24: «Til byggeplass» Start 19:00 etter Slutt 07:00 → «Startet du kvelden før?», deles bak", async () => {
    const d = rendre();
    fireEvent.change(start(d), { target: { value: "19:00" } });
    expect(within(d).getByTestId("reise-midnatt-boks").textContent).toBe(
      'timer.reiseKort.startetKveldenFoer{"fra":"19:00","dato1":"04.11","til":"07:00","dato2":"05.11"}',
    );
    expect(d.textContent).not.toContain("timer.feil.sluttForStart");
    await lagre(d);
    expect(deltKall()).toMatchObject({ vei: "bak", del1: { fraTid: "19:00", tilTid: "24:00" }, del2: { fraTid: "00:00", tilTid: "07:00" } });
    expect(h.kall.some((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")).toBe(false);
  });

  it("negativkontroll: reise innenfor døgnet → ingen boks, vanlig rad", async () => {
    const d = rendre();
    expect(within(d).queryByTestId("reise-midnatt-boks")).toBeNull();
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "06:56", tilTid: "07:00" });
    expect(deltKall()).toBeUndefined();
  });

  it("pkt 23: overlapp sjekkes på delen som står på dagens sedel (00:00–00:30)", () => {
    const d = rendre({ timer: [arbeid({ fraTid: "00:30", tilTid: "05:00", timer: "4.5" }), arbeid({ id: "r2", lonnsartId: "lr", erReise: true, reiseRetning: "retur", fraTid: "00:05", tilTid: "00:20", kortId: "k2", projectId: "p2", byggeplassId: "b2" })] });
    fireEvent.change(antall(d), { target: { value: "1" } });
    expect(within(d).getByTestId("reise-midnatt-boks")).toBeTruthy();
    expect(d.textContent).toContain("timer.feil.overlappKort");
    expect(d.textContent).toContain('"fra":"00:00","til":"00:30","annenFra":"00:05"');
    expect(lagreKnapp(d).disabled).toBe(true);
  });

  it("pkt 25: «Til byggeplass» som overlapper kontorreisen → stopp med lenke til «Sted og aktivitet»", () => {
    const d = rendre({ timer: [kontorreise(), arbeid()], perioder: [FAST_TROMSO, narvikEgen] });
    const p = within(d).getByTestId("reise-paa-kontor");
    expect(p.textContent).toContain('timer.reiseKort.sperre.paaKontor{"kontor":"Kontor Narvik","tid":"07:00","byggeplass":"sommerfeldtsgt 65"}');
    expect(d.textContent).not.toContain("timer.feil.overlapp");
    expect(lagreKnapp(d).disabled).toBe(true);
    fireEvent.click(within(p).getByRole("button", { name: "timer.jobbSkjema.aapneVindu" }));
    expect(screen.queryByRole("dialog", { name: "timer.reiseKort.tittel" })).toBeNull();
  });

  it("pkt 25 negativkontroll: «Fra byggeplass» med samme rader stoppes ikke av kontorreisen", () => {
    const d = rendre({ timer: [kontorreise(), arbeid()], perioder: [FAST_TROMSO, narvikEgen] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(within(d).queryByTestId("reise-paa-kontor")).toBeNull();
  });
});

describe("O20 (vedtak-timer-web § Reisevinduet pkt 26) — «Flytt jobbens start/slutt»", () => {
  afterEach(cleanup);
  // Siljes dag: én arbeidsrad 07:00–17:30, 30 min pause = 10,0 t.
  const jobb = () => arbeid({ fraTid: "07:00", tilTid: "17:30", timer: "10", pauseMin: 30 });
  const OVER = { ...REGEL, reiseTerskelMin: 2 };
  const flyttBoks = (d: HTMLElement) => within(d).queryByTestId("reise-flytt-jobb");
  const settTid = (d: HTMLElement, fra: string, til: string) => {
    fireEvent.change(slutt(d), { target: { value: til } });
    fireEvent.change(start(d), { target: { value: fra } });
  };
  const tilfoyKall = () => h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;

  it("Til-reise 07:00–07:50 under terskel: knappen flytter jobbens start og lagrer reisen (Reisetid) i ett kall", async () => {
    const d = rendre({ timer: [jobb()] });
    settTid(d, "07:00", "07:50");
    // Overlapp-teksten står, og den gamle knappen er fortsatt sperret.
    expect(d.textContent).toContain("timer.feil.overlappKort");
    expect(lagreKnapp(d).disabled).toBe(true);
    const boks = flyttBoks(d)!;
    expect(boks.textContent).toContain('timer.reiseKort.flyttJobb.blir{"fra":"07:50","til":"17:30","timer":"9,2"}');
    fireEvent.click(within(boks).getByRole("button", { name: 'timer.reiseKort.flyttJobb.start{"tid":"07:50"}' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(tilfoyKall()).toMatchObject({
      fraTid: "07:00",
      tilTid: "07:50",
      lonnsartId: "lr",
      kortId: "k1",
      reiseIKort: true,
      flyttRad: { radId: "r1", nyFra: "07:50" },
    });
  });

  it("Fra-reise 17:00–17:40 over terskel: knappen flytter jobbens slutt til 17:00", async () => {
    const d = rendre({ timer: [jobb()], regel: OVER });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(start(d), { target: { value: "17:00" } });
    fireEvent.change(slutt(d), { target: { value: "17:40" } });
    const boks = flyttBoks(d)!;
    expect(boks.textContent).toContain('timer.reiseKort.flyttJobb.blir{"fra":"07:00","til":"17:00","timer":"9,5"}');
    fireEvent.click(within(boks).getByRole("button", { name: 'timer.reiseKort.flyttJobb.slutt{"tid":"17:00"}' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(tilfoyKall()).toMatchObject({ fraTid: "17:00", tilTid: "17:40", flyttRad: { radId: "r1", nyTil: "17:00" } });
    expect((tilfoyKall()!.flyttRad as Record<string, unknown>).nyFra).toBeUndefined();
  });

  it("negativkontroll: ingen overlapp → ingen knapp, og «Lagre» sender ingen flytting", async () => {
    const d = rendre({ timer: [jobb()], regel: OVER });
    settTid(d, "06:10", "07:00");
    expect(flyttBoks(d)).toBeNull();
    const input = (await lagre(d))!;
    expect(input.flyttRad).toBeUndefined();
  });

  it("regresjon: reise midt i jobben sperrer som før, ingen knapp", () => {
    const d = rendre({ timer: [jobb()] });
    settTid(d, "10:00", "10:30");
    expect(d.textContent).toContain("timer.feil.overlappKort");
    expect(flyttBoks(d)).toBeNull();
    expect(lagreKnapp(d).disabled).toBe(true);
  });

  it("regresjon: overlapp med et annet kort sperrer som før, ingen knapp", () => {
    const annen = arbeid({ id: "r2", fraTid: "06:00", tilTid: "07:10", timer: "1.17", kortId: "k2", projectId: "p2", byggeplassId: "b2" });
    const d = rendre({ timer: [jobb(), annen] });
    settTid(d, "07:00", "07:50");
    expect(flyttBoks(d)).toBeNull();
    expect(lagreKnapp(d).disabled).toBe(true);
  });

  it("feil retning: «Fra byggeplass» mot jobbens start gir ingen knapp", () => {
    const d = rendre({ timer: [jobb()], regel: OVER });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "07:50" } });
    expect(flyttBoks(d)).toBeNull();
  });
});

describe("O20 TILLEGG — jobb delt i normal + overtid (O5) viser ny fordeling", () => {
  afterEach(cleanup);
  // Jobben 07:00–17:30 lagret av O5: normal 07:00–15:00 (7,5 t, pause 30) + overtid 15:00–17:30 (2,5 t).
  const o5Jobb = () => [
    arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 }),
    arbeid({ id: "r2", fraTid: "15:00", tilTid: "17:30", timer: "2.5", pauseMin: 0, lonnsartId: "lot", createdAt: "2026-11-05T07:01:00.000Z" }),
  ];
  const OVER = { ...REGEL, reiseTerskelMin: 2 };
  const tilfoyKall = () => h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;

  it("Til 07:00–07:50: linja viser 7,5 t + 1,7 t overtid, og bare kanten sendes (serveren regner fordelingen)", async () => {
    const d = rendre({ timer: o5Jobb(), o5: true, regel: OVER });
    fireEvent.change(slutt(d), { target: { value: "07:50" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    const boks = within(d).getByTestId("reise-flytt-jobb");
    expect(boks.textContent).toContain(
      'timer.reiseKort.flyttJobb.blirOvertid{"fra":"07:50","til":"17:30","normal":"7,5","overtid":"1,7"}',
    );
    fireEvent.click(within(boks).getByRole("button", { name: 'timer.reiseKort.flyttJobb.start{"tid":"07:50"}' }));
    await new Promise((r) => setTimeout(r, 0));
    expect(tilfoyKall()).toMatchObject({ flyttRad: { radId: "r1", nyFra: "07:50" } });
  });

  it("Fra 17:00–17:40: linja viser 7,5 t + 2,0 t overtid (overtiden tas først)", () => {
    const d = rendre({ timer: o5Jobb(), o5: true, regel: OVER });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(start(d), { target: { value: "17:00" } });
    fireEvent.change(slutt(d), { target: { value: "17:40" } });
    const boks = within(d).getByTestId("reise-flytt-jobb");
    expect(boks.textContent).toContain(
      'timer.reiseKort.flyttJobb.blirOvertid{"fra":"07:00","til":"17:00","normal":"7,5","overtid":"2,0"}',
    );
    expect(within(boks).getByRole("button", { name: 'timer.reiseKort.flyttJobb.slutt{"tid":"17:00"}' })).toBeTruthy();
  });

  it("overtiden blir 0 (Til 07:00–09:30): linja viser bare sum", () => {
    const d = rendre({ timer: o5Jobb(), o5: true, regel: OVER });
    fireEvent.change(slutt(d), { target: { value: "09:30" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    const boks = within(d).getByTestId("reise-flytt-jobb");
    expect(boks.textContent).toContain('timer.reiseKort.flyttJobb.blir{"fra":"09:30","til":"17:30","timer":"7,5"}');
  });

  it("regresjon: jobb med én arbeidsrad viser sum som før, også med norm", () => {
    const d = rendre({ timer: [arbeid({ fraTid: "07:00", tilTid: "17:30", timer: "10", pauseMin: 30 })], o5: true, regel: OVER });
    fireEvent.change(slutt(d), { target: { value: "07:50" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(within(d).getByTestId("reise-flytt-jobb").textContent).toContain(
      'timer.reiseKort.flyttJobb.blir{"fra":"07:50","til":"17:30","timer":"9,2"}',
    );
  });
});

describe("O21 (vedtak-timer-web § Reisevinduet pkt 27) — Start inne i jobben: Slutt følger", () => {
  afterEach(cleanup);
  // Kenneths dag (B12, 19.11): normal 07:00–15:00 + Overtid 50 % 15:00–17:30. Kjøretid 4 min.
  const o5Jobb = () => [
    arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 }),
    arbeid({ id: "r2", fraTid: "15:00", tilTid: "17:30", timer: "2.5", pauseMin: 0, lonnsartId: "lot", createdAt: "2026-11-05T07:01:00.000Z" }),
  ];
  const flyttBoks = (d: HTMLElement) => within(d).queryByTestId("reise-flytt-jobb");

  it("Kenneths tilfelle: Til byggeplass, Start 07:00 → Slutt 07:04, og «Flytt jobbens start til 07:04» vises", () => {
    const d = rendre({ timer: o5Jobb(), o5: true });
    expect(start(d).value).toBe("06:56");
    expect(slutt(d).value).toBe("07:00");
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(slutt(d).value).toBe("07:04");
    expect(d.textContent).not.toContain("timer.feil.sluttForStart");
    const boks = flyttBoks(d)!;
    expect(within(boks).getByRole("button", { name: 'timer.reiseKort.flyttJobb.start{"tid":"07:04"}' })).toBeTruthy();
  });

  it("tidsfeltets mellomverdi (06:56 → 07:56 → 07:00) ender på 07:04, ikke 08:00", () => {
    const d = rendre({ timer: o5Jobb(), o5: true });
    fireEvent.change(start(d), { target: { value: "07:56" } });
    expect(slutt(d).value).toBe("08:00");
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(slutt(d).value).toBe("07:04");
  });

  it("Slutt rettes fritt etterpå (07:50), og knappen følger", () => {
    const d = rendre({ timer: o5Jobb(), o5: true });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "07:50" } });
    expect(within(flyttBoks(d)!).getByRole("button", { name: 'timer.reiseKort.flyttJobb.start{"tid":"07:50"}' })).toBeTruthy();
    // Arbeiderens egen Slutt står når neste Start ligger før den.
    fireEvent.change(start(d), { target: { value: "07:10" } });
    expect(slutt(d).value).toBe("07:50");
    // … og følger igjen når Start går forbi den, inne i jobben.
    fireEvent.change(start(d), { target: { value: "08:00" } });
    expect(slutt(d).value).toBe("08:04");
  });

  it("regresjon pkt 6: Start 06:30 (før jobben) → Slutt står", () => {
    const d = rendre({ timer: o5Jobb(), o5: true });
    fireEvent.change(start(d), { target: { value: "06:30" } });
    expect(slutt(d).value).toBe("07:00");
  });

  it("regresjon pkt 24: Start 19:00 (etter jobben) → «Startet du kvelden før?»", () => {
    const d = rendre({ timer: o5Jobb(), o5: true });
    fireEvent.change(start(d), { target: { value: "19:00" } });
    expect(slutt(d).value).toBe("07:00");
    expect(within(d).getByTestId("reise-midnatt-boks").textContent).toContain("timer.reiseKort.startetKveldenFoer");
  });

  it("regresjon: kort uten jobb → Slutt står som i dag", () => {
    const d = rendre({ timer: [arbeid({ kortId: "k1", erReise: true, fraTid: "06:00", tilTid: "06:30", timer: "0.5" })] });
    // Uten arbeid finnes ikke noe forslag; skrevet Start gir Start + kjøretid (w15b), som før O21.
    expect(slutt(d).value).toBe("");
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(slutt(d).value).toBe("07:04");
  });

  it("uten kjøretid: Slutt står (dagens sperre «Slutt-tid må være etter start-tid»)", () => {
    const d = rendre({ timer: o5Jobb(), o5: true, utenKjoretid: true });
    expect(within(d).getByTestId("reise-uten-kjoretid")).toBeTruthy();
    expect(slutt(d).value).toBe("07:00");
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(slutt(d).value).toBe("07:00");
    expect(d.textContent).toContain("timer.feil.sluttForStart");
    expect(flyttBoks(d)).toBeNull();
  });
});

describe("O23 (vedtak-timer-web § Reisevinduet pkt 29) — Fra byggeplass: Slutt inne i jobben, Start følger", () => {
  afterEach(cleanup);
  // Kenneths dag (B12, 19.11): normal 07:00–15:00 + Overtid 50 % 15:00–17:30. Kjøretid 4 min.
  const o5Jobb = () => [
    arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 }),
    arbeid({ id: "r2", fraTid: "15:00", tilTid: "17:30", timer: "2.5", pauseMin: 0, lonnsartId: "lot", createdAt: "2026-11-05T07:01:00.000Z" }),
  ];
  const flyttBoks = (d: HTMLElement) => within(d).queryByTestId("reise-flytt-jobb");
  const midnatt = (d: HTMLElement) => within(d).queryByTestId("reise-midnatt-boks");
  const fra = (d: HTMLElement) => {
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    return d;
  };

  it("Kenneths tilfelle: Slutt 17:00 → Start 16:56, ingen deling over midnatt", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    expect(start(d).value).toBe("17:30");
    fireEvent.change(slutt(d), { target: { value: "17:00" } });
    expect(start(d).value).toBe("16:56");
    expect(slutt(d).value).toBe("17:00");
    expect(midnatt(d)).toBeNull();
    expect(d.textContent).not.toContain("timer.feil.sluttForStart");
  });

  it("Slutt på jobbens slutt (17:30) → Start 17:26, og «Flytt jobbens slutt til 17:26» vises", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    fireEvent.change(slutt(d), { target: { value: "17:30" } });
    expect(start(d).value).toBe("17:26");
    expect(within(flyttBoks(d)!).getByRole("button", { name: 'timer.reiseKort.flyttJobb.slutt{"tid":"17:26"}' })).toBeTruthy();
  });

  it("tidsfeltets mellomverdi (17:34 → 16:34 → 16:50) ender på Start 16:46", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    expect(slutt(d).value).toBe("17:34");
    fireEvent.change(slutt(d), { target: { value: "16:34" } });
    expect(start(d).value).toBe("16:30");
    fireEvent.change(slutt(d), { target: { value: "16:50" } });
    expect(start(d).value).toBe("16:46");
  });

  it("Start rettet av arbeideren står når Slutt er etter den", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    fireEvent.change(slutt(d), { target: { value: "17:00" } });
    fireEvent.change(start(d), { target: { value: "16:30" } });
    fireEvent.change(slutt(d), { target: { value: "16:50" } });
    expect(start(d).value).toBe("16:30");
  });

  it("regresjon pkt 23: Slutt 01:00 (utenfor jobben) → reisen deles over midnatt som før", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    fireEvent.change(slutt(d), { target: { value: "01:00" } });
    expect(start(d).value).toBe("17:30");
    expect(midnatt(d)).toBeTruthy();
  });

  it("regresjon: Slutt etter jobben (17:50) → Start står, som i dag", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true }));
    fireEvent.change(slutt(d), { target: { value: "17:50" } });
    expect(start(d).value).toBe("17:30");
    expect(midnatt(d)).toBeNull();
    expect(d.textContent).not.toContain("timer.feil.sluttForStart");
  });

  it("uten kjøretid: Start står, «Slutt-tid må være etter start-tid» — ingen reise på 23,5 t", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true, utenKjoretid: true }));
    fireEvent.change(slutt(d), { target: { value: "17:00" } });
    expect(start(d).value).toBe("17:30");
    expect(midnatt(d)).toBeNull();
    expect(d.textContent).toContain("timer.feil.sluttForStart");
    expect(lagreKnapp(d).disabled).toBe(true);
  });

  it("uten oppmøtested (O22): Start står, sperre — ingen reise på 23,5 t", () => {
    const d = fra(rendre({ timer: o5Jobb(), o5: true, perioder: [] }));
    expect(within(d).getByText("timer.reiseKort.utenOppmote")).toBeTruthy();
    fireEvent.change(slutt(d), { target: { value: "17:00" } });
    expect(start(d).value).toBe("17:30");
    expect(midnatt(d)).toBeNull();
    expect(d.textContent).toContain("timer.feil.sluttForStart");
  });
});

// R7 (runde 1 timer, Kenneth 2026-11-26 «reisefunksjonen som var ganske bra tidligere. fungerer ikke
// lenger som forventet»): dagskort-modus hadde ingen «+ Reise» (kun prosjektkortet, 07e15472), og O25
// tok bort reise via lønnsart. Nå: samme reisevindu (`ReiseKort`) fra underprosjekt-bøtta.
describe("VAKTTEST 2026-11-26 (Kenneth: «runde 1 virker») — R7 — «+ Reise» i dagskort-modus åpner samme reisevindu", () => {
  afterEach(cleanup);

  it("dagskort: «+ Reise» åpner reisevinduet, og Lagre fører reisen på prosjektet uten kort", async () => {
    const d = rendre({ modus: "dagskort" });
    expect(within(d).getByLabelText("timer.reiseKort.oppmotested")).toBeTruthy();
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p1", reiseKilde: "manuell", externalCostObjectId: "eco1" });
    expect(input.kortId ?? null).toBeNull();
  });
});

// Runde 2 timer (b) — FASIT Kenneth 2026-11-26: «Føring av reisekort med transport fra kl 07:00
// fungerer fremdeles ikke samme dag som normal dag er automatisk opprettet». Normaldagen
// (`opprettForsteTimerRadForslag`) er 07:00–15:00 med pause 30 og kort-id. Fra dagskort (R7) har
// vinduet ingen kort-id; jobben er dagens jobb i samme prosjekt.
describe("Runde 2 (b) — reise fra 07:00 mot automatisk normaldag 07:00–15:00", () => {
  afterEach(cleanup);
  const normaldag = () => [arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 })];
  const flyttBoks = (d: HTMLElement) => within(d).queryByTestId("reise-flytt-jobb");
  async function flytt(d: HTMLElement, navn: string) {
    fireEvent.click(within(flyttBoks(d)!).getByRole("button", { name: navn }));
    const sjekk = screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
    if (sjekk) fireEvent.click(within(sjekk).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
  }

  for (const modus of ["dagskort", "prosjektkort"] as const) {
    it(`${modus}: Til byggeplass, Start 07:00 → Slutt 07:04, og «Flytt jobbens start til 07:04» lagrer i jobbens kort`, async () => {
      const d = rendre({ timer: normaldag(), modus });
      fireEvent.change(start(d), { target: { value: "07:00" } });
      expect(slutt(d).value).toBe("07:04");
      expect(d.textContent).not.toContain("timer.feil.sluttForStart");
      const input = (await flytt(d, 'timer.reiseKort.flyttJobb.start{"tid":"07:04"}'))!;
      expect(input).toMatchObject({
        fraTid: "07:00",
        tilTid: "07:04",
        kortId: "k1",
        reiseIKort: true,
        flyttRad: { radId: "r1", nyFra: "07:04" },
      });
    });

    it(`${modus}: Til annet oppmøtested (Narvik, 180 min), Start 07:00 → Slutt 10:00, og «Flytt jobbens start til 10:00»`, async () => {
      const d = rendre({ timer: normaldag(), modus });
      fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
      fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "narvik" } });
      fireEvent.change(start(d), { target: { value: "07:00" } });
      expect(slutt(d).value).toBe("10:00");
      const input = (await flytt(d, 'timer.reiseKort.flyttJobb.start{"tid":"10:00"}'))!;
      expect(input).toMatchObject({
        fraTid: "07:00",
        tilTid: "10:00",
        kortId: "k1",
        reiseIKort: true,
        reiseKilde: "overforing",
        flyttRad: { radId: "r1", nyFra: "10:00" },
      });
      // O16: perioden skrives først, som før.
      expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(true);
    });
  }

  it("dagskort: Fra byggeplass, Slutt 15:00 → Start 14:56, og «Flytt jobbens slutt til 14:56» (samme hull som Til)", async () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort" });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(slutt(d), { target: { value: "15:00" } });
    expect(start(d).value).toBe("14:56");
    const input = (await flytt(d, 'timer.reiseKort.flyttJobb.slutt{"tid":"14:56"}'))!;
    expect(input).toMatchObject({ fraTid: "14:56", tilTid: "15:00", kortId: "k1", reiseIKort: true, flyttRad: { radId: "r1", nyTil: "14:56" } });
  });

  it("dagskort: jobben i et annet prosjekt følges ikke (Slutt står)", () => {
    const d = rendre({ timer: [arbeid({ projectId: "p2", byggeplassId: "b2", fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 })], modus: "dagskort" });
    // Vinduet åpnes fra p2-bøtta; bytt til p1 — dagens jobb er ikke i p1.
    fireEvent.change(within(d).getByLabelText("timer.felt.prosjekt"), { target: { value: "p1" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(flyttBoks(d)).toBeNull();
  });

  it("dagskort uten flytting: Lagre fører fortsatt uten kort (R7 står)", async () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort" });
    fireEvent.change(start(d), { target: { value: "06:00" } });
    expect(slutt(d).value).toBe("07:00");
    const input = (await lagre(d))!;
    expect(input.kortId ?? null).toBeNull();
    expect(input.flyttRad).toBeUndefined();
  });
});

// Runde 2 timer (c): «Antall timer» i reisevinduet er minuttnøyaktig.
describe("Runde 2 (c) — antall timer i minutter", () => {
  afterEach(cleanup);
  const antall = (d: HTMLElement) => within(d).getByLabelText("timer.felt.antallTimer") as HTMLInputElement;

  it("0,07 t godtas av feltet og lagres som 4 min", async () => {
    const d = rendre({ timer: [arbeid({ fraTid: "08:00", tilTid: "12:00", timer: "4" })] });
    fireEvent.change(antall(d), { target: { value: "0.07" } });
    expect(antall(d).validity.valid).toBe(true);
    expect(start(d).value).toBe("07:56");
    expect(slutt(d).value).toBe("08:00");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "07:56", tilTid: "08:00" });
    expect(input.timer as number).toBeCloseTo(4 / 60, 5);
  });

  it("0,12 t → 7 min (ikke trinn på 0,25)", () => {
    const d = rendre({ timer: [arbeid({ fraTid: "08:00", tilTid: "12:00", timer: "4" })] });
    fireEvent.change(antall(d), { target: { value: "0.12" } });
    expect(antall(d).validity.valid).toBe(true);
    expect(start(d).value).toBe("07:53");
  });
});

// Runde 2 timer — kursreise «Annet sted» (Kenneth 2026-11-26: «hva om jeg sendes til bergen på kurs»
// → «1. ja»): fjerde valg; Fra = dagens oppmøtested (forslag), Til = fritekst, prosjekt «Internt
// arbeid» (forslag). Ingen byggeplass, kjøretidstabell eller oppmøtested-periode.
describe("Runde 2 — kursreise «Annet sted»", () => {
  afterEach(cleanup);
  const annet = (d: HTMLElement) => {
    fireEvent.click(knapp(d, "timer.reiseKort.annetSted"));
    return d;
  };
  const sted = (d: HTMLElement) => within(d).getByLabelText("timer.reiseKort.annetStedFelt") as HTMLInputElement;
  const prosjekt = (d: HTMLElement) => within(d).getByLabelText("timer.felt.prosjekt") as HTMLSelectElement;

  it("fjerde valg: Fra = dagens oppmøtested, Til = fritekst, prosjekt = «Internt arbeid», ingen byggeplass", () => {
    const d = annet(rendre({ internt: true }));
    expect((within(d).getByLabelText("timer.reiseKort.oppmotested") as HTMLSelectElement).value).toBe("tromso");
    expect(sted(d).value).toBe("");
    expect(prosjekt(d).value).toBe("pi");
    expect(within(d).queryByLabelText("timer.felt.byggeplass")).toBeNull();
    expect(within(d).queryByTestId("reise-uten-kjoretid")).toBeNull();
    expect(within(d).queryByTestId("reise-oppmote-boks")).toBeNull();
    // Arbeideren skriver tiden selv (O22-veien): ingen forslag.
    expect(start(d).value).toBe("");
    expect(slutt(d).value).toBe("");
  });

  it("Lagre er sperret til stedet er skrevet", () => {
    const d = annet(rendre({ internt: true }));
    fireEvent.change(start(d), { target: { value: "13:00" } });
    fireEvent.change(slutt(d), { target: { value: "16:30" } });
    expect(lagreKnapp(d).disabled).toBe(true);
    // Forklaringen står i knappens tooltip (KnappMedForklaring).
    fireEvent.mouseEnter(lagreKnapp(d).parentElement!);
    fireEvent.focus(lagreKnapp(d));
    expect(document.body.textContent).toContain("timer.reiseKort.sperre.manglerSted");
    fireEvent.change(sted(d), { target: { value: "Bergen" } });
    expect(lagreKnapp(d).disabled).toBe(false);
  });

  it("lagres på «Internt arbeid» med stedet i sporet, uten byggeplass, kort eller oppmøtested-periode", async () => {
    const d = annet(rendre({ internt: true }));
    fireEvent.change(sted(d), { target: { value: "Bergen" } });
    fireEvent.change(start(d), { target: { value: "13:00" } });
    fireEvent.change(slutt(d), { target: { value: "16:30" } });
    const input = (await lagre(d))!;
    expect(input).toMatchObject({
      erReise: true,
      projectId: "pi",
      byggeplassId: null,
      externalCostObjectId: null,
      fraTid: "13:00",
      tilTid: "16:30",
      timer: 3.5,
      lonnsartId: "lr",
      reiseKilde: "manuell",
      reiseRetning: "ut",
      reiseOppmotestedId: "tromso",
      reiseKjoretidMin: null,
    });
    expect((input.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
    expect(input.kortId ?? null).toBeNull();
    expect(input.reiseIKort).toBeUndefined();
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(false);
  });

  it("Fra og prosjekt kan byttes (Narvik, Prosjekt 1050)", async () => {
    const d = annet(rendre({ internt: true }));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.oppmotested"), { target: { value: "narvik" } });
    fireEvent.change(prosjekt(d), { target: { value: "p2" } });
    fireEvent.change(sted(d), { target: { value: "Bergen" } });
    fireEvent.change(start(d), { target: { value: "13:00" } });
    fireEvent.change(slutt(d), { target: { value: "16:30" } });
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p2", byggeplassId: null, reiseOppmotestedId: "narvik" });
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(false);
  });

  it("antall timer flytter Slutt (Start står)", () => {
    const d = annet(rendre({ internt: true }));
    fireEvent.change(start(d), { target: { value: "06:00" } });
    fireEvent.change(within(d).getByLabelText("timer.felt.antallTimer"), { target: { value: "3.5" } });
    expect(start(d).value).toBe("06:00");
    expect(slutt(d).value).toBe("09:30");
  });

  it("O19: over midnatt deles som i dag, med stedet i begge deler", async () => {
    const d = annet(rendre({ internt: true }));
    fireEvent.change(sted(d), { target: { value: "Bergen" } });
    fireEvent.change(start(d), { target: { value: "22:00" } });
    fireEvent.change(slutt(d), { target: { value: "02:00" } });
    expect(within(d).getByTestId("reise-midnatt-boks")).toBeTruthy();
    fireEvent.click(lagreKnapp(d));
    await new Promise((r) => setTimeout(r, 0));
    const delt = h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyDeltReise")?.input;
    expect(delt).toMatchObject({ projectId: "pi", byggeplassId: null, reiseOppmotestedId: "tromso" });
    expect((delt!.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Bergen" });
  });

  it("uten internt prosjekt: prosjektet vinduet ble åpnet med står", () => {
    const d = annet(rendre());
    expect(prosjekt(d).value).toBe("p1");
  });

  it("tilbake til «Til byggeplass»: prosjektet og byggeplassen fra jobben kommer tilbake", () => {
    const d = annet(rendre({ internt: true, modus: "dagskort" }));
    fireEvent.click(knapp(d, "timer.reiseKort.tur"));
    expect(prosjekt(d).value).toBe("p1");
    expect(start(d).value).toBe("06:56");
  });
});

// RETUR 1 runde 2 (Kenneth 2026-11-26 etter test: «til annet oppmøtested -> feil i feilmeldingen» ·
// «Reise på møte blokeres»).
describe("RETUR 1 runde 2 — kontorreise og «Annet sted» mot dagens jobb", () => {
  afterEach(cleanup);
  const normaldag = () => [arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 })];
  const egen = (sted: string, fraDato: string): OppmotePeriodeInput => ({
    id: "pe", type: "kontor", fast: false, oppmotestedId: sted, projectId: null, fraDato, tilDato: null, kilde: "overforing",
  });
  const flyttBoks = (d: HTMLElement) => within(d).queryByTestId("reise-flytt-jobb");
  async function flytt(d: HTMLElement, navn: string) {
    fireEvent.click(within(flyttBoks(d)!).getByRole("button", { name: navn }));
    const sjekk = screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
    if (sjekk) fireEvent.click(within(sjekk).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
  }

  it("R2-1: «Til annet oppmøtested» uten valgt kontor — grå flytt-knapp sier «Velg kontor»", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort" });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "10:00" } });
    const boks = flyttBoks(d)!;
    expect((within(boks).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(within(d).getByTestId("reise-flytt-sperre").textContent).toBe("timer.reiseKort.sperre.velgKontor");
  });

  it("R2-1: med kontor valgt står ingen sperretekst under knappen", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort" });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "narvik" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect((within(flyttBoks(d)!).getByRole("button") as HTMLButtonElement).disabled).toBe(false);
    expect(within(d).queryByTestId("reise-flytt-sperre")).toBeNull();
  });

  it("R2-2: hjemreise Narvik (midlertidig) → Tromsø (fast) som overlapper jobbens start — «Flytt jobbens start», kontorbyttet står", async () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", perioder: [FAST_TROMSO, egen("narvik", "2026-11-01")] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "tromso" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "10:50" } });
    expect(within(d).getByTestId("reise-oppmote-boks").textContent).toContain('timer.reiseKort.avsluttesMidlertidig{"navn":"Kontor Narvik"}');
    const input = (await flytt(d, 'timer.reiseKort.flyttJobb.start{"tid":"10:50"}'))!;
    expect(input).toMatchObject({
      fraTid: "07:00",
      tilTid: "10:50",
      kortId: "k1",
      reiseIKort: true,
      reiseKilde: "overforing",
      reiseRetning: "retur",
      flyttRad: { radId: "r1", nyFra: "10:50" },
    });
    expect(h.kall.some((k) => k.key === "oppmotePeriode.overforing")).toBe(true);
  });

  it("R2-3: «Annet sted» 07:00–10:00 på «Internt arbeid» mot jobben på et annet prosjekt — «Flytt jobbens start», reisen på eget kort", async () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", internt: true });
    fireEvent.click(knapp(d, "timer.reiseKort.annetSted"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.annetStedFelt"), { target: { value: "Gardermoen, Møte" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "10:00" } });
    const input = (await flytt(d, 'timer.reiseKort.flyttJobb.start{"tid":"10:00"}'))!;
    expect(input).toMatchObject({ projectId: "pi", fraTid: "07:00", tilTid: "10:00", flyttKortId: "k1", flyttRad: { radId: "r1", nyFra: "10:00" } });
    expect(input.kortId ?? null).toBeNull();
    expect(input.reiseIKort).toBeUndefined();
    expect((input.reiseRegel as { annetSted?: unknown }).annetSted).toEqual({ sted: "Gardermoen, Møte" });
  });

  it("R2-3: «Annet sted» som overlapper jobbens slutt — «Flytt jobbens slutt»", async () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", internt: true });
    fireEvent.click(knapp(d, "timer.reiseKort.annetSted"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.annetStedFelt"), { target: { value: "Gardermoen" } });
    fireEvent.change(start(d), { target: { value: "14:00" } });
    fireEvent.change(slutt(d), { target: { value: "17:00" } });
    const input = (await flytt(d, 'timer.reiseKort.flyttJobb.slutt{"tid":"14:00"}'))!;
    expect(input).toMatchObject({ flyttKortId: "k1", flyttRad: { radId: "r1", nyTil: "14:00" } });
  });

  it("R2-3: «Annet sted» midt i jobben sperrer som før (ingen knapp)", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", internt: true });
    fireEvent.click(knapp(d, "timer.reiseKort.annetSted"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.annetStedFelt"), { target: { value: "Gardermoen" } });
    fireEvent.change(start(d), { target: { value: "10:00" } });
    fireEvent.change(slutt(d), { target: { value: "11:00" } });
    expect(flyttBoks(d)).toBeNull();
    expect(lagreKnapp(d).disabled).toBe(true);
  });
});

// RETUR 2 runde 2 (Kenneth 2026-11-26: «det er flere paralelle valg -> en avsluttknapp under narvik
// i kort1 … dette virker ikke -> knapp blokkert»). R2-4: når den blå boksen for kontorbyttet vises,
// er den eneste stedet å sette «Siste dag» — «Avslutt»-lenken under Fra skjules.
describe("RETUR 2 runde 2 — ett sted å avslutte det midlertidige kontoret", () => {
  afterEach(cleanup);
  const normaldag = () => [arbeid({ fraTid: "07:00", tilTid: "15:00", timer: "7.5", pauseMin: 30 })];
  const narvik: OppmotePeriodeInput = {
    id: "pe", type: "kontor", fast: false, oppmotestedId: "narvik", projectId: null, fraDato: "2026-11-01", tilDato: null, kilde: "overforing",
  };
  const avsluttLenke = (d: HTMLElement) =>
    within(d).queryByTestId("reise-oppmote-periode")
      ? within(within(d).getByTestId("reise-oppmote-periode")).queryByRole("button", { name: "timer.reiseKort.avslutt" })
      : null;

  it("R2-4: uten kontorbytte står «Avslutt» under Fra (som før)", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", perioder: [FAST_TROMSO, narvik] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    expect(within(d).queryByTestId("reise-oppmote-boks")).toBeNull();
    expect(avsluttLenke(d)).not.toBeNull();
  });

  it("R2-4: blå boks «… avsluttes» vises — «Avslutt»-lenken er borte, perioden står", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", perioder: [FAST_TROMSO, narvik] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "tromso" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    expect(within(d).getByTestId("reise-oppmote-boks").textContent).toContain('timer.reiseKort.avsluttesMidlertidig{"navn":"Kontor Narvik"}');
    expect(within(d).getByTestId("reise-oppmote-periode").textContent).toContain("timer.reiseKort.midlertidigPeriode");
    expect(avsluttLenke(d)).toBeNull();
    expect(within(d).queryByTestId("reise-avslutt")).toBeNull();
  });

  it("R2-4: åpent «Avslutt»-spørsmål lukkes når et annet kontor velges", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", perioder: [FAST_TROMSO, narvik] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.click(avsluttLenke(d)!);
    expect(within(d).getByTestId("reise-avslutt")).toBeTruthy();
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "tromso" } });
    expect(within(d).queryByTestId("reise-avslutt")).toBeNull();
    // Tilbake til dagens kontor: lenken kommer igjen, spørsmålet er ikke åpent.
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "" } });
    expect(within(d).queryByTestId("reise-avslutt")).toBeNull();
    expect(avsluttLenke(d)).not.toBeNull();
  });

  it("R2-4: kontorreisen med blå boks lagres fortsatt med «Flytt jobbens start» (vakt for steg 2)", () => {
    const d = rendre({ timer: normaldag(), modus: "dagskort", perioder: [FAST_TROMSO, narvik] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetOppmotested"));
    fireEvent.change(within(d).getByLabelText("timer.reiseKort.tilKontorFelt"), { target: { value: "tromso" } });
    fireEvent.change(start(d), { target: { value: "07:00" } });
    fireEvent.change(slutt(d), { target: { value: "10:50" } });
    const boks = within(d).getByTestId("reise-flytt-jobb");
    expect((within(boks).getByRole("button") as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("RETUR 2 runde 2 R2-5 — «Annet sted»-reisen viser stedet i dagskortet", () => {
  afterEach(cleanup);
  const annetSted = (over: Rad = {}): Rad =>
    arbeid({
      id: "r9",
      lonnsartId: "lr",
      erReise: true,
      fraTid: "07:00",
      tilTid: "10:00",
      timer: "3",
      reiseRetning: "ut",
      byggeplassId: null,
      reiseRegel: { annetSted: { sted: "Gardermoen, Møte" } },
      ...over,
    });

  it("raden viser «Til Gardermoen, Møte»", () => {
    const d = rendre({ timer: [annetSted()], modus: "dagskort" });
    void d;
    expect(screen.getByTestId("reise-annet-sted").textContent).toBe(
      'timer.prosjektkort.reiseTil{"sted":"Gardermoen, Møte"}',
    );
  });

  it("«Hva gjorde du?» står på raden når den er fylt ut", () => {
    const d = rendre({ timer: [annetSted({ beskrivelse: "Kundemøte" })], modus: "dagskort" });
    void d;
    expect(screen.getByTestId("reise-annet-sted").closest("li")!.textContent).toContain("Kundemøte");
  });

  it("vakt: vanlig arbeidsrad får ingen stedslinje", () => {
    const d = rendre({ modus: "dagskort" });
    void d;
    expect(screen.queryByTestId("reise-annet-sted")).toBeNull();
  });
});
