// @vitest-environment jsdom
/**
 * O24 (vedtak-timer-web.md § Reisevinduet pkt 30): en reise ført uten oppmøtested (O22, manuell
 * modus) får merket «uten oppmøtested» i rutelinja i attesteringen. Kjennetegnet er
 * `reiseKilde = "manuell"`, `reiseOppmotestedId = null` OG en retning — eldre «+ Reise»-rader
 * (før L2, 2026-11-15) bar aldri retning og skal ikke få et falskt merke.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TimerRad } from "../attestering-buckets";

vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, p: string | symbol) => {
        if (typeof p !== "string" || p === "then") return undefined;
        if (p === "useQuery") return () => ({ data: undefined });
        return lag([...sti, p]);
      },
    });
  return { trpc: lag([]) };
});
vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ valgtFirma: { id: "org1" } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k) }),
}));

import { ReiseRadMerke, erReiseUtenOppmote } from "../ReiseRadMerke";

const rad = (over: Partial<TimerRad>): TimerRad =>
  ({
    id: "r1",
    erReise: true,
    reiseRetning: "ut",
    reiseKilde: "manuell",
    reiseOppmotestedId: null,
    reiseKjoretidMin: null,
    reiseAvstandM: null,
    byggeplassId: "b1",
    reiseRegel: {},
    ...over,
  }) as TimerRad;

describe("O24 pkt 30 — merket «uten oppmøtested»", () => {
  afterEach(cleanup);

  it("manuell reise uten oppmøtested (O22) → merket vises med forklaring", () => {
    const r = render(<ReiseRadMerke rad={rad({})} />);
    const merke = r.getByTestId("reise-uten-oppmote");
    expect(merke.textContent).toBe("timer.attestering.reise.utenOppmote");
    expect(merke.getAttribute("title")).toBe("timer.attestering.reise.utenOppmoteForklaring");
    cleanup();
    const retur = render(<ReiseRadMerke rad={rad({ reiseRetning: "retur" })} />);
    expect(retur.getByTestId("reise-uten-oppmote")).toBeTruthy();
  });

  it("reise med oppmøtested → intet merke", () => {
    const r = render(<ReiseRadMerke rad={rad({ reiseOppmotestedId: "o1", reiseKjoretidMin: 30 })} />);
    expect(r.queryByTestId("reise-uten-oppmote")).toBeNull();
    // utenByggeplass / manglende kjøretid: oppmøtestedet er kjent → intet merke.
    expect(erReiseUtenOppmote(rad({ reiseOppmotestedId: "o1", byggeplassId: null }))).toBe(false);
  });

  it("eldre «+ Reise»-rad (før L2: ingen retning) → intet merke", () => {
    const r = render(<ReiseRadMerke rad={rad({ reiseRetning: null })} />);
    expect(r.queryByTestId("reise-uten-oppmote")).toBeNull();
  });

  it("andre kilder og ikke-reise → intet merke", () => {
    expect(erReiseUtenOppmote(rad({ reiseKilde: "matrise" }))).toBe(false);
    expect(erReiseUtenOppmote(rad({ reiseKilde: "overforing" }))).toBe(false);
    expect(erReiseUtenOppmote(rad({ reiseKilde: null }))).toBe(false);
    expect(erReiseUtenOppmote(rad({ erReise: false }))).toBe(false);
  });
});
