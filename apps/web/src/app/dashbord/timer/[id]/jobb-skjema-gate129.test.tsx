// @vitest-environment jsdom
/**
 * Plan § 8.22 L3a, gate 129 — `JobbSkjema` rendret direkte (egen trpc-proxy-mock).
 *   V1: tiden flyttes helt over normen → linje 1 lagres (og vises) med firmaets overtidsart;
 *       et bytte av lønnsart på uendret tid beholdes.
 *   V2: regnet linjedeling ≠ lagrede linjer → kortet står som ulagret, «Prøv igjen» kaller
 *       `lagreJobbTid` på raden som finnes; ny jobb husker rad-id-en fra kall 1.
 * Dagen: norm 7,5 t, pause etter 4 t. Lønnsarter: Timelønn (tl) og Overtid 50 % (ot).
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
    />,
  );
  return { onUlagret };
}
const vent = () => new Promise((r) => setTimeout(r, 0));
const lagreKall = () => h.kall.filter((k) => k.sti === LAGRE);
const sisteUlagret = (f: ReturnType<typeof vi.fn>) => f.mock.calls.at(-1)?.[1];

afterEach(() => {
  cleanup();
  h.feilMut = {};
});

describe("gate 129 V1 — hel overtid på eksisterende jobb", () => {
  const dagensFoerste = [{ fraTid: "07:00", tilTid: "15:00", pauseMin: 30 }];

  it("Til flyttes så hele jobben er over normen → nedtrekk og lagring viser overtidsarten", async () => {
    rendre({ linjer: [linje({ fraTid: "16:00", tilTid: "17:00", timer: 1 })], andre: dagensFoerste });
    fireEvent.change(screen.getByLabelText("timer.jobbSkjema.til"), { target: { value: "18:00" } });
    expect(screen.getByLabelText<HTMLSelectElement>("timer.jobbSkjema.lonnsart").value).toBe("ot");
    fireEvent.blur(screen.getByLabelText("timer.jobbSkjema.til"));
    await vent();
    expect(lagreKall()).toEqual([
      {
        sti: LAGRE,
        input: { sheetId: "s1", kortId: "k2", fraTid: "16:00", tilTid: "18:00", pauseMin: 0, linjer: [{ radId: "r1", lonnsartId: "ot" }] },
      },
    ]);
  });

  it("bytte til timelønn på uendret tid beholdes", async () => {
    rendre({ linjer: [linje({ fraTid: "16:00", tilTid: "18:00", timer: 2, lonnsartId: "ot" })], andre: dagensFoerste });
    const art = screen.getByLabelText<HTMLSelectElement>("timer.jobbSkjema.lonnsart");
    fireEvent.change(art, { target: { value: "tl" } });
    expect(art.value).toBe("tl");
    fireEvent.blur(art);
    await vent();
    expect(lagreKall()[0]?.input.linjer).toEqual([{ radId: "r1", lonnsartId: "tl" }]);
  });
});

describe("gate 129 V2 — regnet linjedeling ≠ lagrede linjer", () => {
  it("én lagret linje der skjemaet regner overtid → ulagret, «Prøv igjen» lagrer raden som finnes", async () => {
    // Andre rad 07:00–11:00 (4 t); jobben 11:00–15:30 uten pause = 4,5 t → 3,5 t normal + 1 t overtid.
    const { onUlagret } = rendre({
      linjer: [linje({ fraTid: "11:00", tilTid: "15:30", timer: 4.5 })],
      andre: [{ fraTid: "07:00", tilTid: "11:00", pauseMin: 0 }],
    });
    expect(screen.getByTestId("overtid-linje")).toBeTruthy();
    expect(screen.getByTestId("ikke-lagret")).toBeTruthy();
    expect(sisteUlagret(onUlagret)).toBe(true);
    expect(h.kall).toEqual([]);

    fireEvent.click(screen.getByText("timer.jobbSkjema.provIgjen"));
    await vent();
    expect(lagreKall()).toEqual([
      {
        sti: LAGRE,
        input: { sheetId: "s1", kortId: "k2", fraTid: "11:00", tilTid: "15:30", pauseMin: 0, linjer: [{ radId: "r1", lonnsartId: "tl" }] },
      },
    ]);
  });

  it("lagrede linjer som stemmer → ikke ulagret", () => {
    const { onUlagret } = rendre({ linjer: [linje({ fraTid: "07:00", tilTid: "15:00", pauseMin: 30, timer: 7.5 })] });
    expect(screen.queryByTestId("ikke-lagret")).toBeNull();
    expect(sisteUlagret(onUlagret)).toBe(false);
  });

  it("ny jobb: kall 2 feiler → «Prøv igjen» tar bare kall 2 med rad-id-en fra kall 1", async () => {
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 }, andre: [{ fraTid: "07:00", tilTid: "15:00", pauseMin: 30 }] });
    h.feilMut[LAGRE] = "nettfeil";
    const til = screen.getByLabelText("timer.jobbSkjema.til");
    fireEvent.change(til, { target: { value: "16:00" } });
    fireEvent.blur(til);
    await vent();
    expect(h.kall.map((k) => k.sti)).toEqual([TILFOY, LAGRE]);
    expect(screen.getByTestId("ikke-lagret")).toBeTruthy();

    delete h.feilMut[LAGRE];
    fireEvent.click(screen.getByText("timer.jobbSkjema.provIgjen"));
    await vent();
    expect(h.kall.map((k) => k.sti)).toEqual([TILFOY, LAGRE, LAGRE]);
    expect(h.kall[2]?.input.linjer).toEqual([{ radId: "ny", lonnsartId: "ot" }]);
  });
});
