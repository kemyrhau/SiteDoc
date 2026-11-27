// @vitest-environment jsdom
/**
 * Retur 1 runde 3 timer (2026-11-27). Dagen er #7 (`testdata-dag7.ts`), dagskort-modus:
 * bøtte uten underprosjekt (r1, 7,5 t) og TILL-001 (r2, 1 t, gravemaskin G-12 1 t).
 */
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DAG7_SEDEL, dag7Data } from "./testdata-dag7";

type Kall = { sti: string; input: Record<string, unknown> };
type MutOpt = { onSuccess?: (d: unknown) => void; onError?: (e: { message: string }) => void };

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as Kall[],
  /** Mutasjoner som feiler (sti → melding). */
  feiler: {} as Record<string, string>,
}));

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
          // Kaller onSuccess/onError (hook og kall) så kjeden maskin → vare kan måles.
          return (hookOpt?: MutOpt) => ({
            mutate: (input: Record<string, unknown>, kallOpt?: MutOpt) => {
              h.kall.push({ sti: key, input });
              const feil = h.feiler[key];
              if (feil) {
                hookOpt?.onError?.({ message: feil });
                kallOpt?.onError?.({ message: feil });
              } else {
                hookOpt?.onSuccess?.({ id: "ny" });
                kallOpt?.onSuccess?.({ id: "ny" });
              }
            },
            mutateAsync: async () => ({ id: "ny" }),
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

function rendre(over: { sedel?: Record<string, unknown>; data?: Record<string, unknown> } = {}) {
  cleanup();
  h.kall = [];
  h.feiler = {};
  h.data = {
    ...dag7Data("dagskort"),
    "timer.dagsseddel.hentMedId": { ...DAG7_SEDEL, ...over.sedel },
    "modul.effektivTilstand": { maskin: true },
    ...over.data,
  };
  return render(<Side />);
}

const MENGDE_ENHET = ["timer.felt.mengde", "timer.felt.enhet"];

afterEach(cleanup);

describe(
  "Kenneth 2026-11-27: «Mengde og enhet har ingen ting å gjøre på et kort uten en tilhørende vare. " +
    "Registrering på underprosjekt er bra.»",
  () => {
    it("(a) «+ Legg til maskinbruk» i dagskortet: ingen Mengde/Enhet; underprosjekt, timerad og antall står", () => {
      rendre();
      fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyMaskin/ })[1]!);
      const vindu = screen.getByRole("dialog", { name: "timer.detalj.tilfoyMaskin" });
      for (const felt of MENGDE_ENHET) expect(vindu.textContent).not.toContain(felt);
      for (const felt of ["timer.felt.underprosjekt", "timer.felt.timerad", "timer.felt.antallTimer"]) {
        expect(vindu.textContent).toContain(felt);
      }
    });

    it("(a) blyanten på en maskin med lagret mengde: feltene vises ikke, og mengde/enhet sendes ikke (står urørt)", () => {
      const sedel = DAG7_SEDEL;
      rendre({ sedel: { maskiner: sedel.maskiner.map((m) => ({ ...m, mengde: "12", enhet: "m3" })) } });
      const blyant = screen
        .getAllByTitle("handling.rediger")
        .find((b) => b.closest("li")?.textContent?.includes("Gravemaskin G-12"));
      fireEvent.click(blyant!);
      const vindu = screen.getByRole("dialog", { name: "timer.detalj.redigerMaskinRad" });
      for (const felt of MENGDE_ENHET) expect(vindu.textContent).not.toContain(felt);
      fireEvent.change(vindu.querySelector('input[type="number"]')!, { target: { value: "0.75" } });
      const timerad = Array.from(vindu.querySelectorAll("select")).find((el) =>
        el.textContent?.includes("timer.maskinTimerad.valg"),
      )!;
      fireEvent.change(timerad, { target: { value: timerad.options[1]!.value } });
      fireEvent.submit(vindu.querySelector("form")!);
      const oppdater = h.kall.find((k) => k.sti === "timer.dagsseddel.maskin.oppdater");
      expect(oppdater?.input).toMatchObject({ timer: 0.75 });
      for (const felt of ["mengde", "enhet"]) expect(oppdater?.input).not.toHaveProperty(felt);
    });

    it("(b) maskindelen i «Legg til timer-rad»: ingen Mengde/Enhet", () => {
      rendre();
      fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyTimer/ })[0]!);
      const vindu = screen.getByRole("dialog");
      fireEvent.click(within(vindu).getByText("timer.maskinSeksjon.tittel"));
      expect(vindu.textContent).toContain("timer.felt.utstyr");
      for (const felt of MENGDE_ENHET) expect(vindu.textContent).not.toContain(felt);
    });
  },
);

/** Bøtte 2 (TILL-001, r2, 1 t) uten maskiner, så maskin 1 t er lovlig. Fyller maskinvinduet. */
function nyMaskinPaaBotte2(over: Parameters<typeof rendre>[0] = {}) {
  rendre({ ...over, sedel: { maskiner: [], ...over.sedel } });
  fireEvent.click(screen.getAllByRole("button", { name: /timer\.detalj\.tilfoyMaskin/ })[1]!);
  const vindu = screen.getByRole("dialog", { name: "timer.detalj.tilfoyMaskin" });
  fireEvent.click(within(vindu).getByRole("button", { name: /timer\.velgUtstyr/ }));
  fireEvent.click(within(vindu).getByRole("button", { name: /Gravemaskin G-12/ }));
  const timerad = Array.from(vindu.querySelectorAll("select")).find((el) =>
    el.textContent?.includes("timer.maskinTimerad.valg"),
  )!;
  fireEvent.change(timerad, { target: { value: "r2" } });
  fireEvent.change(within(vindu).getAllByRole("spinbutton")[0]!, { target: { value: "1" } });
  return vindu;
}
/** Vare-nedtrekket (valget med «Pukk 6-32»). */
const vareValg = (vindu: HTMLElement) =>
  Array.from(vindu.querySelectorAll("select")).find((s) =>
    Array.from(s.options).some((o) => o.value === "va1"),
  );
const stier = () => h.kall.map((k) => k.sti);

describe(
  "Kenneth 2026-11-27: «ved registrering av dagskort der vi styrer vare og maskin mot en timerad -> " +
    "da kan vi legge på en nedtreksmeny for å hente varer samtidig som vi registrerer maskin»",
  () => {
    it("(c) vare valgt: maskinen lagres først, så varen på maskinens timerad, underprosjekt og sedel", () => {
      const vindu = nyMaskinPaaBotte2();
      fireEvent.change(vareValg(vindu)!, { target: { value: "va1" } });
      // Mengde med varens enhet som låst tekst — ikke noe Enhet-valg.
      expect(vindu.textContent).toContain("(m3)");
      expect(vindu.textContent).not.toContain("timer.felt.enhet");
      fireEvent.change(within(vindu).getAllByRole("spinbutton")[1]!, { target: { value: "3" } });
      fireEvent.submit(vindu.querySelector("form")!);
      expect(stier()).toEqual(["timer.dagsseddel.maskin.tilfoy", "vareforbruk.opprett"]);
      expect(h.kall[0]!.input).not.toHaveProperty("mengde");
      expect(h.kall[1]!.input).toMatchObject({
        projectId: "p1",
        vareId: "va1",
        antall: 3,
        externalCostObjectId: "e1",
        dagsseddelId: "s1",
        sheetTimerId: "r2",
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("(c) uten vare: bare maskinen lagres", () => {
      const vindu = nyMaskinPaaBotte2();
      fireEvent.submit(vindu.querySelector("form")!);
      expect(stier()).toEqual(["timer.dagsseddel.maskin.tilfoy"]);
    });

    it("(d) uten Varelager på prosjektet: ingen vare-nedtrekk; heller ikke ved redigering av en maskin", () => {
      const vindu = nyMaskinPaaBotte2({
        data: { "vareforbruk.katalogForFirma": { varer: [], prosjektIderMedVarelager: [] } },
      });
      expect(vareValg(vindu)).toBeUndefined();
      expect(vindu.textContent).not.toContain("vareforbruk.felt.vare");
      rendre();
      const blyant = screen
        .getAllByTitle("handling.rediger")
        .find((b) => b.closest("li")?.textContent?.includes("Gravemaskin G-12"));
      fireEvent.click(blyant!);
      const rediger = screen.getByRole("dialog", { name: "timer.detalj.redigerMaskinRad" });
      expect(vareValg(rediger)).toBeUndefined();
    });

    it("(e) varen feiler etter at maskinen er lagret: vinduet står, Lagre sender bare varen — aldri dobbel maskin", () => {
      const vindu = nyMaskinPaaBotte2();
      h.feiler["vareforbruk.opprett"] = "Feil fra server";
      fireEvent.change(vareValg(vindu)!, { target: { value: "va1" } });
      fireEvent.change(within(vindu).getAllByRole("spinbutton")[1]!, { target: { value: "3" } });
      fireEvent.submit(vindu.querySelector("form")!);
      const åpent = screen.getByRole("dialog");
      expect(åpent.textContent).toContain("timer.maskinVare.vareFeilet");
      delete h.feiler["vareforbruk.opprett"];
      fireEvent.submit(åpent.querySelector("form")!);
      expect(stier()).toEqual([
        "timer.dagsseddel.maskin.tilfoy",
        "vareforbruk.opprett",
        "vareforbruk.opprett",
      ]);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  },
);
