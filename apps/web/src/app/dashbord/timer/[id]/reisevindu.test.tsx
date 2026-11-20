// @vitest-environment jsdom
/**
 * w15b (B42 A + Kenneths presisering 2026-11-21, web-timeforing-plan.md § 4.15 del B og G):
 * reisevinduet — systemet foreslår, arbeideren retter.
 *  - «Til annet kontor» → «Etter arbeid»: 230 min etter arbeid 07:00–12:00 gir 12:00–15:50.
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

function rendre({ timer = [arbeid()] as Rad[], kontorer = 2 } = {}) {
  h.kall = [];
  h.utelat.clear();
  h.feil.clear();
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
    ],
    "oppmotested.hentKontorAvstanderForFirma": [
      { fraOppmotestedId: "narvik", tilOppmotestedId: "tromso", kjoretidMin: 230, avstandM: 250000 },
      { fraOppmotestedId: "alta", tilOppmotestedId: "tromso", kjoretidMin: 300, avstandM: 400000 },
    ],
    "oppmotePeriode.hentMine": { perioder: [FAST_TROMSO], trengerValg: false },
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
  await new Promise((r) => setTimeout(r, 0));
  return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
}

describe("w15b — reisevinduet: systemet foreslår, arbeideren retter", () => {
  afterEach(cleanup);

  it("«Til annet kontor» → «Etter arbeid»: 12:00–15:50, kontoret forvalgt", () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetKontor"));
    // Forslaget før arbeid (som i dag): 03:10–07:00.
    expect(start(d).value).toBe("03:10");
    expect(slutt(d).value).toBe("07:00");
    expect(d.textContent).toContain("Kontor Narvik");
    fireEvent.click(knapp(d, "timer.reiseKort.etterArbeid"));
    expect(start(d).value).toBe("12:00");
    expect(slutt(d).value).toBe("15:50");
    expect(d.textContent).toContain('timer.reiseKort.forslag{"min":230}');
  });

  it("rettet start: slutten følger; rettet slutt: står og gir timene", async () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetKontor"));
    fireEvent.click(knapp(d, "timer.reiseKort.etterArbeid"));
    fireEvent.change(start(d), { target: { value: "13:00" } });
    expect(slutt(d).value).toBe("16:50");
    fireEvent.change(slutt(d), { target: { value: "17:30" } });
    expect(start(d).value).toBe("13:00");
    expect(slutt(d).value).toBe("17:30");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ fraTid: "13:00", tilTid: "17:30", timer: 4.5, projectId: "p1" });
    // Firmaets kjøretid står på raden, så attestanten ser begge.
    expect(input.reiseKjoretidMin).toBe(230);
    expect(input.lonnsartId).toBe("lr");
    // Kl. 12-regelen: start 13:00 → det nye kontoret gjelder fra dagen etter.
    expect(h.kall.find((k) => k.key === "oppmotePeriode.overforing")?.input).toMatchObject({
      handling: "start",
      oppmotestedId: "narvik",
      dato: "2026-11-06",
    });
  });

  it("bytt valg forkaster rettede tider (forslaget regnes på nytt)", () => {
    const d = rendre();
    fireEvent.change(start(d), { target: { value: "05:00" } });
    expect(start(d).value).toBe("05:00");
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(start(d).value).toBe("12:00");
    expect(slutt(d).value).toBe("12:04");
  });

  it("«Hvor kjørte du til?»: bytt prosjekt → byggeplass foreslått, underprosjekt tomt, «Får eget kort på …»", async () => {
    const d = rendre();
    expect(d.textContent).toContain('timer.reiseKort.havnerJobb{"sted":"sommerfeldtsgt 65"}');
    const prosjekt = within(d).getByLabelText("timer.felt.prosjekt") as HTMLSelectElement;
    expect(prosjekt.value).toBe("p1");
    fireEvent.change(prosjekt, { target: { value: "p2" } });
    expect(d.textContent).toContain("Byggeplass 1");
    expect((within(d).getByLabelText("timer.felt.underprosjekt") as HTMLSelectElement).value).toBe("");
    expect(d.textContent).toContain('timer.reiseKort.havnerEget{"prosjekt":"Prosjekt 1050"}');
    // Til byggeplass på p2: 35 min før dagens første arbeid.
    expect(start(d).value).toBe("06:25");
    const input = (await lagre(d))!;
    expect(input).toMatchObject({ projectId: "p2", byggeplassId: "b2", externalCostObjectId: null, fraTid: "06:25" });
  });

  it("dagens regel til w15c: «Til annet kontor» → «Etter arbeid» står i jobben", () => {
    const d = rendre();
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetKontor"));
    fireEvent.click(knapp(d, "timer.reiseKort.etterArbeid"));
    expect(d.textContent).toContain('timer.reiseKort.havnerJobb{"sted":"sommerfeldtsgt 65"}');
  });

  it("overlapp med en annen rad: Lagre sperret, teksten navngir raden; ingen mutate", async () => {
    const d = rendre({ timer: [arbeid(), arbeid({ id: "r2", fraTid: "13:00", tilTid: "15:00", kortId: "k2" })] });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetKontor"));
    fireEvent.click(knapp(d, "timer.reiseKort.etterArbeid"));
    // Kjedens slutt er 15:00 → 15:00–18:50. Rett start til 12:00 → 12:00–15:50 kolliderer med 13:00–15:00.
    fireEvent.change(start(d), { target: { value: "12:00" } });
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

  it("tre kontorer: kontoret velges i nedtrekket, forvalgt første andre kontor", () => {
    const d = rendre({ kontorer: 3 });
    fireEvent.click(knapp(d, "timer.reiseKort.tilAnnetKontor"));
    const kontor = within(d).getByLabelText("timer.reiseKort.hvorTil") as HTMLSelectElement;
    expect(kontor.value).toBe("narvik");
    fireEvent.change(kontor, { target: { value: "alta" } });
    expect(d.textContent).toContain('timer.reiseKort.forslag{"min":300}');
    expect(start(d).value).toBe("02:00");
  });
});
