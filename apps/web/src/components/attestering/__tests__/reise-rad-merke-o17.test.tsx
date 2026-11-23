// @vitest-environment jsdom
/**
 * O17 (vedtak-timer-web.md § Reisevinduet pkt 21): reisemerket på attestant-raden viser
 * «{fra-kontor} → {til-kontor}» for en reise mellom to kontorer. Før O17 ble `til` null (ingen
 * byggeplass) og merket viste bare fra-kontoret.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { TimerRad } from "../attestering-buckets";

const data: Record<string, unknown> = {
  "oppmotested.hentForFirma": [{ id: "kt", navn: "Tromsø" }, { id: "kn", navn: "Narvik kontor" }],
  "bygning.hentForFirma": [{ id: "b1", name: "Blokk A" }],
};
vi.mock("@/lib/trpc", () => {
  const lag = (sti: string[]): unknown =>
    new Proxy(() => {}, {
      get: (_m, p: string | symbol) => {
        if (typeof p !== "string" || p === "then") return undefined;
        if (p === "useQuery") return () => ({ data: data[sti.join(".")] });
        return lag([...sti, p]);
      },
    });
  return { trpc: lag([]) };
});
vi.mock("@/kontekst/firma-kontekst", () => ({ useFirma: () => ({ valgtFirma: { id: "org1" } }) }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o ? `${k}${JSON.stringify(o)}` : k) }),
}));

import { ReiseRadMerke } from "../ReiseRadMerke";

const rad = (over: Partial<TimerRad>): TimerRad =>
  ({ id: "r1", erReise: true, reiseRetning: "ut", reiseKilde: "overforing", reiseOppmotestedId: "kt", byggeplassId: null, reiseKjoretidMin: 230, ...over }) as TimerRad;

describe("O17 pkt 21 — ReiseRadMerke", () => {
  afterEach(cleanup);

  it("kontor ↔ kontor: «Tromsø → Narvik kontor»", () => {
    const { container } = render(
      <ReiseRadMerke
        rad={rad({
          reiseRegel: { overforing: { fra: { type: "kontor", oppmotestedId: "kt" }, til: { type: "kontor", oppmotestedId: "kn" }, periodeId: "p1" } },
        })}
      />,
    );
    expect(container.textContent).toContain("Tromsø → Narvik kontor");
  });

  it("vakt: vanlig ut-reise kontor → byggeplass er uendret «Tromsø → Blokk A»", () => {
    const { container } = render(<ReiseRadMerke rad={rad({ reiseKilde: "matrise", byggeplassId: "b1", reiseRegel: {} })} />);
    expect(container.textContent).toContain("Tromsø → Blokk A");
  });
});
