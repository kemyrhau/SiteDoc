// @vitest-environment jsdom
/**
 * POST 2026-11-15 (13) L2 commit 8: web-«+ Reise» åpner reise-kortet (Tur / Retur /
 * overføring) — samme delte regel som mobilens kort (`løsReiseKort` /
 * `løsOverforingKort`). Payloaden til `tilfoyTimerRad` sammenlignes mot den
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
  finnOverforinger,
  løsOppmote,
  løsOverforingKort,
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
          beskrivelse: null,
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
    const input = lagre(dialog);
    const f = fasit(retning, min);
    expect(f.sperre).toBeNull();
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

  it("negativkontroll: under terskel føres ALDRI på resolverens reise-art", () => {
    const input = lagre(rendre({ kjoretidMin: 15 }))!;
    expect(input.lonnsartId).toBe("l1");
    expect(input).not.toHaveProperty("reiseKilde");
  });

  it("over terskel: reise-art + spor «manuell»", () => {
    const input = lagre(rendre({ kjoretidMin: 45 }))!;
    expect(input.lonnsartId).toBe("lr");
    expect(input.reiseKilde).toBe("manuell");
    expect(input.fraTid).toBe("06:15");
    expect(input.tilTid).toBe("07:00");
  });

  it("viser forslaget og samme forklaringslinje som mobil (delt tekst)", () => {
    const dialog = rendre({ kjoretidMin: 15 });
    // w15b: tidene står i «Start kl.»/«Slutt kl.»; linja viser firmaets kjøretid.
    expect(dialog.textContent).toContain('timer.reiseKort.forslag{"min":15}');
    expect(dialog.textContent).toContain("timer.reiseTerskel.under");
    expect(dialog.textContent).toContain("timer.reiseTerskel.kategoriArbeid");
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
    expect(hook).toContain("løsOverforingKort(");
    expect(hook).toContain("løsOppmote(");
    expect(hook).toContain("byggOverforingOppslag(");
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

  it("arbeider: tydelig tekst, ingen lenke, lagring sperret", () => {
    const dialog = rendre({ lonnsarter: utenStandard, kjoretidMin: 15 });
    expect(dialog.textContent).toContain("timer.reiseTerskel.manglerArt");
    expect(within(dialog).queryByRole("link", { name: "timer.reiseTerskel.settStandardArt" })).toBeNull();
    expect(lagreKnapp(dialog).disabled).toBe(true);
  });

  it("firma-admin: «mangler standard lønnsart» + lenke til reise-regelsettet", () => {
    const dialog = rendre({ lonnsarter: utenStandard, admin: true, kjoretidMin: 15 });
    expect(dialog.textContent).toContain("timer.reiseTerskel.manglerStandardArt");
    const lenke = within(dialog).getByRole("link", { name: "timer.reiseTerskel.settStandardArt" });
    expect(lenke.getAttribute("href")).toBe("/dashbord/firma/innstillinger#reise-regelsett");
  });

  it("commit 9: firma-admin får «mangler standard lønnsart» også i tooltipen (ikke «be firmaadmin»)", () => {
    const dialog = rendre({ lonnsarter: utenStandard, admin: true, kjoretidMin: 15 });
    fireEvent.mouseEnter(lagreKnapp(dialog).parentElement!);
    const tooltip = screen.getByRole("tooltip", { hidden: true }).textContent ?? "";
    expect(tooltip).toContain("timer.reiseTerskel.manglerStandardArt");
    expect(tooltip).not.toContain("timer.reiseTerskel.manglerArt");
  });

  it("arbeider får «be firmaadmin»-teksten i tooltipen", () => {
    const dialog = rendre({ lonnsarter: utenStandard, kjoretidMin: 15 });
    fireEvent.mouseEnter(lagreKnapp(dialog).parentElement!);
    expect(screen.getByRole("tooltip", { hidden: true }).textContent).toContain("timer.reiseTerskel.manglerArt");
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

  it("forhåndsvalgt «Overføring Kontor → Skolebygg», lagres med spor «overforing»", () => {
    const perioder = [FAST_KONTOR, BP_PERIODE];
    const dialog = rendre({ perioder, kjoretidMin: 45 });
    const knapp = within(dialog).getByRole("button", { name: /timer\.reiseKort\.overforing/ });
    expect(knapp.textContent).toContain("Kontor");
    expect(knapp.textContent).toContain("Skolebygg");
    expect(knapp.getAttribute("aria-pressed")).toBe("true");

    const [o] = finnOverforinger(DATO, perioder);
    const f = løsOverforingKort({
      overforing: o!,
      oppmotestedId: "o1",
      kjoretidMin: 45,
      avstandM: 12000,
      dagStart: "07:00",
      dagSlutt: "11:00",
      regel: REGEL,
      grensepunkter: [],
      resolverLonnsartId: "lr",
      standardLonnsartId: "l1",
    });
    const input = lagre(dialog)!;
    expect(input.fraTid).toBe(f.fraTid);
    expect(input.tilTid).toBe(f.tilTid);
    expect(input.lonnsartId).toBe(f.klassifisering!.lonnsartId);
    expect(input.reiseKilde).toBe("overforing");
    expect(input.reiseOppmotestedId).toBe("o1");
    expect(input.byggeplassId).toBe("b1");
    expect(input.reiseRegel).toMatchObject({ overforing: expect.anything() });
  });

  it("Tur på byggeplass-periodens dag: sperret (møter på byggeplassen)", () => {
    const dialog = rendre({ perioder: [FAST_KONTOR, BP_PERIODE], kjoretidMin: 45 });
    fireEvent.click(within(dialog).getByRole("button", { name: "timer.reiseKort.tur" }));
    const knapp = lagreKnapp(dialog);
    expect(knapp.disabled).toBe(true);
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(document.body.textContent).toContain("timer.reiseKort.sperre.byggeplassPeriode");
  });
});
