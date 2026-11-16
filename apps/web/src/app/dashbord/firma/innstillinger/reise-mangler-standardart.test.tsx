// @vitest-environment jsdom
/**
 * Ordre 2026-11-14 (11) C: Firmainnstillinger → Reise viser en varsellinje med
 * lenke når terskelen er i bruk (en side = «arbeidstid») og firmaet mangler
 * standard ordinær lønnsart. Ingen toast/banner — en linje i seksjonen.
 */
import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown> }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {} }),
  usePathname: () => "/dashbord/firma/innstillinger",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: "nb" } }),
}));

vi.mock("@/kontekst/firma-kontekst", () => ({
  useFirma: () => ({ valgtFirma: { id: "org1", name: "Test AS" }, isLoading: false }),
}));

vi.mock("@/components/layout/SonetonetSidehode", () => ({
  SonetonetSidehode: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, navn: string) => {
        const key = sti.join(".");
        if (navn === "useQuery") return () => ({ data: h.data[key], isLoading: false, refetch: () => {} });
        if (navn === "useMutation") return () => ({ mutate: () => {}, isPending: false });
        if (navn === "useUtils") return () => lag([]);
        return lag([...sti, navn]);
      },
      apply: () => undefined,
    });
  return { trpc: lag([]) };
});

import FirmaInnstillinger from "./page";

const SETTING = {
  reiseTerskelMin: 30,
  reiseTerskelEnhet: "minutter",
  reiseTerskelM: null,
  reiseUnderTerskelType: "arbeidstid",
  reiseOverTerskelType: "reisetid",
  reiseLonnsartId: "lr",
  reiseLonnsartMatchAntall: 1,
  reiseGrenser: [],
};

function rendre({
  standard,
  setting = SETTING,
  timer = true,
}: {
  standard: boolean;
  setting?: typeof SETTING;
  timer?: boolean;
}) {
  h.data = {
    "organisasjon.hentMedId": {
      id: "org1",
      name: "Test AS",
      organizationNumber: null,
      invoiceAddress: null,
      invoiceEmail: null,
      ehfEnabled: false,
    },
    "organisasjon.hentSetting": setting,
    "modul.effektivTilstand": { timer },
    "organisasjon.hentReiseForutsetninger": { oppmotesteder: 1, parManglerAvstand: 0, parTotalt: 0, uoppnaaelige: [], byggeplasserMangler: [] },
    "timer.lonnsart.list": [
      { id: "l1", navn: "Ordinær", aktiv: true, erStandardvalg: standard, type: "ordinaer" },
      { id: "lr", navn: "Reise", aktiv: true, erStandardvalg: false, type: "ordinaer" },
    ],
  };
  render(<FirmaInnstillinger />);
}

describe("Firmainnstillinger → Reise — mangler standard lønnsart (C)", () => {
  afterEach(cleanup);

  it("terskel i bruk + ingen standardart → varsellinje med lenke til lønnsartene", () => {
    rendre({ standard: false });
    const linje = screen.getByTestId("reise-mangler-standardart");
    expect(linje.textContent).toContain("firma.innstillinger.reise.manglerStandardArt");
    const lenke = linje.querySelector("a");
    expect(lenke?.getAttribute("href")).toBe("/dashbord/firma/timer/lonnsarter");
    expect(lenke?.textContent).toBe("firma.innstillinger.reise.settStandardArt");
  });

  it("negativkontroll: standardart finnes → ingen linje", () => {
    rendre({ standard: true });
    expect(screen.queryByTestId("reise-mangler-standardart")).toBeNull();
  });

  it("terskel ikke i bruk (begge reisetid) → ingen linje", () => {
    rendre({ standard: false, setting: { ...SETTING, reiseUnderTerskelType: "reisetid" } });
    expect(screen.queryByTestId("reise-mangler-standardart")).toBeNull();
  });

  it("Timer-modulen av → ingen linje", () => {
    rendre({ standard: false, timer: false });
    expect(screen.queryByTestId("reise-mangler-standardart")).toBeNull();
  });
});
