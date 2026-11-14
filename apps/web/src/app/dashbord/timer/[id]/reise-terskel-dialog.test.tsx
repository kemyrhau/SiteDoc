// @vitest-environment jsdom
/**
 * Ordre 2026-11-14 (11) A + C: web-«+ Reise» bruker SAMME delte terskelregel som
 * mobilen (`løsManuellReise`). Payloaden til `tilfoyTimerRad` sammenlignes mot
 * den delte fasiten med samme input — under, nøyaktig på terskel, over og ukjent
 * avstand. C: mangler standard lønnsart → tydelig tekst; firma-admin får lenke.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { løsManuellReise, type ReiseRegelsett } from "@sitedoc/shared";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as Array<{ key: string; input: Record<string, unknown> }>,
  /** Oppslag som (ennå) ikke har svart: data undefined, ingen feil. */
  utelat: new Set<string>(),
  /** Oppslag som har feilet: data undefined, isError true. */
  feil: new Set<string>(),
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

const REGEL: ReiseRegelsett = {
  reiseTerskelEnhet: "minutter",
  reiseTerskelMin: 30,
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
};
const KM: ReiseRegelsett = { ...REGEL, reiseTerskelEnhet: "km", reiseTerskelM: 30000 };

const LONNSARTER = [
  { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: true, type: "ordinaer" },
  { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer" },
];

function rendre({
  regel = REGEL,
  lonnsarter = LONNSARTER as Array<Record<string, unknown>>,
  admin = false,
} = {}) {
  h.kall = [];
  h.utelat.clear();
  h.feil.clear();
  h.data = {
    "timer.dagsseddel.hentMedId": {
      id: "s1",
      organizationId: "o1",
      dato: "2026-11-05T00:00:00.000Z",
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
          byggeplassId: null,
          fraTid: "07:00",
          tilTid: "11:00",
          timer: "4",
          pauseMin: 0,
          beskrivelse: null,
          attestertStatus: "pending",
          erReise: false,
        },
      ],
    },
    "prosjekt.hentForTimer": [{ id: "p1", name: "Skole", internalProjectNumber: "2041" }],
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: "prosjektkort",
      reiseLonnsartId: "lr",
      reiseGrenser: [],
      ...regel,
    },
    ...(admin ? { "organisasjon.hentSetting": { tidsrundingMinutter: null } } : {}),
    "oppmotested.hentForFirma": [{ id: "o1", navn: "Kontor", lat: 0, lng: 0, radiusM: 100 }],
    "oppmotested.hentMatriseForFirma": [],
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
  return screen.getByRole("dialog");
}

function fyllTid(dialog: HTMLElement, fra: string, til: string) {
  const [f, t] = Array.from(dialog.querySelectorAll<HTMLInputElement>('input[type="time"]'));
  fireEvent.change(f!, { target: { value: fra } });
  fireEvent.change(t!, { target: { value: til } });
}

function lagre(dialog: HTMLElement) {
  fireEvent.submit(dialog.querySelector("form")!);
  return h.kall.find((k) => k.key === "timer.dagsseddel.tilfoyTimerRad")?.input;
}

/** Den delte fasiten — samme funksjon som mobilens `useManuellReise` kaller. */
function fasit(regel: ReiseRegelsett, reisetimer: number) {
  return løsManuellReise({
    regel,
    oppmotesteder: [{ id: "o1" }],
    sisteValgId: null,
    valgtId: null,
    byggeplassId: null,
    avstandFor: () => null,
    reisetimer,
    grensepunkter: [],
    resolverLonnsartId: "lr",
    standardLonnsartId: "l1",
  }).klassifisering!;
}

describe("web «+ Reise» — samme terskelregel som mobil (A)", () => {
  afterEach(cleanup);

  it.each([
    ["under terskel (15 min)", REGEL, "11:00", "11:15", 0.25],
    ["nøyaktig på terskel (30 min) = over", REGEL, "11:00", "11:30", 0.5],
    ["over terskel (1 t)", REGEL, "11:00", "12:00", 1],
    ["km, ukjent avstand → under", KM, "11:00", "12:00", 1],
  ] as const)("%s: payload = delt fasit", (_n, regel, fra, til, timer) => {
    const dialog = rendre({ regel });
    fyllTid(dialog, fra, til);
    const input = lagre(dialog);
    const k = fasit(regel, timer);
    expect(input).toBeDefined();
    expect(input!.timer).toBe(timer);
    expect(input!.lonnsartId).toBe(k.lonnsartId);
    expect(input!.reiseKilde).toBe(k.erReise ? "manuell" : undefined);
  });

  it("negativkontroll: under terskel føres ALDRI på resolverens reise-art", () => {
    const dialog = rendre();
    fyllTid(dialog, "11:00", "11:15");
    const input = lagre(dialog)!;
    expect(input.lonnsartId).not.toBe("lr");
    expect(input).not.toHaveProperty("reiseKilde");
  });

  it("viser samme forklaringslinje som mobil (delt tekst)", () => {
    const dialog = rendre();
    fyllTid(dialog, "11:00", "11:15");
    expect(dialog.textContent).toContain("timer.reiseTerskel.under");
    expect(dialog.textContent).toContain("Ordinær");
  });

  it("terskel ikke i bruk (begge typer reisetid): som før — resolverens art, reiseKilde manuell", () => {
    const regel: ReiseRegelsett = { ...REGEL, reiseUnderTerskelType: "reisetid" };
    const dialog = rendre({ regel });
    fyllTid(dialog, "11:00", "11:15");
    const input = lagre(dialog)!;
    expect(input.lonnsartId).toBe("lr");
    expect(input.reiseKilde).toBe("manuell");
    expect(input.lonnsartId).toBe(fasit(regel, 0.25).lonnsartId);
  });

  it("web-hooken kaller den delte funksjonen (ingen egen web-logikk)", () => {
    const her = dirname(fileURLToPath(import.meta.url));
    const hook = readFileSync(join(her, "../../../../hooks/useManuellReiseWeb.ts"), "utf-8");
    expect(hook).toContain("løsManuellReise(");
    expect(hook).not.toContain("klassifiserManuellReise(");
  });
});

describe("web «+ Reise» — mangler standard lønnsart (C)", () => {
  afterEach(cleanup);
  const utenStandard = LONNSARTER.map((l) => ({ ...l, erStandardvalg: false }));

  it("arbeider: tydelig tekst, ingen lenke, lagring sperret", () => {
    const dialog = rendre({ lonnsarter: utenStandard });
    fyllTid(dialog, "11:00", "11:15");
    expect(dialog.textContent).toContain("timer.reiseTerskel.manglerArt");
    expect(within(dialog).queryByRole("link", { name: "timer.reiseTerskel.settStandardArt" })).toBeNull();
    const knapp = within(dialog).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
    expect(knapp.disabled).toBe(true);
  });

  it("firma-admin: «mangler standard lønnsart» + lenke — ikke «be firmaadmin»", () => {
    const dialog = rendre({ lonnsarter: utenStandard, admin: true });
    fyllTid(dialog, "11:00", "11:15");
    expect(dialog.textContent).toContain("timer.reiseTerskel.manglerStandardArt");
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerArt");
    const lenke = within(dialog).getByRole("link", { name: "timer.reiseTerskel.settStandardArt" });
    expect(lenke.getAttribute("href")).toBe("/dashbord/firma/timer/lonnsarter");
  });

  it("negativkontroll: med standardart vises ingen veiledning", () => {
    const dialog = rendre({ admin: true });
    fyllTid(dialog, "11:00", "11:15");
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerArt");
    expect(dialog.textContent).not.toContain("timer.reiseTerskel.manglerStandardArt");
  });
});

/* RETUR 2026-11-14 (11) vilkår 1 (lønn): uten lastet regelsett er klassifiseringen
 * ukjent, og «som før» ville stille ført en under-terskel-rad som reise. Lagre
 * skal være sperret med forklaring, og ingen mutate skal gå — også ved submit
 * forbi knappen. Oppslaget tas bort ETTER at dialogen er åpnet, slik at sida
 * selv (som også leser defaults) er uberørt. */
describe("web «+ Reise» — Lagre sperret til regelsettet er lastet (vilkår 1)", () => {
  afterEach(cleanup);

  it.each([
    ["ikke lastet", "utelat", "sperret.reiseRegelLaster"],
    ["feilet", "feil", "sperret.reiseRegelFeilet"],
  ] as const)("defaults %s: Lagre sperret, forklaring, ingen mutate", (_n, hva, forklaring) => {
    const dialog = rendre();
    h[hva].add("organisasjon.hentArbeidstidDefaults");
    fyllTid(dialog, "11:00", "11:15");
    const knapp = within(dialog).getByRole("button", { name: "handling.lagre" }) as HTMLButtonElement;
    expect(knapp.disabled).toBe(true);
    fireEvent.mouseEnter(knapp.parentElement!);
    expect(document.body.textContent).toContain(forklaring);
    expect(lagre(dialog)).toBeUndefined();
    expect(h.kall.filter((k) => k.key.startsWith("timer.dagsseddel."))).toEqual([]);
  });

  it("kontroll: samme dialog med lastet regelsett lagrer (under terskel = ordinær)", () => {
    const dialog = rendre();
    fyllTid(dialog, "11:00", "11:15");
    const input = lagre(dialog);
    expect(input?.lonnsartId).toBe("l1");
  });
});
