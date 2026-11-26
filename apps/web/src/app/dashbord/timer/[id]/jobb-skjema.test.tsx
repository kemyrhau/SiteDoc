// @vitest-environment jsdom
/**
 * Plan § 8.22 L3a — jobbskjemaet (Bilde 2-jobben) på dagssiden, prosjektkort-modus.
 * Testplan 4 (blur-lagring, «Ikke lagret», sperre i «Send dagen») og 5 («+ Registrer timer»
 * lander i skjemaet; ingen rad før Til er fylt). Dagen er #7 (`testdata-dag7.ts`): jobb 1 (k1)
 * 07:00–15:00, jobb 2 (k2) 15:00–16:00 på TILL-001.
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
  /** Mutasjoner som feiler (nøkkel = tRPC-sti). */
  feilMut: {} as Record<string, string>,
  sok: "",
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
  useSearchParams: () => new URLSearchParams(h.sok),
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
            if (h.feilMut[key]) throw new Error(h.feilMut[key]);
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

function rendre(
  a: { modus?: string; sok?: string; sedel?: Partial<typeof DAG7_SEDEL>; data?: Record<string, unknown> } = {},
) {
  h.kall = [];
  h.feil = {};
  h.feilMut = {};
  h.sok = a.sok ?? "";
  h.data = {
    ...dag7Data(a.modus ?? "prosjektkort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, ...a.sedel },
    ...a.data,
  };
  return render(<Side />);
}

/** Åpner jobb 1 (kortet uten TILL-001) og gir skjemaet. */
function aapneJobb1() {
  const kort = screen
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-expanded"))
    .find((b) => !b.textContent?.includes("TILL-001"));
  fireEvent.click(kort!);
  return screen.getByTestId("jobb-skjema");
}
const felt = (skjema: HTMLElement, navn: string) =>
  within(skjema).getByLabelText<HTMLInputElement>(`timer.jobbSkjema.${navn}`);
const kallTil = (sti: string) => h.kall.filter((k) => k.sti === `timer.dagsseddel.${sti}`);
const sendKnapp = () =>
  screen.getAllByRole("button").find((b) => b.textContent?.includes("timer.prosjektkort.sendDagen"))!;
const vent = () => new Promise((r) => setTimeout(r, 0));

describe("L3a — jobbskjemaet", () => {
  afterEach(cleanup);

  it("prosjektkort: jobben står i skjemaet med Fra, Til og pause", () => {
    rendre();
    const skjema = aapneJobb1();
    expect(felt(skjema, "fra").value).toBe("07:00");
    expect(felt(skjema, "til").value).toBe("15:00");
    expect(felt(skjema, "pause").value).toBe("30");
  });

  it("Til endres og feltet forlates: lagreJobbTid får hele jobben, uten Lagre-knapp", async () => {
    rendre();
    const skjema = aapneJobb1();
    expect(within(skjema).queryByRole("button", { name: /lagre/i })).toBeNull();
    fireEvent.change(felt(skjema, "til"), { target: { value: "15:30" } });
    fireEvent.blur(felt(skjema, "til"));
    await vi.waitFor(() => expect(kallTil("lagreJobbTid")).toHaveLength(1));
    expect(kallTil("lagreJobbTid")[0]!.input).toEqual({
      sheetId: "s1",
      kortId: "k1",
      fraTid: "07:00",
      tilTid: "15:30",
      pauseMin: 30,
      linjer: [{ radId: "r1", lonnsartId: "l1" }],
    });
    expect(kallTil("tilfoyTimerRad")).toHaveLength(0);
  });

  it("uendret felt forlates: ingen lagring", async () => {
    rendre();
    const skjema = aapneJobb1();
    fireEvent.blur(felt(skjema, "til"));
    await vent();
    expect(kallTil("lagreJobbTid")).toHaveLength(0);
  });

  it("lagring feiler: «Ikke lagret — prøv igjen», og «Send dagen» er sperret", async () => {
    rendre();
    h.feilMut["timer.dagsseddel.lagreJobbTid"] = "Overlapper";
    const skjema = aapneJobb1();
    expect(sendKnapp().hasAttribute("disabled")).toBe(false);
    fireEvent.change(felt(skjema, "til"), { target: { value: "15:30" } });
    fireEvent.blur(felt(skjema, "til"));
    const feil = await within(skjema).findByTestId("ikke-lagret");
    expect(feil.textContent).toContain("timer.jobbSkjema.ikkeLagret");
    expect(feil.textContent).toContain("Overlapper");
    expect(sendKnapp().hasAttribute("disabled")).toBe(true);
  });

  it("ulagret: å forlate siden spør først (beforeunload)", async () => {
    rendre();
    h.feilMut["timer.dagsseddel.lagreJobbTid"] = "Nett";
    const skjema = aapneJobb1();
    fireEvent.change(felt(skjema, "til"), { target: { value: "15:30" } });
    fireEvent.blur(felt(skjema, "til"));
    await within(skjema).findByTestId("ikke-lagret");
    const hendelse = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(hendelse);
    expect(hendelse.defaultPrevented).toBe(true);
  });

  it("dagskort-modus: ingen jobbskjema", () => {
    rendre({ modus: "dagskort" });
    expect(screen.queryByTestId("jobb-skjema")).toBeNull();
  });

  it("sendt dag: ingen jobbskjema (visningen som i dag)", () => {
    rendre({ sedel: { status: "sent" } });
    const kort = screen.getAllByRole("button").filter((b) => b.hasAttribute("aria-expanded"));
    kort.forEach((k) => fireEvent.click(k));
    expect(screen.queryByTestId("jobb-skjema")).toBeNull();
  });
});

describe("L3a — «+ Registrer timer» lander i skjemaet", () => {
  afterEach(cleanup);

  // Sedelens slutt 15:00 lokal tid (14:00Z) — ikke etter forrige jobbs slutt (16:00).
  const SLUTT_FOR = { endAt: "2026-11-20T14:00:00.000Z" };

  it("ny dag (A): serverens første jobb står i skjemaet med gule felt og merket «firma»", () => {
    rendre({
      sok: "registrer=1&nyttProsjekt=p1",
      sedel: { timer: [DAG7_SEDEL.timer[0]!], maskiner: [], tillegg: [], utlegg: [] } as Partial<typeof DAG7_SEDEL>,
      data: { "vareforbruk.hentMineForDato": [] },
    });
    const skjema = screen.getByTestId("jobb-skjema");
    expect(felt(skjema, "fra").value).toBe("07:00");
    expect(felt(skjema, "til").value).toBe("15:00");
    expect(felt(skjema, "pause").value).toBe("30");
    expect(felt(skjema, "fra").className).toContain("yellow");
    expect(within(skjema).getByTestId("skjema-kilde").textContent).toContain("timer.jobbSkjema.kildeFirma");
  });

  it("ny dag uten rad: utkastet får firmaets tider og dagens pause (07:00–16:00 / 30)", () => {
    rendre({
      sok: "registrer=1&nyttProsjekt=p1",
      sedel: { timer: [], maskiner: [], tillegg: [], utlegg: [] } as Partial<typeof DAG7_SEDEL>,
      data: { "vareforbruk.hentMineForDato": [] },
    });
    const skjema = screen.getByTestId("jobb-skjema");
    expect(felt(skjema, "fra").value).toBe("07:00");
    expect(felt(skjema, "til").value).toBe("16:00");
    expect(felt(skjema, "pause").value).toBe("30");
    expect(within(skjema).getByTestId("skjema-kilde").textContent).toContain("timer.jobbSkjema.kildeFirma");
    expect(kallTil("tilfoyTimerRad")).toHaveLength(0);
  });

  it("neste jobb: pausen er 0 (tatt i forrige jobb)", () => {
    rendre({ sok: "registrer=1&nyttProsjekt=p1&eksisterte=1", sedel: SLUTT_FOR });
    expect(felt(screen.getByTestId("jobb-skjema"), "pause").value).toBe("0");
  });

  it("neste jobb: Fra = forrige slutt, Til tom når firmaets slutt er tidligere, merket «forrige»", () => {
    rendre({ sok: "registrer=1&nyttProsjekt=p1&eksisterte=1", sedel: SLUTT_FOR });
    const skjema = screen.getByTestId("jobb-skjema");
    expect(felt(skjema, "fra").value).toBe("16:00");
    expect(felt(skjema, "til").value).toBe("");
    expect(within(skjema).getByTestId("skjema-kilde").textContent).toContain("timer.jobbSkjema.kildeForrige");
  });

  it("ingen rad før Til er fylt; Til fylt → raden lages med jobbens kort og deles av lagreJobbTid", async () => {
    rendre({ sok: "registrer=1&nyttProsjekt=p1&eksisterte=1", sedel: SLUTT_FOR });
    const skjema = screen.getByTestId("jobb-skjema");
    fireEvent.change(felt(skjema, "fra"), { target: { value: "16:30" } });
    fireEvent.blur(felt(skjema, "fra"));
    await vent();
    expect(kallTil("tilfoyTimerRad")).toHaveLength(0);
    expect(kallTil("lagreJobbTid")).toHaveLength(0);

    fireEvent.change(felt(skjema, "til"), { target: { value: "18:00" } });
    fireEvent.blur(felt(skjema, "til"));
    await vi.waitFor(() => expect(kallTil("lagreJobbTid")).toHaveLength(1));
    const ny = kallTil("tilfoyTimerRad");
    expect(ny).toHaveLength(1);
    expect(ny[0]!.input).toMatchObject({ sheetId: "s1", projectId: "p1", fraTid: "16:30", tilTid: "18:00" });
    const kortId = ny[0]!.input.kortId as string;
    expect(kortId).toBeTruthy();
    expect(["k1", "k2"]).not.toContain(kortId);
    expect(kallTil("lagreJobbTid")[0]!.input).toMatchObject({
      kortId,
      fraTid: "16:30",
      tilTid: "18:00",
      linjer: [{ radId: "ny" }],
    });
  });
});

// O14 pkt 5 (R4): en reise ført som arbeidstid er ingen skjemalinje. Kortet med arbeidsrad +
// arbeidstid-reise står i skjemaet (Fra 07:00, ikke 06:56), og reisen står som reiselinje.
describe("O14 pkt 5 — arbeidstid-reisen hindrer ikke skjemaet", () => {
  afterEach(cleanup);

  it("arbeidsrad + arbeidstid-reise i samme kort: skjemaet viser arbeidet; reisen er en reiselinje", () => {
    const r1 = DAG7_SEDEL.timer[0]!;
    const reise = {
      ...r1,
      id: "ra",
      fraTid: "06:56",
      tilTid: "07:00",
      timer: "0.07",
      pauseMin: 0,
      beskrivelse: null,
      erReise: false,
      arbeidReiseRetning: "ut",
      createdAt: "2026-11-05T06:56:00.000Z",
    };
    rendre({ sedel: { timer: [reise, ...DAG7_SEDEL.timer] as typeof DAG7_SEDEL.timer } });
    const skjema = aapneJobb1();
    expect(felt(skjema, "fra").value).toBe("07:00");
    expect(felt(skjema, "til").value).toBe("15:00");
    expect(document.querySelector('[data-reiselinje="ra"]')).not.toBeNull();
  });
});

describe("O25 — firmaets reise-lønnsart er også en arbeids-lønnsart i jobben", () => {
  afterEach(cleanup);

  it("(5) reise-lønnsart = standard = Timelønn: Timelønn står i jobbnedtrekket", () => {
    rendre({
      data: {
        "organisasjon.hentArbeidstidDefaults": { timerRegistreringsmodus: "prosjektkort", reiseLonnsartId: "l1" },
      },
    });
    const skjema = aapneJobb1();
    const nedtrekk = within(skjema).getAllByLabelText<HTMLSelectElement>("timer.jobbSkjema.lonnsart")[0]!;
    expect(Array.from(nedtrekk.options).map((o) => o.textContent)).toContain("Timelønn");
  });
});
