// @vitest-environment jsdom
/**
 * O26 A (Kenneth 2026-11-26): «Vis timer for alle prosjekter, ingen filter.ikke bland vis timer
 * med regler for registrering av timer.»
 * Timerlista åpnet fra prosjekt Y viser alle brukerens dagssedler i uka — også en sedel som bare
 * har rader på prosjekt X. «Registrer timer» beholder prosjekt Y som forslag.
 *
 * `dagsseddel.list` er mocket som serveren (`dagsseddel.ts` `list`): sendes `projectId`, kommer
 * bare sedler med minst én rad på prosjektet.
 */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  listeInput: [] as Record<string, unknown>[],
  registrer: [] as Record<string, unknown>[],
}));

const SEDLER = [
  {
    id: "sedel-x",
    dato: "2026-11-25",
    status: "draft",
    totaltimer: 7.5,
    antallRader: 1,
    aktivitet: { id: "a1", navn: "Arbeid", kode: null },
    prosjektIder: ["prosjekt-x"],
  },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, back: () => {} }),
  useParams: () => ({ prosjektId: "prosjekt-y" }),
  useSearchParams: () => new URLSearchParams("uke=2026-11-23"),
  usePathname: () => "/dashbord/prosjekt-y/timer",
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));

vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ valgtFirma: { id: "org-1" } }),
}));

vi.mock("@/hooks/useToppbarFiltre", () => ({ useToppbarFiltre: () => {} }));

vi.mock("@/components/layout/SonetonetSidehode", () => ({
  SonetonetSidehode: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/timer/RegistrerTimerKnapp", () => ({
  RegistrerTimerKnapp: (p: Record<string, unknown>) => {
    h.registrer.push(p);
    return <button type="button">registrer</button>;
  },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    timer: {
      dagsseddel: {
        list: {
          useQuery: (input: Record<string, unknown>) => {
            h.listeInput.push(input);
            const pid = input.projectId as string | undefined;
            return {
              data: pid ? SEDLER.filter((s) => s.prosjektIder.includes(pid)) : SEDLER,
              isLoading: false,
            };
          },
        },
      },
    },
  },
}));

import Side from "./page";

afterEach(cleanup);

describe("O26 A — timerlista viser alle prosjekter", () => {
  it("sedel med bare rader på prosjekt X vises i lista åpnet fra prosjekt Y", () => {
    h.listeInput = [];
    render(<Side />);
    expect(screen.queryByText("timer.ingenSedler")).toBeNull();
    expect(screen.getByText("Arbeid")).toBeTruthy();
    expect(h.listeInput.every((i) => !("projectId" in i))).toBe(true);
  });

  it("vakt: «Registrer timer» beholder prosjektet som forslag", () => {
    h.registrer = [];
    render(<Side />);
    expect(h.registrer.at(-1)?.projectId).toBe("prosjekt-y");
  });
});
