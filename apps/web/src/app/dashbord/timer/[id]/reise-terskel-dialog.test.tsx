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
  Modal: ({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose?: () => void }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        {/* O12 R3: modalens X (onClose). */}
        <button type="button" aria-label="modal.x" onClick={onClose} />
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
  /** O12 pkt 14 R5: jobbens byggeplass (null = kort uten byggeplass). */
  jobbByggeplassId = "b1" as string | null,
  /** O12 pkt 12: flere rader (kort) på sedelen. */
  ekstraTimer = [] as Array<Record<string, unknown>>,
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
          byggeplassId: jobbByggeplassId,
          fraTid: "07:00",
          tilTid: "11:00",
          timer: "4",
          pauseMin: 0,
          beskrivelse: "Graving", // § 8.22 L2: jobben er ferdig — «Send dagen» har ingen sperre-tooltip.
          attestertStatus: "pending",
          erReise: false,
          kortId: "k1",
        },
        ...ekstraTimer,
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
    fireEvent.click(screen.getAllByRole("button", { name: /2041 — Skole/ })[0]!);
  }
  // O12 pkt 12: med flere kort åpnes vinduet fra det første (k1).
  fireEvent.click(screen.getAllByRole("button", { name: "timer.prosjektkort.nyReise" })[0]!);
  return screen.getByRole("dialog", { name: "timer.reiseKort.tittel" });
}

function lagreKnapp(dialog: HTMLElement) {
  return within(dialog).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
}

/** Rød sperretekst i selve kortet (ikke tooltipen) — kun når sperren ikke er manglerArt. */
function rodSperretekst(dialog: HTMLElement) {
  return dialog.querySelector("p.text-red-700")?.textContent ?? null;
}

/**
 * Trykker «Lagre». O12 pkt 9/12: åpner «Lagre» en dialog (kortet, terskelen), svarer hjelperen
 * «Ja, lagre» og «Behold arbeidstid» — det som lagrer valget arbeideren alt har gjort i vinduet.
 */
function lagre(dialog: HTMLElement, terskelSvar: "behold" | "reisetid" = "behold") {
  fireEvent.click(lagreKnapp(dialog));
  const kort = within(dialog).queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
  if (kort) fireEvent.click(within(kort).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
  const terskel = within(dialog).queryByRole("dialog", { name: "timer.reiseKort.terskelDialog.tittel" });
  if (terskel) {
    fireEvent.click(
      within(terskel).getByRole("button", {
        name: terskelSvar === "behold" ? "timer.reiseKort.terskelDialog.beholdArbeidstid" : "timer.reiseKort.terskelDialog.forSomReisetid",
      }),
    );
  }
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
    // O16 pkt 4 (vedtak Reisevinduet pkt 1, snur § 8.22 punkt 2): «Til annet oppmøtested» bruker
    // den delte overføringsregelen og kontor–kontor-kjøretiden; periodene via planleggOppmoteBytte.
    expect(hook).toContain("løsOverforingKort(");
    expect(hook).toContain("hentKontorAvstanderForFirma");
    expect(hook).toContain("planleggOppmoteBytte(");
    expect(hook).not.toContain("byggOverforingOppslag(");
    expect(hook).toContain("oppmotePeriode.hentMine");
    expect(hook).not.toContain("localStorage");
  });
});

describe("web «+ Reise» — Lagre sperret (beslutning 2 og 3)", () => {
  afterEach(cleanup);

  it("O12 pkt 14: kjøretid mangler — tidsfeltene står, Slutt (jobbstart) er fylt, grå tekst; «Lagre» åpner når Start er skrevet", () => {
    const dialog = rendre({ kjoretidMin: null });
    const felt = (id: string) => dialog.querySelector(`#${id}`) as HTMLInputElement;
    expect(felt("reise-start").value).toBe("");
    expect(felt("reise-slutt").value).toBe("07:00");
    expect(within(dialog).getByTestId("reise-uten-kjoretid").textContent).toBe("timer.reiseKort.utenKjoretid");
    // Den gamle sperren finnes ikke på web.
    expect(dialog.textContent).not.toContain("timer.reiseKort.sperre.manglerKjoretid");
    expect(lagreKnapp(dialog).disabled).toBe(true);
    fireEvent.change(felt("reise-start"), { target: { value: "06:20" } });
    expect(lagreKnapp(dialog).disabled).toBe(false);
    const input = lagre(dialog, "reisetid")!;
    expect(input).toMatchObject({ fraTid: "06:20", tilTid: "07:00", kortId: "k1" });
    expect(input.timer).toBeCloseTo(40 / 60, 10);
  });

  it("O12 pkt 14 (R5): kortet har ingen byggeplass — tidsfeltene står med egen grå tekst", () => {
    const dialog = rendre({ kjoretidMin: 15, jobbByggeplassId: null });
    expect(within(dialog).getByTestId("reise-uten-kjoretid").textContent).toBe("timer.reiseKort.utenByggeplass");
    expect((dialog.querySelector("#reise-slutt") as HTMLInputElement).value).toBe("07:00");
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
    // O12 pkt 14: «mangler kjøretid» sperrer ikke lenger på web — ikke valgt oppmøtested gjør.
    const dialog = rendre({ perioder: [] });
    expect(screen.getByRole("tooltip", { hidden: true }).closest('[role="dialog"]')).toBeNull();
    expect(rodSperretekst(dialog)).toBe("timer.reiseKort.sperre.oppmoteIkkeValgt");
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
 * O1 (§ 8.22, Kenneths test av L3a): under terskel er turen arbeid. Uten kort-id la serveren den i
 * ELDSTE jobb med samme nøkkel, og den jobben endret tid. Åpnet fra en jobb sender kortet nå
 * jobbens kort-id — bare når nøkkelen er lik — og sier før lagring hva turen blir.
 */
describe("O1 — reise under terskel står i jobben vinduet ble åpnet fra", () => {
  afterEach(cleanup);
  const ECO = [{ id: "e1", proAdmId: "12", kortNavn: "Grøft" }];

  it("under terskel: payload har jobbens kortId og arbeidsarten", () => {
    const input = lagre(rendre({ kjoretidMin: 15 }))!;
    expect(input.kortId).toBe("k1");
    expect(input.lonnsartId).toBe("l1");
    expect(input).not.toHaveProperty("reiseKilde");
  });

  it("O12 pkt 3: over terskel lagres reisen i kortet vinduet ble åpnet fra (kortId + reiseIKort)", () => {
    const input = lagre(rendre({ kjoretidMin: 45 }))!;
    expect(input.lonnsartId).toBe("lr");
    expect(input).toMatchObject({ kortId: "k1", reiseIKort: true });
    expect(input).not.toHaveProperty("arbeidReiseRetning");
  });

  it("under terskel: forklaringslinja sier terskel, art og «på denne jobben»", () => {
    const dialog = rendre({ kjoretidMin: 15 });
    const tekst = dialog.textContent ?? "";
    expect(tekst).toContain("timer.reiseKort.underTerskelPaaJobb");
    expect(tekst).toContain('"art":"Ordinær"');
    expect(tekst).toContain('timer.reiseTerskel.min{\\"min\\":30}');
    // Ikke den generelle linja i tillegg.
    expect(tekst).not.toContain("timer.reiseTerskel.underFores");
  });

  it("O12 pkt 3: annet underprosjekt enn jobben — reisen lagres likevel i kortet", () => {
    const dialog = rendre({ kjoretidMin: 15, ecoer: ECO });
    fireEvent.change(within(dialog).getByRole("combobox", { name: "timer.felt.underprosjekt" }), {
      target: { value: "e1" },
    });
    const input = lagre(dialog)!;
    expect(input.externalCostObjectId).toBe("e1");
    expect(input).toMatchObject({ kortId: "k1", arbeidReiseRetning: "ut" });
  });

  it("O12 pkt 3: prosjekt og byggeplass er tekst (ingen nedtrekk) med den grå linja", () => {
    const dialog = rendre({ kjoretidMin: 15 });
    expect(dialog.querySelector("#reise-prosjekt")).toBeNull();
    expect(within(dialog).queryByRole("combobox", { name: "timer.felt.byggeplass" })).toBeNull();
    const sted = within(dialog).getByTestId("reise-kort-sted");
    expect(sted.textContent).toContain("2041 — Skole · Skolebygg");
    expect(sted.textContent).toContain("timer.reiseKort.foresIKortet");
    // pkt 12: linja «havner i» finnes ikke i prosjektkort-visning.
    expect(dialog.textContent).not.toMatch(/timer\.reiseKort\.havner(Jobb|Kort|Eget)/);
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
    // O12 pkt 3: Reisetid står i kortet vinduet ble åpnet fra.
    expect(input).toMatchObject({ kortId: "k1", reiseIKort: true });
    expect(d.textContent).toContain("timer.reiseTerskel.underFores");
    expect(d.textContent).toContain("timer.reiseTerskel.kategoriReise");
  });

  it("over terskel, arbeideren velger arbeidstid → arbeid på jobben (kortId) med linja «på denne jobben»", () => {
    const d = rendre({ kjoretidMin: 45 });
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    expect(d.textContent).toContain("timer.reiseKort.overTerskelPaaJobb");
    const input = lagre(d)!;
    expect(input.lonnsartId).toBe("l1");
    expect(input.kortId).toBe("k1");
    expect(input).not.toHaveProperty("reiseKilde");
    // O12 pkt 16: arbeidstid-reisen lagrer retningen.
    expect(input.arbeidReiseRetning).toBe("ut");
  });

  it("negativkontroll: uten valg følger lagringen terskelen (under → arbeid, over → reise)", () => {
    expect(lagre(rendre({ kjoretidMin: 15 }))!.lonnsartId).toBe("l1");
    cleanup();
    expect(lagre(rendre({ kjoretidMin: 45 }))!.lonnsartId).toBe("lr");
  });
});

describe("O1 TILLEGG — antall timer ↔ Slutt kl.", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  const retur = (min = 15) => {
    const d = rendre({ kjoretidMin: min });
    fireEvent.click(within(d).getByRole("button", { name: "timer.reiseKort.retur" }));
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
    // 2 t > 30 min terskel, men klassifiseringen står på kjøretiden (15 min) — arbeidstid er forvalgt.
    expect(within(d).getByRole("button", { name: "timer.reiseKort.arbeidstid" }).getAttribute("aria-pressed")).toBe("true");
    expect(lagre(d)!.timer).toBe(2);
  });
});

/**
 * O8 (§ 8.22 punkt 2): kjøretidsforslaget rundes til firmaets tidsrunding — nærmeste intervall,
 * aldri ned til 0. Retningen gjelder etter avrunding. Arbeiderens egne tall rundes ikke.
 * Jobben er 07:00–11:00; terskelen 30 min.
 */
describe("O12 pkt 10 — forslaget er firmaets kjøretid uten avrunding", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });

  it("runding 30: 37 min → 06:23–07:00 og 0,62 t («Til byggeplass» holder Slutt)", () => {
    const d = rendre({ kjoretidMin: 37, runding: 30 });
    expect(felt(d, "reise-start").value).toBe("06:23");
    expect(felt(d, "reise-slutt").value).toBe("07:00");
    expect(felt(d, "reise-antall").value).toBe("0.62");
    const input = lagre(d)!;
    expect(input).toMatchObject({ fraTid: "06:23", tilTid: "07:00" });
    expect(input.timer).toBeCloseTo(37 / 60, 10);
    expect(input.reiseKjoretidMin).toBe(37);
  });

  it("runding 30: «Fra byggeplass» 11:00–11:37; 10 min står som 10 min (ingen «aldri 0»-runding)", () => {
    let d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    expect(felt(d, "reise-slutt").value).toBe("11:37");
    cleanup();
    d = rendre({ kjoretidMin: 10, runding: 30 });
    expect(felt(d, "reise-start").value).toBe("06:50");
    expect(felt(d, "reise-antall").value).toBe("0.17");
  });

  it("R4: rettet Start lagres urundet — «Fra byggeplass» 11:07 gir 11:07–11:44", () => {
    const d = rendre({ kjoretidMin: 37, runding: 30 });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.change(felt(d, "reise-start"), { target: { value: "11:07" } });
    expect(felt(d, "reise-slutt").value).toBe("11:44");
    expect(lagre(d)!).toMatchObject({ fraTid: "11:07", tilTid: "11:44" });
  });

  it("forslagsteksten viser firmaets kjøretid urundet (37 med runding 30 → «37»; 4 → «4»)", () => {
    expect(rendre({ kjoretidMin: 37, runding: 30 }).textContent).toContain('timer.reiseKort.forslag{"min":37}');
    cleanup();
    expect(rendre({ kjoretidMin: 4, runding: 30 }).textContent).toContain('timer.reiseKort.forslag{"min":4}');
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

});

/**
 * O10 (§ 8.22, Kenneth 2026-11-22): «Arbeidstid» i reisevinduet er som før O8 — tider, antall,
 * underprosjekt, røde sperretekster og «Avbryt» + «Lagre». «Bytte til reisetid?» beholder
 * rettede tider. Forslagsteksten viser de avrundede minuttene. Jobben er 07:00–11:00.
 */
describe("O10 — Arbeidstid i reisevinduet som før O8", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });
  const ECO = [{ id: "e1", proAdmId: "12", kortNavn: "Grøft" }];

  it.each([
    ["under terskel (forvalgt)", 15, false],
    ["over terskel (valgt selv)", 45, true],
  ] as const)("%s: Start, Slutt, Antall og Underprosjekt vises; «Avbryt» + «Lagre»", (_n, min, velg) => {
    const d = rendre({ kjoretidMin: min, ecoer: ECO });
    if (velg) fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    expect(knapp(d, "timer.reiseKort.arbeidstid").getAttribute("aria-pressed")).toBe("true");
    expect(felt(d, "reise-start")).not.toBeNull();
    expect(felt(d, "reise-slutt")).not.toBeNull();
    expect(felt(d, "reise-antall")).not.toBeNull();
    expect(within(d).getByRole("combobox", { name: "timer.felt.underprosjekt" })).toBeTruthy();
    expect(knapp(d, "handling.avbryt")).toBeTruthy();
    expect(lagreKnapp(d).disabled).toBe(false);
  });

  it.each([
    ["under terskel", 15, false, "timer.reiseKort.underTerskelPaaJobb"],
    ["over terskel", 45, true, "timer.reiseKort.overTerskelPaaJobb"],
  ] as const)("%s: «Lagre» fører arbeidsraden på jobben; linja «Står i kortet på …» og forklaringen med art", (_n, min, velg, nokkel) => {
    const d = rendre({ kjoretidMin: min });
    if (velg) fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    // O12 pkt 12: ingen linje «havner i» i prosjektkort-visning — vinduet sier at reisen føres i kortet.
    expect(d.textContent).not.toMatch(/timer\.reiseKort\.havner(Jobb|Kort|Eget)/);
    expect(d.textContent).toContain("timer.reiseKort.foresIKortet");
    expect(d.textContent).toContain(nokkel);
    expect(d.textContent).toContain('"art":"Ordinær"');
    const input = lagre(d)!;
    expect(input).toMatchObject({ kortId: "k1", lonnsartId: "l1", tilTid: "07:00", arbeidReiseRetning: "ut" });
    expect(input).not.toHaveProperty("reiseKilde");
  });

  it("borte: «Lukk», «Lagre kontor», «Ingenting føres»/«inngår i arbeidstiden» og «Under terskel — inngår»", () => {
    for (const min of [15, 45]) {
      const d = rendre({ kjoretidMin: min });
      if (min === 45) fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
      expect(within(d).queryByRole("button", { name: "handling.lukk" })).toBeNull();
      expect(within(d).queryByRole("button", { name: "timer.reiseKort.lagreKontor" })).toBeNull();
      const tekst = d.textContent ?? "";
      expect(tekst).not.toContain("timer.reiseKort.inngaarIJobb");
      expect(tekst).not.toContain("timer.reiseKort.inngaarIArbeid");
      expect(tekst).not.toMatch(/timer\.reiseKort\.underTerskel\{/);
      expect(within(d).queryByTestId("reise-inngaar-i-arbeid")).toBeNull();
      cleanup();
    }
  });

  it("røde sperretekster vises under Arbeidstid: slutt før start og overlapp", () => {
    const d = rendre({ kjoretidMin: 15 });
    fireEvent.change(felt(d, "reise-slutt"), { target: { value: "06:00" } });
    expect(d.textContent).toContain("timer.feil.sluttForStart");
    expect(lagreKnapp(d).disabled).toBe(true);
    cleanup();
    const d2 = rendre({ kjoretidMin: 15 });
    fireEvent.change(felt(d2, "reise-slutt"), { target: { value: "07:30" } });
    expect(d2.textContent).toContain("timer.feil.overlapp");
    expect(lagreKnapp(d2).disabled).toBe(true);
  });

});

/**
 * O12 pkt 9 (vedtak-timer-web.md § Reisevinduet): over terskel + Arbeidstid gir et gult varsel uten
 * lenke. Minutt-firma: målt på vinduets tid; «Lagre» spør «Føre turen som reisetid?». Km-firma:
 * avhukingen «Reisen er mer enn {terskel} km» styrer Reisetid. REGEL har terskel 30 min.
 */
describe("O12 pkt 9 — terskel-varsel og «Føre turen som reisetid?»", () => {
  afterEach(cleanup);
  const felt = (d: HTMLElement, id: string) => d.querySelector(`#${id}`) as HTMLInputElement;
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });
  const terskelDialog = () => screen.queryByRole("dialog", { name: "timer.reiseKort.terskelDialog.tittel" });

  it("lenken «Bytte til reisetid?» finnes ikke; gult varsel over terskel + Arbeidstid", () => {
    const d = rendre({ kjoretidMin: 45 });
    expect(within(d).queryByTestId("reise-over-terskel-varsel")).toBeNull();
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    expect(within(d).queryByTestId("reise-bytt-til-reisetid")).toBeNull();
    expect(within(d).queryByRole("button", { name: "timer.reiseKort.byttTilReisetid" })).toBeNull();
    const varsel = within(d).getByTestId("reise-over-terskel-varsel");
    expect(varsel.textContent).toContain("timer.reiseKort.overTerskelVarsel");
    expect(within(varsel).queryByRole("button")).toBeNull();
  });

  it("målt på vinduets tid: tabellen sier 15 min, men Start 06:20 (40 min) gir varsel", () => {
    const d = rendre({ kjoretidMin: 15 });
    expect(within(d).queryByTestId("reise-over-terskel-varsel")).toBeNull();
    fireEvent.change(felt(d, "reise-start"), { target: { value: "06:20" } });
    expect(within(d).getByTestId("reise-over-terskel-varsel")).toBeTruthy();
  });

  it("«Lagre» åpner dialogen; «Før som reisetid» lagrer Reisetid med tidene i vinduet", () => {
    const d = rendre({ kjoretidMin: 45 });
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    fireEvent.change(felt(d, "reise-start"), { target: { value: "06:10" } });
    const input = lagre(d, "reisetid")!;
    expect(input).toMatchObject({ fraTid: "06:10", tilTid: "07:00", lonnsartId: "lr", kortId: "k1", reiseIKort: true });
  });

  it("«Behold arbeidstid» lagrer arbeidsraden med retning", () => {
    const d = rendre({ kjoretidMin: 45 });
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    const input = lagre(d, "behold")!;
    expect(input).toMatchObject({ lonnsartId: "l1", kortId: "k1", arbeidReiseRetning: "ut" });
  });

  it("R3: X i dialogen lukker den, ingenting lagres", () => {
    const d = rendre({ kjoretidMin: 45 });
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    fireEvent.click(lagreKnapp(d));
    const dlg = terskelDialog()!;
    expect(dlg).toBeTruthy();
    fireEvent.click(within(dlg).getByRole("button", { name: "modal.x" }));
    expect(terskelDialog()).toBeNull();
    expect(h.kall.filter((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")).toHaveLength(0);
  });

  it("negativkontroll: under terskel + Arbeidstid lagrer uten dialog", () => {
    const d = rendre({ kjoretidMin: 15 });
    fireEvent.click(lagreKnapp(d));
    expect(terskelDialog()).toBeNull();
  });

  it("km-firma: avhukingen er forhåndsavhuket når tabellen er over; avhuket ⇒ Reisetid; av ⇒ Arbeidstid", () => {
    const regel = { ...REGEL, reiseTerskelEnhet: "km" as const, reiseTerskelM: 7500 };
    let d = rendre({ kjoretidMin: 45, regel });
    const boks = () => within(d).getByRole("checkbox", { name: /timer\.reiseKort\.merEnnKm/ }) as HTMLInputElement;
    // Tabellen sier 12 km (> 7,5 km): forhåndsavhuket og Reisetid.
    expect(boks().checked).toBe(true);
    expect(knapp(d, "timer.reisetid").getAttribute("aria-pressed")).toBe("true");
    // Avhuket + Arbeidstid → varsel; «Lagre» lagrer uten minutt-dialogen.
    fireEvent.click(knapp(d, "timer.reiseKort.arbeidstid"));
    expect(within(d).getByTestId("reise-over-terskel-varsel")).toBeTruthy();
    fireEvent.click(lagreKnapp(d));
    expect(terskelDialog()).toBeNull();
    cleanup();
    d = rendre({ kjoretidMin: 45, regel });
    fireEvent.click(boks());
    expect(boks().checked).toBe(false);
    expect(knapp(d, "timer.reiseKort.arbeidstid").getAttribute("aria-pressed")).toBe("true");
    expect(within(d).queryByTestId("reise-over-terskel-varsel")).toBeNull();
  });
});

/**
 * O12 pkt 12: Til i et annet kort enn dagens første / Fra i et annet enn dagens siste → dialogen
 * nevner dagens første/siste kort; «Ja, lagre» lagrer, «Avbryt» lagrer ingenting.
 */
describe("O12 pkt 12 — reisen i et annet kort enn dagens første/siste", () => {
  afterEach(cleanup);
  const knapp = (d: HTMLElement, navn: string) => within(d).getByRole("button", { name: navn });
  const sjekk = () => screen.queryByRole("dialog", { name: "timer.reiseKort.kortSjekk.tittel" });
  const K2 = {
    id: "r2",
    projectId: "p1",
    byggeplassId: "b1",
    lonnsartId: "l1",
    aktivitetId: null,
    externalCostObjectId: null,
    fraTid: "12:00",
    tilTid: "14:00",
    timer: "2",
    pauseMin: 0,
    beskrivelse: "Etterarbeid",
    erReise: false,
    kortId: "k2",
  };
  const tilfoy = () => h.kall.filter((k) => k.key === "timer.dagsseddel.tilfoyTimerRad");

  it("«Fra byggeplass» i første kort når dagen har et senere kort: dialogen spør; «Ja, lagre» lagrer i kortet", () => {
    const d = rendre({ kjoretidMin: 15, ekstraTimer: [K2] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.click(lagreKnapp(d));
    const dlg = sjekk()!;
    expect(dlg.textContent).toContain("timer.reiseKort.kortSjekk.tekstRetur");
    expect(dlg.textContent).toContain("12:00–14:00");
    expect(tilfoy()).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "timer.reiseKort.kortSjekk.jaLagre" }));
    expect(tilfoy()).toHaveLength(1);
    expect(tilfoy()[0]!.input).toMatchObject({ kortId: "k1" });
  });

  it("«Avbryt» i dialogen lagrer ingenting", () => {
    const d = rendre({ kjoretidMin: 15, ekstraTimer: [K2] });
    fireEvent.click(knapp(d, "timer.reiseKort.retur"));
    fireEvent.click(lagreKnapp(d));
    fireEvent.click(within(sjekk()!).getByRole("button", { name: "handling.avbryt" }));
    expect(sjekk()).toBeNull();
    expect(tilfoy()).toHaveLength(0);
  });

  it("negativkontroll: «Til byggeplass» i dagens første kort lagrer uten dialog", () => {
    const d = rendre({ kjoretidMin: 15, ekstraTimer: [K2] });
    fireEvent.click(lagreKnapp(d));
    expect(sjekk()).toBeNull();
    expect(tilfoy()).toHaveLength(1);
  });
});
