// @vitest-environment jsdom
/**
 * M1 TIMERAD-LIVSLØP — MÅLING, INGEN RETTING (ordre 2026-11-26, rapport
 * `docs/claude/maaling-timerad-livslop.md`). Klientdelen av livsløpet i `JobbSkjema`.
 *
 * Runde 1 timer (R1, R3) gjorde de røde i «ny jobb i kortet» grønne; testene er skrevet om til
 * ett-kalls-kontrakten (`tilfoyTimerRad` med `somJobb`). R2-testen står rød (`it.fails`).
 *
 * Samme trpc-proxy-mock som O2/gate 129, utvidet med (a) logg av `invalidate`-kall og (b) en
 * mutasjon som kan holdes åpen («lagrer»). Navn som starter med «RØD i dag:» feiler på f7a277d3
 * med vilje — de beskriver det Kenneth forventer og skal ikke rettes i denne leveransen.
 *
 * Kenneths bilde i prod (26.11): raden 15–18 var lagret, men kortet viste «—» og dagen 7,5 t.
 * Etter F5: 3,0 t og 10,5 t. Dagskortet regner hode og sum fra `hentMedId` (page.tsx:2470,
 * 2913–2917); de endres bare når `hentMedId` hentes på nytt.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  kall: [] as { sti: string; input: unknown }[],
  /** Mutasjoner som feiler (nøkkel = tRPC-sti). */
  feilMut: {} as Record<string, string>,
  /** Mutasjoner som holdes åpne til løftet løses (nøkkel = tRPC-sti). */
  hold: {} as Record<string, Promise<void>>,
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
          return () => ({
            mutateAsync: async (input: Record<string, unknown>) => {
              h.kall.push({ sti: key, input });
              const holdt = h.hold[key];
              if (holdt) await holdt;
              if (h.feilMut[key]) throw new Error(h.feilMut[key]);
              return { id: "ny" };
            },
            isPending: false,
          });
        }
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      // utils.timer.dagsseddel.hentMedId.invalidate(...) havner her.
      apply: (_t, _this, args: unknown[]) => {
        h.kall.push({ sti: sti.join("."), input: args[0] });
        return undefined;
      },
    });
  return { trpc: lag([]) };
});

import { JobbSkjema, type SkjemaLinje } from "./JobbSkjema";

const TL = { id: "tl", navn: "Timelønn", overtidsnivaa: null, aktiv: true, type: "ordinaer", rekkefolge: 1 };
const LAGRE = "timer.dagsseddel.lagreJobbTid";
const TILFOY = "timer.dagsseddel.tilfoyTimerRad";
const INVALIDATE = "timer.dagsseddel.hentMedId.invalidate";

type AnnenRad = { id: string; fraTid: string; tilTid: string; pauseMin: number; erReise: boolean; overtidsnivaa: number | null };
const FORMIDDAG: AnnenRad[] = [{ id: "x0", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, erReise: false, overtidsnivaa: null }];

function rendre(a: { linjer?: SkjemaLinje[]; ny?: { fraTid: string; tilTid: string; pauseMin: number }; andre?: AnnenRad[] }) {
  h.kall = [];
  const onUlagret = vi.fn();
  const { unmount } = render(
    <JobbSkjema
      sheetId="s1"
      kortId="k2"
      linjer={a.linjer ?? []}
      ny={a.ny ? { projectId: "p1", aktivitetId: "a1", byggeplassId: null, lonnsartId: "tl", ...a.ny } : undefined}
      kilde={null}
      lonnsarter={[TL]}
      velgbareLonnsarter={[TL]}
      andreRader={a.andre ?? FORMIDDAG}
      norm={7.5}
      pauseEtterTimer={4}
      fastPauseFra={null}
      datoTekst="25.11."
      projectId="p1"
      ecoId={null}
      organizationId="o1"
      rader47={[]}
      onUlagret={onUlagret}
      tidsrundingMinutter={null}
    />,
  );
  return { onUlagret, unmount };
}
const vent = () => new Promise((r) => setTimeout(r, 0));
const kallTil = (sti: string) => h.kall.filter((k) => k.sti === sti);
const tilFelt = () => screen.getByLabelText<HTMLInputElement>("timer.jobbSkjema.til");
const skriv = (el: HTMLInputElement, v: string) => fireEvent.change(el, { target: { value: v } });

afterEach(() => {
  cleanup();
  h.feilMut = {};
  h.hold = {};
});

describe("M1 vei «ny jobb i kortet» — R1 (runde 1 timer): ett kall, skjermen hentes alltid", () => {
  it("R1: kallet feiler — ingenting lagret, feilen vises, og skjermen hentes likevel på nytt", async () => {
    h.feilMut[TILFOY] = "Jobben har endret seg — last siden på nytt.";
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(vent);
    // Ny jobb = ETT kall; serveren lager raden og deler linjene i samme transaksjon.
    expect(kallTil(TILFOY)).toHaveLength(1);
    expect(kallTil(TILFOY)[0]?.input).toMatchObject({ fraTid: "15:00", tilTid: "18:00", kortId: "k2", somJobb: true });
    expect(kallTil(LAGRE)).toHaveLength(0);
    expect(screen.getByText(/Jobben har endret seg/)).toBeTruthy();
    // Før R1: invalidate bare ved suksess (målt rødt 26.11). Nå i `finally`.
    expect(kallTil(INVALIDATE)).toHaveLength(1);
  });

  it("kontroll: kallet lykkes — ett kall og skjermen hentes på nytt", async () => {
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(vent);
    expect(kallTil(TILFOY)).toHaveLength(1);
    expect(kallTil(LAGRE)).toHaveLength(0);
    expect(kallTil(INVALIDATE)).toHaveLength(1);
  });
});

describe("R1 — avmontering låser ikke opp «Send dagen»", () => {
  it("lagring feilet, skjemaet lukkes (annet kort åpnet): kortet står fortsatt som ulagret", async () => {
    h.feilMut[TILFOY] = "nettfeil";
    const { onUlagret, unmount } = rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(vent);
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", true]);
    unmount();
    // Før R1 meldte avmonteringen `false` — «Send dagen» låst opp med ulagret jobb.
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", true]);
  });

  it("skjemaet lukkes MENS lagringen pågår: lykkes den, meldes kortet lagret etterpå", async () => {
    let slipp: () => void = () => {};
    h.hold[TILFOY] = new Promise<void>((r) => {
      slipp = r;
    });
    const { onUlagret, unmount } = rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", true]);
    unmount();
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", true]);
    await act(async () => {
      slipp();
      await vent();
    });
    await act(vent);
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", false]);
    expect(kallTil(INVALIDATE)).toHaveLength(1);
  });

  it("ny jobb uten Til (ingenting å lagre): avmontering frigjør kortet som før", () => {
    const { onUlagret, unmount } = rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    unmount();
    expect(onUlagret.mock.calls.at(-1)).toEqual(["k2", false]);
  });
});

describe("R3 — overtid sier fra (JobbSkjema «Lagre jobb»)", () => {
  it("over normen og firmaet har ingen overtidsart med nivå: skjemaet sier det, med nivået", async () => {
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    await act(vent);
    const melding = screen.getByTestId("overtid-mangler-art");
    expect(melding.textContent).toContain("timer.overtidForslag.manglerArt");
    expect(melding.textContent).toContain('"nivaa":50');
  });

  it("under normen: ingen melding", async () => {
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 }, andre: [] });
    skriv(tilFelt(), "18:00");
    await act(vent);
    expect(screen.queryByTestId("overtid-mangler-art")).toBeNull();
  });
});

describe("M1 vei «endre tid i lagret jobb» (JobbSkjema: lagreJobbTid ved blur)", () => {
  // R2 er ikke i runde 1 (ordre 2026-11-26): fortsatt rød — `it.fails` holder `pnpm test` grønn
  // og slår ut den dagen R2 rettes (da skal `.fails` fjernes).
  it.fails("RØD (R2, ikke i runde 1): ny Til skrevet mens forrige lagring pågår blir verken sendt eller merket ulagret", async () => {
    let slipp: () => void = () => {};
    h.hold[LAGRE] = new Promise<void>((r) => {
      slipp = r;
    });
    const { onUlagret } = rendre({
      linjer: [{ id: "r1", fraTid: "15:00", tilTid: "18:00", pauseMin: 0, lonnsartId: "tl", timer: 3, beskrivelse: null }],
    });
    // Første endring: 18:00 → 17:00, lagring starter og henger.
    skriv(tilFelt(), "17:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    expect(kallTil(LAGRE)).toHaveLength(1);
    // Andre endring mens «lagrer»: 17:00 → 16:00. `lagreTiden` returnerer stille (JobbSkjema.tsx:330).
    skriv(tilFelt(), "16:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(async () => {
      slipp();
      await vent();
    });
    await act(vent);
    // Feltet viser 16:00. Forventet: 16:00 sendes, eller kortet står som ulagret («Send dagen» sperret).
    expect(tilFelt().value).toBe("16:00");
    const sendt16 = kallTil(LAGRE).some((k) => (k.input as { tilTid?: string }).tilTid === "16:00");
    const sisteUlagret = onUlagret.mock.calls.at(-1)?.[1] === true;
    expect(sendt16 || sisteUlagret).toBe(true);
  });
});
