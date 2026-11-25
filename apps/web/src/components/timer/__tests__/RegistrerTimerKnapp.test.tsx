// @vitest-environment jsdom
/**
 * REGISTRER-DATO (Kenneth 2026-11-25): «+ Registrer timer» fører på i dag med ett klikk, og pilen
 * «Velg dato» fører på en tidligere dag. Datoen som sendes til `opprett` er den valgte, ikke i dag
 * (Silje-tilfellet: 25.11 er sendt, hun fører 24.11). Ingen dag etter i dag.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  data: {} as Record<string, unknown>,
  kall: [] as { sti: string; input: Record<string, unknown> }[],
  push: [] as string[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (u: string) => h.push.push(u), replace: () => {}, back: () => {} }),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k),
    i18n: { language: "nb" },
  }),
}));
vi.mock("@/kontekst/byggeplass-kontekst", () => ({
  useByggeplass: () => ({ aktivByggeplass: null }),
}));
vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") {
          return (_i: unknown, opt?: { enabled?: boolean }) => ({
            data: opt?.enabled === false ? undefined : h.data[key],
          });
        }
        if (navn === "useMutation") {
          return () => ({
            mutate: (
              input: Record<string, unknown>,
              o?: { onSuccess?: (s: { id: string; eksisterte?: boolean }) => void },
            ) => {
              h.kall.push({ sti: key, input });
              o?.onSuccess?.({ id: "s1", eksisterte: false });
            },
            isPending: false,
          });
        }
        return lag([...sti, navn]);
      },
    });
  return { trpc: lag([]) };
});

import { RegistrerTimerKnapp } from "../RegistrerTimerKnapp";

function prosjektkortData() {
  h.data = {
    "timer.dagsseddel.kanFoereTimer": { kanFoere: true, firmanavn: "A.Markussen AS" },
    "organisasjon.hentArbeidstidDefaults": { timerRegistreringsmodus: "prosjektkort" },
    "timer.aktivitet.list": [{ id: "a1", navn: "Anleggsarbeid", aktiv: true }],
    "prosjekt.hentForTimer": [{ id: "p1" }],
    "bygning.hentForFirma": [],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 25, 12, 0));
  prosjektkortData();
  h.kall = [];
  h.push = [];
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const opprettKall = () => h.kall.filter((k) => k.sti === "timer.dagsseddel.opprett");

describe("RegistrerTimerKnapp — Velg dato", () => {
  it("«I dag» (hovedknappen) sender dagens dato — ett klikk, som før", () => {
    render(<RegistrerTimerKnapp organizationId="o1" projectId="p1" retur="/dashbord/p1/timer" dato="2026-11-24" />);
    fireEvent.click(screen.getByText("timer.registrerTimer"));
    expect(opprettKall()).toHaveLength(1);
    expect(opprettKall()[0]!.input.dato).toBe("2026-11-25");
    expect(opprettKall()[0]!.input.projectId).toBe("p1");
  });

  it("«Velg dato» → 24.11 sender den valgte datoen til opprett, ikke i dag (Silje-tilfellet)", () => {
    render(<RegistrerTimerKnapp organizationId="o1" projectId="p1" retur="/dashbord/p1/timer" />);
    fireEvent.click(screen.getByLabelText("timer.registrerDato.velgDato"));
    const felt = screen.getByLabelText("timer.felt.dato") as HTMLInputElement;
    expect(felt.value).toBe("2026-11-25");
    expect(felt.max).toBe("2026-11-25");
    fireEvent.change(felt, { target: { value: "2026-11-24" } });
    fireEvent.click(screen.getByText('timer.registrerDato.registrer{"dato":"24.11."}'));
    expect(opprettKall()).toHaveLength(1);
    expect(opprettKall()[0]!.input.dato).toBe("2026-11-24");
    expect(opprettKall()[0]!.input.projectId).toBe("p1");
    // Samme flyt videre: dagssiden med prosjektet og retur-adressen.
    expect(h.push[0]).toContain("/dashbord/timer/s1?registrer=1&nyttProsjekt=p1");
    expect(h.push[0]).toContain("retur=");
  });

  it("velgeren starter på `dato`-propen fra siden (uka)", () => {
    render(<RegistrerTimerKnapp organizationId="o1" projectId="p1" dato="2026-11-16" />);
    fireEvent.click(screen.getByLabelText("timer.registrerDato.velgDato"));
    expect((screen.getByLabelText("timer.felt.dato") as HTMLInputElement).value).toBe("2026-11-16");
  });

  it("en dag etter i dag kan ikke registreres", () => {
    render(<RegistrerTimerKnapp organizationId="o1" projectId="p1" />);
    fireEvent.click(screen.getByLabelText("timer.registrerDato.velgDato"));
    fireEvent.change(screen.getByLabelText("timer.felt.dato"), { target: { value: "2026-11-26" } });
    const knapp = screen.getAllByText("timer.registrerTimer").at(-1)!.closest("button")!;
    expect(knapp.disabled).toBe(true);
    fireEvent.click(knapp);
    expect(opprettKall()).toHaveLength(0);
  });

  it("dagskort-modus: uendret lenke til «Ny dagsseddel», ingen datovelger", () => {
    h.data["organisasjon.hentArbeidstidDefaults"] = { timerRegistreringsmodus: "dagskort" };
    render(<RegistrerTimerKnapp organizationId="o1" projectId="p1" />);
    expect(screen.getByText("timer.nyDagsseddel").closest("a")!.getAttribute("href")).toBe("/dashbord/timer/ny");
    expect(screen.queryByLabelText("timer.registrerDato.velgDato")).toBeNull();
  });
});
