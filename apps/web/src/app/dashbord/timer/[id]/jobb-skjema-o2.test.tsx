// @vitest-environment jsdom
/**
 * Plan § 8.22 O2 — `JobbSkjema` (prosjektkort-modus): timer redigeres der de står, og Fra/Til
 * er klokkefelt som i timevinduet. Samme trpc-proxy-mock som gate 129. Dagen: norm 7,5 t, pause etter 4 t.
 *   - timer → Til (Fra + timer + pause, delt `tilFraAntall`), også med pause; Til → timer; pause-endring
 *   - Fra/Til er `input[type="time"]` med timevinduets steg (RETUR O2); rundes ved blur; feil først ved blur
 *     (hva «1600»/«16» gir skrevet, er målt i Chrome/WebKit — jsdom har ikke klokkefeltets tastatur)
 *   - tom Fra: ingenting regnes ut
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  kall: [] as { sti: string; input: Record<string, unknown> }[],
  /** Mutasjoner som feiler (nøkkel = tRPC-sti). */
  feilMut: {} as Record<string, string>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") return () => ({ data: undefined, error: null, isLoading: false });
        if (navn === "useMutation") {
          const logg = (input: Record<string, unknown>) => {
            h.kall.push({ sti: key, input });
            if (h.feilMut[key]) throw new Error(h.feilMut[key]);
            return { id: "ny" };
          };
          return () => ({ mutateAsync: async (input: Record<string, unknown>) => logg(input), isPending: false });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import { JobbSkjema, type SkjemaLinje } from "./JobbSkjema";

const TL = { id: "tl", navn: "Timelønn", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 };
const OT = { id: "ot", navn: "Overtid 50 %", overtidsnivaa: 50, aktiv: true, type: "ordinaer", rekkefolge: 2 };
const LAGRE = "timer.dagsseddel.lagreJobbTid";
const TILFOY = "timer.dagsseddel.tilfoyTimerRad";

const linje = (o: Partial<SkjemaLinje> & Pick<SkjemaLinje, "fraTid" | "tilTid" | "timer">): SkjemaLinje => ({
  id: "r1",
  pauseMin: 0,
  lonnsartId: "tl",
  beskrivelse: "Graving",
  ...o,
});

function rendre(a: {
  linjer?: SkjemaLinje[];
  ny?: { fraTid: string; tilTid: string; pauseMin: number };
  andre?: { fraTid: string; tilTid: string; pauseMin: number }[];
  tidsrundingMinutter?: number | null;
}) {
  h.kall = [];
  const onUlagret = vi.fn();
  render(
    <JobbSkjema
      sheetId="s1"
      kortId="k2"
      linjer={a.linjer ?? []}
      ny={a.ny ? { projectId: "p1", aktivitetId: "a1", byggeplassId: null, lonnsartId: "tl", ...a.ny } : undefined}
      kilde={null}
      lonnsarter={[TL, OT]}
      velgbareLonnsarter={[TL, OT]}
      andreRader={(a.andre ?? []).map((r, i) => ({ id: `x${i}`, erReise: false, overtidsnivaa: null, ...r }))}
      norm={7.5}
      pauseEtterTimer={4}
      fastPauseFra={null}
      datoTekst="25.11."
      projectId="p1"
      ecoId={null}
      organizationId="o1"
      rader47={[]}
      onUlagret={onUlagret}
      tidsrundingMinutter={a.tidsrundingMinutter ?? null}
    />,
  );
  return { onUlagret };
}
const vent = () => new Promise((r) => setTimeout(r, 0));
const lagreKall = () => h.kall.filter((k) => k.sti === LAGRE);

afterEach(() => {
  cleanup();
  h.feilMut = {};
});

const fraFelt = () => screen.getByLabelText<HTMLInputElement>("timer.jobbSkjema.fra");
const tilFelt = () => screen.getByLabelText<HTMLInputElement>("timer.jobbSkjema.til");
const pauseFelt = () => screen.getByLabelText<HTMLInputElement>("timer.jobbSkjema.pause");
const timerFelt = () => screen.getByLabelText<HTMLInputElement>("timer.jobbSkjema.timer");
const skriv = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });
const tall = (v: string) => Number(v.replace(",", "."));
const feilmelding = () => screen.queryByRole("alert");

describe("O2 punkt 1 — timer redigeres i Fra–til-raden", () => {
  it("timer → Til (uten pause), lagres ved blur med lagreJobbTid", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    expect(tall(timerFelt().value)).toBe(8);
    fireEvent.focus(timerFelt());
    skriv(timerFelt(), "6");
    expect(tilFelt().value).toBe("13:00");
    fireEvent.blur(timerFelt());
    await vent();
    expect(lagreKall()).toEqual([
      {
        sti: LAGRE,
        input: { sheetId: "s1", kortId: "k2", fraTid: "07:00", tilTid: "13:00", pauseMin: 0, linjer: [{ radId: "r1", lonnsartId: "tl" }] },
      },
    ]);
    expect(tall(timerFelt().value)).toBe(6);
  });

  it("timer → Til med pause: Til = Fra + timer + pause, og timer står som skrevet", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:30", pauseMin: 30, timer: 8 })] });
    expect(tall(timerFelt().value)).toBe(8);
    fireEvent.focus(timerFelt());
    skriv(timerFelt(), "7");
    expect(tilFelt().value).toBe("14:30");
    fireEvent.blur(timerFelt());
    await vent();
    expect(lagreKall()[0]?.input).toMatchObject({ fraTid: "07:00", tilTid: "14:30", pauseMin: 30 });
    expect(tall(timerFelt().value)).toBe(7);
  });

  it("desimal med komma: 7,5 t fra 07:00 uten pause → 14:30", () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    fireEvent.focus(timerFelt());
    skriv(timerFelt(), "7,5");
    expect(tilFelt().value).toBe("14:30");
  });

  it("Til → timer regnes på nytt", () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    skriv(tilFelt(), "16:00");
    expect(tall(timerFelt().value)).toBe(9);
  });

  it("pause-endring → timer regnes på nytt, Til står", () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:30", pauseMin: 30, timer: 8 })] });
    skriv(pauseFelt(), "60");
    expect(tilFelt().value).toBe("15:30");
    expect(tall(timerFelt().value)).toBe(7.5);
  });

  it("ny jobb uten Til: timer gir Til, og raden lages", async () => {
    rendre({ ny: { fraTid: "12:00", tilTid: "", pauseMin: 0 } });
    fireEvent.focus(timerFelt());
    skriv(timerFelt(), "1");
    expect(tilFelt().value).toBe("13:00");
    fireEvent.blur(timerFelt());
    await vent();
    expect(h.kall.map((k) => k.sti)).toEqual([TILFOY, LAGRE]);
    expect(lagreKall()[0]?.input).toMatchObject({ fraTid: "12:00", tilTid: "13:00" });
  });

  it("tom Fra: ingenting regnes ut", () => {
    rendre({ ny: { fraTid: "", tilTid: "", pauseMin: 0 } });
    fireEvent.focus(timerFelt());
    skriv(timerFelt(), "4");
    expect(tilFelt().value).toBe("");
  });
});

describe("O2 punkt 2 (RETUR) — Fra/Til er klokkefelt som i timevinduet", () => {
  const klokkefelt = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="time"]'));

  it("Fra og Til er input[type=time] med 15-minutters steg; ingen datalist", () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    expect(klokkefelt()).toEqual([fraFelt(), tilFelt()]);
    for (const el of klokkefelt()) expect(el.getAttribute("step")).toBe("900");
    expect(document.querySelector("datalist")).toBeNull();
    expect(tilFelt().hasAttribute("list")).toBe(false);
  });

  for (const [runding, steg] of [[5, "300"], [30, "1800"], [60, "1800"]] as const) {
    it(`firmaets runding ${runding} min gir steg ${steg} s (maks 30 min, som timevinduets timeStep)`, () => {
      rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })], tidsrundingMinutter: runding });
      for (const el of klokkefelt()) expect(el.getAttribute("step")).toBe(steg);
    });
  }

  it("Til forlates: lagres med verdien fra klokkefeltet", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    skriv(tilFelt(), "16:00");
    fireEvent.blur(tilFelt());
    await vent();
    expect(tilFelt().value).toBe("16:00");
    expect(lagreKall()[0]?.input).toMatchObject({ fraTid: "07:00", tilTid: "16:00" });
  });

  it("rundes ved blur med firmaets tidsrunding, som timevinduet", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })], tidsrundingMinutter: 15 });
    skriv(tilFelt(), "16:08");
    fireEvent.blur(tilFelt());
    await vent();
    expect(tilFelt().value).toBe("16:15");
    expect(lagreKall()[0]?.input).toMatchObject({ tilTid: "16:15" });
  });

  it("uten firmaets runding står minuttene som valgt", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    skriv(fraFelt(), "06:50");
    fireEvent.blur(fraFelt());
    await vent();
    expect(fraFelt().value).toBe("06:50");
    expect(lagreKall()[0]?.input).toMatchObject({ fraTid: "06:50", tilTid: "15:00" });
  });

  it("Til før Fra mens det skrives gir ingen feilmelding før blur", async () => {
    rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", timer: 8 })] });
    skriv(tilFelt(), "06:00");
    expect(feilmelding()).toBeNull();
    expect(tilFelt().className).not.toContain("border-red-500");
    fireEvent.blur(tilFelt());
    await vent();
    expect(feilmelding()?.textContent).toBe("timer.jobbSkjema.feilFraForTil");
    expect(lagreKall()).toEqual([]);
    // Velger igjen: meldingen går bort til feltet forlates på nytt.
    skriv(tilFelt(), "16:00");
    expect(feilmelding()).toBeNull();
    fireEvent.blur(tilFelt());
    await vent();
    expect(feilmelding()).toBeNull();
    expect(lagreKall()[0]?.input).toMatchObject({ tilTid: "16:00" });
  });
});
