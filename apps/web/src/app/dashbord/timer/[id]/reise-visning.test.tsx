// @vitest-environment jsdom
/**
 * w15d (web-timeforing-plan § 4.15 del C pkt. 1–4, del G, del H pkt. 8): dagssiden viser reisen.
 * Reiselinja har merket «Reise», stedet og klokka, uten aktivitet og matpause; hodet regner sted og
 * klokke av arbeidet; kortet med bare reise har tre lenker (B45 A), med en timerad alle fem
 * (§ 8.19); kort med bare reise til annet kontor har ikke «+ Timer» (F25); timerad-vinduet sier
 * hvor en reise havner. Dagen er #7 (`testdata-dag7.ts`).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ velgFirma: () => {} }) }));
vi.mock("@/kontekst/prosjekt-kontekst", () => ({ useProsjekt: () => ({ prosjektId: null }) }));
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
            error: null,
            isLoading: false,
            refetch: () => {},
          });
        }
        if (navn === "useMutation") {
          return () => ({ mutate: () => {}, mutateAsync: async () => ({}), isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import Side from "./page";

const BYGGEPLASSER = [
  { id: "b1", name: "Blokk A", projectId: "p1" },
  { id: "b2", name: "Narvik", projectId: "p1" },
];
type Rad = Record<string, unknown>;
const ARBEID1: Rad = { ...DAG7_SEDEL.timer[0]!, byggeplassId: "b1" } as Rad;
const ARBEID2: Rad = { ...DAG7_SEDEL.timer[1]!, byggeplassId: "b1" } as Rad;

function reise(over: Record<string, unknown>): Rad {
  return {
    ...DAG7_SEDEL.timer[0]!,
    lonnsartId: "lr",
    externalCostObjectId: null,
    pauseMin: 0,
    beskrivelse: null,
    erReise: true,
    reiseKilde: "manuell",
    reiseRetning: null,
    ...over,
  } as Rad;
}

function rendre(timer: Rad[], modus = "prosjektkort") {
  cleanup();
  h.data = {
    ...dag7Data(modus),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, timer, maskiner: [], tillegg: [], utlegg: [] },
    "vareforbruk.hentMineForDato": [],
    "bygning.hentForFirma": BYGGEPLASSER,
    "organisasjon.hentArbeidstidDefaults": {
      timerRegistreringsmodus: modus,
      reiseLonnsartId: "lr",
      reiseGrenser: [],
    },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Timelønn", type: "ordinaer", aktiv: true, satsEnhet: "time" },
      { id: "lr", navn: "Reise", type: "ordinaer", aktiv: true, satsEnhet: "time" },
    ],
  };
  return render(<Side />);
}

const kortHoder = () => screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
/** Åpner det første kortet (et eneste kort er åpent fra start, w15a). */
function aapneForste() {
  const hode = kortHoder()[0]!;
  if (hode.getAttribute("aria-expanded") !== "true") fireEvent.click(hode);
}
const LENKER = [
  "timer.prosjektkort.nyTimer",
  "timer.prosjektkort.nyMaskin",
  "timer.prosjektkort.nyVareKort",
  "timer.prosjektkort.nyReise",
  "timer.prosjektkort.leggTil",
];
const synligeLenker = () =>
  LENKER.filter((n) => screen.queryAllByRole("button", { name: n }).length > 0);

// Kortet med bare reise: k3, til Narvik 12:00–15:00 (bilde 8, B43 B).
const TUR = reise({ id: "rt", kortId: "k3", byggeplassId: "b2", fraTid: "12:00", tilTid: "15:00", timer: "3" });

describe("w15d — kortet med bare reise (B45 A)", () => {
  afterEach(cleanup);

  it("hodet sier «Reise», stedet og klokka", () => {
    rendre([TUR]);
    const [hode] = kortHoder();
    expect(hode!.textContent).toContain("timer.prosjektkort.reiseMerke");
    expect(hode!.textContent).toContain("Narvik · 12:00–15:00");
  });

  it("tre lenker: «+ Timer», «+ Reise», «+ Tillegg/Utlegg» — ikke «+ Maskin» og «+ Vare»", () => {
    rendre([TUR]);
    aapneForste();
    expect(synligeLenker()).toEqual([
      "timer.prosjektkort.nyTimer",
      "timer.prosjektkort.nyReise",
      "timer.prosjektkort.leggTil",
    ]);
  });

  it("med en timerad har kortet alle fem (§ 8.19)", () => {
    rendre([TUR, { ...ARBEID1, id: "ra", kortId: "k3", fraTid: "15:00", tilTid: "16:00", timer: "1", pauseMin: 0 }]);
    aapneForste();
    expect(synligeLenker()).toEqual(LENKER);
  });

  it("§ 8.22 punkt 2: reise til annet kontor alene har ingen særregel — «+ Timer» står", () => {
    rendre([{ ...TUR, reiseKilde: "overforing", reiseRetning: "ut" }]);
    aapneForste();
    expect(synligeLenker()).toEqual(["timer.prosjektkort.nyTimer", "timer.prosjektkort.nyReise", "timer.prosjektkort.leggTil"]);
  });
});

describe("w15d — reiselinja og hodet i jobben", () => {
  afterEach(cleanup);

  // Jobb 1 på Blokk A 07:00–15:00 med retur fra Narvik i samme kort (F19-dagen).
  const RETUR = reise({
    id: "rr",
    kortId: "k1",
    byggeplassId: "b2",
    reiseRetning: "retur",
    fraTid: "15:00",
    tilTid: "15:30",
    timer: "0.5",
    beskrivelse: "kjørte hjem",
  });

  it("hodet regner byggeplassen av arbeidet og viser klokka — ikke «2 byggeplasser»", () => {
    rendre([ARBEID1, RETUR]);
    const [hode] = kortHoder();
    expect(hode!.textContent).toContain("Blokk A · 07:00–15:00");
    expect(hode!.textContent).not.toContain("timer.prosjektkort.flereByggeplasser");
    expect(hode!.textContent).not.toContain("timer.prosjektkort.reiseMerke");
  });

  it("reiselinja: merket, «Fra {sted}», klokka, tekst · lønnsart — uten aktivitet og matpause", () => {
    rendre([ARBEID1, RETUR]);
    aapneForste();
    const linje = document.querySelector('[data-reiselinje="rr"]') as HTMLElement;
    expect(linje).not.toBeNull();
    const tekst = linje.textContent ?? "";
    expect(tekst).toContain("timer.prosjektkort.reiseMerke");
    expect(tekst).toContain('timer.prosjektkort.reiseFra{"sted":"Narvik"}');
    expect(tekst).toContain("15:00–15:30");
    expect(tekst).toContain("kjørte hjem · Reise");
    expect(tekst).not.toContain("Arbeid");
    expect(tekst).not.toContain("timer.matpause");
    // Underprosjektet er likt jobbens (ingen) — vises ikke.
    expect(tekst).not.toContain("timer.prosjektkort.utenUnderprosjekt");
    // Knappene står: blyant, del, slett.
    for (const tittel of ["handling.rediger", "timer.rediger.splittRad", "handling.slett"]) {
      expect(linje.querySelector(`[title="${tittel}"]`)).not.toBeNull();
    }
  });

  it("§ 8.22 punkt 2: reise til annet kontor har ingen egen linjetekst — vanlig reise", () => {
    rendre([ARBEID1, { ...RETUR, id: "ro", reiseKilde: "overforing", reiseRetning: "retur" }]);
    aapneForste();
    const tekst = document.querySelector('[data-reiselinje="ro"]')!.textContent ?? "";
    expect(tekst).toContain('timer.prosjektkort.reiseFra{"sted":"Narvik"}');
    expect(tekst).not.toContain("timer.reiseKort.annetKontor");
    expect(tekst).not.toContain("timer.reiseKort.fraAnnetKontor");
  });

  it("reise uten underprosjekt i en jobb med underprosjekt: «Uten underprosjekt» (B48 A)", () => {
    rendre([ARBEID2, reise({ id: "r2r", kortId: "k2", byggeplassId: "b1", fraTid: "16:00", tilTid: "16:30", timer: "0.5" })]);
    aapneForste();
    const linje = document.querySelector('[data-reiselinje="r2r"]') as HTMLElement;
    expect(linje.textContent).toContain("timer.prosjektkort.utenUnderprosjekt");
    expect(linje.textContent).toContain("Blokk A");
  });
});

describe("w15d — teksten under lønnsarten i timerad-vinduet (del C pkt. 4)", () => {
  afterEach(cleanup);

  function pennenPaa(radId: string) {
    const linje = document.querySelector(`[data-reiselinje="${radId}"]`) as HTMLElement;
    fireEvent.click(linje.querySelector('[title="handling.rediger"]')!);
    return screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
  }

  it("reise i en jobb: «Dette er reise. Den står i jobben på {sted}.»", () => {
    rendre([ARBEID1, reise({ id: "rr", kortId: "k1", byggeplassId: "b1", reiseRetning: "retur", fraTid: "15:00", tilTid: "15:30", timer: "0.5" })]);
    aapneForste();
    const dialog = pennenPaa("rr");
    expect(dialog.textContent).toContain('timer.rediger.reiseHavnerJobb{"sted":"Blokk A"}');
  });

  it("ingen jobb på dagen: «Dette er reise. Den får eget kort.»", () => {
    rendre([TUR]);
    aapneForste();
    const dialog = pennenPaa("rt");
    expect(dialog.textContent).toContain("timer.rediger.reiseHavnerEget");
  });

  it("arbeid: ingen reisetekst", () => {
    rendre([ARBEID1]);
    aapneForste();
    // L3a: arbeidslinja står i jobbskjemaet — blyanten i skjemaets hode.
    fireEvent.click(screen.getAllByTitle("timer.jobbSkjema.endreUnderprosjekt")[0]!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(dialog.textContent).not.toContain("timer.rediger.reiseHavner");
  });

  it("dagskort-modus: reiselinja og vinduet er som før", () => {
    rendre([ARBEID1, reise({ id: "rr", kortId: "k1", byggeplassId: "b1", fraTid: "15:00", tilTid: "15:30", timer: "0.5" })], "dagskort");
    expect(document.querySelector("[data-reiselinje]")).toBeNull();
    const blyant = screen
      .getAllByTitle("handling.rediger")
      .find((b) => b.closest("li")?.textContent?.includes("15:00–15:30"));
    fireEvent.click(blyant!);
    const dialog = screen.getByRole("dialog", { name: "timer.detalj.redigerTimerRad" });
    expect(dialog.textContent).not.toContain("timer.rediger.reiseHavner");
  });
});
