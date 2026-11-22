// @vitest-environment jsdom
/**
 * POST 2026-11-15 (13) L2 commit 8: web-«+ Reise» åpner reise-kortet (Tur / Retur;
 * § 8.22: ingen overføringsforslag) — samme delte regel som mobilens kort (`løsReiseKort`). Payloaden til `tilfoyTimerRad` sammenlignes mot den
 * delte fasiten med samme input. Under terskel → ordinær art uten spor; over →
 * reise-art med spor. Lagre sperres når kjøretid mangler, ved ikke valgt
 * oppmøtested, og til regelsettet er lastet. Mangler lønnsart: tekst; firmaadmin
 * får lenke til reise-regelsettet.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  løsOppmote,
  løsReiseKort,
  type OppmotePeriodeInput,
  type ReiseRegelsett,
} from "@sitedoc/shared";

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
            mutateAsync: async () => {},
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

const LONNSARTER = [
  { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true, type: "ordinaer" },
  { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer" },
];

const FAST_KONTOR: OppmotePeriodeInput = {
  id: "pf",
  type: "kontor",
  fast: true,
  oppmotestedId: "o1",
  projectId: null,
  fraDato: "2026-01-01",
  tilDato: null,
};

function rendre({
  regel = REGEL,
  lonnsarter = LONNSARTER as Array<Record<string, unknown>>,
  admin = false,
  perioder = [FAST_KONTOR] as OppmotePeriodeInput[],
  kjoretidMin = 15 as number | null,
  ecoer = [] as Array<Record<string, unknown>>,
  /** O8: firmaets tidsrunding (15/30/60). null = ingen runding. */
  runding = null as number | null,
} = {}) {
  h.kall = [];
  h.utelat.clear();
  h.feil.clear();
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
      timer: [
        {
          id: "r1",
          projectId: "p1",
          lonnsartId: "l1",
          aktivitetId: "a1",
          externalCostObjectId: null,
          vehicleId: null,
          byggeplassId: "b1",
          fraTid: "07:00",
          tilTid: "11:00",
          timer: "4",
          pauseMin: 0,
          beskrivelse: "Graving", // § 8.22 L2: jobben er ferdig — «Send dagen» har ingen sperre-tooltip.
          attestertStatus: "pending",
          erReise: false,
          kortId: "k1",
        },
      ],
    },
    "prosjekt.hentForTimer": [{ id: "p1", name: "Skole", internalProjectNumber: "2041" }],
    "bygning.hentForFirma": [{ id: "b1", projectId: "p1", name: "Skolebygg" }],
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
      tidsrundingMinutter: runding,
      ...regel,
    },
    ...(admin ? { "organisasjon.hentSetting": { tidsrundingMinutter: null } } : {}),
    "oppmotested.hentForFirma": [{ id: "o1", navn: "Kontor", lat: 0, lng: 0, radiusM: 100 }],
    "oppmotested.hentMatriseForFirma":
      kjoretidMin == null ? [] : [{ oppmotestedId: "o1", byggeplassId: "b1", kjoretidMin, avstandM: 12000 }],
    "oppmotested.hentKontorAvstanderForFirma": [],
    "oppmotePeriode.hentMine": { perioder, trengerValg: false },
    "timer.lonnsart.list": lonnsarter,
    "timer.aktivitet.list": [{ id: "a1", navn: "Arbeid", aktiv: true }],
    "vareforbruk.hentMineForDato": [],
    "eksternKostObjekt.list": ecoer,
  };
  render(<Side />);
  // Ett kort på sedelen er åpent fra start; klikk kun hvis det er lukket.
  if (!screen.queryByRole("button", { name: "timer.prosjektkort.nyReise" })) {
    fireEvent.click(screen.getByRole("button", { name: /2041 — Skole/ }));
  }
  fireEvent.click(screen.getByRole("button", { name: "timer.prosjektkort.nyReise" }));
  return screen.getByRole("dialog", { name: "timer.reiseKort.tittel" });
}

function lagreKnapp(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
}

/** Rød sperretekst i selve kortet (ikke tooltipen) — kun når sperren ikke er manglerArt. */
function rodSperretekst(dialog: HTMLElement) {
  return dialog.querySelector("p.text-red-700")?.textContent ?? null;
}

function lagre(dialog: HTMLElement) {
  fireEvent.click(lagreKnapp(dialog));
  return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
}

/** O8: «Arbeidstid» har ingen Lagre — bare «Lukk». */
function harLagre(dialog: HTMLElement) {
  return within(dialog).queryByRole("button", { name: "handling.lagre" }) != null;
}

/** Den delte fasiten — samme funksjon som mobilens `useManuellReise` kaller. */
function fasit(retning: "tur" | "retur", kjoretidMin: number, regel = REGEL) {
  return løsReiseKort({
    retning,
    oppmote: løsOppmote(DATO, "p1", [FAST_KONTOR], null),
    byggeplassId: "b1",
    kjoretidFor: () => kjoretidMin,
    avstandFor: () => 12000,
    dagStart: "07:00",
    dagSlutt: "11:00",
    regel,
    grensepunkter: [],
    resolverLonnsartId: "lr",
    standardLonnsartId: "l1",
  });
}

describe("web «+ Reise» — reise-kortet, samme regel som mobil", () => {
  afterEach(cleanup);

  it.each([
    ["Tur under terskel (15 min)", "tur", 15],
    ["Tur over terskel (45 min)", "tur", 45],
    ["Retur under terskel (15 min)", "retur", 15],
    ["Retur over terskel (45 min)", "retur", 45],
    ["nøyaktig på terskel (30 min) = over", "tur", 30],
  ] as const)("%s: payload = delt fasit", (_n, retning, min) => {
    const dialog = rendre({ kjoretidMin: min });
    if (retning === "retur") fireEvent.click(within(dialog).getByRole("button", { name: "timer.reiseKort.retur" }));
    const f = fasit(retning, min);
    expect(f.sperre).toBeNull();
    // O8: under terskel (arbeidstid) føres ingenting — ingen Lagre, ingen rad.
    if (!f.spor!.erReise) {
      expect(harLagre(dialog)).toBe(false);
      expect(h.kall.filter((k) => k.key.startsWith("timer.dagsseddel."))).toEqual([]);
      return;
    }
    const input = lagre(dialog);
    expect(input).toBeDefined();
    expect(input!.timer).toBe(f.timer);
    expect(input!.fraTid).toBe(f.fraTid);
    expect(input!.tilTid).toBe(f.tilTid);
    expect(input!.lonnsartId).toBe(f.klassifisering!.lonnsartId);
    expect(input!.pauseMin).toBe(0);
    expect(input!.aktivitetId).toBe("a1");
    expect(input!.byggeplassId).toBe("b1");
    if (f.spor!.erReise) {
      expect(input!.reiseKilde).toBe("manuell");
      expect(input!.reiseOppmotestedId).toBe("o1");
      expect(input!.reiseKjoretidMin).toBe(min);
    } else {
      expect(input).not.toHaveProperty("reiseKilde");
    }
  });

  it("negativkontroll: under terskel føres ALDRI på resolverens reise-art (O8: ingenting føres)", () => {
    const dialog = rendre({ kjoretidMin: 15 });
    expect(harLagre(dialog)).toBe(false);
    expect(h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")).toBeUndefined();
  });

  it("over terskel: reise-art + spor «manuell»", () => {
    const input = lagre(rendre({ kjoretidMin: 45 }))!;
    expect(input.lonnsartId).toBe("lr");
    expect(input.reiseKilde).toBe("manuell");
    expect(input.fraTid).toBe("06:15");
    expect(input.tilTid).toBe("07:00");
  });

  it("viser forslaget og samme forklaringslinje som mobil (delt tekst) når turen ikke står i jobben", () => {
    // Over terskel: ingen kort-id → den delte teksten, som mobil.
    const dialog = rendre({ kjoretidMin: 45 });
    // w15b: tidene står i «Start kl.»/«Slutt kl.»; linja viser firmaets kjøretid.
    expect(dialog.textContent).toContain('timer.reiseKort.forslag{"min":45}');
    expect(dialog.textContent).toContain("timer.reiseTerskel.overFores");
    expect(dialog.textContent).toContain("timer.reiseTerskel.kategoriReise");
  });

  it("ett oppmøtested: ingen «Fra …»-tekst og ingen oppmøtested-velger", () => {
    const dialog = rendre();
    expect(dialog.textContent).not.toContain("timer.reiseKort.fraOppmotested");
    expect(dialog.querySelector("select option[value='o1']")).toBeNull();
  });

  it("web-hooken kaller de delte funksjonene (ingen egen web-logikk, ingen localStorage)", () => {
    const her = dirname(fileURLToPath(import.meta.url));
    const hook = readFileSync(join(her, "../../../../hooks/useManuellReiseWeb.ts"), "utf-8");
    expect(hook).toContain("løsReiseKort(");
    expect(hook).toContain("løsOppmote(");
    // § 8.22 punkt 2: ingen overføringsregel og ingen kontor↔kontor-kjøretid i reisevinduet.
    expect(hook).not.toContain("løsOverforingKort(");
    expect(hook).not.toContain("byggOverforingOppslag(");
    expect(hook).not.toContain("hentKontorAvstanderForFirma");
    expect(hook).toContain("oppmotePeriode.hentMine");
    expect(hook).not.toContain("localStorage");
  });
});

describe("web «+ Reise» — Lagre sperret (beslutning 2 og 3)", () => {
  afterEach(cleanup);

  it("kjøretid mangler: Lagre sperret med forklaring, ingen mutate", () => {
    const dialog = rendre({ kjoretidMin: null });
    const knapp = lagreKnapp(dialog);
    expect(knapp.disabled).toBe(true);
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(document.body.textContent).toContain("timer.reiseKort.sperre.manglerKjoretid");
    expect(lagre(dialog)).toBeUndefined();
  });

  it("ikke valgt oppmøtested: sperret med egen tekst — i kortet og i tooltipen (vedtak 2026-11-15)", () => {
    const dialog = rendre({ perioder: [] });
    const knapp = lagreKnapp(dialog);
    expect(knapp.disabled).toBe(true);
    expect(rodSperretekst(dialog)).toBe("timer.reiseKort.sperre.oppmoteIkkeValgt");
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(screen.getByRole("tooltip", { hidden: true }).textContent).toContain(
      "timer.reiseKort.sperre.oppmoteIkkeValgt",
    );
    expect(lagre(dialog)).toBeUndefined();
  });

  it("commit 9: sperreårsaken står som rød tekst i KORTET (ikke bare i tooltipen, som er portalet til body)", () => {
    const dialog = rendre({ kjoretidMin: null });
    // Tooltipen ligger utenfor dialogen — teksten i dialogen kan bare komme fra kortet.
    expect(screen.getByRole("tooltip", { hidden: true }).closest('[role="dialog"]')).toBeNull();
    expect(rodSperretekst(dialog)).toBe("timer.reiseKort.sperre.manglerKjoretid");
  });

  it("negativkontroll: uten sperre finnes ingen rød sperretekst i kortet", () => {
    const dialog = rendre();
    expect(dialog.querySelector("p.text-red-700")).toBeNull();
  });

  it.each([
    ["ikke lastet", "utelat", "sperret.reiseRegelLaster"],
    ["feilet", "feil", "sperret.reiseRegelFeilet"],
  ] as const)("perioder %s: Lagre sperret, forklaring, ingen mutate", (_n, hva, forklaring) => {
    const dialog = rendre();
    h[hva].add("oppmotePeriode.hentMine");
    // Tving ny render med oppdatert mock (bytt retning og tilbake).
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.reiseKort.retur" }));
    const knapp = lagreKnapp(dialog);
    expect(knapp.disabled).toBe(true);
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(document.body.textContent).toContain(forklaring);
    expect(lagre(dialog)).toBeUndefined();
    expect(h.kall.filter((k) => k.key.startsWith("timer.dagsseddel."))).toEqual([]);
  });
});

describe("web «+ Reise» — mangler lønnsart (C)", () => {
  afterEach(cleanup);
  const utenStandard = LONNSARTER.map((l) => ({ ...l, erStandardvalg: false }));

  // O8 (§ 8.22 punkt 2): uten standardart er det bare «Arbeidstid» (under terskel) som mangler
  // art — og «Arbeidstid» fører ingenting. Da trengs ingen art, og ingen veiledning vises.
  // (Reisetid bruker reise-arten; «+ Reise» finnes bare når firmaet har den.)
  it.each([
    ["arbeider", false],
    ["firma-admin", true],
  ] as const)("%s, under terskel uten standardart: ingenting føres, ingen «mangler art»-tekst (O8)", (_n, admin) => {
    const dialog = rendre({ lonnsarter: utenStandard, admin, kjoretidMin: 15 });
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerArt");
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerStandardArt");
    expect(within(dialog).queryByRole("link", { name: "timer.reiseTerskel.settStandardArt" })).toBeNull();
    expect(harLagre(dialog)).toBe(false);
    expect(within(dialog).getByRole("button", { name: "handling.lukk" })).toBeTruthy();
  });

  it("negativkontroll: med standardart vises ingen veiledning", () => {
    const dialog = rendre({ admin: true, kjoretidMin: 15 });
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerArt");
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerStandardArt");
  });
});

describe("web «+ Reise» — overføring første dag i en byggeplass-periode (TILLEGG)", () => {
  afterEach(cleanup);
  const BP_PERIODE: OppmotePeriodeInput = {
    id: "pb",
    type: "byggeplass",
    fast: false,
    oppmotestedId: null,
    projectId: "p1",
    fraDato: DATO,
    tilDato: "2026-11-20",
  };

  it("§ 8.22 punkt 2: ingen overføringsforslag på periodens første dag; ingenting lagres med spor «overforing»", () => {
    const dialog = rendre({ perioder: [FAST_KONTOR, BP_PERIODE], kjoretidMin: 45 });
    expect(within(dialog).queryByRole("button", { name: /timer\.reiseKort\.overforing/ })).toBeNull();
    expect(within(dialog).getByRole("button", { name: "timer.reiseKort.tur" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("gate (123) vilkår 1: Tur på periodens første dag er vanlig reise fra hjemstedet — Lagre aktiv", () => {
    const dialog = rendre({ perioder: [FAST_KONTOR, BP_PERIODE], kjoretidMin: 45 });
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.reiseKort.tur" }));
    expect(lagreKnapp(dialog).disabled).toBe(false);
    expect(document.body.textContent).not.toContain("timer.reiseKort.sperre.byggeplassPeriode");
  });

  it("Tur på en mellomdag i byggeplass-perioden: sperret (møter på byggeplassen)", () => {
    const dialog = rendre({ perioder: [FAST_KONTOR, { ...BP_PERIODE, fraDato: "2026-11-01" }], kjoretidMin: 45 });
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.reiseKort.tur" }));
    const knapp = lagreKnapp(dialog);
    expect(knapp.disabled).toBe(true);
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(document.body.textContent).toContain("timer.reiseKort.sperre.byggeplassPeriode");
  });
});

/**
 * O8 (§ 8.22 punkt 2, Kenneth 2026-11-22): «Arbeidstid» fører ingen egen tid. O1 la turen som en
 * Timelønn-rad før jobbstart (06:56–07:00, 0,07 t) — falsk tid attestanten ikke ser. Nå: ingen
 * rad, jobben er urørt, vinduet sier at reisen inngår i jobbens arbeidstid (fra–til), og
 * knappen er «Lukk». Reisetid er som før.
 */
describe("O8 — arbeidstid under terskel fører ingen egen tid", () => {
  afterEach(cleanup);
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });

  it("under terskel: ingen rad; jobbens tid uendret; «Lukk» lukker uten kall", () => {
    const d = rendre({ kjoretidMin: 15 });
    expect(knapp(d, "timer.reiseKort.arbeidstid").getAttribute("aria-pressed")).toBe("true");
    expect(harLagre(d)).toBe(false);
    expect(within(d).queryByRole("button", { name: "handling.avbryt" })).toBeNull();
    fireEvent.click(knapp(d, "handling.lukk"));
    expect(screen.queryByRole("dialog", { name: "timer.reiseKort.tittel" })).toBeNull();
    // Ingen tilfoyTimerRad, oppdaterTimerRad eller lagreJobbTid: jobben 07:00–11:00 står.
    expect(h.kall.filter((k) => k.key.startsWith("timer.dagsseddel."))).toEqual([]);
  });

  it("vinduet sier at reisen inngår i jobbens arbeidstid (fra–til) og at ingenting føres; tider, antall og underprosjekt skjult", () => {
    const d = rendre({ kjoretidMin: 15, ecoer: [{ id: "e1", proAdmId: "12", kortNavn: "Grøft" }] });
    expect(within(d).getByTestId("reise-inngaar-i-arbeid").textContent).toBe(
      'timer.reiseKort.inngaarIJobb{"fra":"07:00","til":"11:00"}',
    );
    expect(d.querySelector("#reise-start")).toBeNull();
    expect(d.querySelector("#reise-slutt")).toBeNull();
    expect(d.querySelector("#reise-antall")).toBeNull();
    expect(within(d).queryByRole("combobox", { name: "timer.felt.underprosjekt" })).toBeNull();
    // Grunnen står (terskelen), men ikke «føres som …» eller linja «Står i jobben …».
    const tekst = d.textContent ?? "";
    expect(tekst).toContain('timer.reiseKort.underTerskel{"terskel":"timer.reiseTerskel.min{\\"min\\":30}"}');
    expect(tekst).not.toContain("timer.reiseTerskel.underFores");
    expect(tekst).not.toContain("timer.reiseKort.havnerJobb");
  });

  it("bytte til Reisetid: egen reise-rad med tider og antall, som før", () => {
    const d = rendre({ kjoretidMin: 15 });
    fireEvent.click(knapp(d, "timer.reisetid"));
    expect(within(d).queryByTestId("reise-inngaar-i-arbeid")).toBeNull();
    expect((d.querySelector("#reise-antall") as HTMLInputElement).value).toBe("0.25");
    const input = lagre(d)!;
    expect(input).toMatchObject({ fraTid: "06:45", tilTid: "07:00", timer: 0.25, lonnsartId: "lr", reiseKilde: "manuell" });
    expect(input).not.toHaveProperty("kortId");
  });

  it("over terskel: reisetid forvalgt, ingen kortId (serveren velger reisekortet som før)", () => {
    const input = lagre(rendre({ kjoretidMin: 45 }))!;
    expect(input.lonnsartId).toBe("lr");
    expect(input).not.toHaveProperty("kortId");
  });

  it("over terskel, arbeideren velger Arbeidstid selv: ingenting føres", () => {
    const d = rendre({ kjoretidMin: 45 });
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    expect(harLagre(d)).toBe(false);
    expect(d.textContent).toContain("timer.reiseKort.overTerskel");
    expect(within(d).getByTestId("reise-inngaar-i-arbeid").textContent).toContain("timer.reiseKort.inngaarIJobb");
    fireEvent.click(knapp(d, "handling.lukk"));
    expect(h.kall.filter((k) => k.key.startsWith("timer.dagsseddel."))).toEqual([]);
  });

  it("negativkontroll: Reisetid har Avbryt og Lagre, ingen «Lukk» og ingen «inngår»-tekst", () => {
    const d = rendre({ kjoretidMin: 45 });
    expect(harLagre(d)).toBe(true);
    expect(within(d).getByRole("button", { name: "handling.avbryt" })).toBeTruthy();
    expect(within(d).queryByRole("button", { name: "handling.lukk" })).toBeNull();
    expect(within(d).queryByTestId("reise-inngaar-i-arbeid")).toBeNull();
  });
});

/**
 * O1 TILLEGG (§ 8.22, Kenneth 2026-11-21): terskelen foreslår, arbeideren velger reisetid eller
 * arbeidstid; antall timer regner Slutt kl. ut fra Start kl. (og omvendt).
 */
describe("O1 TILLEGG — arbeideren velger reisetid/arbeidstid", () => {
  afterEach(cleanup);
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });

  it("under terskel: «Arbeidstid» er forvalgt", () => {
    const d = rendre({ kjoretidMin: 15 });
    expect(knapp(d, "timer.reiseKort.arbeidstid").getAttribute("aria-pressed")).toBe("true");
    expect(knapp(d, "timer.reisetid").getAttribute("aria-pressed")).toBe("false");
  });

  it("over terskel: «Reisetid» er forvalgt", () => {
    const d = rendre({ kjoretidMin: 45 });
    expect(knapp(d, "timer.reisetid").getAttribute("aria-pressed")).toBe("true");
  });

  it("under terskel, arbeideren velger reisetid → lagres som reise (reiseart, spor), ingen kortId", () => {
    const d = rendre({ kjoretidMin: 15 });
    fireEvent.click(knapp(d, "timer.reisetid"));
    expect(knapp(d, "timer.reisetid").getAttribute("aria-pressed")).toBe("true");
    const input = lagre(d)!;
    expect(input.lonnsartId).toBe("lr");
    expect(input.reiseKilde).toBe("manuell");
    expect(input.reiseKjoretidMin).toBe(15);
    expect((input.reiseRegel as Record<string, unknown>).kategori).toBe("reisetid");
    expect((input.reiseRegel as Record<string, unknown>).regelKategori).toBe("arbeidstid");
    expect(input).not.toHaveProperty("kortId");
    expect(d.textContent).toContain("timer.reiseTerskel.underFores");
    expect(d.textContent).toContain("timer.reiseTerskel.kategoriReise");
  });

  it("negativkontroll: uten valg følger lagringen terskelen (under → ingenting (O8), over → reise)", () => {
    expect(harLagre(rendre({ kjoretidMin: 15 }))).toBe(false);
    cleanup();
    expect(lagre(rendre({ kjoretidMin: 45 }))!.lonnsartId).toBe("lr");
  });
});

describe("O1 TILLEGG — antall timer ↔ Slutt kl.", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  // O8: under terskel er «Arbeidstid» forvalgt og viser ingen tider — testene her gjelder
  // reise-raden, så arbeideren velger Reisetid.
  const retur = (min = 15) => {
    const d = rendre({ kjoretidMin: min });
    fireEvent.click(within(d).getByRole("button", { name: "timer.reiseKort.retur" }));
    fireEvent.click(within(d).getByRole("button", { name: "timer.reisetid" }));
    return d;
  };

  it("antall timer regner Slutt kl. ut fra Start kl.", () => {
    const d = retur();
    expect(felt(d, "reise-start").value).toBe("11:00");
    expect(felt(d, "reise-slutt").value).toBe("11:15");
    expect(felt(d, "reise-antall").value).toBe("0.25");
    fireEvent.change(felt(d, "reise-antall"), { target: { value: "1" } });
    expect(felt(d, "reise-slutt").value).toBe("12:00");
    const input = lagre(d)!;
    expect(input.fraTid).toBe("11:00");
    expect(input.tilTid).toBe("12:00");
    expect(input.timer).toBe(1);
  });

  it("rettet Slutt kl. regner antall timer (det motsatte)", () => {
    const d = retur();
    fireEvent.change(felt(d, "reise-antall"), { target: { value: "1" } });
    fireEvent.change(felt(d, "reise-slutt"), { target: { value: "11:30" } });
    expect(felt(d, "reise-antall").value).toBe("0.5");
    expect(lagre(d)!.timer).toBe(0.5);
  });

  it("rettet Start kl. med skrevet antall: slutten følger med antallet", () => {
    const d = retur();
    fireEvent.change(felt(d, "reise-antall"), { target: { value: "1.5" } });
    fireEvent.change(felt(d, "reise-start"), { target: { value: "12:00" } });
    expect(felt(d, "reise-slutt").value).toBe("13:30");
  });

  it("kjøretidsforslaget forhåndsutfyller og kan overstyres; terskelen står på firmaets kjøretid", () => {
    const d = retur(15);
    fireEvent.change(felt(d, "reise-antall"), { target: { value: "2" } });
    // 2 t > 30 min terskel, men klassifiseringen står på kjøretiden (15 min): regelen sier
    // arbeidstid, arbeiderens valg (reisetid) står.
    expect(within(d).getByRole("button", { name: "timer.reisetid" }).getAttribute("aria-pressed")).toBe("true");
    const input = lagre(d)!;
    expect(input.timer).toBe(2);
    expect((input.reiseRegel as Record<string, unknown>).regelKategori).toBe("arbeidstid");
  });
});

/**
 * O8 (§ 8.22 punkt 2): kjøretidsforslaget rundes til firmaets tidsrunding — nærmeste intervall,
 * aldri ned til 0. Retningen gjelder etter avrunding. Arbeiderens egne tall rundes ikke.
 * Jobben er 07:00–11:00; terskelen 30 min.
 */
describe("O8 — reiseforslaget avrundes etter firmaets tidsrunding", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });

  it("30 min: 37 min → 0,5 t; «Til byggeplass» holder Slutt (07:00), Start 06:30", () => {
    const d = rendre({ kjoretidMin: 37, runding: 30 });
    expect(felt(d, "reise-antall").value).toBe("0.5");
    expect(felt(d, "reise-start").value).toBe("06:30");
    expect(felt(d, "reise-slutt").value).toBe("07:00");
    const input = lagre(d)!;
    expect(input).toMatchObject({ fraTid: "06:30", tilTid: "07:00", timer: 0.5 });
    // Sporet og terskelen står på firmaets kjøretid.
    expect(input.reiseKjoretidMin).toBe(37);
  });

  it("30 min: «Fra byggeplass» holder Start (11:00), Slutt 11:30", () => {
    const d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(felt(d, "reise-start").value).toBe("11:00");
    expect(felt(d, "reise-slutt").value).toBe("11:30");
    expect(lagre(d)!.timer).toBe(0.5);
  });

  it("nærmeste intervall: 50 min med 30 → 1 t; 38 min med 15 → 0,75 t; 37 min med 15 → 0,5 t", () => {
    let d = rendre({ kjoretidMin: 50, runding: 30 });
    expect(felt(d, "reise-antall").value).toBe("1");
    expect(felt(d, "reise-start").value).toBe("06:00");
    cleanup();
    d = rendre({ kjoretidMin: 38, runding: 15 });
    expect(felt(d, "reise-antall").value).toBe("0.75");
    expect(felt(d, "reise-start").value).toBe("06:15");
    cleanup();
    d = rendre({ kjoretidMin: 37, runding: 15 });
    expect(felt(d, "reise-antall").value).toBe("0.5");
  });

  it("aldri 0: 10 min med 30 → 0,5 t (Reisetid valgt under terskel)", () => {
    const d = rendre({ kjoretidMin: 10, runding: 30 });
    fireEvent.click(knapp(d, "timer.reisetid"));
    expect(felt(d, "reise-antall").value).toBe("0.5");
    expect(lagre(d)!).toMatchObject({ fraTid: "06:30", tilTid: "07:00", timer: 0.5 });
  });

  it("negativkontroll: tidsrunding null → ingen avrunding (37 min = 06:23–07:00)", () => {
    const d = rendre({ kjoretidMin: 37, runding: null });
    expect(felt(d, "reise-start").value).toBe("06:23");
    expect(felt(d, "reise-antall").value).toBe("0.62");
    expect(lagre(d)!.timer).toBeCloseTo(37 / 60, 10);
  });

  it("rettet tall rundes ikke: skrevet antall 0.6 og rettet Slutt 11:37 står som skrevet", () => {
    let d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.change(felt(d, "reise-antall"), { target: { value: "0.6" } });
    expect(felt(d, "reise-start").value).toBe("06:24");
    expect(felt(d, "reise-slutt").value).toBe("07:00");
    expect(lagre(d)!.timer).toBeCloseTo(0.6, 10);
    cleanup();
    d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(felt(d, "reise-slutt"), { target: { value: "11:37" } });
    expect(lagre(d)!).toMatchObject({ fraTid: "11:00", tilTid: "11:37" });
  });

  it("rettet Start («Fra byggeplass»): slutten følger med det avrundede forslaget, starten står som skrevet", () => {
    const d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(felt(d, "reise-start"), { target: { value: "11:07" } });
    expect(felt(d, "reise-slutt").value).toBe("11:37");
  });
});
