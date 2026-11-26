// @vitest-environment jsdom
/**
 * M1 TIMERAD-LIVSLØP — MÅLING, INGEN RETTING (ordre 2026-11-26, rapport
 * `docs/claude/maaling-timerad-livslop.md`). Klientdelen av livsløpet i `JobbSkjema`.
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

function rendre(a: { linjer?: SkjemaLinje[]; ny?: { fraTid: string; tilTid: string; pauseMin: number } }) {
  h.kall = [];
  const onUlagret = vi.fn();
  render(
    <JobbSkjema
      sheetId="s1"
      kortId="k2"
      linjer={a.linjer ?? []}
      ny={a.ny ? { projectId: "p1", aktivitetId: "a1", byggeplassId: null, lonnsartId: "tl", ...a.ny } : undefined}
      kilde={null}
      lonnsarter={[TL]}
      velgbareLonnsarter={[TL]}
      andreRader={[{ id: "x0", fraTid: "07:00", tilTid: "15:00", pauseMin: 30, erReise: false, overtidsnivaa: null }]}
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
  return { onUlagret };
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

describe("M1 vei «ny jobb i kortet» (JobbSkjema: tilfoyTimerRad + lagreJobbTid)", () => {
  it("RØD i dag: kall 1 lagrer raden, kall 2 feiler — skjermen hentes ikke på nytt, så kortet viser «—» og gammel sum til F5", async () => {
    h.feilMut[LAGRE] = "Jobben har endret seg — last siden på nytt.";
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(vent);
    // Kall 1 gikk: raden 15–18 står på serveren.
    expect(kallTil(TILFOY)).toHaveLength(1);
    expect(kallTil(TILFOY)[0]?.input).toMatchObject({ fraTid: "15:00", tilTid: "18:00", kortId: "k2" });
    // Kall 2 feilet og meldes i skjemaet …
    expect(kallTil(LAGRE)).toHaveLength(1);
    expect(screen.getByText(/Jobben har endret seg/)).toBeTruthy();
    // … men `ferdig` (JobbSkjema.tsx:316–327) invaliderer bare ved suksess. Forventet: det som er
    // lagret, vises. Målt: ingen invalidate — hode og sum står på det gamle (`hentMedId`).
    expect(kallTil(INVALIDATE)).toHaveLength(1);
  });

  it("kontroll: begge kall lykkes — skjermen hentes på nytt (grønn)", async () => {
    rendre({ ny: { fraTid: "15:00", tilTid: "", pauseMin: 0 } });
    skriv(tilFelt(), "18:00");
    fireEvent.blur(tilFelt());
    await act(vent);
    await act(vent);
    expect(kallTil(TILFOY)).toHaveLength(1);
    expect(kallTil(LAGRE)).toHaveLength(1);
    expect(kallTil(INVALIDATE)).toHaveLength(1);
  });
});

describe("M1 vei «endre tid i lagret jobb» (JobbSkjema: lagreJobbTid ved blur)", () => {
  it("RØD i dag: ny Til skrevet mens forrige lagring pågår blir verken sendt eller merket ulagret", async () => {
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
